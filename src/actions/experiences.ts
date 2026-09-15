"use server";

import { formError } from "@/lib/form-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const experienceSchema = z
  .object({
    role: z.string().trim().min(2).max(150),
    company: z.string().trim().min(1).max(150),
    companyUrl: z.string().trim().url().optional().or(z.literal("")),
    location: z.string().trim().max(100).optional().default("Remote"),
    startDate: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid start month."),
    endDate: z
      .string()
      .regex(/^(?:\d{4}-(0[1-9]|1[0-2]))?$/, "Choose a valid end month.")
      .default(""),
    current: z.coerce.boolean().default(false),
    summary: z.string().trim().max(300).optional().default(""),
    techStack: z.string().optional().default(""),
    highlights: z.string().optional().default(""), // one per line
    order: z.coerce.number().int().default(0),
  })
  .refine((d) => d.current || !d.endDate || d.endDate >= d.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export type ExperienceFormState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return experienceSchema.safeParse({
    role: formData.get("role"),
    company: formData.get("company"),
    companyUrl: formData.get("companyUrl"),
    location: formData.get("location"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    current: formData.get("current") === "on",
    summary: formData.get("summary"),
    techStack: formData.get("techStack"),
    highlights: formData.get("highlights"),
    order: formData.get("order") || 0,
  });
}

function toData(d: z.infer<typeof experienceSchema>) {
  return {
    role: d.role,
    company: d.company,
    companyUrl: d.companyUrl || null,
    location: d.location || "Remote",
    startDate: new Date(`${d.startDate}-01T00:00:00Z`),
    endDate:
      d.current || !d.endDate ? null : new Date(`${d.endDate}-01T00:00:00Z`),
    current: d.current,
    summary: d.summary,
    techStack: d.techStack
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    highlights: d.highlights
      .split("\n")
      .map((h) => h.trim())
      .filter(Boolean),
    order: d.order,
  };
}

function revalidateExperience() {
  revalidatePath("/");
  revalidatePath("/experience");
  revalidatePath("/about");
}

export async function createExperience(
  _prev: ExperienceFormState,
  formData: FormData,
): Promise<ExperienceFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await prisma.experience.create({ data: toData(parsed.data) });
    revalidateExperience();
    redirect("/admin/experience");
  } catch (error) {
    return formError(error);
  }
}

export async function updateExperience(
  id: string,
  _prev: ExperienceFormState,
  formData: FormData,
): Promise<ExperienceFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await prisma.experience.update({
      where: { id },
      data: toData(parsed.data),
    });
    revalidateExperience();
    redirect("/admin/experience");
  } catch (error) {
    return formError(error);
  }
}

export async function deleteExperience(id: string) {
  await requireAdmin();
  await prisma.experience.delete({ where: { id } });
  revalidateExperience();
  revalidatePath("/admin/experience");
}
