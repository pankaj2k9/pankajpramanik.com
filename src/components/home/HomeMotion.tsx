"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Interaction layer for the homepage sections below the hero. Markup opts in
 * with data attributes, so the sections themselves stay server-rendered:
 *
 *   data-hm="up|left|right"    reveal on entry (opacity, small slide, blur)
 *   data-hm-stagger            children with data-hm reveal one after another
 *   data-hm-focus              gets data-focus while near the viewport centre
 *   data-hm-pointer            receives --px/--py (-1..1) for layered depth
 *   data-hm-tilt               plus a tilt of at most 2.5°
 *   data-hm-magnetic           follows the pointer by a few pixels
 *   data-cursor-label="…"      shows a small label next to the pointer
 *
 * The shell element (.home-shell) also gets data-scrolled, data-past-hero,
 * data-section and data-near-footer, which CSS uses for the sticky header,
 * the active nav dot and the floating buttons. Everything is skipped for
 * reduced motion except the state attributes, which carry no motion.
 */

/** Side progress steps; ids are the section elements on the homepage. */
const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "expertise", label: "Services" },
  { id: "work", label: "Work" },
  { id: "finder", label: "Process" },
  { id: "contact", label: "Contact" },
] as const;

const STAGGER_MS = 110;
const TILT_DEG = 2.5;
const MAGNET_PX = 4;

export default function HomeMotion() {
  const [active, setActive] = useState("");
  const cursor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".home-shell");
    const root = document.querySelector<HTMLElement>(".home-below");
    if (!shell || !root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = matchMedia(
      "(pointer: fine) and (min-width: 900px)",
    ).matches;
    const cleanups: (() => void)[] = [];

    // ---- reveal ------------------------------------------------------------
    root.querySelectorAll<HTMLElement>("[data-hm-stagger]").forEach((group) => {
      group
        .querySelectorAll<HTMLElement>(":scope > [data-hm], :scope [data-hm]")
        .forEach((el, i) => {
          if (!el.style.getPropertyValue("--hm-delay"))
            el.style.setProperty("--hm-delay", `${i * STAGGER_MS}ms`);
        });
    });
    if (!reduced) {
      root.classList.add("hm-armed");
      const reveal = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-in");
            reveal.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
      );
      root.querySelectorAll("[data-hm]").forEach((el) => reveal.observe(el));
      cleanups.push(() => reveal.disconnect());
    }

    // ---- centre focus ------------------------------------------------------
    const focus = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          (entry.target as HTMLElement).toggleAttribute(
            "data-focus",
            entry.isIntersecting,
          );
      },
      { rootMargin: "-38% 0px -38% 0px" },
    );
    root.querySelectorAll("[data-hm-focus]").forEach((el) => focus.observe(el));
    cleanups.push(() => focus.disconnect());

    // ---- sections: side progress + nav dot ----------------------------------
    const sections = STEPS.map((s) => document.getElementById(s.id)).filter(
      (s): s is HTMLElement => s !== null,
    );
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).id;
          setActive(id);
          shell.dataset.section = id;
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => sectionObserver.observe(s));
    cleanups.push(() => sectionObserver.disconnect());

    // ---- header + floating controls ------------------------------------------
    const hero = document.querySelector<HTMLElement>(".home-hero-frame");
    const footer = document.querySelector<HTMLElement>(".home-footer");
    const onScroll = () => {
      shell.toggleAttribute("data-scrolled", window.scrollY > 12);
      if (hero)
        shell.toggleAttribute(
          "data-past-hero",
          hero.getBoundingClientRect().bottom < 80,
        );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));
    if (footer) {
      const footerObserver = new IntersectionObserver(([entry]) =>
        shell.toggleAttribute("data-near-footer", entry.isIntersecting),
      );
      footerObserver.observe(footer);
      cleanups.push(() => footerObserver.disconnect());
    }

    if (reduced || !finePointer) return () => cleanups.forEach((c) => c());

    // ---- pointer depth, tilt, magnetic ------------------------------------------
    const onCardMove = (event: PointerEvent) => {
      const card = event.currentTarget as HTMLElement;
      const r = card.getBoundingClientRect();
      const px = ((event.clientX - r.left) / r.width) * 2 - 1;
      const py = ((event.clientY - r.top) / r.height) * 2 - 1;
      card.style.setProperty("--px", px.toFixed(3));
      card.style.setProperty("--py", py.toFixed(3));
      if (card.hasAttribute("data-hm-tilt")) {
        card.style.setProperty("--rx", `${(-py * TILT_DEG).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${(px * TILT_DEG).toFixed(2)}deg`);
      }
    };
    const onCardLeave = (event: PointerEvent) => {
      const card = event.currentTarget as HTMLElement;
      for (const v of ["--px", "--py", "--rx", "--ry"])
        card.style.removeProperty(v);
    };
    root.querySelectorAll<HTMLElement>("[data-hm-pointer]").forEach((card) => {
      card.addEventListener("pointermove", onCardMove);
      card.addEventListener("pointerleave", onCardLeave);
      cleanups.push(() => {
        card.removeEventListener("pointermove", onCardMove);
        card.removeEventListener("pointerleave", onCardLeave);
      });
    });

    const onMagnetMove = (event: PointerEvent) => {
      const el = event.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const dx = ((event.clientX - r.left) / r.width - 0.5) * 2 * MAGNET_PX;
      const dy = ((event.clientY - r.top) / r.height - 0.5) * 2 * MAGNET_PX;
      el.style.setProperty("--mx", `${dx.toFixed(1)}px`);
      el.style.setProperty("--my", `${dy.toFixed(1)}px`);
    };
    const onMagnetLeave = (event: PointerEvent) => {
      const el = event.currentTarget as HTMLElement;
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    };
    root.querySelectorAll<HTMLElement>("[data-hm-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", onMagnetMove);
      el.addEventListener("pointerleave", onMagnetLeave);
      cleanups.push(() => {
        el.removeEventListener("pointermove", onMagnetMove);
        el.removeEventListener("pointerleave", onMagnetLeave);
      });
    });

    // ---- cursor label ---------------------------------------------------------
    const label = cursor.current;
    if (label) {
      let frame = 0;
      let x = 0;
      let y = 0;
      const place = () => {
        label.style.transform = `translate3d(${x + 16}px, ${y + 16}px, 0)`;
        frame = 0;
      };
      const onMove = (event: PointerEvent) => {
        x = event.clientX;
        y = event.clientY;
        const target = (event.target as Element | null)?.closest<HTMLElement>(
          "[data-cursor-label]",
        );
        if (target && root.contains(target)) {
          label.textContent = target.dataset.cursorLabel ?? "";
          label.dataset.visible = "";
        } else {
          delete label.dataset.visible;
        }
        if (!frame) frame = requestAnimationFrame(place);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("pointermove", onMove);
        cancelAnimationFrame(frame);
      });
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return (
    <>
      <div ref={cursor} className="hm-cursor" aria-hidden />
      <nav className="hm-progress" aria-label="Page sections">
        <ol>
          {STEPS.map((step, i) => (
            <li key={step.id}>
              <a
                href={`#${step.id}`}
                aria-current={active === step.id ? "location" : undefined}
              >
                <span className="hm-progress-num">0{i + 1}</span>
                <span className="hm-progress-label">{step.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
