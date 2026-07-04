import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPostBySlug, getRelatedPosts } from "@/lib/queries";
import { renderContent, readingTimeMinutes } from "@/lib/content";
import { formatDate } from "@/lib/utils";
import { absoluteUrl, site } from "@/lib/site";
import { PostCard } from "@/components/site/cards";

export const revalidate = 300;

export async function generateStaticParams() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.status !== "PUBLISHED") return {};

  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt.slice(0, 160);

  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: absoluteUrl(`/blog/${post.slug}`),
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.status !== "PUBLISHED") notFound();

  const html = renderContent(post.content, post.contentFormat);
  const minutes = readingTimeMinutes(post.content, post.contentFormat);
  const related = await getRelatedPosts(
    post.id,
    post.categories.map((c) => c.slug)
  );

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription ?? post.excerpt,
    image: post.coverImage ? [absoluteUrl(post.coverImage)] : undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: site.name, url: site.url },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };

  return (
    <article className="container-site py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <div className="mx-auto max-w-3xl">
        <nav className="text-sm text-faint" aria-label="Breadcrumb">
          <Link href="/blog" className="hover:text-accent">
            ← Back to blog
          </Link>
        </nav>

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-faint">
            {post.categories.map((c) => (
              <Link
                key={c.id}
                href={`/blog?category=${c.slug}`}
                className="rounded-full border border-border px-3 py-0.5 text-xs text-accent hover:border-accent"
              >
                {c.name}
              </Link>
            ))}
            <time dateTime={post.publishedAt?.toISOString()}>
              {formatDate(post.publishedAt)}
            </time>
            <span aria-hidden>·</span>
            <span>{minutes} min read</span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
            {post.title}
          </h1>
        </header>

        {post.coverImage && (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl border border-border">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        )}

        <div
          className="prose-content mt-10"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {post.tags.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-2 border-t border-border pt-8">
            {post.tags.map((t) => (
              <li
                key={t.id}
                className="rounded-md border border-border bg-surface-raised px-2.5 py-1 text-xs text-muted"
              >
                #{t.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {related.length > 0 && (
        <aside className="mx-auto mt-20 max-w-5xl">
          <h2 className="font-display text-2xl font-bold">Related posts</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </aside>
      )}
    </article>
  );
}
