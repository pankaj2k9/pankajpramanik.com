import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import {
  getExperiences,
  getPublishedProjects,
  getServices,
  getSkillGroups,
} from "@/lib/queries";
import { splitTitle } from "@/lib/project-tags";
import { serviceGroups } from "@/lib/service-catalog";
import PageHero from "@/components/inner/PageHero";
import SectionHead from "@/components/inner/SectionHead";
import PageCTA from "@/components/inner/PageCTA";
import PageMotion from "@/components/motion/PageMotion";
import SkillMap, { type SkillCategory } from "@/components/inner/SkillMap";
import Counter from "@/components/site/Counter";

export const revalidate = 300;

export const metadata = pageMetadata(
  "Skills & Tech Stack",
  "Technical skills across Generative AI, LLM/RAG systems, data science, MLOps, frontend, backend, and cloud — Python, LangChain, Next.js, AWS, and more.",
  "/skills",
);

const TONES = ["blue", "peach", "mint", "orange", "violet"];
const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "map", label: "Capability map" },
  { id: "services", label: "Services" },
  { id: "contact", label: "Contact" },
];

/** Loose match, so "LLM (GPT-4, Claude)" still finds "GPT-4" in a stack. */
function usedIn(skill: string, values: string[]) {
  const s = skill.toLowerCase();
  const core = s.split(/[(/,·]/)[0].trim();
  return values.some((v) => {
    const t = v.toLowerCase();
    return t.includes(core) || core.includes(t);
  });
}

export default async function SkillsPage() {
  const [groups, services, projects, experiences] = await Promise.all([
    getSkillGroups(),
    getServices(),
    getPublishedProjects(),
    getExperiences(),
  ]);

  const categories: SkillCategory[] = groups.map((g, i) => ({
    id: g.id,
    label: g.category,
    tone: TONES[i % TONES.length],
    items: g.items.map((name) => ({
      name,
      projects: projects
        .filter((p) => usedIn(name, p.techStack))
        .slice(0, 6)
        .map((p) => ({ slug: p.slug, name: splitTitle(p.title).name })),
      roles: experiences
        .filter((e) => usedIn(name, e.techStack))
        .map((e) => e.company),
    })),
  }));
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const serviceMap = Object.fromEntries(services.map((s) => [s.slug, s]));

  return (
    <>
      <PageHero
        index="06"
        label="Skills"
        tone="mint"
        lines={["The tools behind", "the systems."]}
        lead={
          <p>
            From model training and agentic workflows to production deployment
            and cloud infrastructure. Pick a technology to see the projects and
            roles that actually use it.
          </p>
        }
      >
        <dl className="ip-stats sk-stats">
          <div>
            <dd>
              <Counter value={total} />
            </dd>
            <dt>Technologies</dt>
          </div>
          <div>
            <dd>
              <Counter value={groups.length} />
            </dd>
            <dt>Capability groups</dt>
          </div>
          <div>
            <dd>
              <Counter value={services.length} />
            </dd>
            <dt>Services they power</dt>
          </div>
        </dl>
      </PageHero>

      <section id="map" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="01"
            label="Capability map"
            title={["What I work with,", "and where it shows up."]}
            intro="No percentage bars — just the groups I work in and the evidence behind each tool."
          />
          <div data-hm="up">
            <SkillMap categories={categories} />
          </div>
        </div>
      </section>

      <section id="services" className="ip-section is-tint">
        <div className="hm-container">
          <SectionHead
            index="02"
            label="Services"
            title={["What these skills", "turn into."]}
            action={
              <Link className="hm-link" href="/services">
                All services <span aria-hidden>→</span>
              </Link>
            }
          />
          <div className="sv-groups" data-hm-stagger>
            {serviceGroups.map((g) => {
              const pages = g.serviceSlugs.map((s) => serviceMap[s]).filter(Boolean);
              if (!pages.length) return null;
              return (
                <div key={g.id} className={`sk-service tone-${g.tone}`} data-hm="up">
                  <div className="sk-service-head">
                    <span className="sk-dot" aria-hidden />
                    <h3>{g.label}</h3>
                    <Link className="hm-link" href={`/services?area=${g.id}#explorer`}>
                      Explore <span aria-hidden>→</span>
                    </Link>
                  </div>
                  <ul className="ip-chips">
                    {g.tools.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <PageCTA
        label="Put it to work"
        lines={["Need one of these", "on your project?"]}
        copy="Tell me what you’re building and which parts are unclear. I’ll say what I’d use, what I’d avoid, and why."
        cta="Let’s talk"
      />
      <PageMotion steps={STEPS} />
    </>
  );
}
