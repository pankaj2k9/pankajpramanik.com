/**
 * Simple fixed-window in-memory rate limiter. Suitable for a single-process
 * deployment (PM2 fork mode on one droplet). Swap for a Redis-backed
 * limiter if the app ever runs on multiple instances.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
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

// Periodically drop expired entries so the map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) if (entry.resetAt < now) hits.delete(key);
}, 5 * 60_000).unref?.();
