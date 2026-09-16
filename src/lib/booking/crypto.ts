import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Secrets for bookings: unguessable manage tokens, short references and
 * AES-256-GCM encryption for OAuth tokens stored in the database.
 */

function key(): Buffer {
  const secret = process.env.BOOKING_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("BOOKING_ENCRYPTION_KEY (or AUTH_SECRET) must be set to store calendar tokens.");
  return createHash("sha256").update(`booking-oauth:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** 256-bit URL-safe token used in public manage links. */
export const newBookingToken = () => randomBytes(32).toString("base64url");

const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I

export function newReference(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return `PKP-${out}`;
}

/** Cheap shape check before hitting the database with a token. */
export const looksLikeToken = (token: string) => /^[A-Za-z0-9_-]{40,60}$/.test(token);
