import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPageBySlug, getServices } from "@/lib/queries";
import { renderContent } from "@/lib/content";
import { absoluteUrl, site } from "@/lib/site";

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

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page || page.kind !== "SERVICE") notFound();

  const others = (await getServices()).filter((s) => s.slug !== slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.label || page.title,
    description: page.summary,
    provider: { "@type": "Person", name: site.name, url: site.url },
    url: absoluteUrl(`/services/${page.slug}`),
  };

  return (
    <div className="container-site py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <nav className="text-sm text-faint" aria-label="Breadcrumb">
          <Link href="/services" className="hover:text-accent">
            ← All services
          </Link>
        </nav>

        <header className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            Service
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {page.label || page.title}
          </h1>
          {page.summary && (
            <p className="mt-3 text-lg text-muted">{page.summary}</p>
          )}
        </header>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/contact"
            className="rounded-xl bg-accent-strong px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Hire Me for This
          </Link>
          <Link
            href="/portfolio"
            className="rounded-xl border border-border-strong px-6 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent"
          >
            See Related Work
          </Link>
        </div>

        <div
          className="prose-content mt-10"
          dangerouslySetInnerHTML={{
            __html: renderContent(page.content, page.contentFormat),
          }}
        />
      </div>

      <aside className="mx-auto mt-16 max-w-3xl border-t border-border pt-10">
        <h2 className="font-display text-xl font-bold">Other services</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {others.map((s) => (
            <li key={s.id}>
              <Link
                href={`/services/${s.slug}`}
                className="inline-block rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-muted transition hover:border-accent hover:text-accent"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
