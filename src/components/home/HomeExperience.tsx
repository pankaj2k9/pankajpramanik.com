"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import SocialLinks from "@/components/site/SocialLinks";
import Ticker from "@/components/site/Ticker";
import Counter from "@/components/site/Counter";
import { site } from "@/lib/site";
import { scrollToTarget } from "@/lib/lenis";
import { cn } from "@/lib/utils";

const NeuralScene = dynamic(() => import("./NeuralScene"), {
  ssr: false,
  loading: () => null,
});

const SLIDES = ["intro", "work", "contact"] as const;

const AVAILABILITY = [
  "Available for new projects",
  "AI & Data Engineering",
  "LLM · RAG · Agentic systems",
  "Remote worldwide",
  "Open to contract & full-time",
];

/** Headline numbers for the "what I build" section. */
const STATS = [
  { value: 8, suffix: "+", label: "years shipping production systems" },
  { value: 40, suffix: "+", label: "data & AI pipelines delivered" },
  { value: 20, suffix: "+", label: "services offered end to end" },
];

const CAPABILITIES = [
  { label: "LLM & RAG Systems", href: "/services/llm-rag-developer-hire" },
  { label: "Agentic AI", href: "/services/ai-chatbot-agent-designer" },
  { label: "MLOps Pipelines", href: "/services/hire-the-perfect-mlops-developer" },
  { label: "Data Engineering", href: "/services/data-engineering-excellence" },
  { label: "Machine Learning", href: "/services/data-science-and-machine-learning" },
];

/**
 * Full-viewport homepage experience: a persistent Three.js neural scene fixed
 * behind three full-screen sections. GSAP animates each section's copy in as it
 * becomes active, and the scene's palette follows the active section.
 *
 * The sections used to live in their own scroll-snapped `overflow-y-auto`
 * element. Lenis attaches to the window, so it never touched that scroller and
 * the landing page silently had no smooth scrolling at all while every other
 * page did. Snap and momentum smoothing also pull against each other. The page
 * now scrolls normally, through the same Lenis instance as everywhere else.
 */
const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const mql = window.matchMedia(motionQuery);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export default function HomeExperience() {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // false during SSR; real preference on the client
  const sceneOn = useSyncExternalStore(
    subscribeMotion,
    () => !window.matchMedia(motionQuery).matches,
    () => false
  );

  // track which slide is in view
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-slide]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(Number((e.target as HTMLElement).dataset.slide));
          }
        }
      },
      { threshold: 0.55 }
    );
    panels.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, []);

  // animate the active slide's copy in
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const panel = root.querySelector<HTMLElement>(`[data-slide="${active}"]`);
    if (!panel) return;
    const targets = panel.querySelectorAll("[data-fx]");
    gsap.fromTo(
      targets,
      { y: 34, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, stagger: 0.09, ease: "power3.out" }
    );
  }, [active]);

  function goTo(i: number) {
    const panel = scroller.current?.querySelector<HTMLElement>(
      `[data-slide="${i}"]`
    );
    if (panel) scrollToTarget(panel);
  }

  return (
    <div className="force-dark relative bg-background text-foreground">
      {/* persistent 3D scene */}
      <div className="fixed inset-0 z-0" aria-hidden>
        <div
          className="absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, #6366f1 0%, #8b5cf6 50%, transparent 100%)",
          }}
        />
        {sceneOn && <NeuralScene slide={active} />}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(7,8,15,0.85)_100%)]" />
      </div>

      {/* slide dots */}
      <nav
        className="fixed right-5 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3 sm:right-8"
        aria-label="Homepage sections"
      >
        {SLIDES.map((s, i) => (
          <button
            key={s}
            onClick={() => goTo(i)}
            aria-label={`Go to ${s}`}
            aria-current={active === i}
            className={cn(
              "h-2.5 w-2.5 rounded-full border transition-all",
              active === i
                ? "scale-125 border-accent bg-accent"
                : "border-border-strong bg-transparent hover:border-accent"
            )}
          />
        ))}
      </nav>

      {/* scroll hint */}
      {active < SLIDES.length - 1 && (
        <button
          onClick={() => goTo(active + 1)}
          className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 text-faint transition hover:text-accent"
          aria-label="Scroll to next section"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce" aria-hidden>
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* slides */}
      <div
        ref={scroller}
        className="relative z-10"
      >
        {/* ---- slide 1: intro ---- */}
        <section
          data-slide="0"
          className="flex h-dvh flex-col items-center justify-center px-6 text-center"
        >
          <p
            data-fx
            className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-4 py-1.5 text-sm font-medium text-emerald"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald" />
            Available for new projects
          </p>
          <h1
            data-fx
            className="mt-8 max-w-5xl font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl"
          >
            Data Scientist
            <br />
            <span className="text-gradient">&amp; AI Engineer</span>
          </h1>
          <p data-fx className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
            I&apos;m {site.name.split(" ")[0]} — I turn raw data into
            intelligent, production-ready systems. Agentic AI, LLM &amp; RAG
            applications, MLOps, and modern data platforms.
          </p>
          <div data-fx className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/portfolio"
              data-magnetic
              className="rounded-xl bg-accent-strong px-7 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90"
            >
              View My Work
            </Link>
            <Link
              href="/about"
              className="rounded-xl border border-border-strong px-7 py-3.5 font-semibold transition hover:border-accent hover:text-accent"
            >
              About Me
            </Link>
          </div>

          <div data-fx className="mt-14 w-screen">
            <Ticker items={AVAILABILITY} />
          </div>
        </section>

        {/* ---- slide 2: what I build ---- */}
        <section
          data-slide="1"
          className="flex h-dvh flex-col justify-center px-6"
        >
          <div className="mx-auto w-full max-w-4xl">
            <p data-fx className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald">
              What I build
            </p>
            <ul className="mt-8 space-y-2">
              {CAPABILITIES.map((c, i) => (
                <li key={c.href} data-fx>
                  <Link
                    href={c.href}
                    className="group flex items-baseline gap-4 border-b border-border/60 py-4 transition-colors hover:border-accent"
                  >
                    <span className="font-mono text-sm text-faint">
                      0{i + 1}
                    </span>
                    <span className="font-display text-3xl font-bold tracking-tight text-muted transition-colors group-hover:text-foreground sm:text-5xl">
                      {c.label}
                    </span>
                    <span className="ml-auto hidden text-accent opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <dl
              data-fx
              className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3"
            >
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-background p-5">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <Counter
                      value={stat.value}
                      suffix={stat.suffix}
                      className="font-display text-3xl font-bold tabular-nums tracking-tight sm:text-4xl"
                    />
                    <span className="mt-1 block text-sm text-muted">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <p data-fx className="mt-6 text-sm text-faint">
              Production systems for AI, SaaS, and data-driven teams —{" "}
              <Link href="/services" className="text-accent hover:underline">
                all services
              </Link>
            </p>
          </div>
        </section>

        {/* ---- slide 3: contact ---- */}
        <section
          data-slide="2"
          className="flex h-dvh flex-col items-center justify-center px-6 text-center"
        >
          <p data-fx className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald">
            Have data? Let&apos;s make it think.
          </p>
          <h2
            data-fx
            className="mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Let&apos;s build something{" "}
            <span className="text-gradient">intelligent</span> together
          </h2>
          <div data-fx className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/contact"
              data-magnetic
              className="rounded-xl bg-accent-strong px-8 py-3.5 font-semibold text-white shadow-lg shadow-accent-strong/25 transition hover:opacity-90"
            >
              Start a Project
            </Link>
            <a
              href={site.cv}
              download
              className="rounded-xl border border-border-strong px-8 py-3.5 font-semibold transition hover:border-accent hover:text-accent"
            >
              Download CV
            </a>
          </div>
          <div data-fx className="mt-10">
            <SocialLinks size="lg" className="justify-center" />
          </div>
        </section>
      </div>
    </div>
  );
}
