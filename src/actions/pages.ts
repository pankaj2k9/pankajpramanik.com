"use server";

import { formError } from "@/lib/form-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const pageSchema = z.object({
  label: z.string().trim().max(120).optional().default(""),
  summary: z.string().trim().max(400).optional().default(""),
  title: z.string().trim().min(2).max(250),
  content: z.string().optional().default(""),
  contentFormat: z.enum(["HTML", "MARKDOWN"]).default("HTML"),
  seoTitle: z.string().trim().max(200).optional().default(""),
  seoDescription: z.string().trim().max(300).optional().default(""),
});

export type PageFormState = { error?: string } | undefined;

export async function updatePage(
  id: string,
  _prev: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  await requireAdmin();
  const parsed = pageSchema.safeParse({
    label: formData.get("label"),
    summary: formData.get("summary"),
    title: formData.get("title"),
    content: formData.get("content"),
    contentFormat: formData.get("contentFormat"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const page = await prisma.page.update({
      where: { id },
      data: {
        ...parsed.data,
        seoTitle: parsed.data.seoTitle || null,
        seoDescription: parsed.data.seoDescription || null,
      },
    });

    revalidatePath("/services");
    revalidatePath(`/services/${page.slug}`);
    revalidatePath(`/${page.slug}`);
    revalidatePath("/sitemap.xml");
    redirect("/admin/pages");
  } catch (error) {
    return formError(error);
  }
}
