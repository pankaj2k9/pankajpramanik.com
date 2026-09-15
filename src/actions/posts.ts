"use server";

import { formError } from "@/lib/form-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { slugSchema, coverImageSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";

const postSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: slugSchema,
  excerpt: z.string().trim().max(500).optional().default(""),
  content: z.string().optional().default(""),
  contentFormat: z.enum(["HTML", "MARKDOWN"]).default("MARKDOWN"),
  coverImage: coverImageSchema,
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  seoTitle: z.string().trim().max(200).optional().default(""),
  seoDescription: z.string().trim().max(300).optional().default(""),
  categoryIds: z.array(z.string()).optional().default([]),
  tagNames: z.string().optional().default(""), // comma separated
});

export type PostFormState = { error?: string } | undefined;

function parsePostForm(formData: FormData) {
  return postSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt"),
    content: formData.get("content"),
    contentFormat: formData.get("contentFormat"),
    coverImage: formData.get("coverImage"),
    status: formData.get("status"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    categoryIds: formData.getAll("categoryIds").map(String),
    tagNames: formData.get("tagNames"),
  });
}

async function upsertTags(tagNames: string) {
  const names = tagNames
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const tags = [];
  for (const name of names) {
    const slug = slugify(name);
    tags.push(
      await prisma.tag.upsert({
        where: { slug },
        update: {},
        create: { name, slug },
      }),
    );
  }
  return tags;
}

function revalidateBlog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function createPost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const session = await requireAdmin();
  const parsed = parsePostForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const d = parsed.data;
    const slug = d.slug || slugify(d.title);
    if (!slug || !slugSchema.safeParse(slug).success)
      return {
        error: "Enter a valid URL slug using lowercase letters and numbers.",
      };
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) return { error: `Slug "${slug}" is already in use.` };

    const tags = await upsertTags(d.tagNames);
    await prisma.post.create({
      data: {
        title: d.title,
        slug,
        excerpt: d.excerpt,
        content: d.content,
        contentFormat: d.contentFormat,
        coverImage: d.coverImage || null,
        status: d.status,
        publishedAt: d.status === "PUBLISHED" ? new Date() : null,
        seoTitle: d.seoTitle || null,
        seoDescription: d.seoDescription || null,
        authorId: session.user!.id,
        categories: { connect: d.categoryIds.map((id) => ({ id })) },
        tags: { connect: tags.map((t) => ({ id: t.id })) },
      },
    });

    revalidateBlog(slug);
    redirect("/admin/posts");
  } catch (error) {
    return formError(error);
  }
}

export async function updatePost(
  id: string,
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  await requireAdmin();
  const parsed = parsePostForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const d = parsed.data;
    const current = await prisma.post.findUnique({ where: { id } });
    if (!current) return { error: "Post not found." };

    const slug = d.slug || slugify(d.title);
    if (!slug || !slugSchema.safeParse(slug).success)
      return {
        error: "Enter a valid URL slug using lowercase letters and numbers.",
      };
    const clash = await prisma.post.findFirst({
      where: { slug, id: { not: id } },
    });
    if (clash) return { error: `Slug "${slug}" is already in use.` };

    const tags = await upsertTags(d.tagNames);
    await prisma.post.update({
      where: { id },
      data: {
        title: d.title,
        slug,
        excerpt: d.excerpt,
        content: d.content,
        contentFormat: d.contentFormat,
        coverImage: d.coverImage || null,
        status: d.status,
        publishedAt:
          d.status === "PUBLISHED"
            ? (current.publishedAt ?? new Date())
            : current.publishedAt,
        seoTitle: d.seoTitle || null,
        seoDescription: d.seoDescription || null,
        categories: { set: d.categoryIds.map((cid) => ({ id: cid })) },
        tags: { set: tags.map((t) => ({ id: t.id })) },
      },
    });

    revalidateBlog(slug);
    if (current.slug !== slug) revalidatePath(`/blog/${current.slug}`);
    redirect("/admin/posts");
  } catch (error) {
    return formError(error);
  }
}

export async function deletePost(id: string) {
  await requireAdmin();
  const post = await prisma.post.delete({ where: { id } });
  revalidateBlog(post.slug);
  revalidatePath("/admin/posts");
}
