"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import SystemVisual, { type SystemVisualKind } from "@/components/home/SystemVisual";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  date: string;
  dateLabel: string;
  minutes: number;
  categories: { name: string; slug: string }[];
  tone: string;
  visual: SystemVisualKind;
};

/** Category tabs, search and the article grid. Cards re-enter on each change. */
export default function BlogExplorer({
  posts,
  categories,
  initial,
}: {
  posts: BlogPost[];
  categories: { slug: string; name: string; count: number }[];
  /** Category slug from ?category=… so links from articles still work. */
  initial?: string;
}) {
  const [category, setCategory] = useState(
    initial && categories.some((c) => c.slug === initial) ? initial : "all",
  );
  const [query, setQuery] = useState("");
  const shown = posts.filter(
    (p) =>
      (category === "all" || p.categories.some((c) => c.slug === category)) &&
      (query.trim() === "" ||
        `${p.title} ${p.excerpt}`.toLowerCase().includes(query.toLowerCase().trim())),
  );

  return (
    <div className="bl">
      <div className="pj-controls" data-hm="up">
        <div className="pj-tabs" role="tablist" aria-label="Article categories">
          <button
            type="button"
            role="tab"
            aria-selected={category === "all"}
            className="pj-tab"
            onClick={() => setCategory("all")}
          >
            All<span>{posts.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={category === c.slug}
              className="pj-tab"
              onClick={() => setCategory(c.slug)}
            >
              {c.name}
              <span>{c.count}</span>
            </button>
          ))}
        </div>
        <label className="pj-search">
          <span className="sr-only">Search articles</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder="Search articles"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <p className="pj-count" role="status">
        {shown.length} {shown.length === 1 ? "article" : "articles"}
        {shown.length !== posts.length ? ` of ${posts.length}` : ""}
      </p>
      <div className="bl-grid" key={`${category}-${query}`}>
        {shown.map((p) => (
          <article key={p.id} className={`bl-card tone-${p.tone}`} data-hm-pointer>
            <Link href={`/blog/${p.slug}`} className="bl-card-link">
              <span className="sr-only">{p.title}</span>
            </Link>
            <div className="bl-visual" data-cursor-label="Read article ↗">
              {p.coverImage ? (
                <Image
                  src={p.coverImage}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <SystemVisual kind={p.visual} />
              )}
            </div>
            <div className="bl-body">
              <div className="bl-meta">
                {p.categories[0] && <span className="bl-cat">{p.categories[0].name}</span>}
                <time dateTime={p.date}>{p.dateLabel}</time>
                <span aria-hidden>·</span>
                <span>{p.minutes} min read</span>
              </div>
              <h3>{p.title}</h3>
              <p>{p.excerpt}</p>
              <span className="bl-more">
                Read article <span aria-hidden>→</span>
              </span>
            </div>
          </article>
        ))}
      </div>
      {shown.length === 0 && (
        <div className="ip-card pj-empty">
          <h2>No matching articles</h2>
          <p>Try another category or search term.</p>
          <button
            type="button"
            className="hm-link"
            onClick={() => {
              setCategory("all");
              setQuery("");
            }}
          >
            Show all articles <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  );
}
