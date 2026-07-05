import { getRedis } from "@/lib/redis";

/**
 * Fixed-window rate limiter.
 *
 * Uses Redis (INCR + EXPIRE) when REDIS_URL is configured — correct across
 * multiple app instances / a horizontally-scaled deployment. Falls back to
 * an in-process Map when Redis is absent (single PM2 fork or local dev), and
 * also if a Redis call fails, so a cache outage never blocks the form.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  entry.count += 1;
  if (entry.count > limit) return { ok: false, remaining: 0 };
  return { ok: true, remaining: limit - entry.count };
}

export async function rateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): Promise<{ ok: boolean; remaining: number }> {
  const redis = getRedis();
  if (redis) {
    try {
      const redisKey = `rl:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.pexpire(redisKey, windowMs);
      }
      if (count > limit) return { ok: false, remaining: 0 };
      return { ok: true, remaining: limit - count };
    } catch {
      // fall through to in-memory on any Redis error
    }
  }
  return memoryLimit(key, limit, windowMs);
}

// Periodically drop expired in-memory entries so the map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) if (entry.resetAt < now) hits.delete(key);
}, 5 * 60_000).unref?.();
