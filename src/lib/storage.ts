import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Persistent media storage.
 *
 * All media lives under STORAGE_DIR/uploads (default: <project>/storage) and is
 * served at /uploads/* by src/app/uploads/[...path]/route.ts. In production the
 * directory is a host bind mount (/opt/pankajpramanik/storage), so nothing in it
 * is lost when the container is replaced.
 *
 * `npm start` runs the standalone server, which chdirs into .next/standalone —
 * scripts/start.mjs sets STORAGE_DIR so the default below is never wrong there.
 */
export const STORAGE_DIR = path.resolve(
  process.env.STORAGE_DIR || path.join(process.cwd(), "storage"),
);
export const UPLOADS_DIR = path.join(STORAGE_DIR, "uploads");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Upload types accepted from the admin. SVG is excluded: it can carry script. */
export const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

/** Content types for serving, keyed by extension. */
export const SERVE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
};

/**
 * Resolves URL segments to a file inside UPLOADS_DIR, or null if the result
 * would escape it.
 */
export function resolveUpload(segments: string[]): string | null {
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("\\")))
    return null;
  const file = path.resolve(UPLOADS_DIR, ...segments);
  return file.startsWith(UPLOADS_DIR + path.sep) ? file : null;
}

function safeBaseName(name: string): string {
  const base = path
    .basename(name, path.extname(name))
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "file";
}

/** Checks the file's leading bytes, since the declared type is client-supplied. */
function matchesSignature(bytes: Buffer, type: string): boolean {
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString("latin1");
  switch (type) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/gif":
      return ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a";
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "image/avif":
      return ascii(4, 8) === "ftyp" && /avi[fs]/.test(ascii(8, 12));
    case "application/pdf":
      return ascii(0, 5) === "%PDF-";
    default:
      return false;
  }
}

/**
 * Saves an uploaded file into a date-based folder (uploads/YYYY/MM/DD) and
 * returns its public URL. Names get a random suffix, so an upload never
 * overwrites an existing file.
 */
export async function saveUpload(file: File, now = new Date()): Promise<string> {
  const ext = UPLOAD_TYPES[file.type];
  if (!ext) throw new Error("Unsupported file type.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 10 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature(bytes, file.type))
    throw new Error("Unsupported file type: contents do not match.");

  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dir = path.join(UPLOADS_DIR, yyyy, mm, dd);
  const name = `${safeBaseName(file.name)}-${randomBytes(4).toString("hex")}.${ext}`;

  await mkdir(dir, { recursive: true });
  // "wx" fails instead of overwriting if the name somehow already exists.
  await writeFile(path.join(dir, name), bytes, { flag: "wx" });
  return `/uploads/${yyyy}/${mm}/${dd}/${name}`;
}
