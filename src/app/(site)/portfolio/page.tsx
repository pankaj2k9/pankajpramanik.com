import PortfolioGrid from "@/components/site/PortfolioGrid";
import { getPublishedProjects } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
export const revalidate = 300;
export const metadata = pageMetadata(
  "Projects & Case Studies",
  "Explore AI applications, data engineering, MLOps, and full-stack projects. Filter by service or technology and inspect each project's approach and evidence.",
  "/portfolio",
);
export default async function PortfolioPage() {
  const projects = await getPublishedProjects();
  return (
    <div className="container-site py-16">
      <header className="max-w-3xl">
        <p className="eyebrow">The work / Projects &amp; experiments</p>
        <h1 className="mt-5 font-display text-4xl font-medium tracking-tight sm:text-6xl">
          From an idea
          <br />
          to an implementation.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Explore how I approach AI, data, and software challenges. These
          projects include open-source experiments and application builds, with
          technical context and source links wherever available.
        </p>
        <a
          href={site.github}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link mt-3"
        >
          Explore my GitHub ↗
        </a>
      </header>
      <PortfolioGrid projects={projects} />
    </div>
  );
}
