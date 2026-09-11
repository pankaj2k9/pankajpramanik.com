"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { setLenis } from "@/lib/lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * The page's scroll experience: Lenis for momentum, ScrollTrigger for reveals.
 *
 * Mounted once in the root layout so the homepage and interior pages share the
 * same feel. Fully disabled for `prefers-reduced-motion`.
 *
 * Three things here are deliberate, and each fixes a specific defect:
 *
 *  1. `autoRaf: false`. Lenis used to run its own requestAnimationFrame loop
 *     alongside GSAP's ticker. Two loops meant Lenis and ScrollTrigger sampled
 *     scroll position at different moments within the same frame, which is
 *     what produced the jitter. One ticker drives both now.
 *
 *  2. `lagSmoothing(0)`. After a long task GSAP normally fabricates a catch-up
 *     frame, which makes a Lenis-driven page lurch. Turning it off keeps the
 *     scroll honest about how much time actually passed.
 *
 *  3. Reveals play once. They used to be `play reverse play reverse`, so every
 *     block faded back out on the way past and replayed on the way up. That
 *     reads as flicker rather than polish.
 */
export default function ScrollFX() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      // Lower than before: 0.16 with a 1.25 multiplier overshot and felt loose.
      lerp: 0.09,
      wheelMultiplier: 1,
      smoothWheel: true,
      // Touch scrolls natively. Smoothing it fights iOS's own momentum, and
      // loses every time.
      syncTouch: false,
      autoRaf: false,
    });
    setLenis(lenis);

    lenis.on("scroll", ScrollTrigger.update);

    // GSAP's ticker is in seconds, Lenis wants milliseconds.
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // A mobile URL bar collapsing is a resize; without this every trigger
    // recalculates mid-scroll.
    ScrollTrigger.config({ ignoreMobileResize: true });

    lenis.scrollTo(0, { immediate: true, force: true });

    const ctx = gsap.context(() => {
      const h1 = document.querySelector("main h1");
      if (h1) {
        gsap.fromTo(
          h1,
          { y: 26, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
        );
      }

      const blocks = gsap.utils.toArray<HTMLElement>(
        "main .card, main section > h2, main [data-reveal]"
      );
      if (blocks.length) {
        gsap.set(blocks, { y: 34, opacity: 0, scale: 0.98 });

        // One batched trigger for the whole set rather than one per element,
        // and a stagger so a grid reveals as a wave instead of a wall.
        ScrollTrigger.batch(blocks, {
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.64,
              ease: "power2.out",
              stagger: 0.09,
              overwrite: true,
            }),
        });
      }
    });

    // In-page anchors have to go through Lenis too, or they jump while
    // everything else glides.
    const onAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>(
        'a[href^="#"]'
      );
      const hash = link?.getAttribute("href");
      if (!link || !hash || hash === "#") return;

      // The href comes from migrated WordPress HTML, which the sanitizer
      // permits `href` on. A value like `#a"]` is a valid attribute but an
      // invalid selector, and querySelector throws SyntaxError on it — an
      // uncaught exception inside a click handler. Fall back to the browser's
      // own anchor handling rather than swallowing the click.
      let el: HTMLElement | null = null;
      try {
        el = document.querySelector<HTMLElement>(hash);
      } catch {
        return;
      }
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -80 });
      history.pushState(null, "", hash);
    };
    document.addEventListener("click", onAnchorClick);

    // Triggers measured against a pre-webfont, pre-image layout fire at the
    // wrong scroll positions. Re-measure once both have settled.
    const refresh = () => ScrollTrigger.refresh();
    const raf1 = requestAnimationFrame(refresh);
    document.fonts?.ready.then(refresh).catch(() => {});

    const images = Array.from(document.images).filter((img) => !img.complete);
    let pending = images.length;
    const onImage = () => {
      pending -= 1;
      if (pending <= 0) refresh();
    };
    for (const img of images) {
      img.addEventListener("load", onImage, { once: true });
      img.addEventListener("error", onImage, { once: true });
    }

    return () => {
      cancelAnimationFrame(raf1);
      document.removeEventListener("click", onAnchorClick);
      for (const img of images) {
        img.removeEventListener("load", onImage);
        img.removeEventListener("error", onImage);
      }
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis.destroy();
      setLenis(null);
    };
  }, [pathname]);

  return null;
}
