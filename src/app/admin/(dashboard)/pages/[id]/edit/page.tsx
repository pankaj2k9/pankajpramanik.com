import { notFound } from "next/navigation";
import { marked } from "marked";
import { prisma } from "@/lib/prisma";
import PageForm from "@/components/admin/PageForm";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) notFound();

  // the WYSIWYG editor works in HTML — convert legacy markdown once
  if (page.contentFormat === "MARKDOWN" && page.content) {
    page.content = marked.parse(page.content, { async: false }) as string;
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Edit page</h1>
      <p className="mt-1 text-sm text-faint">
        {page.kind === "SERVICE" ? `/services/${page.slug}` : `/${page.slug}`}
      </p>
      <div className="mt-6">
        <PageForm page={page} />
      </div>
    </div>
  );
}
