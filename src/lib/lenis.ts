import type Lenis from "lenis";

/**
 * Module-level handle on the single Lenis instance created by `ScrollFX`.
 *
 * Anything that wants to scroll the page has to go through Lenis. Native
 * `scrollIntoView({ behavior: "smooth" })` is inert while Lenis is running,
 * because Lenis sets `scroll-behavior: auto !important` on the document — so a
 * component calling it directly would jump instead of glide, or do nothing.
 */
let instance: Lenis | null = null;

export function setLenis(next: Lenis | null) {
  instance = next;
}

export function getLenis(): Lenis | null {
  return instance;
}

/**
 * Scroll to an element (or absolute offset), gracefully degrading to native
 * scrolling when Lenis is not running — which is the case for
 * `prefers-reduced-motion` visitors, where an instant jump is the correct
 * behaviour anyway.
 */
export function scrollToTarget(
  target: HTMLElement | number,
  options?: { offset?: number; immediate?: boolean }
) {
  const lenis = getLenis();
  if (lenis) {
    lenis.scrollTo(target, {
      offset: options?.offset ?? 0,
      immediate: options?.immediate ?? false,
    });
    return;
  }
  if (typeof target === "number") {
    window.scrollTo({ top: target });
  } else {
    target.scrollIntoView({ block: "start" });
  }
}
