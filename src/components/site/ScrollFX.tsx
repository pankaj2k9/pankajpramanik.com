"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export default function ScrollFX() {
  const pathname = usePathname();
  useEffect(() => {
    if (
      pathname.startsWith("/admin") ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            element.animate(
              [{ transform: "translateY(18px)" }, { transform: "none" }],
              { duration: 600, easing: "cubic-bezier(.2,.7,.2,1)" },
            );
            observer.unobserve(element);
          }
      },
      { threshold: 0.08 },
    );
    document
      .querySelectorAll("[data-reveal]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
