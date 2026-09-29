"use client";
import { useEffect, useRef } from "react";
import { heroServices } from "@/lib/services";
import HeroIcon from "./HeroIcons";

/**
 * Lightweight stand-in for the WebGL brain on phones and touch devices: the
 * six services orbit a glowing core. Tap a node to select it, drag sideways
 * to spin. Plain SVG driven by one requestAnimationFrame loop that writes
 * attributes directly, so there are no React renders per frame.
 */

const W = 360;
const H = 300;
const CX = W / 2;
const CY = H / 2;
const RX = 138;
const RY = 92;
const TILT = -8; // degrees
const STEP = (Math.PI * 2) / heroServices.length;
/** Angle that puts a node at the front (bottom of the ellipse). */
const FRONT = Math.PI / 2;
const DRIFT = 0.00024; // radians per ms while idle
const IDLE_MS = 3500;

/** Glow colours per tone. "teal" (Automation) matches its card's navy icon. */
const TONE: Record<string, string> = {
  blue: "#2f5fe8",
  violet: "#5b3df0",
  coral: "#f0452e",
  teal: "#1c2436",
  orange: "#f26a1b",
  indigo: "#3548d6",
};
const toneOf = (i: number) => TONE[heroServices[i].tone] ?? "#2f5fe8";

/** Shortest signed angular distance from a to b. */
function delta(a: number, b: number) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function position(base: number, i: number) {
  const a = base + i * STEP;
  const depth = (Math.sin(a) + 1) / 2; // 0 = back, 1 = front
  return { x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY, depth };
}

export default function MobileOrbit({
  selected,
  onSelect,
  playing,
}: {
  selected: number;
  onSelect: (index: number) => void;
  playing: boolean;
}) {
  const nodes = useRef<(SVGGElement | null)[]>([]);
  const links = useRef<(SVGLineElement | null)[]>([]);
  const pulse = useRef<SVGCircleElement>(null);
  const motion = useRef({
    base: FRONT - selected * STEP,
    target: null as number | null,
    velocity: 0,
    // No input yet, so the idle drift starts as soon as the page loads.
    lastInput: -Infinity,
    dragging: false,
  });
  const selectedRef = useRef(selected);

  // A new selection (from a node or from the cards below) turns to the front.
  // The first run is the initial selection, already at the front.
  useEffect(() => {
    if (selectedRef.current === selected) return;
    selectedRef.current = selected;
    const m = motion.current;
    m.target = m.base + delta(m.base, FRONT - selected * STEP);
    m.velocity = 0;
    m.lastInput = performance.now();
  }, [selected]);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const m = motion.current;
    let frame = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!m.dragging) {
        if (m.target !== null) {
          const rest = m.target - m.base;
          m.base += reduced ? rest : rest * Math.min(1, dt * 0.008);
          if (Math.abs(rest) < 0.001) {
            m.base = m.target;
            m.target = null;
          }
        } else if (Math.abs(m.velocity) > 0.00002) {
          m.base += m.velocity * dt;
          m.velocity *= Math.pow(0.994, dt);
        } else if (!reduced && now - m.lastInput > IDLE_MS) {
          m.base += DRIFT * dt;
        }
      }
      for (let i = 0; i < heroServices.length; i++) {
        const { x, y: orbitY, depth } = position(m.base, i);
        // Each node bobs gently on its own phase, so the scene never sits still.
        const y = orbitY + (reduced ? 0 : Math.sin(now / 700 + i * 1.3) * 3);
        const scale = 0.72 + depth * 0.38;
        nodes.current[i]?.setAttribute(
          "transform",
          `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})`,
        );
        nodes.current[i]?.style.setProperty(
          "opacity",
          (0.45 + depth * 0.55).toFixed(2),
        );
        const line = links.current[i];
        if (line) {
          line.setAttribute("x2", x.toFixed(1));
          line.setAttribute("y2", y.toFixed(1));
        }
      }
      // A data packet travels from the core to the selected node.
      const dot = pulse.current;
      if (dot) {
        const { x, y } = position(m.base, selectedRef.current);
        const t = reduced ? 0.6 : (now % 1400) / 1400;
        dot.setAttribute("cx", (CX + (x - CX) * t).toFixed(1));
        dot.setAttribute("cy", (CY + (y - CY) * t).toFixed(1));
        dot.style.setProperty(
          "opacity",
          (reduced ? 1 : Math.sin(t * Math.PI)).toFixed(2),
        );
      }
      if (playing && !reduced) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    // Reduced motion draws on demand only: re-run while a turn is in progress.
    const settle = reduced
      ? window.setInterval(() => requestAnimationFrame(draw), 120)
      : 0;
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(settle);
    };
  }, [playing]);

  // Horizontal drag spins the orbit; vertical movement stays page scroll.
  const drag = useRef<{ x: number; t: number; moved: number } | null>(null);
  // Click fires after pointerup, so the finished drag's distance is kept here.
  const lastMoved = useRef(0);
  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    drag.current = { x: event.clientX, t: performance.now(), moved: 0 };
    const m = motion.current;
    m.dragging = true;
    m.target = null;
    m.velocity = 0;
    m.lastInput = performance.now();
  }
  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const dx = event.clientX - d.x;
    const box = event.currentTarget.getBoundingClientRect();
    const radians = (dx / box.width) * Math.PI * 1.4;
    const m = motion.current;
    m.base -= radians;
    m.velocity = -radians / Math.max(1, now - d.t);
    m.lastInput = now;
    d.moved += Math.abs(dx);
    d.x = event.clientX;
    d.t = now;
  }
  function onPointerUp() {
    const m = motion.current;
    m.dragging = false;
    m.lastInput = performance.now();
    if (performance.now() - (drag.current?.t ?? 0) > 80) m.velocity = 0;
    lastMoved.current = drag.current?.moved ?? 0;
    drag.current = null;
  }
  function tapNode(index: number) {
    // A drag that ends on a node is a spin, not a selection.
    if (lastMoved.current > 8) return;
    onSelect(index);
  }

  const tone = toneOf(selected);
  const initial = heroServices.map((_, i) =>
    position(FRONT - selected * STEP, i),
  );

  return (
    <svg
      className="mobile-orbit"
      viewBox={`0 0 ${W} ${H}`}
      style={{ ["--orbit-tone" as string]: tone }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <radialGradient id="orbit-core" cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor={tone} stopOpacity="0.85" />
          <stop offset="100%" stopColor={tone} />
        </radialGradient>
        <radialGradient id="orbit-halo">
          <stop offset="0%" stopColor={tone} stopOpacity="0.35" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={`rotate(${TILT} ${CX} ${CY})`}>
        <ellipse className="orbit-ring" cx={CX} cy={CY} rx={RX} ry={RY} />
        <ellipse
          className="orbit-ring is-dashed"
          cx={CX}
          cy={CY}
          rx={RX * 0.66}
          ry={RY * 0.66}
        />

        {heroServices.map((s, i) => (
          <line
            key={s.id}
            ref={(el) => {
              links.current[i] = el;
            }}
            className={`orbit-link${i === selected ? " is-active" : ""}`}
            x1={CX}
            y1={CY}
            x2={initial[i].x}
            y2={initial[i].y}
          />
        ))}
        <circle ref={pulse} className="orbit-packet" r="4" cx={CX} cy={CY} />

        <circle cx={CX} cy={CY} r="78" fill="url(#orbit-halo)" />
        <circle className="orbit-wave" cx={CX} cy={CY} r="40" />
        <circle className="orbit-wave is-late" cx={CX} cy={CY} r="40" />
        <circle
          cx={CX}
          cy={CY}
          r="38"
          fill="url(#orbit-core)"
          className="orbit-core"
        />
        <g
          transform={`translate(${CX - 14} ${CY - 14}) rotate(${-TILT} 14 14)`}
          className="orbit-core-icon"
        >
          <HeroIcon
            name={heroServices[selected].id}
            size={28}
            strokeWidth={1.8}
          />
        </g>

        {heroServices.map((s, i) => (
          <g
            key={s.id}
            ref={(el) => {
              nodes.current[i] = el;
            }}
            className={`orbit-node${i === selected ? " is-active" : ""}`}
            style={{ ["--node-tone" as string]: toneOf(i) }}
            transform={`translate(${initial[i].x} ${initial[i].y})`}
            onClick={() => tapNode(i)}
          >
            <g transform={`rotate(${-TILT})`}>
              <circle className="orbit-node-ring" r="27" />
              <circle className="orbit-node-disc" r="21" />
              <g transform="translate(-11 -11)">
                <HeroIcon name={s.id} size={22} />
              </g>
              <text y="42" textAnchor="middle">
                {s.label}
              </text>
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
