import Link from "next/link";
import IntelligenceExperience from "./IntelligenceExperience";
import HeroIcon from "./HeroIcons";
import ServiceFinder from "@/components/site/ServiceFinder";
import { servicePaths } from "@/lib/services";
import { site } from "@/lib/site";
import { Caveat } from "next/font/google";
import type { PortfolioProject } from "@/components/site/PortfolioGrid";

const handwriting = Caveat({
  subsets: ["latin"],
  weight: "500",
  variable: "--font-hand",
  display: "swap",
});

export default function HomeExperience({
  projects,
}: {
  projects: PortfolioProject[];
}) {
  return (
    <main
      id="main-content"
      className={`home-page ${handwriting.variable}`}
    >
      <div className="home-hero-frame">
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
              I connect data, AI, and automation to build systems that make
              your work flow better.
            </p>
            <div className="hero-actions">
              <Link href="/contact" className="button-primary">
                Let’s build something <span aria-hidden>↗</span>
              </Link>
              <Link href="/portfolio" className="button-ghost">
                Explore my work <span aria-hidden>▶</span>
              </Link>
            </div>
            <dl className="hero-stats">
              <div>
                <dt>8+ Years</dt>
                <dd>Global Experience</dd>
              </div>
              <div className="stat-bolt">
                <HeroIcon name="bolt" size={20} />
                <dt>
                  Start
                  <br />
                  Immediately
                </dt>
              </div>
              <div>
                <dt>40h/wk</dt>
                <dd>Availability</dd>
              </div>
              <div>
                <dt>10+</dt>
                <dd>
                  Client Reviews
                  <small>Global clients • Upwork • LinkedIn</small>
                </dd>
              </div>
            </dl>
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
          {["Python", "LangChain", "n8n", "Next.js", "AWS", "DBT"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
      <section
        id="expertise"
        className="home-section"
        aria-labelledby="expertise-title"
      >
        <div className="section-heading" data-reveal>
          <div>
            <p className="eyebrow">01 / What I do</p>
            <h2 id="expertise-title">
              Complex challenges.
              <br />
              <span>Thoughtful solutions.</span>
            </h2>
          </div>
          <p>
            From the first data source to the last automated step, I help turn a
            useful idea into a system your team can work with.
          </p>
        </div>
        <div className="service-triptych">
          {servicePaths.map((s, i) => (
            <Link
              key={s.id}
              href={`/services/${s.slug}`}
              className="service-panel"
              data-reveal
            >
              <div className={`service-art service-art-${i}`} aria-hidden>
                <i />
                <i />
                <i />
                <span>{["⊞", "✳", "↗"][i]}</span>
              </div>
              <div className="service-panel-top">
                <span>
                  0{i + 1} / {s.label}
                </span>
                <span aria-hidden>↗</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
              <span className="service-tools">{s.technologies}</span>
            </Link>
          ))}
        </div>
      </section>
      <section
        className="home-section selected-work"
        aria-labelledby="work-heading"
      >
        <div className="section-heading" data-reveal>
          <div>
            <p className="eyebrow">02 / Selected work</p>
            <h2 id="work-heading">
              Ideas made <span>tangible.</span>
            </h2>
          </div>
          <Link className="text-link" href="/portfolio">
            All projects <span aria-hidden>↗</span>
          </Link>
        </div>
        <div className="home-projects">
          {projects.length ? (
            projects.slice(0, 3).map((p, i) => (
              <Link
                href={`/portfolio/${p.slug}`}
                key={p.id}
                className="home-project"
                data-reveal
              >
                <div className={`project-diagram diagram-${i}`} aria-hidden>
                  <span>
                    {p.category === "Data Engineering"
                      ? "DATA → PIPELINE → INSIGHT"
                      : p.category === "MLOps"
                        ? "TRAIN → TRACK → DEPLOY"
                        : "CONNECT → REASON → ACT"}
                  </span>
                  <div>
                    <i />
                    <i />
                    <i />
                  </div>
                  <span>{p.techStack.slice(0, 3).join(" / ")}</span>
                </div>
                <p className="eyebrow">{p.category}</p>
                <h3>
                  {p.title}
                  <span aria-hidden>↗</span>
                </h3>
                <p>{p.description}</p>
              </Link>
            ))
          ) : (
            <p>
              Project case studies are being prepared.{" "}
              <Link className="text-link" href={site.github}>
                Explore the source code on GitHub ↗
              </Link>
            </p>
          )}
        </div>
      </section>
      <div className="home-section">
        <ServiceFinder />
      </div>
      <section className="home-section collaboration-note" data-reveal>
        <p className="eyebrow">A practical partnership</p>
        <h2>
          Good systems start
          <br />
          with <span>good conversations.</span>
        </h2>
        <p>
          Tell me what’s getting in the way, what you want to build, and what
          success would look like. We’ll start with a clear scope and the next
          useful step.
        </p>
        <Link href="/contact" className="button-primary">
          Let’s talk about your idea <span aria-hidden>↗</span>
        </Link>
      </section>
    </main>
  );
}
