"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";

const projectSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().max(120).optional().default(""),
  tagline: z.string().trim().max(200).optional().default(""),
  description: z.string().trim().max(2000).optional().default(""),
  content: z.string().optional().default(""),
  contentFormat: z.enum(["HTML", "MARKDOWN"]).default("HTML"),
  techStack: z.string().optional().default(""), // comma separated
  repoUrl: z.string().trim().url().optional().or(z.literal("")),
  liveUrl: z.string().trim().url().optional().or(z.literal("")),
  category: z.string().trim().max(60).optional().default("General"),
  featured: z.coerce.boolean().default(false),
  order: z.coerce.number().int().default(0),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  seoTitle: z.string().trim().max(200).optional().default(""),
  seoDescription: z.string().trim().max(300).optional().default(""),
});

export type ProjectFormState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return projectSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    content: formData.get("content"),
    contentFormat: formData.get("contentFormat"),
    techStack: formData.get("techStack"),
    repoUrl: formData.get("repoUrl"),
    liveUrl: formData.get("liveUrl"),
    category: formData.get("category"),
    featured: formData.get("featured") === "on",
    order: formData.get("order") || 0,
    status: formData.get("status"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
  });
}

function toData(d: z.infer<typeof projectSchema>, slug: string) {
  return {
    title: d.title,
    slug,
    tagline: d.tagline,
    description: d.description,
    content: d.content,
    contentFormat: d.contentFormat,
    techStack: d.techStack.split(",").map((t) => t.trim()).filter(Boolean),
    repoUrl: d.repoUrl || null,
    liveUrl: d.liveUrl || null,
    category: d.category || "General",
    featured: d.featured,
    order: d.order,
    status: d.status,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
  };
}

function revalidateProjects(slug?: string) {
  revalidatePath("/");
  revalidatePath("/portfolio");
  if (slug) revalidatePath(`/portfolio/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const slug = parsed.data.slug || slugify(parsed.data.title);
  if (await prisma.project.findUnique({ where: { slug } }))
    return { error: `Slug "${slug}" is already in use.` };

  await prisma.project.create({ data: toData(parsed.data, slug) });
  revalidateProjects(slug);
  redirect("/admin/projects");
}

export async function updateProject(
  id: string,
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const current = await prisma.project.findUnique({ where: { id } });
  if (!current) return { error: "Project not found." };

  const slug = parsed.data.slug || slugify(parsed.data.title);
  const clash = await prisma.project.findFirst({
    where: { slug, id: { not: id } },
  });
  if (clash) return { error: `Slug "${slug}" is already in use.` };

  await prisma.project.update({ where: { id }, data: toData(parsed.data, slug) });
  revalidateProjects(slug);
  if (current.slug !== slug) revalidatePath(`/portfolio/${current.slug}`);
  redirect("/admin/projects");
}

export async function deleteProject(id: string) {
  await requireAdmin();
  const project = await prisma.project.delete({ where: { id } });
  revalidateProjects(project.slug);
  revalidatePath("/admin/projects");
}
