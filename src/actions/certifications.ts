"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const certSchema = z.object({
  title: z.string().trim().min(2).max(200),
  issuer: z.string().trim().min(2).max(120),
  url: z.string().trim().url().optional().or(z.literal("")),
  order: z.coerce.number().int().default(0),
});

export type CertFormState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return certSchema.safeParse({
    title: formData.get("title"),
    issuer: formData.get("issuer"),
    url: formData.get("url"),
    order: formData.get("order") || 0,
  });
}

function revalidateCerts() {
  revalidatePath("/experience");
  revalidatePath("/admin/certifications");
}

export async function createCertification(
  _prev: CertFormState,
  formData: FormData
): Promise<CertFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.certification.create({
    data: { ...parsed.data, url: parsed.data.url || null },
  });
  revalidateCerts();
  redirect("/admin/certifications");
}

export async function updateCertification(
  id: string,
  _prev: CertFormState,
  formData: FormData
): Promise<CertFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.certification.update({
    where: { id },
    data: { ...parsed.data, url: parsed.data.url || null },
  });
  revalidateCerts();
  redirect("/admin/certifications");
}

export async function deleteCertification(id: string) {
  await requireAdmin();
  await prisma.certification.delete({ where: { id } });
  revalidateCerts();
}
