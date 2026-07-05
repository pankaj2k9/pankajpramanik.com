"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Full-screen "neural constellation" — an abstract neural network of
 * ~360 nodes on a warped sphere, connected by synapse lines that pulse.
 * The palette lerps toward a per-slide theme color as the visitor moves
 * between the homepage's full-screen sections. One geometry for points,
 * one for lines, no textures, no postprocessing — cheap on the GPU.
 */

const NODE_COUNT = 360;
const RADIUS = 4.2;
const LINK_DISTANCE = 1.35;

// per-slide theme: [primary, secondary]
const THEMES: [string, string][] = [
  ["#818cf8", "#ec4899"], // intro — indigo → pink
  ["#34d399", "#22d3ee"], // work — emerald → cyan
  ["#f59e0b", "#f472b6"], // contact — amber → pink
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Constellation({ slide }: { slide: number }) {
  const group = useRef<THREE.Group>(null!);
  const pointsMat = useRef<THREE.PointsMaterial>(null!);
  const linesMat = useRef<THREE.LineBasicMaterial>(null!);
  const pointer = useRef({ x: 0, y: 0 });
  const colorA = useRef(new THREE.Color(THEMES[0][0]));
  const colorB = useRef(new THREE.Color(THEMES[0][1]));

  const { nodePositions, linePositions } = useMemo(() => {
    const rand = mulberry32(42);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      // fibonacci-ish sphere with radial jitter → organic shell
      const u = rand();
      const v = rand();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = RADIUS * (0.72 + rand() * 0.4);
      pts.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta) * 0.72, // squashed = brain-ish
          r * Math.cos(phi)
        )
      );
    }
    const nodePositions = new Float32Array(NODE_COUNT * 3);
    pts.forEach((p, i) => p.toArray(nodePositions, i * 3));

    // connect close pairs (synapses)
    const linePts: number[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        if (pts[i].distanceTo(pts[j]) < LINK_DISTANCE) {
          linePts.push(...pts[i].toArray(), ...pts[j].toArray());
        }
      }
    }
    return { nodePositions, linePositions: new Float32Array(linePts) };
  }, []);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;

    pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, state.pointer.x, 0.05);
    pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, state.pointer.y, 0.05);

    g.rotation.y += delta * 0.06;
    g.rotation.x = pointer.current.y * 0.18;
    g.rotation.z = pointer.current.x * 0.08;

    // gentle breathing
    const s = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
    g.scale.setScalar(s);

    // lerp palette toward the active slide theme
    const [a, b] = THEMES[slide % THEMES.length];
    colorA.current.lerp(new THREE.Color(a), 0.04);
    colorB.current.lerp(new THREE.Color(b), 0.04);
    if (pointsMat.current) pointsMat.current.color.copy(colorA.current);
    if (linesMat.current) {
      linesMat.current.color.copy(colorB.current);
      linesMat.current.opacity =
        0.16 + (Math.sin(state.clock.elapsedTime * 1.4) + 1) * 0.05;
    }
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nodePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={pointsMat}
          size={0.055}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={linesMat}
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

export default function NeuralScene({ slide }: { slide: number }) {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 8.2], fov: 50 }}
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      aria-hidden
    >
      <Constellation slide={slide} />
    </Canvas>
  );
}
