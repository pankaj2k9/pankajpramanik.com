import Link from "next/link";
import { getPublishedProjects } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { ALL_PROJECT_TAGS, projectTags } from "@/lib/project-tags";
import PageHero from "@/components/inner/PageHero";
import SectionHead from "@/components/inner/SectionHead";
import PageCTA from "@/components/inner/PageCTA";
import PageMotion from "@/components/motion/PageMotion";
import ProjectExplorer, { type ExplorerProject } from "@/components/inner/ProjectExplorer";
import Counter from "@/components/site/Counter";

export const revalidate = 300;

export const metadata = pageMetadata(
  "Projects & Case Studies",
  "Explore AI applications, data engineering, MLOps, and full-stack projects. Filter by category or technology and inspect each project's approach and evidence.",
  "/portfolio",
);

const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "work", label: "Projects" },
  { id: "contact", label: "Contact" },
];

export default async function PortfolioPage() {
  const projects = await getPublishedProjects();
  const explorerProjects: ExplorerProject[] = projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    tagline: p.tagline,
    description: p.description,
    techStack: p.techStack,
    category: p.category,
    repoUrl: p.repoUrl,
    liveUrl: p.liveUrl,
    tags: projectTags(p),
  }));
  const counts = new Map<string, number>();
  for (const p of explorerProjects)
    for (const t of p.tags) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  const filters = [
    { id: "all", label: "All", count: explorerProjects.length },
    ...ALL_PROJECT_TAGS.filter((t) => counts.get(t.id)).map((t) => ({
      id: t.id,
      label: t.label,
      count: counts.get(t.id) ?? 0,
    })),
  ];
  const technologies = new Set(explorerProjects.flatMap((p) => p.techStack));

  return (
    <>
      <PageHero
        index="04"
        label="Projects"
        tone="blue"
        lines={["Systems built", "for real problems."]}
        lead={
          <p>
            AI applications, data pipelines, automation and full-stack builds —
            with the technical context and source links available for each.
          </p>
        }
      >
        <dl className="ip-stats pj-stats">
          <div>
            <dd>
              <Counter value={explorerProjects.length} />
            </dd>
            <dt>Published projects</dt>
          </div>
          <div>
            <dd>
              <Counter value={filters.length - 1} />
            </dd>
            <dt>Categories</dt>
          </div>
          <div>
            <dd>
              <Counter value={technologies.size} />
            </dd>
            <dt>Technologies used</dt>
          </div>
        </dl>
        <div className="ip-actions pj-hero-actions">
          <a className="hm-button" href="#work" data-hm-magnetic>
            Browse the work <span aria-hidden>↓</span>
          </a>
          <a className="hm-link" href={site.github} target="_blank" rel="noopener noreferrer">
            Explore my GitHub <span aria-hidden>↗</span>
          </a>
        </div>
      </PageHero>

      <section id="work" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="01"
            label="Selected work"
            title={["Ideas made", "tangible."]}
            intro="Filter by what the system does. Each card opens a case study with the architecture, stack and links."
          />
          {explorerProjects.length ? (
            <ProjectExplorer projects={explorerProjects} filters={filters} />
          ) : (
            <p className="hm-intro">
              Project stories are being prepared.{" "}
              <Link className="hm-link" href="/contact">
                Ask about relevant work <span aria-hidden>→</span>
              </Link>
            </p>
          )}
        </div>
      </section>

      <PageCTA
        label="Next step"
        lines={["Have a similar challenge?", "Let’s build something useful."]}
        copy="Tell me what you’re trying to ship and where it’s stuck. I’ll share how I’d approach it and what the first step looks like."
        cta="Start a conversation"
      />
      <PageMotion steps={STEPS} />
    </>
  );
}
