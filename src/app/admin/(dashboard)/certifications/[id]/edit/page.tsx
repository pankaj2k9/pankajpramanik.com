import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CertificationForm from "@/components/admin/CertificationForm";

export default async function EditCertificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const cert = await prisma.certification.findUnique({ where: { id } });
  if (!cert) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Edit certification</h1>
      <div className="mt-6">
        <CertificationForm cert={cert} />
      </div>
    </div>
  );
}
