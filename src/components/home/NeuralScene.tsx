"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

const COLORS = ["#547aa3", "#e88e7c", "#608f95"];
const NODES: [number, number, number][] = [
  [-2.7, 0.6, 0.1],
  [1.4, 2, 0],
  [2.6, -1.1, 0.4],
];
function Network({
  selected,
  onSelect,
  playing,
}: {
  selected: number;
  onSelect: (i: number) => void;
  playing: boolean;
}) {
  const sculpture = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Points>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const time = useRef(0);
  const target = useMemo(() => new THREE.Color(COLORS[selected]), [selected]);
  const { paths, positions, shell } = useMemo(() => {
    const paths = NODES.map(
      (n, i) =>
        new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(...n),
          new THREE.Vector3(0, i === 0 ? 2.8 : -1.5, 1.8),
          new THREE.Vector3(...NODES[(i + 1) % 3]),
        ),
    );
    const positions = new Float32Array(90 * 3);
    // An organic folded surface, built locally: no model, texture, or HDR downloads.
    const shell = new THREE.SphereGeometry(1.7, 112, 72);
    const p = shell.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const theta = Math.atan2(v.z, v.x),
        phi = Math.acos(THREE.MathUtils.clamp(v.y / 1.7, -1, 1));
      const ridge =
        0.1 * Math.sin(theta * 12 + Math.sin(phi * 8) * 2.4) * Math.sin(phi) +
        0.075 * Math.cos(phi * 17 + Math.sin(theta * 6));
      v.multiplyScalar(1 + ridge);
      v.x *= 1.06;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    shell.computeVertexNormals();
    return { paths, positions, shell };
  }, []);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    if (playing) time.current += Math.min(delta, 0.05);
    if (sculpture.current) {
      sculpture.current.rotation.y =
        time.current * 0.055 + state.pointer.x * 0.13;
      sculpture.current.rotation.x = -0.15 + state.pointer.y * 0.08;
    }
    if (material.current) material.current.emissive.lerp(target, 0.035);
    if (particles.current) {
      const attr = particles.current.geometry.attributes
        .position as THREE.BufferAttribute;
      for (let i = 0; i < 90; i++) {
        paths[i % 3].getPoint((i / 90 + time.current * 0.085) % 1, point);
        attr.setXYZ(i, point.x, point.y, point.z);
      }
      attr.needsUpdate = true;
    }
  });
  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[-3, 5, 5]} intensity={4} color="#ffffff" />
      <directionalLight position={[2, -2, 3]} intensity={3} color="#f8a597" />
      <pointLight position={[0, 0, 3]} intensity={10} color="#dce8ff" />
      <group ref={sculpture} rotation={[-0.15, 0.2, -0.16]}>
        <mesh geometry={shell}>
          <meshStandardMaterial
            ref={material}
            color="#d8e6f6"
            roughness={0.3}
            metalness={0.18}
            emissive={COLORS[1]}
            emissiveIntensity={0.12}
          />
        </mesh>
        <mesh rotation={[0.2, 0.15, 0]}>
          <torusKnotGeometry args={[1.57, 0.07, 150, 8, 3, 7]} />
          <meshStandardMaterial
            color="#ffd8c9"
            emissive="#e2755f"
            emissiveIntensity={0.6}
            roughness={0.4}
          />
        </mesh>
      </group>
      {paths.map((path, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(
                  path.getPoints(70).flatMap((p) => p.toArray()),
                ),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#6a86a7" transparent opacity={0.45} />
        </line>
      ))}
      <points ref={particles}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.045} color="#e47864" sizeAttenuation />
      </points>
      {NODES.map((position, i) => (
        <mesh
          key={i}
          position={position}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(i);
          }}
        >
          <sphereGeometry args={[selected === i ? 0.16 : 0.11, 20, 16]} />
          <meshStandardMaterial
            color={COLORS[i]}
            emissive={COLORS[i]}
            emissiveIntensity={selected === i ? 0.8 : 0.15}
          />
        </mesh>
      ))}
    </>
  );
}
function supportsWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
export default function NeuralScene(props: {
  selected: number;
  onSelect: (i: number) => void;
  playing: boolean;
}) {
  const [supported, setSupported] = useState(supportsWebGL2);
  if (!supported) return null;
  return (
    <Canvas
      camera={{ position: [0, 0, 7.8], fov: 43 }}
      dpr={[1, 1.5]}
      frameloop={props.playing ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          "webglcontextlost",
          () => setSupported(false),
          { once: true },
        );
      }}
    >
      <Network {...props} />
    </Canvas>
  );
}
