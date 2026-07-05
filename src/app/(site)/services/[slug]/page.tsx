import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPageBySlug, getServices } from "@/lib/queries";
import { renderContent } from "@/lib/content";
import { absoluteUrl, site } from "@/lib/site";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

export async function generateStaticParams() {
  const services = await prisma.page.findMany({
    where: { kind: "SERVICE" },
    select: { slug: true },
  });
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page || page.kind !== "SERVICE") return {};
  return {
    title: page.label || page.title,
    description: page.seoDescription ?? page.summary,
    alternates: { canonical: `/services/${page.slug}` },
    openGraph: {
      title: page.label || page.title,
      description: page.seoDescription ?? page.summary,
      url: absoluteUrl(`/services/${page.slug}`),
    },
  };
}

type Feature = { icon: string; title: string; desc: string };

/**
 * Migrated service content follows a consistent Elementor pattern:
 * `<img class="svc-icon" src="…"><h2>Feature</h2><p>Description</p>`.
 * Pull those triplets out into a proper card grid and keep the rest
 * of the article as flowing prose.
 */
function extractFeatures(html: string): { features: Feature[]; rest: string } {
  const features: Feature[] = [];
  const rest = html.replace(
    // attribute order varies after sanitizing — assert svc-icon via lookahead
    /<img\b(?=[^>]*\bsvc-icon\b)[^>]*\bsrc="([^"]+)"[^>]*\/?>\s*<h2>([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>/g,
    (_m, icon: string, title: string, desc: string) => {
      features.push({ icon, title, desc });
      return "";
    }
  );
  return { features, rest };
}

const BANNER_STATS = [
  { value: "8+", label: "Years experience" },
  { value: "50+", label: "Projects delivered" },
  { value: "24h", label: "Response time" },
  { value: "100%", label: "Client satisfaction" },
];

const PROCESS = [
  { n: "01", color: "#6366f1", title: "Discuss", desc: "Your goals, constraints, and success criteria." },
  { n: "02", color: "#8b5cf6", title: "Design", desc: "Architecture, data flow, and a concrete plan." },
  { n: "03", color: "#ec4899", title: "Develop", desc: "Iterative builds with tests and check-ins." },
  { n: "04", color: "#10b981", title: "Launch", desc: "Production deploy, monitoring, and handoff." },
];

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page || page.kind !== "SERVICE") notFound();

  const services = await getServices();
  const fullHtml = renderContent(page.content, page.contentFormat);
  const { features, rest } = extractFeatures(fullHtml);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.label || page.title,
    description: page.summary,
    provider: { "@type": "Person", name: site.name, url: site.url },
    url: absoluteUrl(`/services/${page.slug}`),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---------- Banner (always dark, agency-style) ---------- */}
      <section className="force-dark relative overflow-hidden border-b border-border bg-background text-foreground">
        {/* glow orbs + grid pattern */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(closest-side, #6366f1, transparent)" }}
          />
          <div
            className="absolute -right-24 top-1/3 h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(closest-side, #ec4899, transparent)" }}
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
            }}
          />
        </div>

        <div className="container-site relative py-16 sm:py-24">
          <nav className="text-sm text-faint" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-accent">Home</Link>{" "}
            <span aria-hidden>/</span>{" "}
            <Link href="/services" className="hover:text-accent">Services</Link>{" "}
            <span aria-hidden>/</span>{" "}
            <span className="text-muted">{page.label || page.title}</span>
          </nav>

          <div className="mt-10 max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-4 py-1.5 text-sm font-medium text-emerald">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald" />
              Available for new projects
            </p>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {page.label || page.title}
            </h1>
            {page.summary && (
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
                {page.summary}
              </p>
            )}
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-xl bg-accent-strong px-7 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90"
              >
                Hire Me for This
              </Link>
              <Link
                href="/portfolio"
                className="rounded-xl border border-border-strong px-7 py-3.5 font-semibold transition hover:border-accent hover:text-accent"
              >
                See Related Work
              </Link>
            </div>
          </div>

          <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {BANNER_STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border bg-surface/60 px-4 py-4 backdrop-blur"
              >
                <dd className="font-display text-2xl font-bold text-gradient">
                  {s.value}
                </dd>
                <dt className="mt-1 text-xs text-faint">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- Body: content + sticky sidebar ---------- */}
      <div className="container-site grid gap-12 py-16 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {/* feature cards */}
          {features.length > 0 && (
            <section>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
                What&apos;s included
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Capabilities in this service
              </h2>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {features.map((f, i) => (
                  <div key={f.title} className="card card-hover relative overflow-hidden p-6">
                    <span className="absolute right-5 top-4 font-display text-4xl font-bold text-border" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.icon}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      className="h-12 w-12 rounded-xl bg-surface-raised p-2"
                    />
                    <h3
                      className="mt-4 font-display text-lg font-semibold"
                      dangerouslySetInnerHTML={{ __html: f.title }}
                    />
                    <p
                      className="mt-2 text-sm leading-relaxed text-muted"
                      dangerouslySetInnerHTML={{ __html: f.desc }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* article */}
          <section className={features.length ? "mt-14 border-t border-border pt-12" : ""}>
            <div
              className="prose-content"
              dangerouslySetInnerHTML={{ __html: rest }}
            />
          </section>

          {/* mini process */}
          <section className="mt-14 border-t border-border pt-12">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
              How we&apos;ll work
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              From first call to production
            </h2>
            <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS.map((s) => (
                <li key={s.n} className="card p-5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ background: s.color }}
                  >
                    {s.n}
                  </span>
                  <h3 className="mt-3 font-display font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {s.desc}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* CTA */}
          <section className="mt-14">
            <div className="card relative overflow-hidden p-10 text-center sm:p-14">
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  background:
                    "radial-gradient(60% 80% at 50% 0%, #6366f1 0%, transparent 70%)",
                }}
                aria-hidden
              />
              <h2 className="relative font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Need {page.label || "this"}?{" "}
                <span className="text-gradient">Let&apos;s talk.</span>
              </h2>
              <p className="relative mx-auto mt-3 max-w-lg text-muted">
                Tell me about your project — I&apos;ll reply within 24 hours
                with a concrete plan.
              </p>
              <Link
                href="/contact"
                className="relative mt-7 inline-block rounded-xl bg-accent-strong px-8 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90"
              >
                Start a Project
              </Link>
            </div>
          </section>
        </div>

        {/* ---------- Sticky sidebar ---------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <p className="border-b border-border px-5 py-4 font-display text-sm font-bold uppercase tracking-wider">
              All services
            </p>
            <ul className="max-h-96 overflow-y-auto p-2" data-lenis-prevent>
              {services.map((s) => {
                const active = s.slug === slug;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/services/${s.slug}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-accent-strong/15 font-semibold text-accent"
                          : "text-muted hover:bg-surface-raised hover:text-foreground"
                      )}
                    >
                      {s.label}
                      <span aria-hidden className={active ? "" : "opacity-0"}>
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card mt-5 p-6">
            <h2 className="font-display text-lg font-bold">
              Have a project in mind?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Free consultation — tell me what you&apos;re building and get a
              concrete plan within 24 hours.
            </p>
            <Link
              href="/contact"
              className="mt-5 block rounded-xl bg-accent-strong px-5 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
            >
              Get in Touch
            </Link>
            <a
              href={site.cv}
              download
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border-strong px-5 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download CV
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
