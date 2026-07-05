"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * Inner-page scroll experience:
 *  - Lenis smooth scrolling driven by GSAP's ticker
 *  - a thin gradient progress line fixed to the top of the viewport
 *  - ScrollTrigger reveal animations for cards/headers as they enter
 * Re-initialises the reveals on every route change; fully disabled for
 * prefers-reduced-motion users.
 */
export default function ScrollFX() {
  const pathname = usePathname();

  // Lenis lives once for the whole (site) group
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  // per-route reveal animations + progress line
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // progress line
      gsap.fromTo(
        "#scroll-progress",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
        }
      );

      // page header entrance
      const h1 = document.querySelector("main h1");
      if (h1) {
        gsap.fromTo(
          h1,
          { y: 26, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
        );
      }

      // cards float in as they enter the viewport
      const cards = gsap.utils.toArray<HTMLElement>("main .card");
      if (cards.length) {
        gsap.set(cards, { y: 30, opacity: 0 });
        ScrollTrigger.batch(cards, {
          start: "top 90%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              opacity: 1,
              duration: 0.7,
              stagger: 0.07,
              ease: "power3.out",
              overwrite: true,
            }),
        });
        // safety net: anything never triggered (e.g. layout shifts) fades in
        ScrollTrigger.refresh();
      }
    });

    // scroll to top on navigation (Lenis keeps position otherwise)
    window.scrollTo(0, 0);

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [pathname]);

  return (
    <div
      id="scroll-progress"
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left"
      style={{
        transform: "scaleX(0)",
        background: "linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)",
      }}
    />
  );
}
