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
