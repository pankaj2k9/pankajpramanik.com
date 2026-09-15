import { createHmac } from "node:crypto";

/**
 * The visitor's IP, for rate limiting.
 *
 * Only trustworthy behind the production proxy: the shared Caddy sets
 * `header_up X-Forwarded-For {remote_host}`, REPLACING whatever the client
 * sent, so the first entry is the real peer. The app publishes no port of its
 * own, so requests cannot bypass that proxy.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Keyed, non-reversible IP fingerprint for storing alongside user content. */
export function hashIp(ip: string): string {
  const key = process.env.AUTH_SECRET || "ip-hash";
  return createHmac("sha256", key).update(ip).digest("hex").slice(0, 32);
}
