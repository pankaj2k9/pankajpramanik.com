/**
 * Import prisma/content/snapshot.json into the database in DATABASE_URL, making
 * its content tables mirror the snapshot. Users and contact messages are never
 * touched.
 *
 * Runs on every production deploy (bundled to scripts/content-import.cjs in the
 * image). It is a no-op when the snapshot hash matches the last import, so
 * edits made in the production admin survive until a NEW snapshot is exported
 * locally and deployed — at which point the snapshot wins.
 *
 * Usage: npm run content:import [-- --force]
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import {
  hashSnapshot,
  loadEnv,
  SNAPSHOT_VERSION,
  snapshotPath,
  SYNC_ID,
  type Snapshot,
} from "./snapshot";

loadEnv();
const prisma = new PrismaClient();
const force = process.argv.includes("--force");

/**
 * Makes sure the admin from ADMIN_EMAIL exists, so a fresh production database
 * needs no separate seed step. An existing admin's password is never changed.
 */
async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) return null;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    console.warn("ADMIN_PASSWORD missing or under 12 characters — admin user not created.");
    return null;
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME || "Admin",
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
    },
  });
  console.log(`✓ created admin user ${email}`);
  return user;
}

async function main() {
  const file = snapshotPath();
  if (!fs.existsSync(file)) {
    console.log(`No content snapshot at ${file} — nothing to import.`);
    return;
  }
  const raw = fs.readFileSync(file, "utf8");
  const hash = hashSnapshot(raw);
  const s = JSON.parse(raw) as Snapshot;
  if (s.version !== SNAPSHOT_VERSION)
    throw new Error(`Unsupported snapshot version ${s.version}`);

  const last = await prisma.contentSync.findUnique({ where: { id: SYNC_ID } });
  if (last?.hash === hash && !force) {
    console.log(`Content snapshot ${hash.slice(0, 12)} already imported — skipping.`);
    return;
  }

  const admin = await ensureAdmin();
  const users = new Map(
    (await prisma.user.findMany({ select: { id: true, email: true } })).map((u) => [u.email, u.id]),
  );

  await prisma.$transaction(
    async (tx) => {
      // Stale posts go first: a post renamed locally keeps its unique wpId, and
      // the old row would otherwise collide with it on create.
      await tx.post.deleteMany({ where: { slug: { notIn: s.posts.map((p) => p.slug) } } });
      for (const c of s.categories)
        await tx.category.upsert({ where: { slug: c.slug }, update: c, create: c });
      for (const t of s.tags)
        await tx.tag.upsert({ where: { slug: t.slug }, update: t, create: t });

      for (const { authorEmail, categories, tags, ...p } of s.posts) {
        const authorId = (authorEmail && users.get(authorEmail)) || admin?.id || null;
        const data = {
          ...p,
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
          createdAt: new Date(p.createdAt),
          authorId,
        };
        await tx.post.upsert({
          where: { slug: p.slug },
          update: {
            ...data,
            categories: { set: categories.map((slug) => ({ slug })) },
            tags: { set: tags.map((slug) => ({ slug })) },
          },
          create: {
            ...data,
            categories: { connect: categories.map((slug) => ({ slug })) },
            tags: { connect: tags.map((slug) => ({ slug })) },
          },
        });
      }
      await tx.category.deleteMany({ where: { slug: { notIn: s.categories.map((c) => c.slug) } } });
      await tx.tag.deleteMany({ where: { slug: { notIn: s.tags.map((t) => t.slug) } } });

      for (const p of s.projects) {
        const data = { ...p, createdAt: new Date(p.createdAt) };
        await tx.project.upsert({ where: { slug: p.slug }, update: data, create: data });
      }
      await tx.project.deleteMany({ where: { slug: { notIn: s.projects.map((p) => p.slug) } } });

      for (const p of s.pages)
        await tx.page.upsert({ where: { slug: p.slug }, update: p, create: p });
      await tx.page.deleteMany({ where: { slug: { notIn: s.pages.map((p) => p.slug) } } });

      for (const g of s.skillGroups)
        await tx.skillGroup.upsert({ where: { category: g.category }, update: g, create: g });
      await tx.skillGroup.deleteMany({
        where: { category: { notIn: s.skillGroups.map((g) => g.category) } },
      });

      // No natural key — replace wholesale.
      await tx.experience.deleteMany();
      await tx.experience.createMany({
        data: s.experiences.map((e) => ({
          ...e,
          startDate: new Date(e.startDate),
          endDate: e.endDate ? new Date(e.endDate) : null,
          createdAt: new Date(e.createdAt),
        })),
      });
      await tx.education.deleteMany();
      await tx.education.createMany({ data: s.education });
      await tx.certification.deleteMany();
      await tx.certification.createMany({ data: s.certifications });
      await tx.testimonial.deleteMany();
      await tx.testimonial.createMany({ data: s.testimonials });

      await tx.contentSync.upsert({
        where: { id: SYNC_ID },
        update: { hash },
        create: { id: SYNC_ID, hash },
      });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  console.log(
    `✓ imported content snapshot ${hash.slice(0, 12)}: ${s.posts.length} posts, ` +
      `${s.projects.length} projects, ${s.pages.length} pages, ${s.experiences.length} experiences`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
