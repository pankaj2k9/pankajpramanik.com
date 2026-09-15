import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getServices, getSkillGroups } from "@/lib/queries";

export const revalidate = 300;

export const metadata = pageMetadata(
  "Skills & Tech Stack",
  "Technical skills across Generative AI, LLM/RAG systems, data science, MLOps, frontend, backend, and cloud \u2014 Python, LangChain, Next.js, AWS, and more.",
  "/skills",
);

export default async function SkillsPage() {
  const [groups, services] = await Promise.all([
    getSkillGroups(),
    getServices(),
  ]);

  return (
    <div className="container-site py-16">
      <header className="max-w-2xl">
        <p className="micro-label">Skills</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Tech stack &amp; capabilities
        </h1>
        <p className="mt-4 text-lg text-muted">
          The tools I reach for — from model training and agentic workflows to
          production deployment and cloud infrastructure.
        </p>
      </header>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.id} className="card p-7">
            <h2 className="font-display text-lg font-semibold">{g.category}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {g.items.map((s) => (
                <li
                  key={s}
                  className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-muted"
                >
                  {s}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* ---------- Services these skills power ---------- */}
      <section className="mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="micro-label">Services</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
              Hire me for
            </h2>
          </div>
          <Link
            href="/services"
            className="text-sm font-medium text-muted transition-colors hover:text-accent"
          >
            All services →
          </Link>
        </div>
        <ul className="mt-6 flex flex-wrap gap-2.5">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/services/${s.slug}`}
                className="inline-block rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-16 text-center">
        <p className="text-muted">Need one of these skills on your project?</p>
        <Link
          href="/contact"
          className="mt-4 inline-block rounded-xl bg-accent-strong px-8 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90"
        >
          Let&apos;s Talk
        </Link>
      </div>
    </div>
  );
}
