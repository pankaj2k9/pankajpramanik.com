"use server";

import { formError } from "@/lib/form-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const skillGroupSchema = z.object({
  category: z.string().trim().min(2).max(100),
  items: z.string().trim().min(1), // comma separated
  order: z.coerce.number().int().default(0),
});

export type SkillFormState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return skillGroupSchema.safeParse({
    category: formData.get("category"),
    items: formData.get("items"),
    order: formData.get("order") || 0,
  });
}

function toData(d: z.infer<typeof skillGroupSchema>) {
  return {
    category: d.category,
    items: d.items
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    order: d.order,
  };
}

function revalidateSkills() {
  revalidatePath("/");
  revalidatePath("/skills");
  revalidatePath("/about");
  revalidatePath("/admin/skills");
}

export async function createSkillGroup(
  _prev: SkillFormState,
  formData: FormData,
): Promise<SkillFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const exists = await prisma.skillGroup.findUnique({
      where: { category: parsed.data.category },
    });
    if (exists) return { error: "A group with that category already exists." };

    await prisma.skillGroup.create({ data: toData(parsed.data) });
    revalidateSkills();
    redirect("/admin/skills");
  } catch (error) {
    return formError(error);
  }
}

export async function updateSkillGroup(
  id: string,
  _prev: SkillFormState,
  formData: FormData,
): Promise<SkillFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const clash = await prisma.skillGroup.findFirst({
      where: { category: parsed.data.category, id: { not: id } },
    });
    if (clash) return { error: "A group with that category already exists." };

    await prisma.skillGroup.update({
      where: { id },
      data: toData(parsed.data),
    });
    revalidateSkills();
    redirect("/admin/skills");
  } catch (error) {
    return formError(error);
  }
}

export async function deleteSkillGroup(id: string) {
  await requireAdmin();
  await prisma.skillGroup.delete({ where: { id } });
  revalidateSkills();
}
