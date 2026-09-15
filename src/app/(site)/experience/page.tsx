import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import {
  getCertifications,
  getEducation,
  getExperiences,
  getTestimonials,
} from "@/lib/queries";
import { formatMonthYear } from "@/lib/utils";

export const revalidate = 300;

export const metadata = pageMetadata(
  "Work Experience",
  "8+ years of professional experience \u2014 AI engineering, LLM/RAG systems, MLOps, 3D graphics, and full-stack development across global teams.",
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

  return (
    <div className="container-site py-16">
      <header className="max-w-2xl">
        <p className="micro-label">Experience</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Where I&apos;ve worked
        </h1>
        <p className="mt-4 text-lg text-muted">
          8+ years across AI engineering, data platforms, 3D graphics, and
          full-stack development — remote-first with teams worldwide.
        </p>
        <a
          href="/Pankaj_Kumar_Pramanik_AI_Data_Engineer_CV.pdf"
          download
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-strong px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download CV
        </a>
      </header>

      {/* ---------- Timeline ---------- */}
      <ol className="relative mt-14 max-w-3xl space-y-10 border-l border-border pl-8">
        {experiences.map((e) => (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-[2.42rem] top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                e.current
                  ? "border-emerald bg-emerald/30"
                  : "border-accent-strong bg-surface"
              }`}
              aria-hidden
            />
            <p className="text-sm text-faint">
              {formatMonthYear(e.startDate)} —{" "}
              {e.current ? (
                <span className="font-medium text-emerald">Present</span>
              ) : (
                formatMonthYear(e.endDate)
              )}
              <span className="mx-2" aria-hidden>
                ·
              </span>
              {e.location}
            </p>
            <h2 className="mt-1.5 font-display text-xl font-semibold">
              {e.role}{" "}
              <span className="text-muted">
                —{" "}
                {e.companyUrl ? (
                  <a
                    href={e.companyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-accent"
                  >
                    {e.company}
                  </a>
                ) : (
                  e.company
                )}
              </span>
            </h2>
            {e.summary && (
              <p className="mt-1 text-sm text-accent/90">{e.summary}</p>
            )}
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
              {e.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {h}
                </li>
              ))}
            </ul>
            {e.techStack.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {e.techStack.map((t) => (
                  <li
                    key={t}
                    className="rounded-md border border-border bg-surface-raised px-2 py-0.5 text-[11px] text-muted"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      {/* ---------- Education ---------- */}
      <section className="mt-20 max-w-3xl">
        <h2 className="font-display text-2xl font-bold">Education</h2>
        <div className="mt-6 space-y-4">
          {education.map((ed) => (
            <div key={ed.id} className="card p-6">
              <p className="text-sm text-faint">
                {ed.startYear} — {ed.endYear ?? "present"}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold">
                {ed.degree}
              </h3>
              <p className="text-sm text-accent/90">{ed.institution}</p>
              {ed.description && (
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {ed.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Certifications ---------- */}
      <section className="mt-20">
        <h2 className="font-display text-2xl font-bold">Certifications</h2>
        <p className="mt-2 text-muted">
          Continuous learning across AI, software engineering, and modern web
          technologies.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {certifications.map((c) => {
            const inner = (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                  {c.issuer}
                </p>
                <p className="mt-1 text-sm font-medium leading-snug">
                  {c.title}
                </p>
                {c.url && (
                  <p className="mt-2 text-xs font-medium text-accent">
                    View certificate ↗
                  </p>
                )}
              </>
            );
            return (
              <li key={c.id}>
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card card-hover block h-full p-4"
                  >
                    {inner}
                  </a>
                ) : (
                  <div className="card h-full p-4">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- Testimonials ---------- */}
      {testimonials.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-2xl font-bold">Testimonials</h2>
          <p className="mt-2 text-muted">
            Trusted by founders, engineering leaders, and clients across AI,
            SaaS, and Web3.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {testimonials.map((t) => (
              <figure key={t.id} className="card p-7">
                <div className="text-sm text-amber-400" aria-label="5 stars">
                  ★★★★★
                </div>
                <blockquote className="mt-3 text-sm leading-relaxed text-muted">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold text-foreground">
                    {t.author}
                  </span>
                  {t.authorTitle && (
                    <span className="text-faint"> — {t.authorTitle}</span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <div className="mt-20 text-center">
        <Link
          href="/contact"
          className="inline-block rounded-xl bg-accent-strong px-8 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90"
        >
          Work With Me
        </Link>
      </div>
    </div>
  );
}
