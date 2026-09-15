"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  problem?: string;
  approach?: string;
  outcome?: string;
  evidenceUrl?: string | null;
};
export default function PortfolioGrid({
  projects,
}: {
  projects: PortfolioProject[];
}) {
  const [category, setCategory] = useState("All");
  const [technology, setTechnology] = useState("All");
  const [query, setQuery] = useState("");
  const categories = useMemo(
    () => [...new Set(projects.map((p) => p.category))].sort(),
    [projects],
  );
  const technologies = useMemo(
    () => [...new Set(projects.flatMap((p) => p.techStack))].sort(),
    [projects],
  );
  const shown = projects.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      (technology === "All" || p.techStack.includes(technology)) &&
      `${p.title} ${p.description} ${p.techStack.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const reset = () => {
    setCategory("All");
    setTechnology("All");
    setQuery("");
  };
  return (
    <div>
      <div className="project-filters">
        <label>
          Service area
          <select
            aria-label="Service area"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="All">All services</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Technology
          <select
            aria-label="Technology"
            value={technology}
            onChange={(e) => setTechnology(e.target.value)}
          >
            <option value="All">All technologies</option>
            {technologies.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Search projects
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or topic"
          />
        </label>
        <button className="text-link" onClick={reset}>
          Reset filters ↺
        </button>
      </div>
      <p role="status" className="text-sm text-muted">
        {shown.length} {shown.length === 1 ? "project" : "projects"}
        {shown.length !== projects.length ? ` of ${projects.length}` : ""}
      </p>
      {!shown.length && (
        <div className="card mt-6 p-8">
          <h2 className="text-xl font-semibold">
            {projects.length
              ? "No matching projects"
              : "Project stories are on their way"}
          </h2>
          <p className="mt-2 text-muted">
            {projects.length
              ? "Try another service, technology, or search term."
              : "Get in touch to discuss relevant work and your project requirements."}
          </p>
          {projects.length > 0 ? (
            <button onClick={reset} className="text-link">
              Show all projects →
            </button>
          ) : (
            <Link href="/contact" className="text-link">
              Discuss your project →
            </Link>
          )}
        </div>
      )}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <article key={p.id} className="card overflow-hidden">
            {p.coverImage && (
              <div className="relative aspect-[2/1] bg-surface-raised">
                <Image
                  src={p.coverImage}
                  alt={`${p.title} — project preview`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
            )}
            <div className="p-6">
              <p className="eyebrow text-muted">{p.category}</p>
              <h2 className="mt-3 text-xl font-semibold">
                <Link href={`/portfolio/${p.slug}`} className="hover:underline">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {p.description}
              </p>
              <ul
                className="mt-4 flex flex-wrap gap-2"
                aria-label="Technology stack"
              >
                {p.techStack.map((t) => (
                  <li
                    key={t}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted"
                  >
                    {t}
                  </li>
                ))}
              </ul>
              <details className="case-study">
                <summary>Explore case study</summary>
                <dl>
                  <dt>Problem &amp; scope</dt>
                  <dd>
                    {p.problem ||
                      p.tagline ||
                      "Project context is available in the full overview."}
                  </dd>
                  <dt>Approach</dt>
                  <dd>{p.approach || p.description}</dd>
                  <dt>Technology stack</dt>
                  <dd>{p.techStack.join(", ") || "Not documented yet."}</dd>
                  <dt>Verified outcomes</dt>
                  <dd>
                    {p.outcome && p.evidenceUrl ? (
                      <>
                        {p.outcome}{" "}
                        <a
                          className="underline"
                          href={p.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Supporting evidence ↗
                        </a>
                      </>
                    ) : (
                      "No measured outcome has been published with supporting evidence. Explore the implementation for technical details."
                    )}
                  </dd>
                </dl>
                <Link className="text-link" href={`/portfolio/${p.slug}`}>
                  Full project details ↗
                </Link>
              </details>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
