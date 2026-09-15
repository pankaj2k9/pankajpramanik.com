"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { homeServices } from "@/lib/services";

/** How long the outgoing panel takes to fade before the new one slides in. */
const SWAP_MS = 180;

export default function HomeServiceFinder() {
  const [selected, setSelected] = useState(0);
  const [shown, setShown] = useState(0);
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

  const service = homeServices[shown];
  return (
    <div className="hm-finder" data-hm="up">
      <div className="hm-finder-options">
        <p className="hm-label">A good place to start</p>
        <h2 className="hm-finder-title">Find the right service.</h2>
        <p className="hm-finder-lead">What would you like to move forward?</p>
        <div role="group" aria-label="Your project goal">
          {homeServices.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`hm-option tone-${s.tone}`}
              aria-pressed={selected === i}
              onClick={() => choose(i)}
            >
              <span className="hm-option-num">0{i + 1}</span>
              <span className="hm-option-text">{s.need}</span>
              <span className="hm-option-arrow" aria-hidden>
                →
              </span>
            </button>
          ))}
        </div>
      </div>
      <div
        className={`hm-finder-result tone-${service.tone}`}
        data-leaving={leaving || undefined}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="hm-finder-panel" key={shown}>
          <p className="hm-label">
            Your starting point <span>/ 0{shown + 1}</span>
          </p>
          <h3>{service.title}</h3>
          <p className="hm-finder-desc">{service.description}</p>
          <div className="hm-outcome">
            <span className="hm-label">Outcome</span>
            <p>{service.deliverable}</p>
          </div>
        </div>
        {/* Outside the keyed panel, so the magnetic listener survives a swap. */}
        <div className="hm-finder-actions">
          <Link
            className="hm-button"
            href={`/contact?service=${service.id}`}
            data-hm-magnetic
          >
            Discuss this project <span aria-hidden>→</span>
          </Link>
          <Link className="hm-link" href={`/services/${service.slug}`}>
            Explore service <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
