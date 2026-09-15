import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { prisma } from "@/lib/prisma";
import ProjectForm from "@/components/admin/ProjectForm";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  // the WYSIWYG editor works in HTML — convert scraped README markdown
  if (project.contentFormat === "MARKDOWN" && project.content) {
    project.content = marked.parse(project.content, { async: false }) as string;
  }

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
