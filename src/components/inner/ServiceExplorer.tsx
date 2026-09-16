"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SystemVisual from "@/components/home/SystemVisual";
import type { ServiceGroup } from "@/lib/service-catalog";

type ServiceLink = { slug: string; label: string };
type ProjectLink = { slug: string; name: string; tag: string };

const SWAP_MS = 170;

export default function ServiceExplorer({
  groups,
  services,
  projects,
  initial = 0,
}: {
  groups: ServiceGroup[];
  services: Record<string, ServiceLink>;
  projects: Record<string, ProjectLink[]>;
  initial?: number;
}) {
  const [selected, setSelected] = useState(initial);
  const [shown, setShown] = useState(initial);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  function choose(index: number) {
    setSelected(index);
    if (index === shown) return;
    clearTimeout(timer.current);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(index);
      return;
    }
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setShown(index);
      setLeaving(false);
    }, SWAP_MS);
  }

  const group = groups[shown];
  const pages = group.serviceSlugs.map((s) => services[s]).filter(Boolean);
  const related = projects[group.id] ?? [];
  return (
    <div className={`sx tone-${groups[selected].tone}`} style={{ "--sx-index": selected, "--sx-count": groups.length } as React.CSSProperties}>
      <nav className="sx-nav" aria-label="Service areas">
        <span className="sx-rail" aria-hidden>
          <span className="sx-indicator" />
        </span>
        <ol role="tablist" aria-orientation="vertical">
          {groups.map((g, i) => (
            <li key={g.id} role="presentation">
              <button
                type="button"
                role="tab"
                id={`sx-tab-${g.id}`}
                aria-selected={selected === i}
                aria-controls="sx-panel"
                className={`sx-tab tone-${g.tone}`}
                onClick={() => choose(i)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                  event.preventDefault();
                  const next = (i + (event.key === "ArrowDown" ? 1 : groups.length - 1)) % groups.length;
                  choose(next);
                  document.getElementById(`sx-tab-${groups[next].id}`)?.focus();
                }}
                tabIndex={selected === i ? 0 : -1}
              >
                <span className="sx-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="sx-label">{g.label}</span>
                <span className="sx-arrow" aria-hidden>
                  →
                </span>
              </button>
            </li>
          ))}
        </ol>
        <span className="sx-connector" key={selected} aria-hidden />
      </nav>
      <div
        id="sx-panel"
        role="tabpanel"
        aria-labelledby={`sx-tab-${group.id}`}
        className={`sx-panel tone-${group.tone}`}
        data-leaving={leaving || undefined}
      >
        <div className="sx-panel-inner" key={shown}>
          <div className="sx-panel-head">
            <div>
              <p className="hm-label">
                Service area <span>/ {String(shown + 1).padStart(2, "0")}</span>
              </p>
              <h3>{group.title}</h3>
              <p className="sx-desc">{group.description}</p>
            </div>
            <div className="sx-visual" aria-hidden>
              <SystemVisual kind={group.visual} />
            </div>
          </div>
          <div className="sx-columns">
            <div>
              <p className="hm-label">Typical problems</p>
              <ul className="sx-list">
                {group.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="hm-label">What you get</p>
              <ul className="sx-list sx-list-check">
                {group.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="sx-meta">
            <div>
              <p className="hm-label">Tools</p>
              <ul className="ip-chips">
                {group.tools.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            {pages.length > 0 && (
              <div>
                <p className="hm-label">Service pages</p>
                <ul className="sx-links">
                  {pages.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/services/${s.slug}`}>
                        {s.label} <span aria-hidden>→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {related.length > 0 && (
              <div>
                <p className="hm-label">Related projects</p>
                <ul className="sx-links">
                  {related.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/portfolio/${p.slug}`}>
                        {p.name} <span aria-hidden>↗</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="ip-actions sx-actions">
          <Link className="hm-button" href={`/contact?service=${group.id}`} data-hm-magnetic>
            Discuss {group.label} <span aria-hidden>→</span>
          </Link>
          {pages[0] && (
            <Link className="hm-link" href={`/services/${pages[0].slug}`}>
              Read the full service <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
