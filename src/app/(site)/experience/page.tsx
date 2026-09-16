import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import {
  getCertifications,
  getEducation,
  getExperiences,
  getTestimonials,
} from "@/lib/queries";
import { formatMonthYear } from "@/lib/utils";
import { site } from "@/lib/site";
import PageHero from "@/components/inner/PageHero";
import SectionHead from "@/components/inner/SectionHead";
import PageCTA from "@/components/inner/PageCTA";
import PageMotion from "@/components/motion/PageMotion";
import Counter from "@/components/site/Counter";

export const revalidate = 300;

export const metadata = pageMetadata(
  "Work Experience",
  "8+ years of professional experience — AI engineering, LLM/RAG systems, MLOps, 3D graphics, and full-stack development across global teams.",
  "/experience",
);

export default async function ExperiencePage() {
  const [experiences, education, certifications, testimonials] =
    await Promise.all([
      getExperiences(),
      getEducation(),
      getCertifications(),
      getTestimonials(),
    ]);

  const technologies = new Set(experiences.flatMap((e) => e.techStack));
  const companies = new Set(experiences.map((e) => e.company));
  const steps = [
    { id: "intro", label: "Intro" },
    { id: "roles", label: "Roles" },
    { id: "education", label: "Education" },
    { id: "certifications", label: "Certificates" },
    ...(testimonials.length ? [{ id: "testimonials", label: "Testimonials" }] : []),
    { id: "contact", label: "Contact" },
  ];

  return (
    <>
      <PageHero
        index="05"
        label="Experience"
        tone="violet"
        lines={["Years of building,", "learning and shipping."]}
        lead={
          <p>
            Remote-first work with teams worldwide — across AI engineering, data
            platforms, 3D graphics and full-stack product development.
          </p>
        }
      >
        <dl className="ip-stats ex-stats">
          <div>
            <dd>
              <Counter value={site.yearsExperience} suffix="+" />
            </dd>
            <dt>Years of experience</dt>
          </div>
          <div>
            <dd>
              <Counter value={experiences.length} />
            </dd>
            <dt>Roles</dt>
          </div>
          <div>
            <dd>
              <Counter value={companies.size} />
            </dd>
            <dt>Companies &amp; clients</dt>
          </div>
          <div>
            <dd>
              <Counter value={technologies.size} />
            </dd>
            <dt>Technologies</dt>
          </div>
        </dl>
        <div className="ip-actions ex-hero-actions">
          <a className="hm-button" href={site.cv} download data-hm-magnetic>
            Download CV <span aria-hidden>↓</span>
          </a>
          <Link className="hm-link" href="/portfolio">
            See the projects <span aria-hidden>→</span>
          </Link>
        </div>
      </PageHero>

      <section id="roles" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="01"
            label="Roles"
            title={["Where I’ve worked,", "and what I built there."]}
            intro="Open “What I built” on any role for the specific systems and results recorded for it."
          />
          <div className="ex-timeline" data-hm-fill>
            <span className="ex-rail" aria-hidden>
              <span />
            </span>
            <ol data-hm-stagger>
              {experiences.map((e) => (
                <li key={e.id} className="ex-role" data-hm="up" data-hm-focus>
                  <div className="ex-when">
                    <span className="ex-year">{e.startDate.getFullYear()}</span>
                    <span className="ex-range">
                      {formatMonthYear(e.startDate)} —{" "}
                      {e.current ? "Present" : formatMonthYear(e.endDate)}
                    </span>
                    <span className="ex-place">{e.location}</span>
                    {e.current && <span className="ex-now">Current</span>}
                  </div>
                  <div className="ex-card ip-card">
                    <h3>{e.role}</h3>
                    <p className="ex-company">
                      {e.companyUrl ? (
                        <a href={e.companyUrl} target="_blank" rel="noopener noreferrer">
                          {e.company} <span aria-hidden>↗</span>
                        </a>
                      ) : (
                        e.company
                      )}
                    </p>
                    {e.summary && <p className="ex-summary">{e.summary}</p>}
                    {e.highlights.length > 0 && (
                      <details className="ex-details">
                        <summary>
                          What I built <span aria-hidden>+</span>
                        </summary>
                        <ul>
                          {e.highlights.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {e.techStack.length > 0 && (
                      <ul className="ip-chips ex-tech" aria-label="Technologies">
                        {e.techStack.map((t) => (
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

      <section id="education" className="ip-section is-tint">
        <div className="hm-container">
          <SectionHead index="02" label="Education" title={["Where it started."]} />
          <div className="ex-education" data-hm-stagger>
            {education.map((ed) => (
              <article key={ed.id} className="ip-card ex-edu" data-hm="up">
                <p className="hm-label">
                  {ed.startYear} — {ed.endYear ?? "present"}
                </p>
                <h3>{ed.degree}</h3>
                <p className="ex-institution">{ed.institution}</p>
                {ed.description && <p className="ex-summary">{ed.description}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="certifications" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="03"
            label="Certifications"
            title={["Continuous learning."]}
            intro={`${certifications.length} certificates across AI, software engineering and cloud.`}
          />
          <ul className="ex-certs" data-hm-stagger>
            {certifications.map((c) => {
              const inner = (
                <>
                  <span className="hm-label">{c.issuer}</span>
                  <span className="ex-cert-title">{c.title}</span>
                  {c.url && (
                    <span className="ex-cert-link">
                      View certificate <span aria-hidden>↗</span>
                    </span>
                  )}
                </>
              );
              return (
                <li key={c.id} data-hm="up">
                  {c.url ? (
                    <a className="ex-cert" href={c.url} target="_blank" rel="noopener noreferrer">
                      {inner}
                    </a>
                  ) : (
                    <div className="ex-cert">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section id="testimonials" className="ip-section is-tint">
          <div className="hm-container">
            <SectionHead
              index="04"
              label="Testimonials"
              title={["What clients say."]}
              intro="Feedback from founders, engineering leaders and clients."
            />
            <div className="ex-quotes" data-hm-stagger>
              {testimonials.map((t) => (
                <figure key={t.id} className="ip-card ex-quote" data-hm="up">
                  <blockquote>“{t.quote}”</blockquote>
                  <figcaption>
                    <strong>{t.author}</strong>
                    {t.authorTitle && <span>{t.authorTitle}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <PageCTA
        label="Work together"
        lines={["Need this experience", "on your team?"]}
        copy="Tell me about the role or project. I’ll be direct about where I can help and where someone else would be a better fit."
        cta="Start a conversation"
      />
      <PageMotion steps={steps} />
    </>
  );
}
