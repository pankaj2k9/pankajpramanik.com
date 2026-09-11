import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/site/cards";
import { getCategoriesWithCounts, getPublishedPosts } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Articles on AI engineering, LLM/RAG systems, MLOps, data engineering, and full-stack development.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [posts, categories] = await Promise.all([
    getPublishedPosts(category),
    getCategoriesWithCounts(),
  ]);

  return (
    <div className="container-site py-16">
      <header className="max-w-2xl">
        <p className="micro-label">
          Blog
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Writing on AI, data &amp; engineering
        </h1>
        <p className="mt-4 text-lg text-muted">
          Deep dives into LLM/RAG systems, MLOps, cloud architecture, and the
          craft of building production software.
        </p>
      </header>

      <div className="mt-10 flex flex-wrap gap-2">
        <Link
          href="/blog"
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors",
            !category
              ? "border-accent-strong bg-accent-strong/15 text-accent"
              : "border-border text-muted hover:text-foreground"
          )}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/blog?category=${c.slug}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              category === c.slug
                ? "border-accent-strong bg-accent-strong/15 text-accent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {c.name}{" "}
            <span className="text-faint">({c._count.posts})</span>
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="mt-16 text-muted">No posts found.</p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
