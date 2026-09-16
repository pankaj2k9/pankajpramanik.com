"use client";
import { useEffect, useRef, useState } from "react";

export type TocItem = { id: string; text: string; level: number };

/**
 * Reading progress bar plus the sticky table of contents. The active entry
 * follows the heading nearest the top of the viewport.
 */
export default function ArticleReader({ toc }: { toc: TocItem[] }) {
  const [active, setActive] = useState(toc[0]?.id ?? "");
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>(".ar-body");
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!article || !bar.current) return;
        const start = article.offsetTop;
        const distance = article.offsetHeight - window.innerHeight * 0.6;
        const progress = Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(distance, 1)));
        bar.current.style.scale = `${progress} 1`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const headings = toc
      .map((t) => document.getElementById(t.id))
      .filter((h): h is HTMLElement => h !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-90px 0px -70% 0px" },
    );
    headings.forEach((h) => observer.observe(h));

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [toc]);

  return (
    <>
      <div className="ar-progress" aria-hidden>
        <div ref={bar} />
      </div>
      {toc.length > 1 && (
        <nav className="ar-toc" aria-label="On this page">
          <p className="hm-label">On this page</p>
          <ol>
            {toc.map((t) => (
              <li key={t.id} data-level={t.level}>
                <a href={`#${t.id}`} aria-current={active === t.id ? "location" : undefined}>
                  {t.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </>
  );
}
