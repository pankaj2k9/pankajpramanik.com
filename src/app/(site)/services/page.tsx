import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/queries";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Services",
  description:
    "AI engineering, LLM/RAG systems, agentic AI, data engineering, MLOps, workflow automation, and full-stack development services.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div className="container-site py-16">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">
          Services
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          What I can <span className="text-gradient">do for you</span>
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          From LLM &amp; RAG systems to data pipelines and full-stack apps —
          {" "}{services.length} specialized services, each backed by production
          experience. Click any service for details.
        </p>
      </header>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <Link
            key={s.id}
            href={`/services/${s.slug}`}
            className="card card-hover group relative overflow-hidden"
          >
            <div className="relative aspect-[8/5] overflow-hidden border-b border-border bg-surface-raised">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/services-art/${s.slug}.svg`}
                alt=""
                loading="lazy"
                width={800}
                height={500}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            </div>
            <div className="p-6">
              <h2 className="font-display text-lg font-semibold group-hover:text-accent">
                {s.label}
              </h2>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                {s.summary}
              </p>
              <span className="mt-4 inline-block text-sm font-medium text-accent">
                Learn more →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="card mt-14 flex flex-wrap items-center justify-between gap-6 p-8">
        <div>
          <h2 className="font-display text-xl font-bold">
            Have a project in mind?
          </h2>
          <p className="mt-1 text-muted">
            Tell me what you&apos;re building — I&apos;ll reply within 24 hours.
          </p>
        </div>
        <Link
          href="/contact"
          className="rounded-xl bg-accent-strong px-7 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Get in Touch
        </Link>
      </div>
    </div>
  );
}
