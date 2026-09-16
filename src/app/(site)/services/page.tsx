import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { getPublishedProjects, getServices } from "@/lib/queries";
import { serviceGroups } from "@/lib/service-catalog";
import { projectTags, splitTitle } from "@/lib/project-tags";
import PageHero from "@/components/inner/PageHero";
import SectionHead from "@/components/inner/SectionHead";
import PageCTA from "@/components/inner/PageCTA";
import ServiceExplorer from "@/components/inner/ServiceExplorer";
import PageMotion from "@/components/motion/PageMotion";
import SystemVisual from "@/components/home/SystemVisual";

export const revalidate = 300;

export const metadata = pageMetadata(
  "AI, Data & Automation Services",
  "Practical AI engineering, document retrieval, data pipelines, MLOps, and workflow automation. Find the right service and discuss a clear project scope.",
  "/services",
);

const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "explorer", label: "Explorer" },
  { id: "capabilities", label: "All services" },
  { id: "contact", label: "Contact" },
];

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const [{ area }, services, projects] = await Promise.all([
    searchParams,
    getServices(),
    getPublishedProjects(),
  ]);
  const serviceMap = Object.fromEntries(
    services.map((s) => [s.slug, { slug: s.slug, label: s.label, summary: s.summary }]),
  );
  const tagged = projects.map((p) => ({ p, tags: projectTags(p).map((t) => t.id) }));
  const relatedByGroup = Object.fromEntries(
    serviceGroups.map((g) => [
      g.id,
      tagged
        .filter(({ tags }) => g.projectTags.includes(tags[0]))
        .slice(0, 3)
        .map(({ p }) => ({ slug: p.slug, name: splitTitle(p.title).name, tag: g.label })),
    ]),
  );
  const initial = Math.max(0, serviceGroups.findIndex((g) => g.id === area));
  const grouped = new Set(serviceGroups.flatMap((g) => g.serviceSlugs));
  const ungrouped = services.filter((s) => !grouped.has(s.slug));

  return (
    <>
      <PageHero
        index="03"
        label="Services"
        tone="blue"
        lines={["From raw data", "to working intelligence."]}
        lead={
          <p>
            Bring a business problem, an early prototype or a system that needs
            to improve. I design and build the data pipelines, AI applications
            and integrations that connect your tools to your goals.
          </p>
        }
        visual={
          <div className="sv-hero-card ip-card" data-hm-pointer>
            <div className="sv-hero-art">
              <SystemVisual kind="pipeline" />
            </div>
            <ol className="sv-hero-flow">
              {["Data", "Intelligence", "Automation", "Production"].map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        }
      >
        <div className="ip-actions">
          <a className="hm-button" href="#explorer" data-hm-magnetic>
            Explore services <span aria-hidden>↓</span>
          </a>
          <Link className="hm-link" href="/portfolio">
            See the work <span aria-hidden>→</span>
          </Link>
        </div>
      </PageHero>

      <section id="explorer" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="01"
            label="Service explorer"
            title={["Eight ways in.", "One connected system."]}
            intro="Pick an area to see the problems it solves, what you get, the tools involved and related work."
          />
          <div data-hm="up">
            <ServiceExplorer
              groups={serviceGroups}
              services={serviceMap}
              projects={relatedByGroup}
              initial={initial}
            />
          </div>
        </div>
      </section>

      <section id="capabilities" className="ip-section is-tint">
        <div className="hm-container">
          <SectionHead
            index="02"
            label="All services"
            title={["Every service page,", "grouped by area."]}
          />
          <div className="sv-groups">
            {serviceGroups.map((g) => {
              const pages = g.serviceSlugs.map((s) => serviceMap[s]).filter(Boolean);
              if (!pages.length) return null;
              return (
                <div key={g.id} className={`sv-group tone-${g.tone}`} data-hm-stagger>
                  <h3 className="sv-group-title" data-hm="up">
                    <span aria-hidden />
                    {g.label}
                  </h3>
                  <div className="sv-group-cards">
                    {pages.map((s) => (
                      <Link key={s.slug} href={`/services/${s.slug}`} className="sv-card" data-hm="up">
                        <span className="sv-card-title">{s.label}</span>
                        <span className="sv-card-summary">{s.summary}</span>
                        <span className="hm-arrow" aria-hidden>
                          ↗
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
            {ungrouped.length > 0 && (
              <div className="sv-group tone-blue" data-hm-stagger>
                <h3 className="sv-group-title" data-hm="up">
                  <span aria-hidden />
                  More
                </h3>
                <div className="sv-group-cards">
                  {ungrouped.map((s) => (
                    <Link key={s.slug} href={`/services/${s.slug}`} className="sv-card" data-hm="up">
                      <span className="sv-card-title">{s.label}</span>
                      <span className="sv-card-summary">{s.summary}</span>
                      <span className="hm-arrow" aria-hidden>
                        ↗
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <PageCTA
        label="Not sure yet?"
        lines={["Not sure which service fits?", "Tell me what you’re building."]}
        copy="Describe the goal and what’s in the way. I’ll suggest where to start — even if it’s smaller than you expected."
        cta="Tell me about your project"
      />
      <PageMotion steps={STEPS} />
    </>
  );
}
