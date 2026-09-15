"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { site } from "@/lib/site";
const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Projects" },
  { href: "/blog", label: "Journal" },
];
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
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
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
          aria-label="Pankaj Pramanik home"
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
              aria-current={active(l.href) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <Link href="/contact" className="header-contact">
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
          <Link
            href="/about"
            className="header-avatar rounded-full"
            aria-label="About Pankaj"
          >
            <Image
              src={site.photo}
              alt=""
              width={80}
              height={80}
              className="rounded-full"
            />
          </Link>
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
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active(l.href) ? "page" : undefined}
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
