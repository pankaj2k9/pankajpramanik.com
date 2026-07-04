import { prisma } from "@/lib/prisma";
import PostForm from "@/components/admin/PostForm";

export default async function NewPostPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">New post</h1>
      <div className="mt-6">
        <PostForm allCategories={categories} />
      </div>
    </div>
  );
}
