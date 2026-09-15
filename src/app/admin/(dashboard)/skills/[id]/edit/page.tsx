import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SkillGroupForm from "@/components/admin/SkillGroupForm";

export default async function EditSkillGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const group = await prisma.skillGroup.findUnique({ where: { id } });
  if (!group) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Edit skill group</h1>
      <div className="mt-6">
        <SkillGroupForm group={group} />
      </div>
    </div>
  );
}
