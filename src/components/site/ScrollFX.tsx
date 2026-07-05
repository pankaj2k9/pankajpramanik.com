"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * Inner-page scroll experience:
 *  - Lenis smooth scrolling (lerp-based for a soft, floaty feel; fresh
 *    instance per route so navigation can never leave a stuck one)
 *  - content blocks fade in as they enter the viewport and fade back
 *    out as they leave, in both scroll directions
 * Fully disabled for prefers-reduced-motion users.
 */
export default function ScrollFX() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: 0.09, // lower = smoother/floatier
      smoothWheel: true,
      wheelMultiplier: 0.9,
      autoRaf: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    lenis.scrollTo(0, { immediate: true, force: true });

    const ctx = gsap.context(() => {
      // page header entrance
      const h1 = document.querySelector("main h1");
      if (h1) {
        gsap.fromTo(
          h1,
          { y: 26, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
        );
      }

      // cards + section headings: fade/slide in when entering, fade out
      // when leaving — both scroll directions
      const blocks = gsap.utils.toArray<HTMLElement>(
        "main .card, main section > h2, main [data-reveal]"
      );
      for (const el of blocks) {
        gsap.fromTo(
          el,
          { y: 34, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 94%",
              end: "bottom 6%",
              // onEnter / onLeave / onEnterBack / onLeaveBack
              toggleActions: "play reverse play reverse",
            },
          }
        );
      }
    });

    const refreshId = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(refreshId);
      ctx.revert();
      lenis.destroy();
    };
  }, [pathname]);

  return null;
}
