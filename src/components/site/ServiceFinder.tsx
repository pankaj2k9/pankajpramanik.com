"use client";
import { useState } from "react";
import Link from "next/link";
import { servicePaths } from "@/lib/services";

export default function ServiceFinder() {
  const [selected, setSelected] = useState(0);
  const service = servicePaths[selected];
  return (
    <section
      className="service-finder"
      aria-labelledby="finder-heading"
      data-reveal
    >
      <div>
        <p className="eyebrow">A good place to start</p>
        <h2 id="finder-heading">Find the right service.</h2>
        <p>What would you like to move forward?</p>
        <div
          className="finder-options"
          role="group"
          aria-label="Your project goal"
        >
          {servicePaths.map((s, i) => (
            <button
              key={s.id}
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              <span>0{i + 1}</span>
              {s.need}
              <span aria-hidden>↗</span>
            </button>
          ))}
        </div>
      </div>
      <div className="finder-result" aria-live="polite" aria-atomic="true">
        <span className="eyebrow">Your starting point / 0{selected + 1}</span>
        <h3>{service.title}</h3>
        <p>{service.description}</p>
        <p className="finder-deliverable">{service.deliverable}</p>
        <div className="flex flex-wrap gap-4">
          <Link
            className="button-primary"
            href={`/contact?service=${service.id}`}
          >
            Discuss this project <span aria-hidden>↗</span>
          </Link>
          <Link className="text-link" href={`/services/${service.slug}`}>
            Explore service →
          </Link>
        </div>
      </div>
    </section>
  );
}
