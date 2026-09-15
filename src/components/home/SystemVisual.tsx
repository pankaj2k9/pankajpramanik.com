import { useId } from "react";

/**
 * Abstract system drawings for homepage cards. Each is three depth layers
 * (.sv-l1 far → .sv-l3 near) so the card can shift them by different amounts
 * on pointer move, and `.sv-flow` connectors animate only while the card is
 * hovered or in focus. Colours come from the card's --tone variables, so one
 * drawing works in both themes.
 */
export type SystemVisualKind =
  | "pipeline"
  | "knowledge"
  | "workflow"
  | "analytics"
  | "production"
  | "agents"
  | "rag"
  | "voice";

export default function SystemVisual({ kind }: { kind: SystemVisualKind }) {
  const uid = useId().replace(/:/g, "");
  const orb = `${uid}-orb`;
  const slab = `${uid}-slab`;
  const defs = (
    <defs>
      <radialGradient id={orb} cx="35%" cy="30%" r="75%">
        <stop offset="0" stopColor="var(--sv-highlight)" />
        <stop offset="0.45" stopColor="var(--tone-soft)" />
        <stop offset="1" stopColor="var(--tone)" />
      </radialGradient>
      <linearGradient id={slab} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="var(--sv-surface)" />
        <stop offset="1" stopColor="var(--tone-wash)" />
      </linearGradient>
    </defs>
  );
  return (
    <svg className="sv" viewBox="0 0 360 220" fill="none" aria-hidden>
      {defs}
      {DRAWINGS[kind](`url(#${orb})`, `url(#${slab})`)}
    </svg>
  );
}

type Draw = (orb: string, slab: string) => React.ReactNode;

const rings = (cx: number, cy: number) => (
  <g className="sv-l1">
    <ellipse cx={cx} cy={cy} rx="150" ry="62" className="sv-ring" />
    <ellipse cx={cx} cy={cy} rx="112" ry="44" className="sv-ring sv-ring-dash" />
  </g>
);

const DRAWINGS: Record<SystemVisualKind, Draw> = {
  pipeline: (orb, slab) => (
    <>
      {rings(180, 112)}
      <g className="sv-l2">
        <path className="sv-line sv-flow" d="M78 64 C130 64 130 110 162 110" />
        <path className="sv-line sv-flow" d="M78 110 H162" />
        <path className="sv-line sv-flow" d="M78 156 C130 156 130 110 162 110" />
        <path className="sv-line sv-flow" d="M214 110 H262" />
      </g>
      <g className="sv-l3">
        {[64, 110, 156].map((y) => (
          <g key={y}>
            <rect x="52" y={y - 13} width="26" height="26" rx="8" fill={slab} className="sv-stroke" />
            <circle cx="65" cy={y} r="3.5" className="sv-dot" />
          </g>
        ))}
        <path d="M162 90 v40 a26 9 0 0 0 52 0 v-40" fill={orb} />
        <ellipse cx="188" cy="90" rx="26" ry="9" fill={slab} className="sv-stroke" />
        <ellipse cx="188" cy="110" rx="26" ry="9" className="sv-seam" />
        <rect x="262" y="72" width="62" height="76" rx="12" fill={slab} className="sv-stroke" />
        {[92, 108, 124].map((y, i) => (
          <rect key={y} x="274" y={y} width={i === 0 ? 38 : 30} height="5" rx="2.5" className={i === 0 ? "sv-bar-tone" : "sv-bar"} />
        ))}
      </g>
    </>
  ),
  knowledge: (orb, slab) => (
    <>
      {rings(220, 110)}
      <g className="sv-l2">
        <path className="sv-line sv-flow" d="M128 104 C160 70 178 84 196 98" />
        <path className="sv-line sv-flow" d="M252 124 C270 140 278 146 286 150" />
      </g>
      <g className="sv-l3">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${46 + i * 12} ${58 + i * 12})`}>
            <rect width="70" height="88" rx="12" fill={slab} className="sv-stroke" />
            {i === 2 &&
              [20, 32, 44, 56].map((y, j) => (
                <rect key={y} x="12" y={y} width={j === 0 ? 34 : 46 - j * 4} height="4.5" rx="2.25" className={j === 0 ? "sv-bar-tone" : "sv-bar"} />
              ))}
          </g>
        ))}
        <circle cx="224" cy="110" r="34" fill={orb} />
        <circle cx="160" cy="62" r="4" className="sv-dot" />
        <circle cx="300" cy="80" r="4" className="sv-dot" />
        <rect x="272" y="146" width="66" height="36" rx="12" fill={slab} className="sv-stroke" />
        <path d="M286 164 l6 6 12 -12" className="sv-check" />
      </g>
    </>
  ),
  workflow: (_orb, slab) => (
    <>
      {rings(180, 110)}
      <g className="sv-l2">
        <path className="sv-line sv-flow" d="M64 110 H96" />
        <path className="sv-line sv-flow" d="M152 110 C170 110 170 70 188 70" />
        <path className="sv-line sv-flow" d="M152 110 C170 110 170 150 188 150" />
        <path className="sv-line sv-flow" d="M244 70 C262 70 262 110 280 110" />
        <path className="sv-line sv-flow" d="M244 150 C262 150 262 110 280 110" />
      </g>
      <g className="sv-l3">
        <circle cx="50" cy="110" r="14" className="sv-tone-fill" />
        <path d="M46 103 l9 7 -9 7z" className="sv-on-tone" />
        {[
          [96, 90],
          [188, 50],
          [188, 130],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="56" height="40" rx="11" fill={slab} className="sv-stroke" />
            <rect x={x + 11} y={y + 12} width="22" height="4.5" rx="2.25" className="sv-bar-tone" />
            <rect x={x + 11} y={y + 23} width="32" height="4.5" rx="2.25" className="sv-bar" />
          </g>
        ))}
        <circle cx="298" cy="110" r="18" fill={slab} className="sv-stroke" />
        <path d="M290 110 l6 6 11 -12" className="sv-check" />
      </g>
    </>
  ),
  analytics: (orb, slab) => (
    <>
      {rings(180, 116)}
      <g className="sv-l2">
        <rect x="48" y="38" width="238" height="146" rx="18" fill={slab} className="sv-stroke" />
        {[44, 68, 52, 88, 74, 104].map((h, i) => (
          <rect key={i} x={72 + i * 32} y={166 - h} width="16" height={h} rx="5" className={i === 5 ? "sv-tone-fill" : "sv-bar"} />
        ))}
      </g>
      <g className="sv-l3">
        <path className="sv-line sv-line-tone" d="M80 112 L112 94 L144 104 L176 72 L208 84 L240 52" />
        {[
          [80, 112],
          [144, 104],
          [240, 52],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="4.5" className="sv-dot" />
        ))}
        <circle cx="300" cy="62" r="26" fill={orb} />
        <circle cx="300" cy="62" r="14" className="sv-hole" />
      </g>
    </>
  ),
  production: (orb, slab) => (
    <>
      <g className="sv-l1">
        <path className="sv-line sv-pulse" d="M20 186 H110 l10 -18 12 30 10 -22 8 10 H340" />
      </g>
      <g className="sv-l2">
        <circle cx="180" cy="100" r="64" className="sv-ring" />
        <circle cx="180" cy="100" r="64" className="sv-line sv-flow sv-orbit" />
      </g>
      <g className="sv-l3">
        <path d="M180 70 l26 15 v30 l-26 15 -26 -15 v-30z" fill={orb} />
        <path d="M154 85 l26 15 26 -15 M180 100 v30" className="sv-seam" />
        {[
          [180, 36],
          [236, 132],
          [124, 132],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 24} y={y - 12} width="48" height="24" rx="12" fill={slab} className="sv-stroke" />
            <circle cx={x - 11} cy={y} r="4" className={i === 1 ? "sv-dot-ok" : "sv-dot"} />
            <rect x={x - 3} y={y - 2.5} width="16" height="5" rx="2.5" className="sv-bar" />
          </g>
        ))}
      </g>
    </>
  ),
  agents: (orb, slab) => (
    <>
      <g className="sv-l1">
        <path className="sv-line sv-route" d="M24 190 C90 150 140 206 200 172 S300 150 336 120" />
        <circle cx="336" cy="120" r="5" className="sv-tone-fill" />
      </g>
      <g className="sv-l2">
        {[
          [96, 64],
          [270, 60],
          [300, 150],
          [70, 150],
          [184, 190],
        ].map(([x, y]) => (
          <path key={`${x}${y}`} className="sv-line sv-flow" d={`M180 104 L${x} ${y}`} />
        ))}
      </g>
      <g className="sv-l3">
        <circle cx="180" cy="104" r="28" fill={orb} />
        {[
          [96, 64],
          [270, 60],
          [300, 150],
          [70, 150],
          [184, 190],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="15" fill={slab} className="sv-stroke" />
            <circle cx={x} cy={y} r="4.5" className={i === 0 ? "sv-dot-ok" : "sv-dot"} />
          </g>
        ))}
      </g>
    </>
  ),
  rag: (orb, slab) => (
    <>
      {rings(190, 110)}
      <g className="sv-l2">
        <path className="sv-line sv-flow" d="M96 110 H132" />
        <path className="sv-line sv-flow" d="M196 110 H222" />
        <path className="sv-line sv-flow" d="M278 110 C292 110 292 146 304 150" />
      </g>
      <g className="sv-l3">
        <rect x="36" y="72" width="60" height="76" rx="12" fill={slab} className="sv-stroke" />
        {[92, 104, 116, 128].map((y, j) => (
          <rect key={y} x="48" y={y} width={j === 0 ? 26 : 36 - j * 3} height="4.5" rx="2.25" className={j === 0 ? "sv-bar-tone" : "sv-bar"} />
        ))}
        {[0, 1, 2].flatMap((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={136 + c * 20} y={82 + r * 20} width="14" height="14" rx="4" className={(r + c) % 3 === 0 ? "sv-tone-fill" : "sv-bar"} />
          )),
        )}
        <circle cx="250" cy="110" r="28" fill={orb} />
        <rect x="286" y="136" width="56" height="34" rx="11" fill={slab} className="sv-stroke" />
        <path d="M298 153 l5 5 10 -11" className="sv-check" />
      </g>
    </>
  ),
  voice: (orb, slab) => (
    <>
      {rings(180, 110)}
      <g className="sv-l2">
        <path className="sv-line sv-flow" d="M112 110 H150" />
        <path className="sv-line sv-flow" d="M210 110 C228 110 228 66 246 66" />
        <path className="sv-line sv-flow" d="M210 110 C228 110 228 154 246 154" />
      </g>
      <g className="sv-l3">
        <rect x="36" y="80" width="76" height="60" rx="16" fill={slab} className="sv-stroke" />
        {[10, 22, 34, 18, 28, 12].map((h, i) => (
          <rect key={i} x={50 + i * 9} y={110 - h / 2} width="4.5" height={h} rx="2.25" className={i % 2 ? "sv-bar" : "sv-bar-tone"} />
        ))}
        <circle cx="180" cy="110" r="30" fill={orb} />
        {[46, 134].map((y, i) => (
          <g key={y}>
            <rect x="246" y={y} width="72" height="40" rx="11" fill={slab} className="sv-stroke" />
            <circle cx="262" cy={y + 20} r="5" className={i ? "sv-dot" : "sv-dot-ok"} />
            <rect x="274" y={y + 17.5} width="30" height="5" rx="2.5" className="sv-bar" />
          </g>
        ))}
      </g>
    </>
  ),
};
