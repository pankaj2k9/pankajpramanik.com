import type { ReactNode } from "react";

/** Section heading in the homepage style: numbered label, two-line title. */
export default function SectionHead({
  index,
  label,
  title,
  intro,
  action,
  id,
}: {
  index: string;
  label: string;
  title: [string, string?];
  intro?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <header className="hm-head" data-hm-stagger>
      <div>
        <p className="hm-label" data-hm="up">
          <span>{index}</span> / {label}
        </p>
        <h2 className="hm-title ip-section-title" id={id}>
          <span className="hm-line" data-hm="up">
            {title[0]}
          </span>
          {title[1] && (
            <span className="hm-line hm-line-soft" data-hm="up">
              {title[1]}
            </span>
          )}
        </h2>
      </div>
      {intro && (
        <div className="hm-intro" data-hm="up">
          {intro}
        </div>
      )}
      {action && <div data-hm="up">{action}</div>}
    </header>
  );
}
