import Link from "next/link";
import MusicPlayer from "@/components/site/MusicPlayer";

/**
 * Homepage shell: minimal overlay navigation on top of the full-screen
 * Three.js experience. Deliberately no footer and no site header chrome.
 *
 * The header is `fixed`, not `absolute`. It used to sit inside a non-scrolling
 * `h-dvh overflow-hidden` wrapper, where absolute positioning was effectively
 * fixed; now that the page itself scrolls, absolute would scroll it away.
 */
export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="force-dark relative">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30">
        <div className="pointer-events-auto mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight text-white"
          >
            Pankaj<span className="text-gradient">.</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            {[
              { href: "/about", label: "About" },
              { href: "/services", label: "Services", hideOnMobile: true },
              { href: "/portfolio", label: "Portfolio" },
              { href: "/experience", label: "Experience", hideOnMobile: true },
              { href: "/blog", label: "Blog", hideOnMobile: true },
              { href: "/contact", label: "Contact" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-white/70 transition hover:text-white sm:px-3 ${
                  l.hideOnMobile ? "hidden md:block" : ""
                }`}
              >
                {l.label}
              </Link>
            ))}
            <a
              href="/Pankaj_Kumar_Pramanik_AI_Data_Engineer_CV.pdf"
              download
              className="ml-1 rounded-lg border border-white/25 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:border-white/60 sm:ml-2"
            >
              CV
            </a>
          </nav>
        </div>
      </header>
      {children}
      <MusicPlayer />
    </div>
  );
}
