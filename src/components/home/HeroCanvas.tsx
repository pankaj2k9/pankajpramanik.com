"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

/**
 * Client wrapper that lazy-loads the Three.js hero only on the homepage,
 * only in the browser, and only for users who don't prefer reduced motion.
 * Everyone else gets the pure-CSS gradient fallback (also the loading state),
 * so three.js never blocks first paint and never ships to other pages.
 */
const Hero3D = dynamic(() => import("./Hero3D"), {
  ssr: false,
  loading: () => null,
});

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(reducedMotionQuery);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export default function HeroCanvas() {
  // false during SSR, real preference on the client
  const enabled = useSyncExternalStore(
    subscribeReducedMotion,
    () => !window.matchMedia(reducedMotionQuery).matches,
    () => false
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* static gradient glow — fallback + backdrop under the particles */}
      <div
        className="absolute left-1/2 top-1/3 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, #6366f1 0%, #8b5cf6 45%, transparent 100%)",
        }}
      />
      {enabled && (
        <div className="absolute inset-0 opacity-80 [&_canvas]:!pointer-events-none">
          <Hero3D />
        </div>
      )}
      {/* fade the scene into the page background */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
