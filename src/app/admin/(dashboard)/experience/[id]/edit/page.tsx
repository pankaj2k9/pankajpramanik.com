import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ExperienceForm from "@/components/admin/ExperienceForm";

export default async function EditExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const experience = await prisma.experience.findUnique({ where: { id } });
  if (!experience) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Edit experience</h1>
      <p className="mt-1 text-sm text-faint">
        {experience.role} — {experience.company}
      </p>
      <div className="mt-6">
        <ExperienceForm experience={experience} />
      </div>
    </div>
  );
}
