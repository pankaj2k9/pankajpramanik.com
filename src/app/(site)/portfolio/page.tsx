import type { Metadata } from "next";
import { ProjectCard } from "@/components/site/cards";
import { getPublishedProjects } from "@/lib/queries";
import { site } from "@/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Selected projects and open source work — AI engineering, agentic systems, MLOps pipelines, 3D/WebGL, and full-stack applications.",
  alternates: { canonical: "/portfolio" },
};

export default async function PortfolioPage() {
  const projects = await getPublishedProjects();
  const categories = [...new Set(projects.map((p) => p.category))];

  return (
    <div className="container-site py-16">
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-4 py-1.5 text-sm font-medium text-emerald">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald" />
          Available for new projects
        </p>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Selected projects{" "}
          <span className="text-gradient">&amp; open source work</span>
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          A collection of AI engineering, agentic systems, MLOps pipelines, and
          full-stack applications — from production deployments to open-source
          experiments. More on{" "}
          <a
            href={site.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-4"
          >
            GitHub
          </a>
          .
        </p>
      </header>

      {categories.map((cat) => {
        const items = projects.filter((p) => p.category === cat);
        return (
          <section key={cat} className="mt-14">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {cat}
              <span className="ml-2 text-sm font-normal text-faint">
                {items.length} project{items.length > 1 ? "s" : ""}
              </span>
            </h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
