"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";

/**
 * Theme-aware custom cursor.
 *
 * Two layers: a dot that tracks the pointer exactly, and a ring that lags
 * behind it. The ring's lag is driven by `gsap.quickTo`, which reuses a single
 * tween instead of allocating a new one on every `mousemove` — the difference
 * shows at 120Hz.
 *
 * The two theme variants are defined entirely in CSS (see `globals.css`), so
 * this component never reads `data-theme`. A theme switch cross-fades for free
 * through the transitions on those rules.
 *
 * Deliberately absent:
 *  - touch devices (`pointer: fine` only) — nothing renders at all
 *  - `prefers-reduced-motion: reduce`
 *  - `/admin`, which is a working tool rather than a showcase
 *
 * `cursor: none` is applied from here rather than from a stylesheet, so a JS
 * failure can never leave a visitor with no cursor.
 */

const FINE = "(pointer: fine)";
const REDUCED = "(prefers-reduced-motion: reduce)";

/** Elements that get the "interactive" ring without opting in by hand. */
const INTERACTIVE = 'a, button, [role="button"], summary, label[for]';
const TEXT_INPUT = "input:not([type=checkbox]):not([type=radio]), textarea, select";

/**
 * `false` during SSR so the markup matches, real preference on the client.
 * Subscribing beats an effect here: a visitor can change their reduced-motion
 * setting, or move from a trackpad to a touchscreen, mid-session.
 */
function subscribeMedia(onChange: () => void) {
  const fine = window.matchMedia(FINE);
  const reduced = window.matchMedia(REDUCED);
  fine.addEventListener("change", onChange);
  reduced.addEventListener("change", onChange);
  return () => {
    fine.removeEventListener("change", onChange);
    reduced.removeEventListener("change", onChange);
  };
}

function readMedia() {
  return (
    window.matchMedia(FINE).matches && !window.matchMedia(REDUCED).matches
  );
}

export default function CustomCursor() {
  const pathname = usePathname();
  const supported = useSyncExternalStore(subscribeMedia, readMedia, () => false);

  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  // The label rides in its own layer. Putting it inside the ring would subject
  // the text to the ring's squash-and-stretch and smear it.
  const labelRef = useRef<HTMLDivElement>(null);

  // /admin is a working tool, not a showcase.
  const enabled = supported && !pathname.startsWith("/admin");

  useEffect(() => {
    const ring = ringRef.current;
    const dot = dotRef.current;
    const label = labelRef.current;
    if (!enabled || !ring || !dot || !label) return;

    const root = document.documentElement;
    root.classList.add("has-custom-cursor");

    // Start off-screen so the cursor never flashes at 0,0 before the first move.
    gsap.set([ring, dot, label], { x: -100, y: -100 });

    const ringX = gsap.quickTo(ring, "x", { duration: 0.4, ease: "power3" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.4, ease: "power3" });
    const dotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power2" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power2" });
    // Squash along the direction of travel. Light theme leans on this hardest:
    // it is what makes the ink blot feel like a liquid rather than a disc.
    const ringRotate = gsap.quickTo(ring, "rotation", { duration: 0.2, ease: "power2" });
    const ringScaleX = gsap.quickTo(ring, "scaleX", { duration: 0.25, ease: "power2" });
    const ringScaleY = gsap.quickTo(ring, "scaleY", { duration: 0.25, ease: "power2" });
    const labelX = gsap.quickTo(label, "x", { duration: 0.4, ease: "power3" });
    const labelY = gsap.quickTo(label, "y", { duration: 0.4, ease: "power3" });

    let lastX = 0;
    let lastY = 0;
    let lastT = performance.now();
    let seen = false;

    // Magnetic targets, re-collected per route rather than per frame.
    let magnets: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>("[data-magnetic]")
    );
    const magnetTweens = new WeakMap<HTMLElement, gsap.QuickToFunc[]>();
    const quickForMagnet = (el: HTMLElement) => {
      let q = magnetTweens.get(el);
      if (!q) {
        q = [
          gsap.quickTo(el, "x", { duration: 0.45, ease: "elastic.out(1, 0.5)" }),
          gsap.quickTo(el, "y", { duration: 0.45, ease: "elastic.out(1, 0.5)" }),
        ];
        magnetTweens.set(el, q);
      }
      return q;
    };

    const onMove = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e;

      if (!seen) {
        seen = true;
        gsap.set([ring, dot, label], { x, y });
        root.classList.add("cursor-ready");
        lastX = x;
        lastY = y;
      }

      ringX(x);
      ringY(y);
      dotX(x);
      dotY(y);
      labelX(x);
      labelY(y);

      // Velocity → squash. Capped so a fast flick does not tear it apart.
      const now = performance.now();
      const dt = Math.max(now - lastT, 8);
      const dx = x - lastX;
      const dy = y - lastY;
      const speed = Math.min(Math.hypot(dx, dy) / dt, 3);
      if (speed > 0.15) {
        ringRotate((Math.atan2(dy, dx) * 180) / Math.PI);
        ringScaleX(1 + speed * 0.28);
        ringScaleY(1 - speed * 0.16);
      } else {
        ringScaleX(1);
        ringScaleY(1);
      }
      lastX = x;
      lastY = y;
      lastT = now;

      // Magnetic pull. The element moves toward the pointer, not the cursor.
      for (const el of magnets) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        const radius = Math.max(r.width, r.height) * 0.9 + 40;
        const [mx, my] = quickForMagnet(el);
        if (dist < radius) {
          const pull = (1 - dist / radius) * 6;
          mx(((x - cx) / radius) * pull * 2);
          my(((y - cy) / radius) * pull * 2);
        } else {
          mx(0);
          my(0);
        }
      }
    };

    /** Resolve what the pointer is over into a single cursor state. */
    const onOver = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== "function") return;

      const opted = target.closest<HTMLElement>("[data-cursor]");
      const mode = opted?.dataset.cursor;

      root.classList.remove("cursor-link", "cursor-view", "cursor-text");
      label.textContent = "";

      if (mode && mode !== "link" && mode !== "text") {
        // data-cursor="View" renders that word inside the ring.
        label.textContent = mode;
        root.classList.add("cursor-view");
        return;
      }
      if (mode === "text" || target.closest(TEXT_INPUT)) {
        root.classList.add("cursor-text");
        return;
      }
      if (mode === "link" || target.closest(INTERACTIVE)) {
        root.classList.add("cursor-link");
      }
    };

    const onDown = () => root.classList.add("cursor-down");
    const onUp = () => root.classList.remove("cursor-down");
    const onLeave = () => root.classList.remove("cursor-ready");
    const onEnter = () => {
      if (seen) root.classList.add("cursor-ready");
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);

    // New route, new magnetic elements.
    const refresh = () => {
      magnets = Array.from(document.querySelectorAll<HTMLElement>("[data-magnetic]"));
    };
    const refreshId = window.setTimeout(refresh, 0);

    return () => {
      window.clearTimeout(refreshId);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
      for (const el of magnets) gsap.set(el, { x: 0, y: 0 });
      root.classList.remove(
        "has-custom-cursor",
        "cursor-ready",
        "cursor-link",
        "cursor-view",
        "cursor-text",
        "cursor-down"
      );
    };
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden />
      <div ref={labelRef} className="cursor-label" aria-hidden />
      <div ref={dotRef} className="cursor-dot" aria-hidden />
    </>
  );
}
