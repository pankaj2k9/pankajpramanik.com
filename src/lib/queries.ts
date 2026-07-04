import { prisma } from "@/lib/prisma";
import { cache } from "react";

/**
 * Read-side data access used by public pages. Wrapped in React cache()
 * so a request that needs the same data in generateMetadata and the
 * page body only hits the database once.
 */

export const getPublishedPosts = cache(async (categorySlug?: string) =>
  prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      ...(categorySlug ? { categories: { some: { slug: categorySlug } } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    include: { categories: true, tags: true },
  })
);

export const getPostBySlug = cache(async (slug: string) =>
  prisma.post.findUnique({
    where: { slug },
    include: { categories: true, tags: true, author: true },
  })
);

export const getRelatedPosts = cache(async (postId: string, categorySlugs: string[]) =>
  prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      id: { not: postId },
      categories: { some: { slug: { in: categorySlugs } } },
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
    include: { categories: true },
  })
);

export const getCategoriesWithCounts = cache(async () =>
  prisma.category.findMany({
    where: { posts: { some: { status: "PUBLISHED" } } },
    include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
    orderBy: { name: "asc" },
  })
);

export const getPublishedProjects = cache(async () =>
  prisma.project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ featured: "desc" }, { order: "asc" }],
  })
);

export const getFeaturedProjects = cache(async (take = 4) =>
  prisma.project.findMany({
    where: { status: "PUBLISHED", featured: true },
    orderBy: { order: "asc" },
    take,
  })
);

export const getProjectBySlug = cache(async (slug: string) =>
  prisma.project.findUnique({ where: { slug } })
);

export const getExperiences = cache(async () =>
  prisma.experience.findMany({ orderBy: [{ order: "asc" }] })
);

export const getSkillGroups = cache(async () =>
  prisma.skillGroup.findMany({ orderBy: { order: "asc" } })
);

export const getEducation = cache(async () =>
  prisma.education.findMany({ orderBy: { order: "asc" } })
);

export const getCertifications = cache(async () =>
  prisma.certification.findMany({ orderBy: { order: "asc" } })
);

export const getTestimonials = cache(async () =>
  prisma.testimonial.findMany({ orderBy: { order: "asc" } })
);

export const getPageBySlug = cache(async (slug: string) =>
  prisma.page.findUnique({ where: { slug } })
);
