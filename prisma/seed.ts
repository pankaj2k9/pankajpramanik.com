/**
 * Seed the database with:
 *  1. The initial admin user (from ADMIN_EMAIL / ADMIN_PASSWORD env vars)
 *  2. All content migrated from the WordPress site
 *     (migration/extracted/*.json produced by migration/extract.mjs)
 *
 * Idempotent: uses upserts keyed on unique fields, safe to re-run.
 *
 * Usage: npm run db:seed
 */
import { PrismaClient, ContentFormat, ContentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

// Use local configuration when present; CI can supply variables directly.
try { process.loadEnvFile(); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const prisma = new PrismaClient();

const EXTRACTED = path.join(__dirname, "..", "migration", "extracted");
const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(EXTRACTED, file), "utf8"));

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, passwordHash, role: "ADMIN" },
  });
  console.log(`✓ admin user: ${user.email}`);
  return user;
}

async function seedTaxonomy() {
  const categories = readJson<
    { name: string; slug: string; description: string }[]
  >("categories.json");
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description },
      create: { name: c.name, slug: c.slug, description: c.description },
    });
  }
  console.log(`✓ categories: ${categories.length}`);

  const tags = readJson<{ name: string; slug: string }[]>("tags.json");
  for (const t of tags) {
    await prisma.tag.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: { name: t.name, slug: t.slug },
    });
  }
  console.log(`✓ tags: ${tags.length}`);
}

async function seedPosts(authorId: string) {
  type WpPost = {
    wpId: number;
    slug: string;
    title: string;
    excerpt: string;
    contentHtml: string;
    coverImage: string | null;
    publishedAt: string;
    updatedAt: string;
    categories: string[];
    tags: string[];
    seoTitle: string | null;
    seoDescription: string | null;
  };
  const posts = readJson<WpPost[]>("posts.json");
  for (const p of posts) {
    await prisma.post.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        wpId: p.wpId,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.contentHtml,
        contentFormat: ContentFormat.HTML,
        coverImage: p.coverImage,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(p.publishedAt),
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        authorId,
        categories: { connect: p.categories.map((slug) => ({ slug })) },
        tags: { connect: p.tags.map((slug) => ({ slug })) },
      },
    });
  }
  console.log(`✓ posts: ${posts.length}`);
}

async function seedProjects() {
  type Proj = {
    slug: string;
    title: string;
    tagline: string;
    description: string; // Overview tab
    content: string; // Case Study tab (HTML)
    contentFormat: "HTML" | "MARKDOWN";
    coverImage: string | null;
    techStack: string[];
    repoUrl: string | null;
    liveUrl: string | null;
    category: string;
    featured: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
    order: number;
    problem?: string;
    approach?: string;
    outcome?: string;
    evidenceUrl?: string | null;
  };
  // Migrated from the WordPress `portfolio` custom post type
  // (migration/extract-portfolio.mjs) — rich Overview + Case Study content
  // with the original WP slugs preserved.
  const projects = readJson<Proj[]>("portfolio-projects.json");
  // full replace keeps the set in sync with the live portfolio
  await prisma.project.deleteMany();
  for (const p of projects) {
    await prisma.project.create({
      data: {
        slug: p.slug,
        title: p.title,
        tagline: p.tagline,
        description: p.description,
        content: p.content,
        contentFormat: p.contentFormat === "MARKDOWN"
          ? ContentFormat.MARKDOWN
          : ContentFormat.HTML,
        coverImage: p.coverImage,
        techStack: p.techStack,
        repoUrl: p.repoUrl,
        liveUrl: p.liveUrl,
        category: p.category,
        featured: p.featured,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        order: p.order,
        problem: p.problem ?? "",
        approach: p.approach ?? "",
        outcome: p.outcome ?? "",
        evidenceUrl: p.evidenceUrl ?? null,
        status: ContentStatus.PUBLISHED,
      },
    });
  }
  console.log(`✓ projects: ${projects.length}`);
}

async function seedExperience() {
  type Exp = {
    role: string;
    company: string;
    companyUrl: string | null;
    location: string;
    startDate: string;
    endDate: string | null;
    current: boolean;
    summary: string;
    techStack: string[];
    highlights: string[];
  };
  const experiences = readJson<Exp[]>("experiences.json");
  // No natural unique key — replace all to keep the seed idempotent.
  await prisma.experience.deleteMany();
  let order = 0;
  for (const e of experiences) {
    await prisma.experience.create({
      data: {
        ...e,
        startDate: new Date(e.startDate),
        endDate: e.endDate ? new Date(e.endDate) : null,
        order: order++,
      },
    });
  }
  console.log(`✓ experiences: ${experiences.length}`);
}

async function seedSkills() {
  const groups = readJson<{ category: string; order: number; items: string[] }[]>(
    "skills.json"
  );
  for (const g of groups) {
    await prisma.skillGroup.upsert({
      where: { category: g.category },
      update: { items: g.items, order: g.order },
      create: g,
    });
  }
  console.log(`✓ skill groups: ${groups.length}`);
}

async function seedEducationAndCerts() {
  const education = readJson<
    {
      degree: string;
      institution: string;
      startYear: number;
      endYear: number | null;
      description: string;
    }[]
  >("education.json");
  await prisma.education.deleteMany();
  let order = 0;
  for (const e of education) {
    await prisma.education.create({ data: { ...e, order: order++ } });
  }
  console.log(`✓ education: ${education.length}`);

  const certs = readJson<{ issuer: string; title: string; url?: string }[]>(
    "certifications.json"
  );
  await prisma.certification.deleteMany();
  order = 0;
  for (const c of certs) {
    await prisma.certification.create({ data: { ...c, order: order++ } });
  }
  console.log(`✓ certifications: ${certs.length}`);
}

async function seedTestimonials() {
  const testimonials = readJson<
    {
      quote: string;
      author: string;
      authorTitle: string;
      featured: boolean;
      order: number;
    }[]
  >("testimonials.json");
  await prisma.testimonial.deleteMany();
  for (const t of testimonials) {
    await prisma.testimonial.create({ data: t });
  }
  console.log(`✓ testimonials: ${testimonials.length}`);
}

async function seedPages() {
  type WpPage = {
    slug: string;
    kind: "GENERIC" | "SERVICE";
    label: string;
    summary: string;
    title: string;
    contentHtml: string;
    seoTitle: string | null;
    seoDescription: string | null;
  };
  const pages = readJson<WpPage[]>("pages.json");
  for (const p of pages) {
    const data = {
      kind: p.kind,
      label: p.label,
      summary: p.summary,
      title: p.title,
      content: p.contentHtml,
      contentFormat: ContentFormat.HTML,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
    };
    await prisma.page.upsert({
      where: { slug: p.slug },
      // keep page content in sync with the latest extraction
      update: data,
      create: { slug: p.slug, ...data },
    });
  }

  // custom AI-focused services (not from WordPress)
  type CustomPage = WpPage;
  const custom = readJson<CustomPage[]>("custom-services.json");
  for (const p of custom) {
    const data = {
      kind: p.kind,
      label: p.label,
      summary: p.summary,
      title: p.title,
      content: p.contentHtml,
      contentFormat: ContentFormat.HTML,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
    };
    await prisma.page.upsert({
      where: { slug: p.slug },
      update: data,
      create: { slug: p.slug, ...data },
    });
  }

  // remove retired WP service pages
  const retired = ["remote-angular-app-developer", "full-stack-javascript-app-developer"];
  await prisma.page.deleteMany({ where: { slug: { in: retired } } });

  console.log(`✓ pages: ${pages.length} + ${custom.length} custom, retired ${retired.length}`);
}

async function main() {
  const admin = await seedAdmin();
  await seedTaxonomy();
  await seedPosts(admin.id);
  await seedProjects();
  await seedExperience();
  await seedSkills();
  await seedEducationAndCerts();
  await seedTestimonials();
  await seedPages();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
