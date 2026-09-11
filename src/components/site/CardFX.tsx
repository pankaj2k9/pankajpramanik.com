"use client";

import { useEffect } from "react";

/**
 * Feeds the pointer position into whichever `.card` is under it, as the
 * `--mx` / `--my` custom properties that `globals.css` paints its radial glow
 * from.
 *
 * One delegated listener on the document rather than a handler per card. The
 * cards themselves are server components, so this also keeps them from having
 * to become client components just to track a pointer.
 */
export default function CardFX() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let current: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const card = target?.closest?.<HTMLElement>(".card") ?? null;

      if (card !== current) {
        // Leave the previous card centred so its glow fades out from the
        // middle rather than snapping to wherever the pointer exited.
        current?.style.removeProperty("--mx");
        current?.style.removeProperty("--my");
        current = card;
      }
      if (!card) return;

      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      current?.style.removeProperty("--mx");
      current?.style.removeProperty("--my");
    };
  }, []);

  return null;
}
