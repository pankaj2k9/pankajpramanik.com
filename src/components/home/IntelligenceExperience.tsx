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
import type { NodeAnchors } from "./NeuralScene";

/** Distance (px) from a card's edge to the centre of its sphere. */
const NODE_GAP = 22;

/**
 * Where each card's sphere docks, in heroServices order: a point on the card's
 * outline as [x, y] fractions of its box. The sphere sits just outside that
 * edge — below/right for the cards above-left of the brain, on top for the rest.
 */
const DOCKS: [number, number][] = [
  [0.85, 1], // Data — under the bottom-right corner
  [1, 0.72], // AI / ML — off the right edge
  [0.2, 0], // Intelligence
  [0.3, 0], // Automation
  [0.35, 0], // Data Analytics
  [0.3, 0], // LLMOps
];

/** Each card's dock point, in the canvas's normalised device coordinates. */
function measureAnchors(canvas: HTMLElement, cards: HTMLElement[]): NodeAnchors {
  const c = canvas.getBoundingClientRect();
  return cards.map((card, i) => {
    const r = card.getBoundingClientRect();
    const [fx, fy] = DOCKS[i] ?? [0.5, 0];
    let px = r.left + r.width * fx;
    let py = r.top + r.height * fy;
    if (fy === 0) py -= NODE_GAP;
    else if (fy === 1) py += NODE_GAP;
    else if (fx === 1) px += NODE_GAP;
    else if (fx === 0) px -= NODE_GAP;
    return [((px - c.left) / c.width) * 2 - 1, -(((py - c.top) / c.height) * 2 - 1)];
  });
}

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
  const [anchors, setAnchors] = useState<NodeAnchors>();
  const root = useRef<HTMLDivElement>(null);
  const canvasBox = useRef<HTMLDivElement>(null);
  const selector = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = canvasBox.current;
    const group = selector.current;
    if (!canvas || !group) return;
    const observer = new ResizeObserver(() => {
      const cards = Array.from(group.children) as HTMLElement[];
      setAnchors(measureAnchors(canvas, cards));
    });
    observer.observe(canvas);
    observer.observe(group);
    return () => observer.disconnect();
  }, []);
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
      <div className="neural-fallback" aria-hidden>
        <div className="fallback-core" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
        ))}
      </div>
      <div className="neural-canvas" aria-hidden="true" ref={canvasBox}>
        {enabled && (
          <SceneBoundary>
            <NeuralScene
              selected={selected}
              region={service.region}
              onSelect={setSelected}
              playing={visible && !paused}
              onReady={markReady}
              anchors={anchors}
            />
          </SceneBoundary>
        )}
      </div>
      <div
        className="scene-selector"
        role="group"
        ref={selector}
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
              <HeroIcon name={s.id} size={24} />
            </span>
            <span className="node-text">
              <small>0{i + 1}</small>
              <strong>{s.label}</strong>
            </span>
            <span className="node-chevron" aria-hidden>
              ›
            </span>
            <span className="node-tags">{s.tags}</span>
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
