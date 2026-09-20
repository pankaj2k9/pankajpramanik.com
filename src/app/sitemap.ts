import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

type Entry = { slug: string; updatedAt: Date };

/** Newest updatedAt in a set, or undefined when the set is empty. */
function latest(...groups: Entry[][]): Date | undefined {
  const times = groups.flat().map((e) => e.updatedAt.getTime());
  return times.length ? new Date(Math.max(...times)) : undefined;
}

/**
 * Content rows for the sitemap. Google reports "Couldn't fetch" for any
 * non-200, so a database hiccup must NOT take the whole sitemap down — on
 * failure we still serve the static routes.
 */
async function contentEntries() {
  try {
    const [posts, projects, services] = await Promise.all([
      prisma.post.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.project.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.page.findMany({
        where: { kind: "SERVICE" },
        select: { slug: true, updatedAt: true },
      }),
    ]);
    return { posts, projects, services };
  } catch (error) {
    console.error("[sitemap] content query failed, serving static routes", error);
    return { posts: [] as Entry[], projects: [] as Entry[], services: [] as Entry[] };
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { posts, projects, services } = await contentEntries();

  // Listing pages change when the content they list changes.
  const blogUpdated = latest(posts);
  const portfolioUpdated = latest(projects);
  const servicesUpdated = latest(services);
  const siteUpdated = latest(posts, projects, services);

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: siteUpdated, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/services"), lastModified: servicesUpdated, changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/portfolio"), lastModified: portfolioUpdated, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/experience"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/skills"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/blog"), lastModified: blogUpdated, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.6 },
    { url: absoluteUrl("/booking"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/privacy-policy"), changeFrequency: "yearly", priority: 0.3 },
  ];

  return [
    ...staticPages,
    ...posts.map((p) => ({
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...projects.map((p) => ({
      url: absoluteUrl(`/portfolio/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...services.map((s) => ({
      url: absoluteUrl(`/services/${s.slug}`),
      lastModified: s.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
