import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectBySlug } from "@/lib/queries";
import { renderContent } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: project.title,
    description: project.description,
    codeRepository: project.repoUrl ?? undefined,
    programmingLanguage: project.techStack.join(", "),
    url: absoluteUrl(`/portfolio/${project.slug}`),
  };

  return (
    <article className="container-site py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl">
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

        <div className="card mt-10 p-7">
          <h2 className="font-display text-lg font-semibold">Overview</h2>
          <p className="mt-3 leading-relaxed text-muted">
            {project.description}
          </p>
        </div>

        {project.content && (
          <div
            className="prose-content mt-8"
            dangerouslySetInnerHTML={{
              __html: renderContent(project.content, "MARKDOWN"),
            }}
          />
        )}

        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Tech stack</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {project.techStack.map((t) => (
              <li
                key={t}
                className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-muted"
              >
                {t}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}
