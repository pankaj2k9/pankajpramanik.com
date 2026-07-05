import Redis from "ioredis";

/**
 * Lazily-created shared Redis client. Returns null when REDIS_URL is not
 * set, so callers can fall back to an in-process implementation. Survives
 * dev hot-reloads via a global singleton.
 */
const globalForRedis = globalThis as unknown as { redis?: Redis | null };

export function getRedis(): Redis | null {
  if (globalForRedis.redis !== undefined) return globalForRedis.redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    globalForRedis.redis = null;
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
    // don't crash the app if Redis is briefly unavailable
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });

  globalForRedis.redis = client;
  return client;
}
