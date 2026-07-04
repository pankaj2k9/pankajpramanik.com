import Link from "next/link";
import HeroCanvas from "@/components/home/HeroCanvas";
import { PostCard, ProjectCard, SectionHeading } from "@/components/site/cards";
import {
  getFeaturedProjects,
  getPublishedPosts,
  getSkillGroups,
  getTestimonials,
} from "@/lib/queries";
import { site, absoluteUrl } from "@/lib/site";

export const revalidate = 300;

const HERO_BADGES = [
  "8+ Years Experience",
  "LLM & RAG Specialist",
  "AWS · GCP · Azure",
];

export default async function HomePage() {
  const [projects, posts, skillGroups, testimonials] = await Promise.all([
    getFeaturedProjects(4),
    getPublishedPosts().then((p) => p.slice(0, 3)),
    getSkillGroups(),
    getTestimonials().then((t) => t.slice(0, 4)),
  ]);

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    url: site.url,
    email: `mailto:${site.email}`,
    jobTitle: "AI & Data Engineer",
    sameAs: [site.github],
    knowsAbout: [...site.keywords],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      {/* ---------- Hero ---------- */}
      <section className="relative isolate overflow-hidden">
        <HeroCanvas />
        <div className="container-site relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-24 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-4 py-1.5 text-sm font-medium text-emerald">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald" />
            Available for new projects
          </p>
          <h1 className="mt-8 max-w-4xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            AI &amp; Data Engineer building{" "}
            <span className="text-gradient">intelligent systems</span> that ship.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Agentic AI · LLM &amp; RAG applications · MLOps · Data platforms.
            8+ years turning ambitious ideas into production systems with
            LangChain, LangGraph, n8n, OpenAI, Claude, and modern cloud stacks.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/portfolio"
              className="rounded-xl bg-accent-strong px-7 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90"
            >
              View My Work
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-border-strong px-7 py-3.5 font-semibold text-foreground transition hover:border-accent hover:text-accent"
            >
              Get in Touch
            </Link>
          </div>
          <ul className="mt-14 flex flex-wrap items-center justify-center gap-3">
            {HERO_BADGES.map((b) => (
              <li
                key={b}
                className="rounded-full border border-border bg-surface/70 px-4 py-1.5 text-sm text-muted backdrop-blur"
              >
                {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Featured projects ---------- */}
      <section className="container-site py-20">
        <SectionHeading
          eyebrow="Portfolio"
          title="Featured work"
          action={{ href: "/portfolio", label: "All projects" }}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>

      {/* ---------- Skills strip ---------- */}
      <section className="border-y border-border bg-surface/50 py-20">
        <div className="container-site">
          <SectionHeading
            eyebrow="Capabilities"
            title="What I work with"
            action={{ href: "/skills", label: "Full tech stack" }}
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {skillGroups.slice(0, 6).map((g) => (
              <div key={g.id} className="card p-6">
                <h3 className="font-display text-base font-semibold">
                  {g.category}
                </h3>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {g.items.slice(0, 8).map((s) => (
                    <li
                      key={s}
                      className="rounded-md border border-border bg-surface-raised px-2 py-0.5 text-[11px] text-muted"
                    >
                      {s}
                    </li>
                  ))}
                  {g.items.length > 8 && (
                    <li className="px-2 py-0.5 text-[11px] text-faint">
                      +{g.items.length - 8} more
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Latest posts ---------- */}
      <section className="container-site py-20">
        <SectionHeading
          eyebrow="Blog"
          title="Latest writing"
          action={{ href: "/blog", label: "All posts" }}
        />
        <div className="grid gap-6 md:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      </section>

      {/* ---------- Testimonials ---------- */}
      {testimonials.length > 0 && (
        <section className="border-t border-border bg-surface/50 py-20">
          <div className="container-site">
            <SectionHeading eyebrow="Testimonials" title="What clients say" />
            <div className="grid gap-6 md:grid-cols-2">
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
          </div>
        </section>
      )}

      {/* ---------- CTA ---------- */}
      <section className="container-site py-24">
        <div className="card relative overflow-hidden p-10 text-center sm:p-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background:
                "radial-gradient(60% 80% at 50% 0%, #6366f1 0%, transparent 70%)",
            }}
          />
          <h2 className="relative font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Let&apos;s build something{" "}
            <span className="text-gradient">intelligent</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted">
            Available for AI engineering, agentic systems, RAG applications,
            MLOps, and full-stack development engagements.
          </p>
          <Link
            href="/contact"
            className="relative mt-8 inline-block rounded-xl bg-accent-strong px-8 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90"
          >
            Contact Me
          </Link>
        </div>
      </section>
    </>
  );
}
