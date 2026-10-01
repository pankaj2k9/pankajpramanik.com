import type { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

/**
 * Curated search titles and meta descriptions (prisma/content/seo.json),
 * written into the seoTitle / seoDescription columns of posts, projects and
 * pages. Used by `npm run content:seo` and at the end of `npm run db:seed`,
 * which would otherwise restore the WordPress-era values.
 */
type Entry = { title: string; description: string };
type SeoFile = {
  posts: Record<string, Entry>;
  projects: Record<string, Entry>;
  pages: Record<string, Entry>;
};

const SEO_FILE = path.join(process.cwd(), "prisma", "content", "seo.json");

/**
 * Titles up to 45 characters get " | Pankaj Pramanik" appended (brandedTitle
 * in src/lib/seo.ts); longer ones are shown alone, so must still fit.
 */
function lengthWarnings(kind: string, slug: string, { title, description }: Entry) {
  const warnings: string[] = [];
  if (title.length > 60) {
    warnings.push(`title is ${title.length} characters`);
  }
  if (description.length < 120 || description.length > 158) {
    warnings.push(`description is ${description.length} characters`);
  }
  return warnings.map((w) => `  ! ${kind}/${slug}: ${w}`);
}

export async function applySeo(prisma: PrismaClient) {
  const seo = JSON.parse(fs.readFileSync(SEO_FILE, "utf8")) as SeoFile;
  const warnings: string[] = [];
  const missing: string[] = [];
  let updated = 0;

  const tables = [
    ["posts", seo.posts, prisma.post],
    ["projects", seo.projects, prisma.project],
    ["pages", seo.pages, prisma.page],
  ] as const;

  for (const [kind, entries, table] of tables) {
    for (const [slug, entry] of Object.entries(entries)) {
      warnings.push(...lengthWarnings(kind, slug, entry));
      // updateMany: a slug missing from this database is reported, not fatal.
      const { count } = await (table as typeof prisma.post).updateMany({
        where: { slug },
        data: { seoTitle: entry.title, seoDescription: entry.description },
      });
      if (count) updated += count;
      else missing.push(`${kind}/${slug}`);
    }
  }

  console.log(`✓ seo: ${updated} records updated from prisma/content/seo.json`);
  if (missing.length) console.warn(`  slugs not in this database: ${missing.join(", ")}`);
  if (warnings.length) console.warn(warnings.join("\n"));
}
