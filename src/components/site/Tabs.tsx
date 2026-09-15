"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export type TabItem = {
  label: string;
  content: React.ReactNode;
};

/** Accessible client-side tabs (used on project detail pages). */
export default function Tabs({ items }: { items: TabItem[] }) {
  const [active, setActive] = useState(0);
  const baseId = useId();

  return (
    <div>
      <div
        role="tablist"
        aria-label="Project sections"
        className="flex flex-wrap gap-2 border-b border-border"
      >
        {items.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`${baseId}-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (i + 1) % items.length
                  : event.key === "ArrowLeft"
                    ? (i + items.length - 1) % items.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? items.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                setActive(next);
                document.getElementById(`${baseId}-tab-${next}`)?.focus();
              }
            }}
            onClick={() => setActive(i)}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              active === i
                ? "border-accent-strong text-accent"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {items.map((t, i) => (
        <div
          key={t.label}
          role="tabpanel"
          id={`${baseId}-panel-${i}`}
          aria-labelledby={`${baseId}-tab-${i}`}
          hidden={active !== i}
          className="pt-6"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
