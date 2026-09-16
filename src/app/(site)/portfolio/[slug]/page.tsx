import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectBySlug, getPublishedProjects } from "@/lib/queries";
import { renderContent, upgradeCtaLinks } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";
import { jsonLdScript } from "@/lib/utils";
import { architectureLayers, projectTags, projectType, splitTitle } from "@/lib/project-tags";
import PageHero from "@/components/inner/PageHero";
import SectionHead from "@/components/inner/SectionHead";
import PageCTA from "@/components/inner/PageCTA";
import ArchitectureFlow from "@/components/inner/ArchitectureFlow";
import ProjectCard from "@/components/inner/ProjectCard";
import PageMotion from "@/components/motion/PageMotion";
import SystemVisual from "@/components/home/SystemVisual";
import Counter from "@/components/site/Counter";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const projects = await prisma.project.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true },
    });
    return projects.map((p) => ({ slug: p.slug }));
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
  const project = await getProjectBySlug(slug);
  if (!project || project.status !== "PUBLISHED") return {};
  const title = project.seoTitle ?? `${project.title} — Project`;
  const description =
    project.seoDescription ?? project.description.slice(0, 160);
  return {
    ...pageMetadata(title, description, `/portfolio/${project.slug}`),
    ...(project.coverImage
      ? {
          openGraph: {
            ...pageMetadata(title, description, `/portfolio/${project.slug}`)
              .openGraph,
            images: [
              {
                url: project.coverImage,
                alt: `${project.title} — project preview`,
              },
            ],
          },
          twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [project.coverImage],
          },
        }
      : {}),
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

  const tags = projectTags(project);
  const primary = tags[0];
  const { name, subtitle } = splitTitle(project.title);
  const layers = architectureLayers(project.techStack);
  const all = await getPublishedProjects();
  const related = all
    .filter((p) => p.slug !== slug)
    .map((p) => ({ p, tags: projectTags(p) }))
    .filter(({ p, tags: t }) => t[0]?.id === primary?.id || p.category === project.category)
    .slice(0, 3);
  const caseStudy = project.content
    ? upgradeCtaLinks(renderContent(project.content, project.contentFormat))
    : "";

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

  const steps = [
    { id: "intro", label: "Intro" },
    { id: "overview", label: "Overview" },
    ...(layers.length ? [{ id: "architecture", label: "Architecture" }] : []),
    { id: "stack", label: "Stack" },
    ...(caseStudy ? [{ id: "case", label: "Case study" }] : []),
    ...(related.length ? [{ id: "related", label: "Related" }] : []),
    { id: "contact", label: "Contact" },
  ];

  const facts = [
    { label: "Type", value: projectType(project) },
    { label: "Category", value: project.category },
    { label: "Focus", value: tags.map((t) => t.label).slice(0, 2).join(" · ") },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <PageHero
        index="04"
        label={`Project / ${primary?.label ?? project.category}`}
        tone={primary?.tone ?? "blue"}
        lines={[name, subtitle ?? project.tagline ?? ""]}
        visual={
          <div className="pd-visual ip-card" data-hm-pointer>
            <div className="pd-visual-art">
              <SystemVisual kind={primary?.visual ?? "workflow"} />
            </div>
            <dl className="sd-meta">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        }
        lead={<p>{project.tagline || project.description.slice(0, 220)}</p>}
      >
        <div className="ip-actions">
          {project.repoUrl && (
            <a className="hm-button" href={project.repoUrl} target="_blank" rel="noopener noreferrer" data-hm-magnetic>
              View source <span aria-hidden>↗</span>
            </a>
          )}
          {project.liveUrl && (
            <a
              className={project.repoUrl ? "hm-link" : "hm-button"}
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Live demo <span aria-hidden>↗</span>
            </a>
          )}
          <Link className="ip-back" href="/portfolio">
            <span aria-hidden>←</span> All projects
          </Link>
        </div>
      </PageHero>

      <section id="overview" className="ip-section">
        <div className="hm-container pd-overview">
          <div>
            <SectionHead index="01" label="Overview" title={["What this project is."]} />
            <div className="pd-prose" data-hm="up">
              <p>{project.description}</p>
            </div>
            <div className="pd-facts" data-hm-stagger>
              {project.problem && (
                <article className="ip-card pd-fact" data-hm="up">
                  <p className="hm-label">The problem</p>
                  <p>{project.problem}</p>
                </article>
              )}
              {project.approach && (
                <article className="ip-card pd-fact" data-hm="up">
                  <p className="hm-label">Approach</p>
                  <p>{project.approach}</p>
                </article>
              )}
              <article className="ip-card pd-fact" data-hm="up">
                <p className="hm-label">Measured outcome</p>
                <p>
                  {project.outcome && project.evidenceUrl ? (
                    <>
                      {project.outcome}{" "}
                      <a className="hm-link" href={project.evidenceUrl} target="_blank" rel="noopener noreferrer">
                        Evidence <span aria-hidden>↗</span>
                      </a>
                    </>
                  ) : (
                    "No measured outcome has been published with supporting evidence for this project."
                  )}
                </p>
              </article>
            </div>
          </div>
          <dl className="ip-stats pd-stats" data-hm="scale">
            <div>
              <dd>
                <Counter value={project.techStack.length} />
              </dd>
              <dt>Technologies</dt>
            </div>
            <div>
              <dd>
                <Counter value={layers.length} />
              </dd>
              <dt>System layers</dt>
            </div>
            <div>
              <dd>
                <Counter value={related.length} />
              </dd>
              <dt>Related projects</dt>
            </div>
          </dl>
        </div>
      </section>

      {layers.length > 0 && (
        <section id="architecture" className={`ip-section is-tint tone-${primary?.tone ?? "blue"}`}>
          <div className="hm-container sd-how">
            <div className="sd-how-aside">
              <SectionHead index="02" label="Architecture" title={["How the pieces", "fit together."]} />
              <p className="hm-intro" data-hm="up">
                Grouped from the stack recorded for this project. Scroll to walk
                the layers, or hover one for its components.
              </p>
            </div>
            <ArchitectureFlow
              label={`${name} architecture`}
              items={[
                { name: "User", detail: "Where a request or upload enters the system." },
                ...layers.map((l) => ({
                  name: l.name,
                  detail: `Handled by ${l.tools.slice(0, 3).join(", ")}${l.tools.length > 3 ? " and more" : ""}.`,
                  tools: l.tools,
                })),
              ]}
            />
          </div>
        </section>
      )}

      <section id="stack" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="03"
            label="Tech stack"
            title={["Everything it runs on."]}
            action={
              (project.repoUrl || project.liveUrl) && (
                <div className="ip-actions">
                  {project.repoUrl && (
                    <a className="hm-link" href={project.repoUrl} target="_blank" rel="noopener noreferrer">
                      Source code <span aria-hidden>↗</span>
                    </a>
                  )}
                  {project.liveUrl && (
                    <a className="hm-link" href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                      Live demo <span aria-hidden>↗</span>
                    </a>
                  )}
                </div>
              )
            }
          />
          <div className="pd-stack" data-hm-stagger>
            {layers.map((layer) => (
              <div key={layer.id} className="pd-stack-group" data-hm="up">
                <p className="hm-label">{layer.name}</p>
                <ul className="ip-chips">
                  {layer.tools.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {caseStudy && (
        <section id="case" className="ip-section is-tint">
          <div className="hm-container">
            <SectionHead index="04" label="Case study" title={["The full write-up."]} />
            <div
              className="prose-content pd-case"
              data-hm="up"
              dangerouslySetInnerHTML={{ __html: caseStudy }}
            />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section id="related" className="ip-section">
          <div className="hm-container">
            <SectionHead
              index="05"
              label="Related work"
              title={["More in this space."]}
              action={
                <Link className="hm-link" href="/portfolio">
                  All projects <span aria-hidden>→</span>
                </Link>
              }
            />
            <div className="pj-grid" data-hm-stagger>
              {related.map(({ p, tags: t }) => (
                <ProjectCard key={p.id} project={p} tags={t} />
              ))}
            </div>
          </div>
        </section>
      )}

      <PageCTA
        label="Next step"
        lines={["Building something similar?", "Let’s talk it through."]}
        copy="Tell me what you’re working on and where it gets difficult. I’ll share how this project’s approach would apply to your case."
        cta="Discuss your project"
      />
      <PageMotion steps={steps} />
    </>
  );
}
