"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Interactive particle galaxy rendered behind the homepage hero.
 * ~7k GPU-animated points in a spiral disc, drifting slowly and
 * tilting toward the pointer. Kept deliberately light: one geometry,
 * one PointsMaterial, no textures, no postprocessing.
 */

const COUNT = 7000;
const BRANCHES = 4;
const RADIUS = 5.5;

function Galaxy() {
  const points = useRef<THREE.Points>(null!);
  const pointer = useRef({ x: 0, y: 0 });

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const inner = new THREE.Color("#818cf8");
    const mid = new THREE.Color("#8b5cf6");
    const outer = new THREE.Color("#ec4899");

    for (let i = 0; i < COUNT; i++) {
      const r = Math.pow(Math.random(), 1.6) * RADIUS;
      const branch = ((i % BRANCHES) / BRANCHES) * Math.PI * 2;
      const spin = r * 1.1;
      const spread = (Math.random() - 0.5) * (1 - r / RADIUS) * 1.6;
      const x = Math.cos(branch + spin) * r + spread * Math.random();
      const z = Math.sin(branch + spin) * r + spread * Math.random();
      const y = (Math.random() - 0.5) * 0.55 * (1 - (r / RADIUS) * 0.6);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const t = r / RADIUS;
      const c =
        t < 0.5
          ? inner.clone().lerp(mid, t * 2)
          : mid.clone().lerp(outer, (t - 0.5) * 2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, []);

  useFrame((state, delta) => {
    const p = points.current;
    if (!p) return;
    pointer.current.x = THREE.MathUtils.lerp(
      pointer.current.x,
      state.pointer.x,
      0.04
    );
    pointer.current.y = THREE.MathUtils.lerp(
      pointer.current.y,
      state.pointer.y,
      0.04
    );
    p.rotation.y += delta * 0.045;
    p.rotation.x = -0.45 + pointer.current.y * 0.12;
    p.rotation.z = pointer.current.x * 0.06;
  });

  return (
    <points ref={points} position={[0, 0.3, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function Hero3D() {
  return (
    <Canvas
      className="absolute inset-0"
      camera={{ position: [0, 2.6, 6.5], fov: 55 }}
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      aria-hidden
    >
      <Galaxy />
    </Canvas>
  );
}
