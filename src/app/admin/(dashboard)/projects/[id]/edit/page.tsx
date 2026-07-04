import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectForm from "@/components/admin/ProjectForm";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Edit project</h1>
      <p className="mt-1 text-sm text-faint">/{project.slug}</p>
      <div className="mt-6">
        <ProjectForm project={project} />
      </div>
    </div>
  );
}
