/**
 * Export all authored content from the database in DATABASE_URL (normally the
 * local one) into prisma/content/snapshot.json. Commit the file; the deploy
 * workflow imports it into production.
 *
 * Also checks that every /uploads/… file the content references exists in
 * storage/uploads, so a deploy never ships a broken image.
 *
 * Usage: npm run content:export
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, SNAPSHOT_VERSION, snapshotPath, type Snapshot } from "./snapshot";

loadEnv();
const prisma = new PrismaClient();

const strip = <T extends Record<string, unknown>, K extends string>(row: T, keys: K[]) => {
  const out = { ...row };
  for (const k of keys) delete out[k];
  return out as Omit<T, K>;
};

async function main() {
  const [categories, tags, posts, projects, pages, skillGroups, experiences, education, certifications, testimonials] =
    await Promise.all([
      prisma.category.findMany({ orderBy: { slug: "asc" } }),
      prisma.tag.findMany({ orderBy: { slug: "asc" } }),
      prisma.post.findMany({
        orderBy: { slug: "asc" },
        include: {
          author: { select: { email: true } },
          categories: { select: { slug: true }, orderBy: { slug: "asc" } },
          tags: { select: { slug: true }, orderBy: { slug: "asc" } },
        },
      }),
      prisma.project.findMany({ orderBy: { slug: "asc" } }),
      prisma.page.findMany({ orderBy: { slug: "asc" } }),
      prisma.skillGroup.findMany({ orderBy: { category: "asc" } }),
      prisma.experience.findMany({ orderBy: [{ order: "asc" }, { startDate: "desc" }] }),
      prisma.education.findMany({ orderBy: { order: "asc" } }),
      prisma.certification.findMany({ orderBy: { order: "asc" } }),
      prisma.testimonial.findMany({ orderBy: { order: "asc" } }),
    ]);

  const snapshot: Snapshot = {
    version: SNAPSHOT_VERSION,
    categories: categories.map((r) => strip(r, ["id"])),
    tags: tags.map((r) => strip(r, ["id"])),
    posts: posts.map(({ author, categories, tags, ...p }) => ({
      ...strip(p, ["id", "updatedAt", "authorId"]),
      authorEmail: author?.email ?? null,
      categories: categories.map((c) => c.slug),
      tags: tags.map((t) => t.slug),
    })),
    projects: projects.map((r) => strip(r, ["id", "updatedAt"])),
    pages: pages.map((r) => strip(r, ["id", "updatedAt"])),
    skillGroups: skillGroups.map((r) => strip(r, ["id"])),
    experiences: experiences.map((r) => strip(r, ["id", "updatedAt"])),
    education: education.map((r) => strip(r, ["id"])),
    certifications: certifications.map((r) => strip(r, ["id"])),
    testimonials: testimonials.map((r) => strip(r, ["id"])),
  };

  const raw = JSON.stringify(snapshot, null, 2) + "\n";
  const file = snapshotPath();
  const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, raw);

  const counts = Object.entries(snapshot)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `${k}=${(v as unknown[]).length}`)
    .join(" ");
  console.log(`✓ wrote ${path.relative(process.cwd(), file)} (${counts})`);
  console.log(previous === raw ? "  unchanged since last export" : "  content changed — commit it to deploy");

  // Every referenced local media file must exist in storage.
  const uploads = path.resolve(process.env.STORAGE_DIR || "storage", "uploads");
  const refs = new Set(
    [...raw.matchAll(/\/uploads\/([^"'\s)<>?#\\]+)/g)].map((m) => decodeURIComponent(m[1])),
  );
  const missing = [...refs].filter((r) => !fs.existsSync(path.join(uploads, r)));
  if (missing.length) {
    console.warn(`⚠ ${missing.length} referenced media file(s) missing from ${uploads}:`);
    for (const m of missing) console.warn(`  /uploads/${m}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ all ${refs.size} referenced media files present in storage/uploads`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
