import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectBySlug, getPublishedProjects } from "@/lib/queries";
import { renderContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";
import Tabs from "@/components/site/Tabs";

export const revalidate = 300;

export async function generateStaticParams() {
  const projects = await prisma.project.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project || project.status !== "PUBLISHED") return {};
  const title = project.seoTitle ?? `${project.title} — Project`;
  const description =
    project.seoDescription ?? project.description.slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: `/portfolio/${project.slug}` },
    openGraph: {
      title,
      description: project.seoDescription ?? project.tagline,
      url: absoluteUrl(`/portfolio/${project.slug}`),
      images: project.coverImage ? [{ url: project.coverImage }] : undefined,
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project || project.status !== "PUBLISHED") notFound();

  const related = (await getPublishedProjects())
    .filter((p) => p.slug !== slug && p.category === project.category)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: project.title,
    description: project.seoDescription ?? project.description,
    codeRepository: project.repoUrl ?? undefined,
    programmingLanguage: project.techStack.join(", "),
    url: absoluteUrl(`/portfolio/${project.slug}`),
    image: project.coverImage ?? undefined,
  };

  const overview = (
    <div className="space-y-6">
      <p className="text-lg leading-relaxed text-muted">{project.description}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">
            Category
          </p>
          <p className="mt-1 font-medium">{project.category}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">
            Links
          </p>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                Source code ↗
              </a>
            )}
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                Live demo ↗
              </a>
            )}
            {!project.repoUrl && !project.liveUrl && (
              <span className="text-faint">Private project</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const techStack = (
    <ul className="flex flex-wrap gap-2">
      {project.techStack.map((t) => (
        <li
          key={t}
          className="rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm text-muted"
        >
          {t}
        </li>
      ))}
    </ul>
  );

  const tabs = [
    { label: "Overview", content: overview },
    ...(project.content
      ? [
          {
            label: "Case Study",
            content: (
              <div
                className="prose-content"
                dangerouslySetInnerHTML={{
                  __html: renderContent(project.content, project.contentFormat),
                }}
              />
            ),
          },
        ]
      : []),
    { label: "Tech Stack", content: techStack },
  ];

  return (
    <article className="container-site py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl">
        <nav className="text-sm text-faint" aria-label="Breadcrumb">
          <Link href="/portfolio" className="hover:text-accent">
            ← All projects
          </Link>
        </nav>

        <header className="mt-6">
          <p className="text-sm font-medium uppercase tracking-wider text-faint">
            {project.category}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {project.title}
          </h1>
          <p className="mt-3 text-lg text-accent">{project.tagline}</p>
        </header>

        <div className="mt-8 flex flex-wrap gap-3">
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              View Source ↗
            </a>
          )}
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border-strong px-5 py-2.5 text-sm font-semibold transition hover:border-accent hover:text-accent"
            >
              Live Demo ↗
            </a>
          )}
        </div>

        {project.coverImage && (
          <div className="relative mt-8 aspect-[2/1] overflow-hidden rounded-2xl border border-border">
            <Image
              src={project.coverImage}
              alt={project.title}
              fill
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="object-cover"
            />
          </div>
        )}

        <div className="mt-10">
          <Tabs items={tabs} />
        </div>
      </div>

      {related.length > 0 && (
        <aside className="mx-auto mt-16 max-w-4xl border-t border-border pt-10">
          <h2 className="font-display text-xl font-bold">Related projects</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {related.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/portfolio/${p.slug}`}
                  className="card card-hover block h-full p-5"
                >
                  <p className="text-xs uppercase tracking-wider text-faint">
                    {p.category}
                  </p>
                  <p className="mt-1 font-display text-sm font-semibold">
                    {p.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
