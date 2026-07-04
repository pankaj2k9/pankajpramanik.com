import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { deletePost } from "@/actions/posts";
import { DeleteButton } from "@/components/admin/ui";

export default async function AdminPostsPage() {
  const posts = await prisma.post.findMany({
    orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
    include: { categories: true },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Blog posts</h1>
        <Link
          href="/admin/posts/new"
          className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + New Post
        </Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Published</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-faint">
                    /{p.slug}
                    {p.categories.length > 0 &&
                      ` · ${p.categories.map((c) => c.name).join(", ")}`}
                  </p>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.status === "PUBLISHED"
                        ? "bg-emerald/15 text-emerald"
                        : "bg-surface-raised text-muted"
                    }`}
                  >
                    {p.status.toLowerCase()}
                  </span>
                </td>
                <td className="px-5 py-3 text-muted">
                  {formatDate(p.publishedAt)}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-4">
                    {p.status === "PUBLISHED" && (
                      <Link
                        href={`/blog/${p.slug}`}
                        target="_blank"
                        className="text-sm text-muted hover:text-accent"
                      >
                        View
                      </Link>
                    )}
                    <Link
                      href={`/admin/posts/${p.id}/edit`}
                      className="text-sm text-accent hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteButton action={deletePost.bind(null, p.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
