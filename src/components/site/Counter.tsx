"use client";

import { useEffect, useRef } from "react";

/**
 * A number that counts up the first time it scrolls into view.
 *
 * Server-renders the final value, so the real number is in the HTML for search
 * engines and for anyone without JavaScript. The animation only ever replaces
 * text content that is already correct.
 */
export default function Counter({
  value,
  suffix = "",
  prefix = "",
  duration = 1600,
  className,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const format = (n: number) => `${prefix}${Math.round(n).toLocaleString()}${suffix}`;
    let frame = 0;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.disconnect();

          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            // easeOutExpo — fast out of the gate, long settle on the number
            const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
            el.textContent = format(value * eased);
            if (t < 1) frame = requestAnimationFrame(tick);
          };
          el.textContent = format(0);
          frame = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, suffix, prefix, duration]);

  return (
    <span ref={ref} className={className}>
      {`${prefix}${value.toLocaleString()}${suffix}`}
    </span>
  );
}
