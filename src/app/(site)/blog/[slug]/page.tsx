import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getPostBySlug,
  getPublishedProjects,
  getRelatedPosts,
} from "@/lib/queries";
import { renderContent, readingTimeMinutes } from "@/lib/content";
import { formatDate, jsonLdScript, slugify } from "@/lib/utils";
import { absoluteUrl, site } from "@/lib/site";
import { projectTags, splitTitle } from "@/lib/project-tags";
import ShareButtons from "@/components/site/ShareButtons";
import Comments from "@/components/site/Comments";
import PageHero from "@/components/inner/PageHero";
import SectionHead from "@/components/inner/SectionHead";
import PageCTA from "@/components/inner/PageCTA";
import ArticleReader, { type TocItem } from "@/components/inner/ArticleReader";
import ProjectCard from "@/components/inner/ProjectCard";
import PageMotion from "@/components/motion/PageMotion";
import SystemVisual from "@/components/home/SystemVisual";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true },
    });
    return posts.map((p) => ({ slug: p.slug }));
  } catch {
    // DB unreachable at build time — pages render on demand (ISR)
    return [];
  }
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
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: absoluteUrl(`/blog/${post.slug}`),
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: [
        {
          url: post.coverImage || absoluteUrl("/opengraph-image"),
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [post.coverImage || absoluteUrl("/opengraph-image")],
    },
  };
}

/** Adds ids to h2/h3 headings and collects them for the table of contents. */
function withToc(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();
  const out = html.replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/g,
    (match, tag: string, attrs: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (!text) return match;
      let id = slugify(text) || `section-${toc.length + 1}`;
      while (used.has(id)) id = `${id}-${toc.length + 1}`;
      used.add(id);
      toc.push({ id, text, level: tag === "h2" ? 2 : 3 });
      return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
    },
  );
  return { html: out, toc };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.status !== "PUBLISHED") notFound();

  const { html, toc } = withToc(renderContent(post.content, post.contentFormat));
  const minutes = readingTimeMinutes(post.content, post.contentFormat);
  const [related, projects] = await Promise.all([
    getRelatedPosts(
      post.id,
      post.categories.map((c) => c.slug),
    ),
    getPublishedProjects(),
  ]);

  // A project worth reading next: most overlap between the post's topics and
  // the project's stack, category and title.
  const topics = [
    ...post.categories.map((c) => c.name),
    ...post.tags.map((t) => t.name),
  ].map((t) => t.toLowerCase());
  const scored = projects
    .map((p) => ({
      p,
      score: topics.filter((t) =>
        `${p.title} ${p.category} ${p.techStack.join(" ")}`.toLowerCase().includes(t),
      ).length,
    }))
    .sort((a, b) => b.score - a.score)[0];
  const relatedProject = scored && scored.score > 0 ? scored.p : null;

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

  const steps = [
    { id: "intro", label: "Intro" },
    { id: "article", label: "Article" },
    ...(related.length || relatedProject ? [{ id: "more", label: "Read next" }] : []),
    { id: "contact", label: "Contact" },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd) }}
      />
      <ArticleReader toc={toc} />
      <PageHero
        index="07"
        label={`Journal / ${post.categories[0]?.name ?? "Article"}`}
        tone="peach"
        compact
        lines={[post.title]}
        lead={<p>{post.excerpt}</p>}
        visual={
          post.coverImage ? (
            <div className="ar-cover ip-card" data-hm-pointer>
              <Image
                src={post.coverImage}
                alt=""
                fill
                priority
                sizes="(max-width: 900px) 92vw, 460px"
              />
            </div>
          ) : undefined
        }
      >
        <div className="ar-meta">
          <time dateTime={post.publishedAt?.toISOString()}>{formatDate(post.publishedAt)}</time>
          <span aria-hidden>·</span>
          <span>{minutes} min read</span>
          {post.categories.map((c) => (
            <Link key={c.id} href={`/blog?category=${c.slug}`} className="ip-chip">
              {c.name}
            </Link>
          ))}
        </div>
        <div className="ip-actions ar-actions">
          <Link className="ip-back" href="/blog">
            <span aria-hidden>←</span> All articles
          </Link>
        </div>
      </PageHero>

      <section id="article" className="ip-section ar-section">
        <div className="hm-container ar-layout">
          <article className="ar-body">
            <div className="prose-content" dangerouslySetInnerHTML={{ __html: html }} />
            {post.tags.length > 0 && (
              <ul className="ip-chips ar-tags" aria-label="Tags">
                {post.tags.map((t) => (
                  <li key={t.id}>#{t.name}</li>
                ))}
              </ul>
            )}
            <ShareButtons url={absoluteUrl(`/blog/${post.slug}`)} title={post.title} />
            <Comments postId={post.id} />
          </article>
        </div>
      </section>

      {(related.length > 0 || relatedProject) && (
        <section id="more" className="ip-section is-tint">
          <div className="hm-container">
            <SectionHead
              index="01"
              label="Read next"
              title={["Related writing", "and work."]}
              action={
                <Link className="hm-link" href="/blog">
                  All articles <span aria-hidden>→</span>
                </Link>
              }
            />
            <div className="ar-more" data-hm-stagger>
              {related.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="ip-card ar-next" data-hm="up">
                  <div className="ar-next-visual" aria-hidden>
                    <SystemVisual kind="knowledge" />
                  </div>
                  <div>
                    <p className="hm-label">{p.categories[0]?.name ?? "Article"}</p>
                    <h3>{p.title}</h3>
                    <p className="ar-next-excerpt">{p.excerpt}</p>
                  </div>
                </Link>
              ))}
              {relatedProject && (
                <ProjectCard
                  project={relatedProject}
                  tags={projectTags(relatedProject)}
                  reveal="up"
                />
              )}
            </div>
          </div>
        </section>
      )}

      <PageCTA
        label="Discuss this idea"
        lines={["Working on something", "like this?"]}
        copy={`If ${splitTitle(post.title).name} touches a problem you have, tell me about it — I’m happy to compare notes or scope the work.`}
        cta="Start a conversation"
      />
      <PageMotion steps={steps} root=".ip-main" />
    </>
  );
}
