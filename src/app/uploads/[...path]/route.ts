import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { resolveUpload, SERVE_TYPES } from "@/lib/storage";

// Files are read from persistent storage at request time, never at build.
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path.map((s) => decodeURIComponent(s));
  const file = resolveUpload(segments);
  const type = file && SERVE_TYPES[path.extname(file).slice(1).toLowerCase()];
  if (!file || !type) return new Response("Not found", { status: 404 });

  let info;
  try {
    info = await stat(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!info.isFile()) return new Response("Not found", { status: 404 });

  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const headers = new Headers({
    "Content-Type": type,
    "Content-Length": String(info.size),
    "Cache-Control": "public, max-age=604800",
    "Last-Modified": info.mtime.toUTCString(),
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });
  // Legacy migrated SVGs may exist; never let one run script in our origin.
  if (type === "image/svg+xml")
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");

  if (request.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });

  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, { headers });
}
