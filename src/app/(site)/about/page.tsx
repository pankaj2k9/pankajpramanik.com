import Link from "next/link";
import Image from "next/image";
import SocialLinks from "@/components/site/SocialLinks";
import Counter from "@/components/site/Counter";
import PageHero from "@/components/inner/PageHero";
import SectionHead from "@/components/inner/SectionHead";
import PageCTA from "@/components/inner/PageCTA";
import PageMotion from "@/components/motion/PageMotion";
import {
  getCertifications,
  getExperiences,
  getPublishedProjects,
  getSkillGroups,
} from "@/lib/queries";
import { site } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export const metadata = pageMetadata(
  "About — Practical AI & Data Engineering",
  "Meet Pankaj Kumar Pramanik, an AI and data engineer connecting software development, data pipelines, intelligent applications, and workflow automation.",
  "/about",
);

const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "approach", label: "Approach" },
  { id: "journey", label: "Journey" },
  { id: "process", label: "How I work" },
  { id: "principles", label: "Principles" },
  { id: "tools", label: "Tools" },
  { id: "contact", label: "Contact" },
];

const APPROACH = [
  {
    title: "Problem first",
    text: "Who needs the system, which data it can use, and what a useful result looks like — before any tool is chosen.",
  },
  {
    title: "Software, not notebooks",
    text: "A background in full-stack web and mobile development means AI work ends as an application people can use and maintain.",
  },
  {
    title: "Reviewable steps",
    text: "Architecture, prototypes and releases arrive in small pieces you can test, question and steer.",
  },
];

const PROCESS = [
  {
    title: "Understand",
    text: "Define the users, constraints, available data and acceptance criteria before choosing a tool.",
  },
  {
    title: "Make it tangible",
    text: "Build a focused prototype so the difficult assumptions get tested early.",
  },
  {
    title: "Build & evaluate",
    text: "Develop in iterations, review behaviour on real inputs and document the trade-offs.",
  },
  {
    title: "Launch & hand over",
    text: "Prepare deployment, monitoring and operating notes so the system can be supported.",
  },
];

const PRINCIPLES = [
  {
    a: "Useful",
    b: "impressive",
    text: "A small system people rely on beats a demo that only works on stage.",
    tone: "peach",
  },
  {
    a: "Simple",
    b: "over-engineered",
    text: "Start with the least machinery that solves the problem; add complexity when it pays.",
    tone: "blue",
  },
  {
    a: "Observable",
    b: "mysterious",
    text: "Logs, traces and evaluations make it possible to trust — and fix — what the system does.",
    tone: "mint",
  },
  {
    a: "Production",
    b: "prototype",
    text: "Deployment, monitoring and handover are part of the work, not an afterthought.",
    tone: "violet",
  },
  {
    a: "Human oversight",
    b: "blind automation",
    text: "People approve what is costly or irreversible; automation handles the rest.",
    tone: "orange",
  },
];

const yearOf = (d: Date) => d.getFullYear();

export default async function AboutPage() {
  const [experiences, projects, certifications, skills] = await Promise.all([
    getExperiences(),
    getPublishedProjects(),
    getCertifications(),
    getSkillGroups(),
  ]);
  const timeline = [...experiences].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );
  const firstYear = timeline.length ? yearOf(timeline[0].startDate) : 2019;

  return (
    <>
      <PageHero
        index="02"
        label="About"
        tone="peach"
        lines={["Engineering useful systems,", "not just impressive demos."]}
        lead={
          <>
            <p>
              I’m Pankaj Kumar Pramanik, an AI and data engineer with a
              background in full-stack web and mobile development. I work where
              data, intelligent applications and everyday business processes
              meet.
            </p>
          </>
        }
        visual={
          <figure className="ab-portrait" data-hm-pointer>
            <div className="ab-portrait-img">
              <Image
                src={site.photo}
                alt="Portrait of Pankaj Kumar Pramanik, AI and data engineer"
                fill
                sizes="(max-width: 900px) 90vw, 440px"
                preload
              />
            </div>
            <figcaption>
              <span className="ab-status" aria-hidden />
              <div>
                <strong>{site.name}</strong>
                <span>AI · Data · Software · Automation</span>
              </div>
            </figcaption>
            <SocialLinks className="ab-socials" />
          </figure>
        }
      >
        <dl className="ip-stats ab-stats">
          <div>
            <dd>
              <Counter value={site.yearsExperience} suffix="+" />
            </dd>
            <dt>Years building software</dt>
          </div>
          <div>
            <dd>
              <Counter value={experiences.length} />
            </dd>
            <dt>Roles across global teams</dt>
          </div>
          <div>
            <dd>
              <Counter value={projects.length} />
            </dd>
            <dt>Published projects</dt>
          </div>
          <div>
            <dd>
              <Counter value={certifications.length} />
            </dd>
            <dt>Certifications</dt>
          </div>
        </dl>
        <div className="ip-actions ab-hero-actions">
          <Link className="hm-button" href="/contact" data-hm-magnetic>
            Let’s work together <span aria-hidden>↗</span>
          </Link>
          <a className="hm-link" href={site.cv} download>
            Download CV <span aria-hidden>↓</span>
          </a>
        </div>
      </PageHero>

      <section id="approach" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="01"
            label="My approach"
            title={["Start with the problem.", "Then choose the tools."]}
            intro="I build document-aware AI applications, data pipelines and connected workflows — and take them past the prototype."
          />
          <div className="ab-approach" data-hm-stagger>
            {APPROACH.map((item, i) => (
              <article key={item.title} className="ip-card ab-approach-card" data-hm="up" data-hm-focus>
                <span className="ab-num">0{i + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="journey" className="ip-section is-tint">
        <div className="hm-container ab-journey">
          <div className="ab-journey-aside">
            <SectionHead
              index="02"
              label="Career journey"
              title={[`${firstYear} → today.`, "Building, learning, shipping."]}
            />
            <p className="hm-intro" data-hm="up">
              From full-stack products and 3D web to machine learning,
              generative AI and RAG systems. Hover a milestone to see the stack.
            </p>
            <Link className="hm-link" href="/experience" data-hm="up">
              Full experience <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="ab-timeline-wrap" data-hm-fill>
            <span className="ab-timeline-rail" aria-hidden>
              <span />
            </span>
            <ol className="ab-timeline">
            {timeline.map((e) => (
              <li key={e.id} className="ab-milestone" data-hm="up" data-hm-focus tabIndex={0}>
                <span className="ab-dot" aria-hidden />
                <span className="ab-year">{yearOf(e.startDate)}</span>
                <div className="ab-milestone-body">
                  <h3>{e.role}</h3>
                  <p className="ab-company">
                    {e.company}
                    {e.current ? " · Present" : e.endDate ? ` · until ${yearOf(e.endDate)}` : ""}
                  </p>
                  {e.summary && <p className="ab-summary">{e.summary}</p>}
                  {e.techStack.length > 0 && (
                    <ul className="ip-chips ab-tech" aria-label="Technologies">
                      {e.techStack.slice(0, 6).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="process" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="03"
            label="How I work"
            title={["Clarity at every step."]}
            intro="Four stages, each ending in something you can see, test and decide on."
          />
          <div className="ab-process" data-hm-stagger>
            <span className="ab-process-line" data-hm="line" aria-hidden />
            {PROCESS.map((step, i) => (
              <article key={step.title} className="ab-step" data-hm="up">
                <span className="ab-step-num">0{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="principles" className="ip-section is-tint">
        <div className="hm-container">
          <SectionHead
            index="04"
            label="Principles"
            title={["What I optimise for."]}
            intro="Five trade-offs I make on purpose. Hover or focus a card for the reasoning."
          />
          <div className="ab-principles" data-hm-stagger>
            {PRINCIPLES.map((p) => (
              <article
                key={p.a}
                className={`ip-card ab-principle tone-${p.tone}`}
                data-hm="up"
                tabIndex={0}
              >
                <p className="ab-statement">
                  <strong>{p.a}</strong>
                  <span className="ab-gt" aria-label="over">
                    &gt;
                  </span>
                  <span>{p.b}</span>
                </p>
                <p className="ab-why">{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tools" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="05"
            label="Tools & capabilities"
            title={["The stack behind the work."]}
            action={
              <Link className="hm-link" href="/skills">
                Explore all skills <span aria-hidden>→</span>
              </Link>
            }
          />
          <div className="ab-tools" data-hm-stagger>
            {skills.map((g) => (
              <article key={g.id} className="ip-card ab-tool-group" data-hm="up">
                <h3>{g.category}</h3>
                <ul className="ip-chips">
                  {g.items.slice(0, 8).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PageCTA
        label="Next step"
        lines={["Have a problem worth solving?", "Let’s talk."]}
        copy="Share what you’re working on and where it’s stuck. I’ll reply with questions, a suggested approach and whether I’m the right fit."
        cta="Start a conversation"
      />
      <PageMotion steps={STEPS} />
    </>
  );
}
