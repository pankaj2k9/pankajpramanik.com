"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Procedural hero models, one per service (the brain for Intelligence lives
 * in NeuralScene). Everything is built from three.js primitives, so nothing
 * is downloaded. Each model sits inside a radius of about 1.6 scene units,
 * the same footprint as the brain, so the camera never has to move.
 */

type ModelProps = { color: string; playing: boolean };

/** Scene time that stops while the hero is paused or off screen. */
function useSceneTime(playing: boolean) {
  const time = useRef(0);
  useFrame((_, delta) => {
    if (playing) time.current += Math.min(delta, 0.05);
  });
  return time;
}

/** Glossy pastel body tinted toward the service colour. */
function useGloss(color: string) {
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#f3f5fb").lerp(new THREE.Color(color), 0.16),
        roughness: 0.26,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
        sheen: 0.5,
        sheenColor: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.05,
      }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/** Self-lit accent (rings, beads, bars' caps). */
function useGlow(color: string, intensity = 0.9) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: intensity,
        roughness: 0.3,
      }),
    [color, intensity],
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/** Reused per frame to avoid allocating in the render loop. */
const scratch = new THREE.Vector3();

/** Cheap deterministic hash in 0..1. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------------------
// Data: a database stack with records spiralling into it.
// ---------------------------------------------------------------------------
const RECORDS = 220;

export function DataModel({ color, playing }: ModelProps) {
  const gloss = useGloss(color);
  const glow = useGlow(color);
  const time = useSceneTime(playing);
  const group = useRef<THREE.Group>(null);
  const cloud = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(RECORDS * 3), []);

  useFrame(() => {
    const t = time.current;
    if (group.current) group.current.rotation.y = t * 0.3;
    const pts = cloud.current;
    if (!pts) return;
    const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < RECORDS; i++) {
      // Each record rises around the stack, tightening as it goes in.
      const h = (hash(i) + t * 0.09) % 1;
      const angle = hash(i + 50) * Math.PI * 2 + h * 7 + t * 0.4;
      const r = 1.55 - h * 0.45;
      pos.setXYZ(i, Math.cos(angle) * r, -1.25 + h * 2.5, Math.sin(angle) * r);
    }
    pos.needsUpdate = true;
  });

  return (
    <group ref={group} rotation={[0.28, 0, 0]}>
      {[-0.66, 0, 0.66].map((y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh material={gloss}>
            <cylinderGeometry args={[0.95, 0.95, 0.5, 64]} />
          </mesh>
          <mesh material={glow} position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.95, 0.02, 8, 96]} />
          </mesh>
          {/* status LEDs on the drive's face */}
          {[0, 1, 2].map((k) => (
            <mesh key={k} material={glow} position={[0.4 + k * 0.16, 0, 0.87]}>
              <sphereGeometry args={[0.035, 12, 8]} />
            </mesh>
          ))}
        </group>
      ))}
      <points ref={cloud}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.05}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------------------
// AI / ML: a layered neural network with signals firing through it.
// ---------------------------------------------------------------------------
const LAYERS = [3, 5, 5, 3];
const SIGNALS = 26;

export function NetworkModel({ color, playing }: ModelProps) {
  const gloss = useGloss(color);
  const time = useSceneTime(playing);
  const group = useRef<THREE.Group>(null);
  const neurons = useRef<(THREE.Mesh | null)[]>([]);
  const pulses = useRef<THREE.Points>(null);

  const { nodes, layerStart, edges, pulsePositions } = useMemo(() => {
    const nodes: THREE.Vector3[] = [];
    const layerStart: number[] = [];
    LAYERS.forEach((count, l) => {
      layerStart.push(nodes.length);
      for (let i = 0; i < count; i++) {
        const y = count === 1 ? 0 : -1.05 + (2.1 * i) / (count - 1);
        nodes.push(new THREE.Vector3(-1.5 + l, y, (i % 2 ? 0.35 : -0.35) * (l % 2 ? 1 : -1)));
      }
    });
    const segments: number[] = [];
    for (let l = 0; l < LAYERS.length - 1; l++) {
      for (let a = 0; a < LAYERS[l]; a++) {
        for (let b = 0; b < LAYERS[l + 1]; b++) {
          const p = nodes[layerStart[l] + a];
          const q = nodes[layerStart[l + 1] + b];
          segments.push(p.x, p.y, p.z, q.x, q.y, q.z);
        }
      }
    }
    return {
      nodes,
      layerStart,
      edges: new Float32Array(segments),
      pulsePositions: new Float32Array(SIGNALS * 3),
    };
  }, []);

  useFrame(() => {
    const t = time.current;
    if (group.current) group.current.rotation.y = -0.5 + Math.sin(t * 0.35) * 0.45;
    // Neurons swell as a wave passes through the layers.
    neurons.current.forEach((mesh, i) => {
      if (!mesh) return;
      const layer = layerStart.findLastIndex((s) => s <= i);
      mesh.scale.setScalar(1 + 0.35 * Math.max(0, Math.sin(t * 2.4 - layer * 1.1)));
    });
    const pts = pulses.current;
    if (!pts) return;
    const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
    const hops = LAYERS.length - 1;
    for (let k = 0; k < SIGNALS; k++) {
      // Every cycle a signal takes a new random route, one neuron per layer.
      const run = hash(k) + t * 0.32;
      const cycle = Math.floor(run);
      const u = (run - cycle) * hops;
      const hop = Math.min(hops - 1, Math.floor(u));
      const pick = (l: number) =>
        layerStart[l] + Math.floor(hash(k * 31 + cycle * 7 + l) * LAYERS[l]);
      const a = nodes[pick(hop)];
      const b = nodes[pick(hop + 1)];
      const f = u - hop;
      pos.setXYZ(k, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f);
    }
    pos.needsUpdate = true;
  });

  return (
    <group ref={group}>
      {nodes.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            neurons.current[i] = el;
          }}
          position={p}
          material={gloss}
        >
          <sphereGeometry args={[0.15, 24, 16]} />
        </mesh>
      ))}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edges, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.28} />
      </lineSegments>
      <points ref={pulses}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pulsePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.11}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Automation: three meshing gears.
// ---------------------------------------------------------------------------
function gearGeometry(teeth: number, radius: number) {
  const shape = new THREE.Shape();
  const inner = radius - 0.13;
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 4 < 2 ? radius : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius * 0.28, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geometry.center();
  return geometry;
}

const GEARS = [
  { teeth: 14, radius: 0.95, position: [-0.42, 0.18, 0] },
  { teeth: 9, radius: 0.62, position: [0.99, -0.62, 0.02] },
  { teeth: 7, radius: 0.48, position: [-1.52, 1.02, -0.02] },
] as const;

export function GearsModel({ color, playing }: ModelProps) {
  const gloss = useGloss(color);
  const glow = useGlow(color, 0.7);
  const time = useSceneTime(playing);
  const group = useRef<THREE.Group>(null);
  const gears = useRef<(THREE.Group | null)[]>([]);
  const geometries = useMemo(() => GEARS.map((g) => gearGeometry(g.teeth, g.radius)), []);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  useFrame(() => {
    const t = time.current;
    if (group.current) group.current.rotation.y = -0.45 + Math.sin(t * 0.3) * 0.3;
    // Meshing gears turn in opposite directions at the tooth-count ratio.
    const drive = t * 0.7;
    gears.current.forEach((gear, i) => {
      if (!gear) return;
      const ratio = GEARS[0].teeth / GEARS[i].teeth;
      gear.rotation.z = i === 0 ? drive : -drive * ratio + Math.PI / GEARS[i].teeth;
    });
  });

  return (
    <group ref={group} rotation={[-0.35, 0, 0]} position={[0.2, -0.05, 0]}>
      {GEARS.map((g, i) => (
        <group
          key={i}
          ref={(el) => {
            gears.current[i] = el;
          }}
          position={g.position as unknown as [number, number, number]}
        >
          <mesh geometry={geometries[i]} material={gloss} />
          <mesh material={glow} position={[0, 0, 0.16]}>
            <torusGeometry args={[g.radius * 0.28, 0.025, 8, 48]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Data Analytics: a live 3D bar chart with a trend line over the front row.
// ---------------------------------------------------------------------------
const COLS = 5;
const ROWS = 3;

export function ChartModel({ color, playing }: ModelProps) {
  const gloss = useGloss(color);
  const glow = useGlow(color, 0.8);
  // Front row: the same gloss, tinted harder, so it reads as the headline series.
  const accent = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#ffffff").lerp(new THREE.Color(color), 0.55),
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.12,
      }),
    [color],
  );
  useEffect(() => () => accent.dispose(), [accent]);
  const time = useSceneTime(playing);
  const group = useRef<THREE.Group>(null);
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  const line = useRef<THREE.Line>(null);
  const lineObject = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COLS * 3), 3));
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }));
  }, [color]);
  useEffect(
    () => () => {
      lineObject.geometry.dispose();
      (lineObject.material as THREE.Material).dispose();
    },
    [lineObject],
  );

  const x = (c: number) => (c - (COLS - 1) / 2) * 0.46;
  const z = (r: number) => (r - (ROWS - 1) / 2) * 0.46;

  useFrame(() => {
    const t = time.current;
    if (group.current) group.current.rotation.y = -0.6 + Math.sin(t * 0.3) * 0.35;
    const attr = line.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const bar = bars.current[r * COLS + c];
        if (!bar) continue;
        // Values grow left to right with a live wobble per column.
        const h = 0.25 + (0.35 + c * 0.22) * (0.75 + 0.25 * Math.sin(t * 1.6 + c * 0.9 + r * 1.7));
        bar.scale.y = h;
        bar.position.y = -0.8 + h / 2;
        if (r === ROWS - 1) {
          attr?.setXYZ(c, x(c), -0.8 + h + 0.12, z(r) + 0.1);
          beads.current[c]?.position.set(x(c), -0.8 + h + 0.12, z(r) + 0.1);
        }
      }
    }
    if (attr) attr.needsUpdate = true;
  });

  return (
    <group ref={group} rotation={[0.42, 0, 0]} position={[0, 0.2, 0]} scale={0.88}>
      <mesh material={gloss} position={[0, -0.86, 0]}>
        <boxGeometry args={[2.7, 0.1, 1.7]} />
      </mesh>
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        return (
          <mesh
            key={i}
            ref={(el) => {
              bars.current[i] = el;
            }}
            material={r === ROWS - 1 ? accent : gloss}
            position={[x(c), -0.5, z(r)]}
          >
            <boxGeometry args={[0.3, 1, 0.3]} />
          </mesh>
        );
      })}
      <primitive ref={line} object={lineObject} />
      {Array.from({ length: COLS }, (_, c) => (
        <mesh
          key={c}
          ref={(el) => {
            beads.current[c] = el;
          }}
          material={glow}
        >
          <sphereGeometry args={[0.055, 16, 12]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// LLMOps / MLOps: the build-deploy-monitor infinity loop.
// ---------------------------------------------------------------------------
const PACKETS = 36;
const STATIONS = [0.08, 0.34, 0.58, 0.84];

export function OpsModel({ color, playing }: ModelProps) {
  const gloss = useGloss(color);
  const glow = useGlow(color);
  const time = useSceneTime(playing);
  const group = useRef<THREE.Group>(null);
  const flow = useRef<THREE.Points>(null);
  const stations = useRef<(THREE.Mesh | null)[]>([]);
  const { curve, tube, packetPositions } = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      const d = 1 + Math.sin(a) ** 2;
      points.push(
        new THREE.Vector3((1.75 * Math.cos(a)) / d, (1.75 * Math.sin(a) * Math.cos(a)) / d, 0.3 * Math.sin(a)),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    return {
      curve,
      tube: new THREE.TubeGeometry(curve, 320, 0.1, 18, true),
      packetPositions: new Float32Array(PACKETS * 3),
    };
  }, []);
  useEffect(() => () => tube.dispose(), [tube]);

  useFrame(() => {
    const t = time.current;
    if (group.current) {
      group.current.rotation.y = Math.sin(t * 0.3) * 0.5;
      group.current.rotation.x = 0.35 + Math.sin(t * 0.22) * 0.15;
    }
    const pts = flow.current;
    if (pts) {
      const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
      const p = new THREE.Vector3();
      for (let k = 0; k < PACKETS; k++) {
        curve.getPointAt((k / PACKETS + t * 0.08) % 1, p);
        pos.setXYZ(k, p.x, p.y, p.z);
      }
      pos.needsUpdate = true;
    }
    // Each stage spins up as work passes through it.
    stations.current.forEach((box, i) => {
      if (!box) return;
      const lead = ((t * 0.08 - STATIONS[i]) % (1 / PACKETS) + 1) % 1;
      box.rotation.set(t * 0.8 + i, t * 1.1, 0);
      box.scale.setScalar(1 + 0.25 * Math.exp(-lead * 200));
    });
  });

  return (
    <group ref={group}>
      <mesh geometry={tube} material={gloss} />
      <points ref={flow}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[packetPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.13}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {STATIONS.map((u, i) => (
        <mesh
          key={u}
          ref={(el) => {
            stations.current[i] = el;
          }}
          material={glow}
          position={curve.getPointAt(u)}
        >
          <boxGeometry args={[0.22, 0.22, 0.22]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// AI Agents: a multi-agent system. A supervisor core delegates to specialist
// agents on an orbit; they hand work to each other and report back. Floating
// objects stand for tools, memory, APIs and knowledge sources.
// Palette: soft white, pale blue, light lavender, coral highlights.
// ---------------------------------------------------------------------------
const PALE_BLUE = "#cfdcff";
const LAVENDER = "#d8cffa";
const SPECIALISTS = ["planning", "retrieval", "reasoning", "tools", "analytics"] as const;
const AGENT_ORBIT = 1.42;
const PATH_DOTS = 26;
/** One orchestration step: delegate, work, hand off, report. */
const STEP = 2.6;

/** Each specialist's ceramic tint, in SPECIALISTS order. */
const AGENT_TINTS = ["#ffab94", "#9fb8ff", "#bba8ff", "#86d6e6", "#ffcf7a"];

type Materials = {
  ceramic: THREE.Material;
  tints: THREE.Material[];
  acrylic: THREE.Material;
  metal: THREE.Material;
  blueGlass: THREE.Material;
  coral: THREE.Material;
};

function useAgentMaterials(color: string): Materials {
  const materials = useMemo(
    () => ({
      tints: AGENT_TINTS.map(
        (tint) =>
          new THREE.MeshPhysicalMaterial({
            color: tint,
            roughness: 0.3,
            clearcoat: 0.8,
            clearcoatRoughness: 0.2,
            sheen: 0.6,
            sheenColor: new THREE.Color("#ffffff"),
          }),
      ),
      ceramic: new THREE.MeshPhysicalMaterial({
        color: "#e2dbff",
        roughness: 0.32,
        clearcoat: 0.7,
        clearcoatRoughness: 0.25,
        sheen: 0.6,
        sheenColor: new THREE.Color(LAVENDER),
      }),
      acrylic: new THREE.MeshPhysicalMaterial({
        color: "#dfe7ff",
        roughness: 0.04,
        clearcoat: 1,
        iridescence: 0.7,
        iridescenceIOR: 1.35,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
      metal: new THREE.MeshStandardMaterial({ color: "#dfe3ec", metalness: 0.9, roughness: 0.22 }),
      blueGlass: new THREE.MeshPhysicalMaterial({
        color: PALE_BLUE,
        roughness: 0.06,
        clearcoat: 1,
        transparent: true,
        opacity: 0.7,
        emissive: new THREE.Color(PALE_BLUE),
        emissiveIntensity: 0.15,
      }),
      coral: new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
    }),
    [color],
  );
  useEffect(
    () => () => Object.values(materials).flat().forEach((m) => m.dispose()),
    [materials],
  );
  return materials;
}

/** Each specialist has its own silhouette, so the functions read at a glance. */
function SpecialistShape({ kind, m }: { kind: (typeof SPECIALISTS)[number]; m: Materials }) {
  switch (kind) {
    case "planning": // tiered steps
      return (
        <>
          {[0, 1, 2].map((k) => (
            <mesh key={k} material={m.ceramic} position={[0, -0.09 + k * 0.09, 0]}>
              <cylinderGeometry args={[0.2 - k * 0.05, 0.2 - k * 0.05, 0.07, 40]} />
            </mesh>
          ))}
          <mesh material={m.coral} position={[0, 0.13, 0]}>
            <sphereGeometry args={[0.035, 16, 12]} />
          </mesh>
        </>
      );
    case "retrieval": // a lens: ceramic ring around a glass eye
      return (
        <>
          <mesh material={m.ceramic}>
            <torusGeometry args={[0.16, 0.05, 20, 48]} />
          </mesh>
          <mesh material={m.blueGlass}>
            <sphereGeometry args={[0.1, 32, 24]} />
          </mesh>
        </>
      );
    case "reasoning": // faceted glass around a ceramic core
      return (
        <>
          <mesh material={m.acrylic}>
            <icosahedronGeometry args={[0.22, 0]} />
          </mesh>
          <mesh material={m.ceramic}>
            <octahedronGeometry args={[0.1]} />
          </mesh>
        </>
      );
    case "tools": // a block with a metal pin through it
      return (
        <>
          <mesh material={m.ceramic}>
            <boxGeometry args={[0.26, 0.26, 0.26]} />
          </mesh>
          <mesh material={m.metal} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.42, 16]} />
          </mesh>
        </>
      );
    case "analytics": // three rising bars on a plate
      return (
        <>
          <mesh material={m.ceramic} position={[0, -0.12, 0]}>
            <boxGeometry args={[0.34, 0.04, 0.2]} />
          </mesh>
          {[0.1, 0.18, 0.28].map((h, k) => (
            <mesh
              key={k}
              material={k === 2 ? m.blueGlass : m.ceramic}
              position={[-0.1 + k * 0.1, -0.1 + h / 2, 0]}
            >
              <boxGeometry args={[0.07, h, 0.07]} />
            </mesh>
          ))}
        </>
      );
  }
}

/** Abstract resources around the system: tools, memory, APIs, knowledge. */
function Resources({ m, playing }: { m: Materials; playing: boolean }) {
  const time = useSceneTime(playing);
  const items = useRef<(THREE.Group | null)[]>([]);
  const spots: [number, number, number][] = [
    [-1.6, 0.85, -0.5], // tools
    [1.55, 0.95, -0.7], // memory
    [1.7, -0.5, 0.4], // APIs
    [-1.5, -0.65, 0.6], // knowledge
  ];
  useFrame(() => {
    const t = time.current;
    items.current.forEach((item, i) => {
      if (!item) return;
      item.position.y = spots[i][1] + Math.sin(t * 0.9 + i * 1.7) * 0.07;
      item.rotation.y = t * 0.35 + i;
    });
  });
  const shapes = [
    // tool: an open metal ring with a handle
    <>
      <mesh material={m.metal}>
        <torusGeometry args={[0.13, 0.035, 12, 40, Math.PI * 1.6]} />
      </mesh>
      <mesh material={m.metal} position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.22, 12]} />
      </mesh>
    </>,
    // memory: stacked acrylic plates
    <>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} material={k === 3 ? m.blueGlass : m.acrylic} position={[0, k * 0.07, 0]}>
          <boxGeometry args={[0.32, 0.025, 0.24]} />
        </mesh>
      ))}
    </>,
    // API: two linked rings
    <>
      <mesh material={m.metal} position={[-0.07, 0, 0]}>
        <torusGeometry args={[0.12, 0.025, 12, 40]} />
      </mesh>
      <mesh material={m.ceramic} position={[0.07, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.025, 12, 40]} />
      </mesh>
    </>,
    // knowledge: a small stack of volumes
    <>
      {[0, 1, 2].map((k) => (
        <mesh
          key={k}
          material={k === 1 ? m.blueGlass : m.ceramic}
          position={[0, k * 0.075, 0]}
          rotation={[0, k * 0.25, 0]}
        >
          <boxGeometry args={[0.28, 0.06, 0.2]} />
        </mesh>
      ))}
    </>,
  ];
  return (
    <>
      {shapes.map((shape, i) => (
        <group
          key={i}
          ref={(el) => {
            items.current[i] = el;
          }}
          position={spots[i]}
          scale={0.95}
        >
          {shape}
        </group>
      ))}
    </>
  );
}

export function AgentModel({ color, playing }: ModelProps) {
  const m = useAgentMaterials(color);
  const time = useSceneTime(playing);
  const orbit = useRef<THREE.Group>(null);
  const agents = useRef<(THREE.Group | null)[]>([]);
  const paths = useRef<(THREE.Object3D | null)[]>([]);
  const handoffPath = useRef<THREE.Points>(null);
  const core = useRef<THREE.Group>(null);
  const heart = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  const packets = useRef<(THREE.Mesh | null)[]>([]);
  const shadow = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color("#7c74b8") } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "varying vec2 vUv; uniform vec3 uColor; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uColor, pow(max(0.0, 1.0 - d), 2.0) * 0.22); }",
      }),
    [],
  );
  useEffect(() => () => shadow.dispose(), [shadow]);
  const pathArrays = useMemo(
    () => SPECIALISTS.map(() => new Float32Array((PATH_DOTS + 1) * 3)),
    [],
  );
  const handoffArray = useMemo(() => new Float32Array((PATH_DOTS + 1) * 3), []);

  useFrame(() => {
    const t = time.current;
    const spin = t * 0.14;
    const positions = SPECIALISTS.map((_, i) => {
      const a = spin + (i / SPECIALISTS.length) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * AGENT_ORBIT, Math.sin(a * 2 + 1) * 0.12, Math.sin(a) * AGENT_ORBIT);
    });
    // Delegation arcs rise above the orbit, like work being handed down.
    const arc = (from: THREE.Vector3, to: THREE.Vector3, lift: number) =>
      new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, lift, 0)), to);
    const coreArcs = positions.map((p) => arc(new THREE.Vector3(), p, 0.55));

    // Choreography: step k delegates to agent k, which hands off to k + 1,
    // which reports back to the supervisor.
    const run = t / STEP;
    const step = Math.floor(run);
    const u = run - step;
    const a = step % SPECIALISTS.length;
    const b = (a + 1) % SPECIALISTS.length;
    const handoff = arc(positions[a], positions[b], 0.35);

    positions.forEach((p, i) => {
      const agent = agents.current[i];
      if (agent) {
        agent.position.copy(p);
        const busy =
          (i === a && u > 0.25 && u < 0.55) || (i === b && u > 0.55 && u < 0.85) ? 1 : 0;
        const k = agent.scale.x + ((1 + busy * 0.28) - agent.scale.x) * 0.12;
        agent.scale.setScalar(k);
        agent.rotation.y = t * 0.4 + i + busy * t * 2;
      }
      const dots = paths.current[i] as THREE.Points | null;
      if (dots) {
        const attr = dots.geometry.attributes.position as THREE.BufferAttribute;
        for (let d = 0; d <= PATH_DOTS; d++) {
          coreArcs[i].getPoint(d / PATH_DOTS, scratch);
          attr.setXYZ(d, scratch.x, scratch.y, scratch.z);
        }
        attr.needsUpdate = true;
        (dots.material as THREE.PointsMaterial).opacity = i === a || i === b ? 0.9 : 0.35;
      }
    });
    const hand = handoffPath.current;
    if (hand) {
      const attr = hand.geometry.attributes.position as THREE.BufferAttribute;
      for (let d = 0; d <= PATH_DOTS; d++) {
        handoff.getPoint(d / PATH_DOTS, scratch);
        attr.setXYZ(d, scratch.x, scratch.y, scratch.z);
      }
      attr.needsUpdate = true;
      (hand.material as THREE.PointsMaterial).opacity = u > 0.45 && u < 0.7 ? 0.9 : 0.15;
    }

    // Packets: coral delegation, lavender handoff, pale-blue result.
    const legs: [THREE.QuadraticBezierCurve3, number, number, boolean][] = [
      [coreArcs[a], 0, 0.25, false],
      [handoff, 0.5, 0.65, false],
      [coreArcs[b], 0.8, 0.97, true],
    ];
    legs.forEach(([curve, start, end, reverse], k) => {
      const dot = packets.current[k];
      if (!dot) return;
      const f = (u - start) / (end - start);
      dot.visible = f >= 0 && f <= 1;
      if (dot.visible) curve.getPoint(reverse ? 1 - f : f, dot.position);
    });

    // The supervisor breathes, and pulses when a result comes home.
    const land = u > 0.95 ? Math.sin(((u - 0.95) / 0.05) * Math.PI) : 0;
    core.current?.scale.setScalar(1 + land * 0.1 + Math.sin(t * 1.6) * 0.015);
    heart.current?.scale.setScalar(1 + land * 0.35 + Math.sin(t * 3) * 0.05);
    if (rings.current) {
      rings.current.rotation.y = t * 0.5;
      rings.current.rotation.z = Math.sin(t * 0.4) * 0.25;
    }
    if (orbit.current) orbit.current.rotation.y = -spin * 0.3;
  });

  return (
    // Slightly isometric, like a product shot.
    <group rotation={[0.42, -0.35, 0]} scale={1.08}>
      <mesh material={shadow} position={[0, -1.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.2, 4.2]} />
      </mesh>

      {/* orbit: a metal hairline and a dotted outer track */}
      <group ref={orbit}>
        <mesh material={m.metal} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[AGENT_ORBIT, 0.006, 8, 180]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[AGENT_ORBIT * 1.28, 0.004, 6, 180]} />
          <meshBasicMaterial color={LAVENDER} transparent opacity={0.7} />
        </mesh>
      </group>

      {/* supervisor: acrylic shell, ceramic body, coral heart, metal rings */}
      <group ref={core}>
        <mesh material={m.acrylic}>
          <sphereGeometry args={[0.5, 64, 48]} />
        </mesh>
        <mesh material={m.ceramic}>
          <sphereGeometry args={[0.3, 64, 48]} />
        </mesh>
        <mesh ref={heart} material={m.coral} position={[0, 0, 0.26]}>
          <sphereGeometry args={[0.09, 24, 16]} />
        </mesh>
        <group ref={rings}>
          <mesh material={m.metal} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.66, 0.01, 10, 120]} />
          </mesh>
          <mesh material={m.metal} rotation={[0.3, 0, Math.PI / 2.8]}>
            <torusGeometry args={[0.74, 0.007, 10, 120, Math.PI * 1.35]} />
          </mesh>
        </group>
      </group>

      {SPECIALISTS.map((kind, i) => (
        <group
          key={kind}
          ref={(el) => {
            agents.current[i] = el;
          }}
        >
          <group scale={1.35}>
            {/* each agent floats on a small acrylic halo */}
            <mesh material={m.acrylic} position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.24, 0.018, 10, 48]} />
            </mesh>
            <SpecialistShape kind={kind} m={{ ...m, ceramic: m.tints[i] }} />
          </group>
        </group>
      ))}

      {pathArrays.map((array, i) => (
        <points
          key={i}
          ref={(el) => {
            paths.current[i] = el;
          }}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[array, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#7d8cc8" size={0.034} transparent opacity={0.35} depthWrite={false} />
        </points>
      ))}
      <points ref={handoffPath}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[handoffArray, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#9c8ae6" size={0.04} transparent opacity={0.15} depthWrite={false} />
      </points>

      {[color, "#a996f0", "#8fb0ff"].map((c, k) => (
        <mesh
          key={k}
          ref={(el) => {
            packets.current[k] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.07, 20, 14]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
      ))}

      <Resources m={m} playing={playing} />
    </group>
  );
}
