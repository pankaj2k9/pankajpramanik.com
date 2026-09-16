"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Shared interaction layer for the homepage and inner pages. Markup opts in
 * with data attributes, so sections can stay server-rendered:
 *
 *   data-hm="up|left|right|scale|line"  reveal once on entry
 *   data-hm-stagger                     data-hm descendants reveal in sequence
 *   data-hm-focus                       data-focus while near the viewport centre
 *   data-hm-fill                        --fill (0..1): how far the element has
 *                                       scrolled past the viewport centre
 *   data-hm-pointer                     --px/--py (-1..1) for layered depth
 *   data-hm-tilt                        plus a tilt of at most 2.5°
 *   data-hm-magnetic                    follows the pointer by a few pixels
 *   data-cursor-label="…"               small label next to the pointer
 *
 * Elements added later (filters, tabs) are picked up by a MutationObserver.
 * The shell gets data-scrolled, data-past-hero, data-section and
 * data-near-footer for the header, nav dot and floating controls. Reduced
 * motion skips reveals, pointer effects and the cursor label.
 */

export type MotionStep = { id: string; label: string };

const STAGGER_MS = 100;
const TILT_DEG = 2.5;
const MAGNET_PX = 4;

export default function PageMotion({
  steps = [],
  shell: shellSelector = ".inner-shell",
  root: rootSelector = "main",
  hero: heroSelector = ".ip-hero",
}: {
  steps?: MotionStep[];
  shell?: string;
  root?: string;
  hero?: string;
}) {
  const [active, setActive] = useState("");
  const cursor = useRef<HTMLDivElement>(null);
  const stepKey = steps.map((s) => s.id).join(",");

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(shellSelector);
    const root = document.querySelector<HTMLElement>(rootSelector);
    if (!shell || !root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = matchMedia("(pointer: fine) and (min-width: 900px)").matches;
    const cleanups: (() => void)[] = [];

    // ---- reveal, focus, fill (re-run for added nodes) ------------------------
    const reveal = reduced
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.classList.add("is-in");
              reveal?.unobserve(entry.target);
            }
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
        );
    const focus = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          (entry.target as HTMLElement).toggleAttribute("data-focus", entry.isIntersecting);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    const fills = new Set<HTMLElement>();
    const scan = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>("[data-hm-stagger]").forEach((group) => {
        group.querySelectorAll<HTMLElement>("[data-hm]").forEach((el, i) => {
          if (!el.style.getPropertyValue("--hm-delay"))
            el.style.setProperty("--hm-delay", `${Math.min(i, 8) * STAGGER_MS}ms`);
        });
      });
      scope.querySelectorAll<HTMLElement>("[data-hm]:not(.is-in)").forEach((el) => {
        if (reveal) reveal.observe(el);
      });
      scope.querySelectorAll("[data-hm-focus]").forEach((el) => focus.observe(el));
      scope.querySelectorAll<HTMLElement>("[data-hm-fill]").forEach((el) => fills.add(el));
    };
    if (!reduced) root.classList.add("hm-armed");
    scan(root);
    const mutations = new MutationObserver((records) => {
      for (const record of records)
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches("[data-hm], [data-hm-focus], [data-hm-fill]")) scan(node.parentElement ?? node);
          else scan(node);
        });
    });
    mutations.observe(root, { childList: true, subtree: true });
    cleanups.push(() => {
      reveal?.disconnect();
      focus.disconnect();
      mutations.disconnect();
    });

    // ---- sections: side progress ---------------------------------------------
    const sections = steps
      .map((s) => document.getElementById(s.id))
      .filter((s): s is HTMLElement => s !== null);
    if (sections.length) {
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
    }

    // ---- scroll state: header, fills --------------------------------------------
    const hero = document.querySelector<HTMLElement>(heroSelector);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        shell.toggleAttribute("data-scrolled", window.scrollY > 12);
        if (hero) shell.toggleAttribute("data-past-hero", hero.getBoundingClientRect().bottom < 80);
        const mid = window.innerHeight * 0.5;
        fills.forEach((el) => {
          if (!el.isConnected) return fills.delete(el);
          const r = el.getBoundingClientRect();
          const value = Math.min(1, Math.max(0, (mid - r.top) / Math.max(r.height, 1)));
          el.style.setProperty("--fill", value.toFixed(3));
        });
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    });

    const footer = document.querySelector<HTMLElement>(".home-footer");
    if (footer) {
      const footerObserver = new IntersectionObserver(([entry]) =>
        shell.toggleAttribute("data-near-footer", entry.isIntersecting),
      );
      footerObserver.observe(footer);
      cleanups.push(() => footerObserver.disconnect());
    }

    if (reduced || !finePointer) return () => cleanups.forEach((c) => c());

    // ---- pointer depth, tilt, magnetic, cursor label (delegated) ------------------
    let card: HTMLElement | null = null;
    let magnet: HTMLElement | null = null;
    const label = cursor.current;
    let labelFrame = 0;
    let x = 0;
    let y = 0;
    const clearCard = () => {
      if (!card) return;
      for (const v of ["--px", "--py", "--rx", "--ry"]) card.style.removeProperty(v);
      card = null;
    };
    const clearMagnet = () => {
      if (!magnet) return;
      magnet.style.removeProperty("--mx");
      magnet.style.removeProperty("--my");
      magnet = null;
    };
    const onMove = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const nextCard = target?.closest<HTMLElement>("[data-hm-pointer]") ?? null;
      if (nextCard !== card) clearCard();
      if (nextCard && root.contains(nextCard)) {
        card = nextCard;
        const r = card.getBoundingClientRect();
        const px = ((event.clientX - r.left) / r.width) * 2 - 1;
        const py = ((event.clientY - r.top) / r.height) * 2 - 1;
        card.style.setProperty("--px", px.toFixed(3));
        card.style.setProperty("--py", py.toFixed(3));
        if (card.hasAttribute("data-hm-tilt")) {
          card.style.setProperty("--rx", `${(-py * TILT_DEG).toFixed(2)}deg`);
          card.style.setProperty("--ry", `${(px * TILT_DEG).toFixed(2)}deg`);
        }
      }
      const nextMagnet = target?.closest<HTMLElement>("[data-hm-magnetic]") ?? null;
      if (nextMagnet !== magnet) clearMagnet();
      if (nextMagnet && root.contains(nextMagnet)) {
        magnet = nextMagnet;
        const r = magnet.getBoundingClientRect();
        magnet.style.setProperty("--mx", `${(((event.clientX - r.left) / r.width - 0.5) * 2 * MAGNET_PX).toFixed(1)}px`);
        magnet.style.setProperty("--my", `${(((event.clientY - r.top) / r.height - 0.5) * 2 * MAGNET_PX).toFixed(1)}px`);
      }
      if (label) {
        x = event.clientX;
        y = event.clientY;
        const labelled = target?.closest<HTMLElement>("[data-cursor-label]");
        if (labelled && root.contains(labelled)) {
          label.textContent = labelled.dataset.cursorLabel ?? "";
          label.dataset.visible = "";
        } else delete label.dataset.visible;
        if (!labelFrame)
          labelFrame = requestAnimationFrame(() => {
            label.style.transform = `translate3d(${x + 16}px, ${y + 16}px, 0)`;
            labelFrame = 0;
          });
      }
    };
    const onLeave = () => {
      clearCard();
      clearMagnet();
      if (label) delete label.dataset.visible;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    cleanups.push(() => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(labelFrame);
      onLeave();
    });

    return () => cleanups.forEach((c) => c());
    // stepKey stands in for the steps array, which is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellSelector, rootSelector, heroSelector, stepKey]);

  return (
    <>
      <div ref={cursor} className="hm-cursor" aria-hidden />
      {steps.length > 0 && (
        <nav className="hm-progress" aria-label="Page sections">
          <ol>
            {steps.map((step, i) => (
              <li key={step.id}>
                <a href={`#${step.id}`} aria-current={active === step.id ? "location" : undefined}>
                  <span className="hm-progress-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="hm-progress-label">{step.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </>
  );
}
