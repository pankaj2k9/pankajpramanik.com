import Image from "next/image";
import Link from "next/link";
import IntelligenceExperience from "./IntelligenceExperience";
import HeroIcon from "./HeroIcons";
import HomeMotion from "./HomeMotion";
import HomeServiceFinder from "./HomeServiceFinder";
import SystemVisual, { type SystemVisualKind } from "./SystemVisual";
import { homeServices } from "@/lib/services";
import { site } from "@/lib/site";
import type { PortfolioProject } from "@/components/site/PortfolioGrid";

/** The story the page tells, shown under the service cards. */
const STORY = [
  "Data",
  "Intelligence",
  "Automation",
  "Analytics",
  "LLMOps / MLOps",
  "Business impact",
];

type Tone = "blue" | "peach" | "mint" | "orange" | "violet";
type ProjectCopy = {
  title: string;
  subtitle?: string;
  category: string;
  stack: string[];
  visual: SystemVisualKind;
  tone: Tone;
};

/** Homepage wording for featured projects whose stored titles run long. */
const PROJECT_COPY: Record<string, ProjectCopy> = {
  "journeymesh-multi-agent-ai-travel-planner-langgraph-mcp-llmops": {
    title: "JourneyMesh",
    subtitle: "Multi-Agent AI Travel Planner",
    category: "Agentic AI",
    stack: ["LangGraph", "MCP", "LLMOps"],
    visual: "agents",
    tone: "blue",
  },
  "ai-automation-engineer-n8n-gohighlevel-ai-automation-engineer": {
    title: "AI Automation Platform",
    subtitle: "Voice agents and CRM workflows",
    category: "AI Automation",
    stack: ["n8n", "GoHighLevel", "AI Voice Agents"],
    visual: "voice",
    tone: "mint",
  },
  "medical-rag-chatbot-langchain-pinecone-flask": {
    title: "Medical RAG Assistant",
    subtitle: "Grounded answers from medical knowledge",
    category: "RAG",
    stack: ["LangChain", "Pinecone", "Flask"],
    visual: "rag",
    tone: "peach",
  },
};

const FALLBACK_TONES: Tone[] = ["blue", "peach", "mint", "violet"];

function projectCopy(p: PortfolioProject, index: number) {
  const known = PROJECT_COPY[p.slug];
  const [title, subtitle] = p.title.split(/\s+[—|(]\s*/);
  const copy: ProjectCopy = known ?? {
    title,
    subtitle: subtitle?.replace(/\)$/, ""),
    category: p.category,
    stack: p.techStack.slice(0, 3),
    visual:
      p.category === "MLOps"
        ? "production"
        : p.category === "Data Engineering"
          ? "pipeline"
          : p.category === "Machine Learning"
            ? "analytics"
            : "knowledge",
    tone: FALLBACK_TONES[index % FALLBACK_TONES.length],
  };
  return { ...copy, summary: p.tagline || p.description };
}

export default function HomeExperience({
  projects,
}: {
  projects: PortfolioProject[];
}) {
  return (
    <main id="main-content" className="home-page">
      <div className="home-hero-frame" id="intro">
        <section className="home-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-cross" aria-hidden>
                ✳
              </span>{" "}
              Pankaj Pramanik / AI &amp; Data Engineer
            </p>
            <h1 id="hero-title">
              YOUR DATA.
              <br />
              REAL
              <br />
              <span className="hero-gradient">INTELLIGENCE.</span>
              <br />
              IN ACTION<span className="coral-dot">.</span>
            </h1>
            <p className="hero-description">
              I connect data, AI, and automation to build systems that make your
              work flow better.
            </p>
            <div className="hero-actions">
              <Link href="/contact" className="button-primary">
                Let’s build something <span aria-hidden>↗</span>
              </Link>
              <Link href="/portfolio" className="button-ghost">
                Explore my work <span aria-hidden>▶</span>
              </Link>
            </div>
            <div className="hero-proof">
              <Link
                href="/about"
                className="hero-avatar"
                aria-label="About Pankaj Kumar Pramanik"
              >
                <Image
                  src={site.photo}
                  alt=""
                  width={112}
                  height={112}
                  className="rounded-full"
                />
                <span className="avatar-status" aria-hidden />
              </Link>
              <dl className="hero-stats">
                <div>
                  <dt>Global experience</dt>
                  <dd>
                    8+ <span>years</span>
                  </dd>
                </div>
                <div className="stat-availability">
                  <dt>
                    <HeroIcon name="bolt" size={12} strokeWidth={2} />I can
                    start immediately
                  </dt>
                  <dd>
                    40h<span>/wk</span>
                  </dd>
                </div>
                <div>
                  <dt>Upwork • LinkedIn</dt>
                  <dd>
                    10+ <span>reviews</span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          <IntelligenceExperience />
          <div className="hero-footnote">
            <a href="#expertise">
              Scroll to discover <span aria-hidden>↓</span>
            </a>
            <span>HUMAN IDEAS. INTELLIGENT SYSTEMS.</span>
          </div>
        </section>
        <div className="tech-ribbon" aria-label="Selected tools">
          {[
            "FastAPI",
            "LangGraph",
            "n8n",
            "Cloud (AWS, GCP, Azure)",
            "DBT",
            "Snowflake",
            "BigQuery",
          ].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
      <div className="home-below">
        <section
          id="expertise"
          className="hm-section hm-services"
          aria-labelledby="expertise-title"
        >
          <div className="hm-container">
            <header className="hm-head" data-hm-stagger>
              <div>
                <p className="hm-label" data-hm="up">
                  <span>01</span> / What I do
                </p>
                <h2 id="expertise-title" className="hm-title">
                  <span className="hm-line" data-hm="up">
                    Complex challenges.
                  </span>
                  <span className="hm-line hm-line-soft" data-hm="up">
                    Thoughtful solutions.
                  </span>
                </h2>
              </div>
              <p className="hm-intro" data-hm="up">
                From the first data source to the last automated step — and on
                into production — I help turn a useful idea into a system your
                team can rely on.
              </p>
            </header>
            <div className="hm-service-grid" data-hm-stagger>
              {homeServices.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/services/${s.slug}`}
                  className={`hm-service-card tone-${s.tone}`}
                  data-hm="up"
                  data-hm-focus
                  data-hm-pointer
                >
                  <div className="hm-card-visual">
                    <SystemVisual kind={s.visual} />
                  </div>
                  <div className="hm-card-meta">
                    <span>
                      0{i + 1} / {s.label}
                    </span>
                    <span className="hm-arrow" aria-hidden>
                      ↗
                    </span>
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                  <span className="hm-card-stack">{s.technologies}</span>
                </Link>
              ))}
            </div>
            <ol
              className="hm-story"
              data-hm="up"
              aria-label="How the work connects"
            >
              {STORY.map((step, i) => (
                <li
                  key={step}
                  className={i === STORY.length - 1 ? "is-goal" : undefined}
                >
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="work"
          className="hm-section hm-work"
          aria-labelledby="work-heading"
        >
          <div className="hm-container">
            <header className="hm-head" data-hm-stagger>
              <div>
                <p className="hm-label" data-hm="up">
                  <span>02</span> / Selected work
                </p>
                <h2 id="work-heading" className="hm-title">
                  <span className="hm-line" data-hm="up">
                    Ideas made
                  </span>
                  <span className="hm-line hm-line-soft" data-hm="up">
                    tangible.
                  </span>
                </h2>
              </div>
              <Link className="hm-link" href="/portfolio" data-hm="up">
                All projects <span aria-hidden>→</span>
              </Link>
            </header>
            {projects.length ? (
              <div className="hm-project-grid" data-hm-stagger>
                {projects.slice(0, 3).map((p, i) => {
                  const copy = projectCopy(p, i);
                  return (
                    <Link
                      key={p.id}
                      href={`/portfolio/${p.slug}`}
                      className={`hm-project tone-${copy.tone}`}
                      data-hm={["left", "up", "right"][i]}
                      data-hm-pointer
                      data-hm-tilt
                    >
                      <div
                        className="hm-project-visual"
                        data-cursor-label="View project ↗"
                      >
                        <SystemVisual kind={copy.visual} />
                      </div>
                      <div className="hm-project-body">
                        <div className="hm-card-meta">
                          <span>{copy.category}</span>
                          <span className="hm-arrow" aria-hidden>
                            ↗
                          </span>
                        </div>
                        <h3>
                          {copy.title}
                          {copy.subtitle && <span>{copy.subtitle}</span>}
                        </h3>
                        <p>{copy.summary}</p>
                        <ul className="hm-chips" aria-label="Technologies">
                          {copy.stack.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="hm-intro">
                Project case studies are being prepared.{" "}
                <Link className="hm-link" href={site.github}>
                  Explore the source code on GitHub →
                </Link>
              </p>
            )}
          </div>
        </section>

        <section
          id="finder"
          className="hm-section hm-finder-section"
          aria-label="Find the right service"
        >
          <div className="hm-container">
            <HomeServiceFinder />
          </div>
        </section>

        <section
          id="contact"
          className="hm-section hm-cta"
          aria-labelledby="cta-heading"
        >
          <div className="hm-cta-glow" aria-hidden />
          <div className="hm-container hm-cta-inner" data-hm-stagger>
            <p className="hm-label" data-hm="up">
              A practical partnership
            </p>
            <h2 id="cta-heading" className="hm-title hm-cta-title">
              <span className="hm-line" data-hm="up">
                Good systems start
              </span>
              <span className="hm-line hm-line-soft" data-hm="up">
                with good conversations.
              </span>
            </h2>
            <p className="hm-cta-copy" data-hm="up">
              Tell me what’s getting in the way, what you want to build, and
              what success would look like. We’ll start with a clear scope and
              the next useful step.
            </p>
            <div data-hm="up">
              <Link
                href="/contact"
                className="hm-button hm-button-lg"
                data-hm-magnetic
              >
                Let’s talk about your idea <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>
        </section>
        <HomeMotion />
      </div>
    </main>
  );
}
