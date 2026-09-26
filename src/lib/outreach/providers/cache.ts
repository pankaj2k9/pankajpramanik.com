import { getRedis } from "@/lib/redis";

/**
 * Response cache that enforces each source's own rate limit.
 *
 * This is a compliance control, not a performance tweak: Remotive's terms
 * allow roughly four calls a day and say excessive requests are blocked, so
 * the interval is honored even when Redis is unavailable.
 *
 * Without Redis the fallback is per-process, which is correct for the single
 * worker container that runs the agent.
 */

type Entry = { value: unknown; expiresAt: number };
const memory = new Map<string, Entry>();

function now(): number {
  return Date.now();
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const full = `outreach:cache:${key}`;
  const redis = getRedis();

  if (redis) {
    try {
      const hit = await redis.get(full);
      if (hit) return JSON.parse(hit) as T;
    } catch (error) {
      console.error("[outreach] cache read failed, falling through", error);
    }
  }

  const local = memory.get(full);
  if (local && local.expiresAt > now()) return local.value as T;

  const value = await fetcher();

  if (redis) {
    try {
      await redis.set(full, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      console.error("[outreach] cache write failed", error);
    }
  }
  memory.set(full, { value, expiresAt: now() + ttlSeconds * 1000 });
  return value;
}

/** Drops a cached response. Used by tests and by a manual dashboard refresh. */
export async function invalidate(key: string): Promise<void> {
  const full = `outreach:cache:${key}`;
  memory.delete(full);
  const redis = getRedis();
  if (redis) {
    try { await redis.del(full); } catch { /* best effort */ }
  }
}
