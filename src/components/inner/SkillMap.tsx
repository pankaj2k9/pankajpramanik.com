"use client";
import Link from "next/link";
import { useState } from "react";

export type SkillItem = {
  name: string;
  /** Projects whose recorded stack includes this technology. */
  projects: { slug: string; name: string }[];
  /** Companies where a role recorded this technology. */
  roles: string[];
};
export type SkillCategory = {
  id: string;
  label: string;
  tone: string;
  items: SkillItem[];
};

/**
 * Capability map: pick a group, then a technology to see where it is actually
 * used. Everything shown comes from the project and role records — there are
 * no invented proficiency scores.
 */
export default function SkillMap({ categories }: { categories: SkillCategory[] }) {
  const [group, setGroup] = useState(0);
  const [item, setItem] = useState<string | null>(null);
  const active = categories[group];
  const detail = active.items.find((i) => i.name === item) ?? null;

  return (
    <div className={`sk tone-${active.tone}`}>
      <nav className="sk-chain" aria-label="Skill groups">
        {categories.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={`sk-node tone-${c.tone}`}
            aria-current={group === i ? "true" : undefined}
            onClick={() => {
              setGroup(i);
              setItem(null);
            }}
          >
            <span className="sk-dot" aria-hidden />
            <span className="sk-node-label">{c.label}</span>
            <span className="sk-node-count">{c.items.length}</span>
          </button>
        ))}
      </nav>
      <div className="sk-body">
        <div className="sk-items" key={active.id}>
          <p className="hm-label">
            {active.label} <span>/ {active.items.length} technologies</span>
          </p>
          <ul>
            {active.items.map((i) => (
              <li key={i.name}>
                <button
                  type="button"
                  className="sk-chip"
                  aria-pressed={item === i.name}
                  onClick={() => setItem(item === i.name ? null : i.name)}
                  onMouseEnter={() => setItem(i.name)}
                >
                  {i.name}
                  {i.projects.length > 0 && <span className="sk-chip-count">{i.projects.length}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <aside className="sk-detail" aria-live="polite">
          {detail ? (
            <div key={detail.name} className="sk-detail-inner">
              <p className="hm-label">Where it is used</p>
              <h3>{detail.name}</h3>
              <p className="sk-usage">
                {detail.projects.length > 0 || detail.roles.length > 0 ? (
                  <>
                    Recorded in {detail.projects.length}{" "}
                    {detail.projects.length === 1 ? "project" : "projects"}
                    {detail.roles.length > 0 && (
                      <>
                        {" "}
                        and {detail.roles.length} {detail.roles.length === 1 ? "role" : "roles"}
                      </>
                    )}
                    .
                  </>
                ) : (
                  <>Part of my toolkit; no published project records it yet.</>
                )}
              </p>
              {detail.projects.length > 0 && (
                <ul className="sx-links">
                  {detail.projects.slice(0, 4).map((p) => (
                    <li key={p.slug}>
                      <Link href={`/portfolio/${p.slug}`}>
                        {p.name} <span aria-hidden>↗</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {detail.roles.length > 0 && (
                <p className="sk-roles">
                  <span className="hm-label">Roles</span>
                  {detail.roles.join(" · ")}
                </p>
              )}
            </div>
          ) : (
            <div className="sk-detail-empty">
              <p className="hm-label">Where it is used</p>
              <p>Pick a technology to see the projects and roles that record it.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
