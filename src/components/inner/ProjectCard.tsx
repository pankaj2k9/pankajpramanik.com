import Link from "next/link";
import SystemVisual from "@/components/home/SystemVisual";
import { projectType, splitTitle, type ProjectTag } from "@/lib/project-tags";

type CardProject = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  techStack: string[];
  category: string;
  repoUrl?: string | null;
  liveUrl?: string | null;
};

/** Project card in the homepage style: abstract visual, tags, stack, arrow. */
export default function ProjectCard({
  project: p,
  tags,
  reveal = "up",
  headingLevel = 3,
}: {
  project: CardProject;
  tags: ProjectTag[];
  reveal?: "up" | "left" | "right" | "scale" | false;
  headingLevel?: 2 | 3;
}) {
  const primary = tags[0];
  const { name, subtitle } = splitTitle(p.title);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Link
      href={`/portfolio/${p.slug}`}
      className={`hm-project pj-card tone-${primary?.tone ?? "blue"}`}
      data-hm={reveal || undefined}
      data-hm-pointer
      data-hm-tilt
    >
      <div className="hm-project-visual" data-cursor-label="View case study ↗">
        <SystemVisual kind={primary?.visual ?? "workflow"} />
        <span className="pj-type">{projectType(p)}</span>
      </div>
      <div className="hm-project-body">
        <div className="hm-card-meta">
          <span>{tags.slice(0, 2).map((t) => t.label).join(" · ")}</span>
          <span className="hm-arrow" aria-hidden>
            ↗
          </span>
        </div>
        <Heading>
          {name}
          {subtitle && <span>{subtitle}</span>}
        </Heading>
        <p>{p.tagline || p.description}</p>
        {p.techStack.length > 0 && (
          <ul className="hm-chips" aria-label="Technologies">
            {p.techStack.slice(0, 4).map((t) => (
              <li key={t}>{t}</li>
            ))}
            {p.techStack.length > 4 && <li>+{p.techStack.length - 4}</li>}
          </ul>
        )}
      </div>
    </Link>
  );
}
