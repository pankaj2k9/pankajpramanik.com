"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import ThemeToggle from "./ThemeToggle";
import { site } from "@/lib/site";
const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Projects" },
  { href: "/blog", label: "Journal" },
];
/** Homepage section in view -> the nav item it belongs to (null = none). */
const HOME_SECTION_LINK: Record<string, string | null> = {
  intro: "/",
  expertise: "/services",
  work: "/portfolio",
  finder: "/services",
  contact: null,
};

/** Reads data-section, which PageMotion keeps in sync with the section in view. */
function subscribeSection(onChange: () => void) {
  const shell = document.querySelector(".home-shell");
  if (!shell) return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(shell, { attributes: true, attributeFilter: ["data-section"] });
  return () => observer.disconnect();
}
const readSection = () => document.querySelector<HTMLElement>(".home-shell")?.dataset.section ?? "intro";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  const section = useSyncExternalStore(subscribeSection, readSection, () => "intro");
  const onHome = pathname === "/";
  // Exactly one item is highlighted: on the homepage the one for the section
  // in view, elsewhere the one for the current route.
  const activeHref = onHome
    ? (HOME_SECTION_LINK[section] ?? null)
    : (links.find((l) => l.href !== "/" && pathname.startsWith(l.href))?.href ?? null);
  const current = (href: string) =>
    href !== activeHref ? undefined : href === pathname ? ("page" as const) : ("location" as const);
  const expandedCurrent = (href: string) =>
    (href === "/" ? onHome : pathname.startsWith(href)) ? ("page" as const) : undefined;
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="header-inner">
        <Link
          href="/"
          className="brand"
          onClick={() => setOpen(false)}
          aria-label="Pankaj Kumar Pramanik, home"
        >
          <span className="brand-mark" aria-hidden>
            ✳
          </span>
          PANKAJ<span className="brand-last"> PRAMANIK</span>
          <span className="coral-dot">.</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current(l.href)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <Link
            href="/contact"
            className="header-contact"
            data-active={(onHome && section === "contact") || pathname.startsWith("/contact") || undefined}
          >
            LET’S TALK <span aria-hidden>↗</span>
          </Link>
          <button
            ref={toggle}
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden>{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="site-menu"
          className="expanded-nav"
          aria-label="More navigation"
        >
          {[
            ...links,
            { href: "/experience", label: "Experience" },
            { href: "/skills", label: "Skills" },
            { href: "/contact", label: "Contact" },
            { href: "/booking", label: "Book a meeting" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={expandedCurrent(l.href)}
              onClick={() => setOpen(false)}
            >
              {l.label}
              <span aria-hidden>↗</span>
            </Link>
          ))}
          <a href={site.cv} download>
            Download CV ↓
          </a>
        </nav>
      )}
    </header>
  );
}
