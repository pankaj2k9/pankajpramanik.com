"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type PortfolioProject = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  techStack: string[];
  category: string;
  featured: boolean;
  coverImage: string | null;
};

/** Tabbed category filter + project card grid for /portfolio. */
export default function PortfolioGrid({
  projects,
}: {
  projects: PortfolioProject[];
}) {
  const categories = ["All", ...new Set(projects.map((p) => p.category))];
  const [active, setActive] = useState("All");
  const shown =
    active === "All" ? projects : projects.filter((p) => p.category === active);

  return (
    <div>
      {/* category tabs */}
      <div
        role="tablist"
        aria-label="Filter projects by category"
        className="flex flex-wrap gap-2 border-b border-border pb-px"
      >
        {categories.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={active === c}
            onClick={() => setActive(c)}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              active === c
                ? "border-accent-strong text-accent"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {c}
            <span className="ml-1.5 text-xs text-faint">
              {c === "All"
                ? projects.length
                : projects.filter((p) => p.category === c).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <article
            key={p.id}
            className="card card-hover group relative overflow-hidden"
          >
            {p.coverImage && (
              <div className="relative aspect-[2/1] overflow-hidden border-b border-border bg-surface-raised">
                <Image
                  src={p.coverImage}
                  alt={p.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
            )}
            <div className="p-6">
              {p.featured && (
                <span className="absolute right-4 top-4 rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                  ★ Featured
                </span>
              )}
              <p className="text-xs font-medium uppercase tracking-wider text-faint">
                {p.category}
              </p>
              <h3 className="mt-2 font-display text-lg font-semibold leading-snug">
                <Link
                  href={`/portfolio/${p.slug}`}
                  className="after:absolute after:inset-0 group-hover:text-accent"
                >
                  {p.title}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-accent/90">{p.tagline}</p>
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
                {p.description}
              </p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {p.techStack.slice(0, 4).map((t) => (
                  <li
                    key={t}
                    className="rounded-md border border-border bg-surface-raised px-2 py-0.5 text-[11px] text-muted"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
