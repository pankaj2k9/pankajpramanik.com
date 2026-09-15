/**
 * Generates public/models/neural-brain.glb — the homepage hero model.
 *
 * The brain is built here from code rather than downloaded, so the asset has
 * no third-party licence and can carry data the scene needs:
 *
 *   COLOR_0.r  "Data" region          (parietal + occipital lobes)
 *   COLOR_0.g  "Intelligence" region  (frontal lobe)
 *   COLOR_0.b  "Automation" region    (motor strip, temporal lobe, cerebellum)
 *   COLOR_0.a  sulcus depth, 0 on a gyrus crest → 1 at the bottom of a fold
 *
 * The shader in src/components/home/NeuralScene.tsx lights the folds of the
 * region matching the selected service node.
 *
 * Usage: npm run models:brain   (deterministic — same seed, same file)
 */
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, quantize } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = path.join(ROOT, "public", "models", "neural-brain.glb");

// ---------------------------------------------------------------------------
// Seeded 3D simplex noise (Gustavson)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNoise(seed) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256).map((_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const g = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ];
  const F3 = 1 / 3, G3 = 1 / 6;
  return (x, y, z) => {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
    } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
    else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];
    const corners = [
      [x0, y0, z0, 0, 0, 0],
      [x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1],
      [x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2],
      [x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1],
    ];
    let n = 0;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    for (const [cx, cy, cz, di, dj, dk] of corners) {
      let tt = 0.6 - cx * cx - cy * cy - cz * cz;
      if (tt < 0) continue;
      const gi = perm[ii + di + perm[jj + dj + perm[kk + dk]]] % 12;
      tt *= tt;
      n += tt * tt * (g[gi][0] * cx + g[gi][1] * cy + g[gi][2] * cz);
    }
    return 32 * n; // ≈ [-1, 1]
  };
}

const noise = makeNoise(20260916);
const noise2 = makeNoise(90);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (v, w) => Math.exp(-((v / w) ** 2));

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Welded cube-sphere: unit directions + triangle indices, no pole pinching. */
function cubeSphere(n) {
  const dirs = [];
  const index = new Map();
  const tris = [];
  const faces = [
    (u, v) => [1, v, -u], (u, v) => [-1, v, u],
    (u, v) => [u, 1, -v], (u, v) => [u, -1, v],
    (u, v) => [u, v, 1], (u, v) => [-u, v, -1],
  ];
  for (const face of faces) {
    const ids = [];
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        // tan warp spreads vertices evenly over the sphere
        const u = Math.tan((-1 + (2 * i) / n) * (Math.PI / 4));
        const v = Math.tan((-1 + (2 * j) / n) * (Math.PI / 4));
        const [x, y, z] = face(u, v);
        const len = Math.hypot(x, y, z);
        const d = [x / len, y / len, z / len];
        const key = d.map((c) => Math.round(c * 1e5)).join(",");
        let id = index.get(key);
        if (id === undefined) {
          id = dirs.length;
          index.set(key, id);
          dirs.push(d);
        }
        ids.push(id);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = ids[j * (n + 1) + i], b = ids[j * (n + 1) + i + 1];
        const c = ids[(j + 1) * (n + 1) + i], d = ids[(j + 1) * (n + 1) + i + 1];
        tris.push(a, b, d, a, d, c);
      }
    }
  }
  return { dirs, tris };
}

function computeNormals(pos, tris) {
  const nrm = new Float32Array(pos.length);
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t] * 3, tris[t + 1] * 3, tris[t + 2] * 3];
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1];
    const ny = e1[2] * e2[0] - e1[0] * e2[2];
    const nz = e1[0] * e2[1] - e1[1] * e2[0];
    for (const v of [a, b, c]) {
      nrm[v] += nx;
      nrm[v + 1] += ny;
      nrm[v + 2] += nz;
    }
  }
  for (let v = 0; v < nrm.length; v += 3) {
    const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]) || 1;
    nrm[v] /= l;
    nrm[v + 1] /= l;
    nrm[v + 2] /= l;
  }
  return nrm;
}

/** Makes sure triangles wind outward (glTF front faces are CCW). */
function orientOutward(pos, tris, center) {
  let score = 0;
  for (let t = 0; t < tris.length; t += 3 * 97) {
    const [a, b, c] = [tris[t] * 3, tris[t + 1] * 3, tris[t + 2] * 3];
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    score += n[0] * (pos[a] - center[0]) + n[1] * (pos[a + 1] - center[1]) + n[2] * (pos[a + 2] - center[2]);
  }
  if (score < 0) for (let t = 0; t < tris.length; t += 3) [tris[t + 1], tris[t + 2]] = [tris[t + 2], tris[t + 1]];
}

/** Sulcus profile: narrow valleys along the zero lines of warped noise. */
function folds(x, y, z, freq) {
  const wx = noise2(x * 1.3, y * 1.3, z * 1.3) * 0.42;
  const wy = noise2(y * 1.3 + 7.1, z * 1.3, x * 1.3) * 0.42;
  const wz = noise2(z * 1.3 + 3.7, x * 1.3, y * 1.3) * 0.42;
  const qx = (x + wx) * freq, qy = (y + wy) * freq, qz = (z + wz) * freq * 0.82;
  const coarse = Math.abs(noise(qx, qy, qz));
  const fine = Math.abs(noise(qx * 2.1 + 11, qy * 2.1, qz * 2.1));
  // 0 at the bottom of a sulcus, 1 across the rounded crest of a gyrus
  const crest = Math.pow(smooth(0.02, 0.55, coarse), 0.85);
  const secondary = smooth(0, 0.35, fine);
  return crest * (0.88 + 0.12 * secondary);
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------
const RES = Number(process.env.BRAIN_RES || 96);

function hemisphere(side) {
  const { dirs, tris } = cubeSphere(RES);
  const pos = new Float32Array(dirs.length * 3);
  const col = new Uint8Array(dirs.length * 4);
  const center = [side * 0.17, 0.06, 0];

  dirs.forEach(([dx, dy, dz], v) => {
    let x = dx, y = dy, z = dz;
    const lateral = x * side; // +1 outer surface, -1 medial wall
    // Medial wall: pressed flat against the midline almost to the crown, so
    // the hemispheres meet at a narrow longitudinal fissure.
    // (x maps to px = centre ± 0.52·x, so -0.31 lands ~0.01 from the midline;
    // the smoothstep rounds the rim at the crown.)
    if (lateral < 0) x = side * -0.31 * Math.sqrt(smooth(0, 0.3, -lateral));
    if (y < 0) y *= 0.66; // flatter underside
    if (z < 0) x *= 1 - 0.2 * z * z; // occipital pole narrows
    y *= 1 - 0.1 * Math.max(0, z) ** 3; // frontal pole dips

    // Temporal lobe: a lateral bulge hanging below the Sylvian fissure.
    const temporal = smooth(0.1, 0.65, lateral) * gauss(z - 0.12, 0.42) * smooth(0.05, -0.45, y);
    y -= 0.2 * temporal;
    x += side * 0.06 * temporal;

    let px = center[0] + x * 0.52;
    let py = center[1] + y * 0.64;
    let pz = z * 0.98;

    // Fold detail, faded on the medial wall where it would be hidden anyway.
    const crest = folds(px, py, pz, 2.9);
    const foldAmp = 0.055 * (0.35 + 0.65 * smooth(-0.6, 0.1, lateral));
    let disp = (crest - 1) * foldAmp;

    // Sylvian (lateral) fissure and central sulcus, the landmarks that make
    // it read as a brain rather than a walnut.
    const sylvian = smooth(0.15, 0.5, lateral) * gauss(dy - (-0.18 - 0.3 * dz), 0.07) * smooth(-0.75, -0.2, dz) * smooth(0.8, 0.45, dz);
    const centralZ = 0.08 - 0.35 * dy;
    const central = gauss(dz - centralZ, 0.045) * smooth(-0.05, 0.3, dy);
    disp -= 0.07 * sylvian + 0.045 * central;

    // displace along the direction from the hemisphere centre
    const rx = px - center[0], ry = py - center[1], rz = pz - center[2];
    const rl = Math.hypot(rx, ry, rz) || 1;
    px += (rx / rl) * disp;
    py += (ry / rl) * disp;
    pz += (rz / rl) * disp;
    pos.set([px, py, pz], v * 3);

    // Region masks for the three service nodes.
    const intelligence = smooth(0.0, 0.5, pz - 0.12 * Math.max(0, -py));
    const data = smooth(0.05, -0.55, pz) * smooth(-0.35, 0.15, py);
    const automation = Math.max(temporal * 1.4, central * 1.2 + 0.6 * gauss(pz - centralZ * 0.98, 0.16) * smooth(0.0, 0.35, py));
    const sum = Math.max(1, intelligence + data + automation);
    const cavity = clamp(1 - crest + sylvian * 0.8 + central * 0.6);
    col.set(
      [data / sum, intelligence / sum, automation / sum, cavity].map((c) => Math.round(clamp(c) * 255)),
      v * 4,
    );
  });
  orientOutward(pos, tris, center);
  return { pos, col, tris, name: side < 0 ? "Cortex_Left" : "Cortex_Right" };
}

function cerebellum() {
  const { dirs, tris } = cubeSphere(Math.round(RES * 0.62));
  const pos = new Float32Array(dirs.length * 3);
  const col = new Uint8Array(dirs.length * 4);
  const center = [0, -0.3, -0.5];
  dirs.forEach(([dx, dy, dz], v) => {
    let x = dx * 0.5, y = dy * (dy > 0 ? 0.18 : 0.27), z = dz * 0.36;
    // two lobes either side of the vermis
    x *= 1 + 0.08 * Math.abs(dx);
    const lamina = Math.abs(Math.sin((dy * 4.2 + dz * 1.8) * 7 + noise(dx * 2.2, dy * 2.2, dz * 2.2) * 2.2));
    const crest = Math.pow(lamina, 0.35);
    const disp = (crest - 1) * 0.024 - 0.035 * gauss(dx, 0.07);
    const l = Math.hypot(x, y, z) || 1;
    const px = center[0] + x + (x / l) * disp;
    const py = center[1] + y + (y / l) * disp;
    const pz = center[2] + z + (z / l) * disp;
    pos.set([px, py, pz], v * 3);
    col.set([0.25, 0, 0.75, clamp(1 - crest)].map((c) => Math.round(c * 255)), v * 4);
  });
  orientOutward(pos, tris, center);
  return { pos, col, tris, name: "Cerebellum" };
}

function brainStem() {
  const radial = 40, rings = 36;
  const pos = [], col = [], tris = [];
  const top = [0, -0.1, -0.2], bottom = [0, -0.68, -0.32];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const radius = (0.15 - 0.06 * t + 0.045 * gauss(t - 0.32, 0.14)) * (r === rings ? 0.0001 : 1);
    const c = top.map((a, k) => a + (bottom[k] - a) * t);
    for (let s = 0; s < radial; s++) {
      const a = (s / radial) * Math.PI * 2;
      pos.push(c[0] + Math.cos(a) * radius * 1.1, c[1], c[2] + Math.sin(a) * radius * 0.85);
      const cav = 0.25 + 0.2 * Math.abs(Math.sin(a * 3 + t * 8));
      col.push(...[0.34, 0.33, 0.33, cav].map((x) => Math.round(x * 255)));
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < radial; s++) {
      const a = r * radial + s, b = r * radial + ((s + 1) % radial);
      const c = a + radial, d = b + radial;
      tris.push(a, c, b, b, c, d);
    }
  }
  const p = new Float32Array(pos);
  orientOutward(p, tris, [0, -0.6, -0.33]);
  return { pos: p, col: new Uint8Array(col), tris, name: "BrainStem" };
}

// ---------------------------------------------------------------------------
// Write GLB
// ---------------------------------------------------------------------------
const doc = new Document();
const buffer = doc.createBuffer();
const material = doc
  .createMaterial("NeuralTissue")
  .setBaseColorFactor([0.93, 0.94, 0.97, 1])
  .setRoughnessFactor(0.34)
  .setMetallicFactor(0);
const scene = doc.createScene("Brain");
const root = doc.createNode("NeuralBrain");
scene.addChild(root);

const parts = [hemisphere(-1), hemisphere(1), cerebellum(), brainStem()];
let triangles = 0;
for (const part of parts) {
  const count = part.pos.length / 3;
  const Index = count > 65535 ? Uint32Array : Uint16Array;
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(part.pos).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(computeNormals(part.pos, part.tris)).setBuffer(buffer))
    .setAttribute("COLOR_0", doc.createAccessor().setType("VEC4").setArray(part.col).setNormalized(true).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Index(part.tris)).setBuffer(buffer))
    .setMaterial(material);
  root.addChild(doc.createNode(part.name).setMesh(doc.createMesh(part.name).addPrimitive(prim)));
  triangles += part.tris.length / 3;
}

await MeshoptEncoder.ready;
await doc.transform(
  quantize({ quantizePosition: 14, quantizeNormal: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const glb = await io.writeBinary(doc);
fs.writeFileSync(OUT, glb);
console.log(`✓ ${path.relative(ROOT, OUT)} — ${triangles.toLocaleString()} triangles, ${(glb.byteLength / 1024).toFixed(0)} KB`);
