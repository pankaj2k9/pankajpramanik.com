import { notFound } from "next/navigation";
import { marked } from "marked";
import { prisma } from "@/lib/prisma";
import PostForm from "@/components/admin/PostForm";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, categories] = await Promise.all([
    prisma.post.findUnique({
      where: { id },
      include: { categories: true, tags: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!post) notFound();

  // the WYSIWYG editor works in HTML — convert legacy markdown once
  if (post.contentFormat === "MARKDOWN" && post.content) {
    post.content = marked.parse(post.content, { async: false }) as string;
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Edit post</h1>
      <p className="mt-1 text-sm text-faint">/{post.slug}</p>
      <div className="mt-6">
        <PostForm post={post} allCategories={categories} />
      </div>
    </div>
  );
}
