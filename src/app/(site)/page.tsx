import Link from "next/link";
import Image from "next/image";
import HeroCanvas from "@/components/home/HeroCanvas";
import SocialLinks from "@/components/site/SocialLinks";
import { PostCard, ProjectCard, SectionHeading } from "@/components/site/cards";
import {
  getFeaturedProjects,
  getPublishedPosts,
  getServices,
  getSkillGroups,
  getTestimonials,
} from "@/lib/queries";
import { site, absoluteUrl } from "@/lib/site";

export const revalidate = 300;

export default async function HomePage() {
  const [projects, posts, skillGroups, testimonials, services] =
    await Promise.all([
      getFeaturedProjects(4),
      getPublishedPosts().then((p) => p.slice(0, 3)),
      getSkillGroups(),
      getTestimonials().then((t) => t.slice(0, 4)),
      getServices(),
    ]);

  const stats = [
    { value: "8+", label: "Years experience" },
    { value: `${services.length}+`, label: "Services offered" },
    { value: `${posts.length > 0 ? "27+" : "25+"}`, label: "Articles written" },
    { value: "100%", label: "Client satisfaction" },
  ];

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    url: site.url,
    email: `mailto:${site.email}`,
    image: absoluteUrl(site.photo),
    jobTitle: "AI & Data Engineer",
    sameAs: [site.github, site.linkedin, site.facebook],
    knowsAbout: [...site.keywords],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      {/* ---------- Hero (always dark — 3D space section) ---------- */}
      <section className="force-dark relative isolate overflow-hidden border-b border-border bg-background text-foreground">
        <HeroCanvas />
        <div className="container-site relative grid min-h-[calc(100vh-4rem)] items-center gap-14 py-20 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-4 py-1.5 text-sm font-medium text-emerald">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald" />
              Available for new projects
            </p>

            <h1 className="mt-7 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Hi, I&apos;m {site.name.split(" ")[0]} —
              <br />
              AI &amp; Data Engineer building{" "}
              <span className="text-gradient">intelligent systems</span>.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Agentic AI · LLM &amp; RAG applications · MLOps · Data platforms.
              8+ years turning ambitious ideas into production systems with
              LangChain, LangGraph, n8n, OpenAI, Claude, and modern cloud
              stacks.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
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

            <div className="mt-9 flex items-center gap-5">
              <SocialLinks />
              <span className="hidden text-sm text-faint sm:block">
                {site.email}
              </span>
            </div>
          </div>

          {/* portrait */}
          <div className="relative mx-auto w-64 sm:w-72 lg:w-full lg:max-w-sm">
            <div
              className="absolute -inset-4 rounded-[2rem] opacity-40 blur-2xl"
              style={{
                background:
                  "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
              }}
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-[2rem] border border-border-strong">
              <Image
                src={site.photo}
                alt={site.name}
                width={800}
                height={800}
                priority
                sizes="(max-width: 640px) 256px, (max-width: 1024px) 288px, 384px"
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="font-display text-sm font-semibold text-white">
                  {site.name}
                </p>
                <p className="text-xs text-white/70">{site.headline}</p>
              </div>
            </div>
          </div>
        </div>

        {/* stats band */}
        <div className="relative border-t border-border bg-surface/60 backdrop-blur">
          <dl className="container-site grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center sm:text-left">
                <dt className="order-2 text-xs uppercase tracking-wider text-faint">
                  {s.label}
                </dt>
                <dd className="font-display text-3xl font-bold text-gradient">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section className="container-site py-20">
        <SectionHeading
          eyebrow="Services"
          title="What I can do for you"
          action={{ href: "/services", label: "All services" }}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.slice(0, 6).map((s) => (
            <Link
              key={s.id}
              href={`/services/${s.slug}`}
              className="card card-hover group p-6"
            >
              <h3 className="font-display text-lg font-semibold group-hover:text-accent">
                {s.label}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                {s.summary}
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-accent">
                Learn more →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Featured projects ---------- */}
      <section className="border-y border-border bg-surface/50 py-20">
        <div className="container-site">
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
        </div>
      </section>

      {/* ---------- Skills strip ---------- */}
      <section className="container-site py-20">
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
      </section>

      {/* ---------- Latest posts ---------- */}
      <section className="border-y border-border bg-surface/50 py-20">
        <div className="container-site">
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
        </div>
      </section>

      {/* ---------- Testimonials ---------- */}
      {testimonials.length > 0 && (
        <section className="container-site py-20">
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
        </section>
      )}

      {/* ---------- CTA ---------- */}
      <section className="container-site pb-24">
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
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/contact"
              className="inline-block rounded-xl bg-accent-strong px-8 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90"
            >
              Contact Me
            </Link>
            <SocialLinks />
          </div>
        </div>
      </section>
    </>
  );
}
