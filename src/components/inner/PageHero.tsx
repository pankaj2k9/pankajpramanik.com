import type { CSSProperties, ReactNode } from "react";

type Tone = "blue" | "peach" | "mint" | "orange" | "violet";

/**
 * Opening section shared by inner pages. Its parts fade in on load in order
 * (label, first line, second line, lead, extras, visual) via --i delays.
 */
export default function PageHero({
  index,
  label,
  lines,
  lead,
  tone = "blue",
  compact = false,
  visual,
  children,
}: {
  index: string;
  label: string;
  /** Smaller title, for long headings such as article titles. */
  compact?: boolean;
  lines: [string, string?];
  lead: ReactNode;
  tone?: Tone;
  visual?: ReactNode;
  children?: ReactNode;
}) {
  const step = (i: number) => ({ "--i": i }) as CSSProperties;
  return (
    <section
      id="intro"
      className={`ip-hero tone-${tone}${compact ? " is-compact" : ""}`}
      aria-labelledby="page-title"
    >
      <span className="ip-hero-num" aria-hidden>
        {index}
      </span>
      <svg className="ip-hero-orbit" viewBox="0 0 1200 400" aria-hidden>
        <ellipse cx="900" cy="220" rx="520" ry="150" />
      </svg>
      <div className={`hm-container ip-hero-grid${visual ? "" : " is-solo"}`}>
        <div className="ip-hero-copy">
          <p className="hm-label ip-load" style={step(0)}>
            <span>{index}</span> / {label}
          </p>
          <h1 id="page-title" className="ip-title">
            <span className="hm-line ip-load" style={step(1)}>
              {lines[0]}
            </span>
            {lines[1] && (
              <span className="hm-line hm-line-soft ip-load" style={step(2)}>
                {lines[1]}
              </span>
            )}
          </h1>
          <div className="ip-lead ip-load" style={step(3)}>
            {lead}
          </div>
          {children && (
            <div className="ip-hero-extra ip-load" style={step(4)}>
              {children}
            </div>
          )}
        </div>
        {visual && (
          <div className="ip-hero-visual ip-load ip-load-scale" style={step(5)}>
            {visual}
          </div>
        )}
      </div>
    </section>
  );
}
