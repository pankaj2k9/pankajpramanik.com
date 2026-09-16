"use client";
import { useLayoutEffect, useRef, useState } from "react";
import ProjectCard from "./ProjectCard";
import type { ProjectTag } from "@/lib/project-tags";

export type ExplorerProject = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  techStack: string[];
  category: string;
  repoUrl: string | null;
  liveUrl: string | null;
  tags: ProjectTag[];
};

/**
 * Category tabs and search over the project grid. Cards keep their place on
 * screen while the list changes: positions are measured before the filter is
 * applied, then animated from where each card was (a FLIP transition).
 */
export default function ProjectExplorer({
  projects,
  filters,
}: {
  projects: ExplorerProject[];
  filters: { id: string; label: string; count: number }[];
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const grid = useRef<HTMLDivElement>(null);
  const previous = useRef<Map<string, DOMRect>>(new Map());
  const pending = useRef(false);

  const shown = projects.filter(
    (p) =>
      (filter === "all" || p.tags.some((t) => t.id === filter)) &&
      (query.trim() === "" ||
        `${p.title} ${p.tagline} ${p.description} ${p.techStack.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase().trim())),
  );

  /** Record where every visible card is, so the next render can animate from there. */
  function measure() {
    if (!grid.current) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    previous.current = new Map(
      Array.from(grid.current.children).map((el) => [
        (el as HTMLElement).dataset.slug ?? "",
        el.getBoundingClientRect(),
      ]),
    );
    pending.current = true;
  }

  useLayoutEffect(() => {
    if (!pending.current || !grid.current) return;
    pending.current = false;
    for (const el of Array.from(grid.current.children) as HTMLElement[]) {
      const before = previous.current.get(el.dataset.slug ?? "");
      const after = el.getBoundingClientRect();
      if (!before) {
        el.animate(
          [
            { opacity: 0, transform: "scale(0.97) translateY(12px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 420, easing: "cubic-bezier(.22,.8,.24,1)" },
        );
        continue;
      }
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (!dx && !dy) continue;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: 500, easing: "cubic-bezier(.22,.8,.24,1)" },
      );
    }
  });

  return (
    <div className="pj">
      <div className="pj-controls" data-hm="up">
        <div className="pj-tabs" role="tablist" aria-label="Project categories">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className="pj-tab"
              onClick={() => {
                measure();
                setFilter(f.id);
              }}
            >
              {f.label}
              <span>{f.count}</span>
            </button>
          ))}
        </div>
        <label className="pj-search">
          <span className="sr-only">Search projects</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder="Search projects"
            onChange={(event) => {
              measure();
              setQuery(event.target.value);
            }}
          />
        </label>
      </div>
      <p className="pj-count" role="status">
        {shown.length} {shown.length === 1 ? "project" : "projects"}
        {shown.length !== projects.length ? ` of ${projects.length}` : ""}
      </p>
      <div className="pj-grid" ref={grid}>
        {shown.map((p) => (
          <div key={p.slug} data-slug={p.slug} className="pj-cell">
            <ProjectCard project={p} tags={p.tags} reveal={false} headingLevel={2} />
          </div>
        ))}
      </div>
      {shown.length === 0 && (
        <div className="ip-card pj-empty">
          <h2>No matching projects</h2>
          <p>Try another category or search term.</p>
          <button
            type="button"
            className="hm-link"
            onClick={() => {
              measure();
              setFilter("all");
              setQuery("");
            }}
          >
            Show all projects <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  );
}
