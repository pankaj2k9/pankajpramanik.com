/**
 * Mirror every media file listed in migration/extracted/media-manifest.json
 * from the live WordPress site into storage/uploads/, preserving the
 * wp-content/uploads/<year>/<month>/<file> path structure so rewritten
 * content URLs (/uploads/...) resolve locally.
 *
 * Usage: node migration/download-media.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "extracted/media-manifest.json"), "utf8")
);
// Media lives in persistent storage (served at /uploads/* by the app).
const PUBLIC = path.join(__dirname, "..", "storage");

const entries = Object.entries(manifest);
let ok = 0,
  failed = [];

const CONCURRENCY = 8;
async function worker(queue) {
  while (queue.length) {
    const [url, local] = queue.shift();
    const dest = path.join(PUBLIC, local.replace(/^\//, ""));
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      ok++;
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      ok++;
    } catch (e) {
      failed.push([url, e.message]);
    }
  }
}

const queue = [...entries];
await Promise.all(
  Array.from({ length: CONCURRENCY }, () => worker(queue))
);

console.log(`downloaded/present: ${ok}/${entries.length}`);
if (failed.length) {
  console.log("FAILED:");
  failed.forEach(([u, m]) => console.log(" -", u, m));
  fs.writeFileSync(
    path.join(__dirname, "extracted/media-failed.json"),
    JSON.stringify(failed, null, 2)
  );
}
