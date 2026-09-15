"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { servicePaths } from "@/lib/services";

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

export default function IntelligenceExperience() {
  const [selected, setSelected] = useState(1);
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
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
  const service = servicePaths[selected];
  return (
    <div className="intelligence-experience" ref={root}>
      <div className="scene-orbit orbit-one" aria-hidden />
      <div className="scene-orbit orbit-two" aria-hidden />
      <div className="scene-coordinate" aria-hidden>
        INTELLIGENCE, CONNECTED.
        <br />
        23° N / 90° E
      </div>
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
              onSelect={setSelected}
              playing={visible && !paused}
            />
          </SceneBoundary>
        )}
      </div>
      <div className="scene-chip">
        <span className="status-dot" />
        <span>
          From possibility
          <br />
          <strong>to something useful.</strong>
        </span>
        <span className="chip-glyph" aria-hidden>
          ✳
        </span>
      </div>
      <div
        className="scene-selector"
        role="group"
        aria-label="Explore the connected services"
      >
        {servicePaths.map((s, i) => (
          <button
            key={s.id}
            className={`scene-node node-${i}`}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <span className="node-symbol" aria-hidden>
              {["⊞", "✳", "↗"][i]}
            </span>
            <span>
              <small>0{i + 1}</small>
              {s.label}
            </span>
            <span className="node-light" aria-hidden />
          </button>
        ))}
      </div>
      <div className="scene-insight" aria-live="polite" aria-atomic="true">
        <p className="eyebrow">Explore / {service.label}</p>
        <p>{service.title}</p>
        <Link href={`/services/${service.slug}`}>
          See what we can build <span aria-hidden>↗</span>
        </Link>
      </div>
      <div className="scene-bottom">
        <span>
          <i aria-hidden /> Select a node to explore
        </span>
        {enabled && (
          <button onClick={() => setPaused(!paused)} aria-pressed={paused}>
            {paused ? "Play motion" : "Pause motion"}
            <span aria-hidden>{paused ? " ▷" : " Ⅱ"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
