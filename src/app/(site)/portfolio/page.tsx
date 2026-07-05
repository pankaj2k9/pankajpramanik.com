import type { Metadata } from "next";
import PortfolioGrid from "@/components/site/PortfolioGrid";
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
          experiments.
        </p>
        <a
          href={site.github}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2.5 rounded-xl bg-orange-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600 hover:shadow-orange-500/40"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a11 11 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.66.41.36.78 1.06.78 2.14 0 1.55-.02 2.79-.02 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          View My GitHub
          <span aria-hidden>→</span>
        </a>
      </header>

      <div className="mt-12">
        <PortfolioGrid projects={projects} />
      </div>
    </div>
  );
}
