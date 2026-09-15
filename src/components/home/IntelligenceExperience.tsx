"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { heroNiches, heroServices } from "@/lib/services";
import HeroIcon from "./HeroIcons";

const NeuralScene = dynamic(() => import("./NeuralScene"), { ssr: false });
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Initials stand in for client photos, which are not ours to publish. */
const CLIENTS = [
  ["JM", "#f5b38a"],
  ["AR", "#9fb8f0"],
  ["SK", "#c7a6ef"],
  ["DL", "#8fd3c3"],
] as const;

export default function IntelligenceExperience() {
  const [selected, setSelected] = useState(2);
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = matchMedia(
      "(min-width: 800px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    const update = () => setEnabled(media.matches && !connection?.saveData);
    // Let the headline paint before downloading the optional scene.
    const timer = window.setTimeout(update, 800);
    media.addEventListener("change", update);
    let intersecting = true;
    const visibility = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      visibility();
    });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timer);
      media.removeEventListener("change", update);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const markReady = useCallback(() => setReady(true), []);
  const service = heroServices[selected];
  return (
    <div
      className="intelligence-experience"
      ref={root}
      data-scene={enabled && ready ? "ready" : undefined}
    >
      <div className="scene-orbit orbit-one" aria-hidden />
      <div className="scene-orbit orbit-two" aria-hidden />
      <div className="scene-coordinate" aria-hidden>
        INTELLIGENCE. CONNECTED.
        <br />
        23° N / 90° E
      </div>
      <p className="scene-note" aria-hidden>
        From possibility
        <br />
        to something useful.
        <svg viewBox="0 0 70 44" fill="none" stroke="currentColor">
          <path d="M66 6C44 4 20 14 6 38" strokeWidth="1.3" />
          <path d="M5 26l1 12 11-4" strokeWidth="1.3" />
        </svg>
      </p>
      <div className="neural-fallback" aria-hidden>
        <div className="fallback-core" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
        ))}
      </div>
      <div className="neural-canvas" aria-hidden="true">
        {enabled && (
          <SceneBoundary>
            <NeuralScene
              selected={selected}
              region={service.region}
              onSelect={setSelected}
              playing={visible && !paused}
              onReady={markReady}
            />
          </SceneBoundary>
        )}
      </div>
      <p className="scene-flow" aria-hidden>
        <span>
          Data <b>→</b> Intelligence
        </span>
        <span>
          <b>→</b> Real Impact
        </span>
      </p>
      <div
        className="scene-selector"
        role="group"
        aria-label="Explore the connected services"
      >
        {heroServices.map((s, i) => (
          <button
            key={s.id}
            className={`scene-node node-${i} tone-${s.tone}`}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <span className="node-icon">
              <HeroIcon name={s.id} size={30} />
            </span>
            <span className="node-text">
              <small>0{i + 1}</small>
              <strong>{s.label}</strong>
              <span>{s.tags}</span>
            </span>
            <span className="node-chevron" aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>
      <div className="scene-insight" aria-live="polite" aria-atomic="true">
        <p className="eyebrow">Explore my approach</p>
        <p>{service.title}</p>
        <p className="insight-sub">
          Real-world AI solutions for real business problems.
        </p>
        <Link
          href={`/services/${service.slug}`}
          className="insight-arrow"
          aria-label={`Explore ${service.label}`}
        >
          ↗
        </Link>
        <div className="insight-trust">
          <span className="avatar-stack" aria-hidden>
            {CLIENTS.map(([initials, color]) => (
              <i key={initials} style={{ background: color }}>
                {initials}
              </i>
            ))}
          </span>
          <span>
            Trusted by global clients
            <br />
            across industries.
          </span>
        </div>
      </div>
      <div className="scene-bottom">
        <nav className="niche-chips" aria-label="Industries">
          {heroNiches.map((n) => (
            <Link key={n.label} href={n.href}>
              <HeroIcon name={n.icon} size={15} />
              {n.label}
            </Link>
          ))}
          <Link href="/services" className="niche-more" aria-label="All services">
            +
          </Link>
        </nav>
        <div className="scene-bottom-row">
          <span>
            <i aria-hidden /> Select a niche to explore
          </span>
          {enabled && (
            <button onClick={() => setPaused(!paused)} aria-pressed={paused}>
              {paused ? "Play motion" : "Pause motion"}
              <span aria-hidden>{paused ? " ▷" : " Ⅱ"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
