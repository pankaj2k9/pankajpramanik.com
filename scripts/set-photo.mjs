/**
 * Replace the site portrait everywhere.
 *
 * Copies the image into storage/uploads/YYYY/MM/DD/ as an optimized square
 * JPEG (JPEG rather than WebP so social/structured-data consumers accept it)
 * and points `photo` in src/lib/site.ts at it. Every page — homepage hero,
 * about page, JSON-LD — reads site.photo. The previous file is kept, since
 * storage never deletes media.
 *
 * Usage: npm run photo -- <path-to-image> [--dry-run]
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const input = args.find((a) => !a.startsWith("--"));

if (!input || !fs.existsSync(input)) {
  console.error("Usage: npm run photo -- <path-to-image> [--dry-run]");
  process.exit(1);
}

const now = new Date();
const dir = [
  String(now.getFullYear()),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
];
const storageDir = path.resolve(process.env.STORAGE_DIR || path.join(ROOT, "storage"));
const outDir = path.join(storageDir, "uploads", ...dir);
const fileName = "pankaj-kumar-pramanik-portrait.jpg";
const url = `/uploads/${dir.join("/")}/${fileName}`;

const meta = await sharp(input).metadata();
fs.mkdirSync(outDir, { recursive: true });
// Square crop biased to the top, so a head-and-shoulders shot keeps the face.
const info = await sharp(input)
  .rotate()
  .resize(1080, 1080, { fit: "cover", position: "attention" })
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(path.join(outDir, fileName));
console.log(`✓ ${meta.width}×${meta.height} → storage${url} (${Math.round(info.size / 1024)} KB)`);

const siteFile = path.join(ROOT, "src", "lib", "site.ts");
const source = fs.readFileSync(siteFile, "utf8");
const updated = source.replace(/(\n\s*photo:\s*)"[^"]*"/, `$1"${url}"`);
if (updated === source && !source.includes(`"${url}"`)) {
  console.error("Could not find `photo:` in src/lib/site.ts — update it by hand.");
  process.exit(1);
}
if (dryRun) {
  console.log(`(dry run) would set site.photo = "${url}"`);
} else {
  fs.writeFileSync(siteFile, updated);
  console.log(`✓ site.photo = "${url}" (homepage, about page, structured data)`);
}
