/**
 * Generate a unique abstract "neural" artwork (SVG) for every service
 * page, replacing the shared stock images. Deterministic: each slug
 * hashes to a seed, so re-running produces identical files.
 *
 * Output: public/services-art/<slug>.svg  (800×500)
 * Usage:  node migration/generate-service-art.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "services-art");
fs.mkdirSync(OUT, { recursive: true });

const pages = JSON.parse(
  fs.readFileSync(path.join(__dirname, "extracted", "pages.json"), "utf8")
);
const services = pages.filter((p) => p.kind === "SERVICE");

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 800;
const H = 500;

function svgFor(slug, index) {
  const rand = mulberry32(hashCode(slug));
  // hue anchored per service, spaced around the wheel
  const hueA = Math.round((index * 47 + rand() * 30) % 360);
  const hueB = (hueA + 60 + Math.round(rand() * 60)) % 360;
  const cA = `hsl(${hueA} 85% 62%)`;
  const cB = `hsl(${hueB} 85% 60%)`;

  // nodes
  const N = 26 + Math.floor(rand() * 10);
  const nodes = Array.from({ length: N }, () => ({
    x: 40 + rand() * (W - 80),
    y: 40 + rand() * (H - 80),
    r: 1.6 + rand() * 3.4,
  }));

  // edges between close nodes
  let edges = "";
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.hypot(dx, dy);
      if (d < 150) {
        const o = (0.34 * (1 - d / 150)).toFixed(3);
        edges += `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" stroke="url(#lg)" stroke-opacity="${o}" stroke-width="1"/>`;
      }
    }
  }

  const dots = nodes
    .map(
      (n, i) =>
        `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r.toFixed(1)}" fill="${i % 3 ? cA : cB}" fill-opacity="${(0.55 + rand() * 0.45).toFixed(2)}"/>`
    )
    .join("");

  // a few large soft orbs
  const orbs = Array.from({ length: 3 }, (_, i) => {
    const x = rand() * W;
    const y = rand() * H;
    const r = 120 + rand() * 160;
    const c = i % 2 ? cA : cB;
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="${c}" fill-opacity="0.13" filter="url(#blur)"/>`;
  }).join("");

  // signal wave path
  const waveY = H * (0.55 + rand() * 0.25);
  let wave = `M 0 ${waveY.toFixed(0)}`;
  for (let x = 0; x <= W; x += 40) {
    const y = waveY + Math.sin(x / 60 + rand() * 4) * (14 + rand() * 22);
    wave += ` L ${x} ${y.toFixed(1)}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="">
<defs>
  <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${cA}"/><stop offset="1" stop-color="${cB}"/>
  </linearGradient>
  <radialGradient id="bg" cx="0.3" cy="0.2" r="1.1">
    <stop offset="0" stop-color="#141830"/><stop offset="1" stop-color="#0b0d18"/>
  </radialGradient>
  <filter id="blur" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="46"/>
  </filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${orbs}
<path d="${wave}" fill="none" stroke="url(#lg)" stroke-opacity="0.5" stroke-width="1.6"/>
${edges}
${dots}
</svg>`;
}

// three variants per service: banner/index art + two in-content artworks
services.forEach((s, i) => {
  fs.writeFileSync(path.join(OUT, `${s.slug}.svg`), svgFor(s.slug, i));
  fs.writeFileSync(path.join(OUT, `${s.slug}-alt.svg`), svgFor(`${s.slug}::alt`, i));
  fs.writeFileSync(path.join(OUT, `${s.slug}-alt2.svg`), svgFor(`${s.slug}::alt2`, i));
});
console.log(`generated ${services.length * 3} artworks in public/services-art/`);
