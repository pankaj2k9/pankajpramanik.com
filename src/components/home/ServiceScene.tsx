"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  AgentModel,
  AutomationModel,
  ChartModel,
  DataModel,
  NetworkModel,
  OpsModel,
} from "./HeroModels";

/**
 * Homepage hero (desktop only). Each service has its own procedural model
 * (HeroModels.tsx); nothing is downloaded. Selecting a service spins the next
 * model in. Drag rotates the model, clicking it sends a pulse, and the node
 * lines bend toward the pointer.
 */

/**
 * One per hero card, in heroServices order, and all clearly different:
 * Data blue, AI/ML violet, AI Agents coral, Automation slate navy
 * (matches its card icon; no green), Analytics amber, LLMOps cyan.
 */
const NODE_COLORS = ["#2f5fe8", "#7c3aed", "#f0452e", "#334155", "#f59e0b", "#06b6d4"];
/** Fallback node positions (scene space), used until the cards are measured. */
const NODES: [number, number, number][] = [
  [-1.75, 1.3, 0.6], // Data
  [-2.6, 0.05, 0.6], // AI / ML
  [1.3, 1.45, 0.6], // Intelligence
  [2.1, 0.0, 0.6], // Automation
  [1.55, -1.5, 0.6], // Data Analytics
  [-1.25, -1.6, 0.6], // LLMOps
];
/** Where each node's signal enters the model (scene space). */
const REGION_ANCHORS: [number, number, number][] = [
  [-0.7, 0.8, 0.3],
  [-1.0, 0.0, 0.5],
  [0.45, 0.75, 0.8],
  [0.95, 0.05, 0.5],
  [0.6, -0.55, 0.6],
  [-0.4, -0.6, 0.6],
];
const CAMERA = { position: [0, 0.2, 7.8] as [number, number, number], fov: 43 };
const PARTICLES_PER_PATH = 14;
/** Depth of the plane the nodes sit on, just in front of the brain. */
const NODE_Z = 0.9;

/** Normalised device coordinates from the HTML cards: [x, y] in -1..1. */
export type NodeAnchors = [number, number][];
const DOTS_PER_PATH = 28;

// Per-frame mutable state lives at module scope: the hero mounts one scene,
// and the React compiler forbids mutating values created during render.
/** Pointer drag on the canvas: user rotation with momentum. */
const drag = { active: false, moved: 0, x: 0, y: 0, rotY: 0, rotX: 0, velY: 0, velX: 0 };
/** Clock times (seconds) of the last model click and the last selection change. */
const pulse = { at: -10 };
const burst = { at: -10 };
const scratchPoint = new THREE.Vector3();
const scratchColor = new THREE.Color();

/**
 * Soft light behind each node orb: a camera-facing radial gradient. Module
 * scope, since the strength is animated per frame.
 */
/** Orb body: the node colour, lifted slightly toward white so the clearcoat reads. */
const pearlColors = NODE_COLORS.map((c) => new THREE.Color("#ffffff").lerp(new THREE.Color(c), 0.8));

const glowMaterials = NODE_COLORS.map(
  (color) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      // Normal blending: additive light vanishes on the pale hero background.
      uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: 0.35 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uStrength;
        void main(){ float d = length(vUv - 0.5) * 2.0;
          float g = pow(max(0.0, 1.0 - d), 2.4) * uStrength;
          gl_FragColor = vec4(uColor, g); }`,
    }),
);

/** A procedural studio for clearcoat reflections — nothing is downloaded. */
function applyEnvironment(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
}

/** Which model shows for each service, in heroServices order. */
const MODELS = [DataModel, NetworkModel, AgentModel, AutomationModel, ChartModel, OpsModel] as const;

/**
 * All six models, only the selected one at full size. A change shrinks the
 * old model away and spins the new one in. The whole stage follows the
 * pointer drag and swells briefly when clicked.
 */
function Stage({
  selected,
  playing,
  onReady,
}: {
  selected: number;
  playing: boolean;
  onReady?: () => void;
}) {
  const stage = useRef<THREE.Group>(null);
  // Everything is procedural, so the scene is ready as soon as it mounts.
  useEffect(() => onReady?.(), [onReady]);
  const slots = useRef<(THREE.Group | null)[]>([]);
  const scales = useRef<number[]>(MODELS.map((_, i) => (i === selected ? 1 : 0)));

  // Drag anywhere on the canvas to turn the model; momentum carries on after.
  // The grab cursor is CSS (.neural-canvas canvas).
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!(e.target instanceof HTMLCanvasElement) || !e.target.closest(".neural-canvas")) return;
      Object.assign(drag, { active: true, moved: 0, x: e.clientX, y: e.clientY, velX: 0, velY: 0 });
    };
    const move = (e: PointerEvent) => {
      if (!drag.active) return;
      const dx = (e.clientX - drag.x) * 0.008;
      const dy = (e.clientY - drag.y) * 0.006;
      drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      drag.rotY += dx;
      drag.rotX = THREE.MathUtils.clamp(drag.rotX + dy, -0.6, 0.6);
      drag.velY = dx;
      drag.velX = dy;
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const up = () => {
      drag.active = false;
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (!drag.active) {
      drag.rotY += drag.velY;
      drag.rotX += drag.velX;
      drag.velY *= 0.93;
      drag.velX *= 0.9;
      // Tilt eases back to level; the turn stays where the visitor left it.
      drag.rotX *= 0.97;
    }
    const since = performance.now() / 1000 - pulse.at;
    const punch = since < 1 ? Math.sin(since * Math.PI * 3) * Math.exp(-since * 4) * 0.12 : 0;
    if (stage.current) {
      stage.current.rotation.set(drag.rotX, drag.rotY, 0);
      stage.current.scale.setScalar(1 + punch);
    }
    const ease = 1 - Math.exp(-dt * 5);
    slots.current.forEach((slot, i) => {
      if (!slot) return;
      const target = i === selected ? 1 : 0;
      // Demand rendering may provide only one frame after a paused selection.
      scales.current[i] = playing
        ? scales.current[i] + (target - scales.current[i]) * ease
        : target;
      const k = scales.current[i];
      slot.visible = k > 0.003;
      slot.scale.setScalar(k);
      // Spin in on arrival, spin away on exit.
      slot.rotation.y = playing ? (1 - k) * (target ? -2.4 : 2.4) : 0;
    });
  });

  return (
    <group ref={stage}>
      {MODELS.map((Model, i) => (
        <group
          key={i}
          ref={(el) => {
            slots.current[i] = el;
          }}
          onClick={(e) => {
            e.stopPropagation();
            // A drag that ends on the model is a turn, not a click.
            if (drag.moved < 6) pulse.at = performance.now() / 1000;
          }}
        >
          <Model color={NODE_COLORS[i]} playing={playing && i === selected} />
        </group>
      ))}
    </group>
  );
}

function Signals({
  selected,
  hovered,
  onSelect,
  playing,
  anchors,
}: {
  selected: number;
  /** Card the pointer is over in the HTML, so the scene can echo it. */
  hovered: number | null;
  onSelect: (i: number) => void;
  playing: boolean;
  anchors?: NodeAnchors;
}) {
  const particles = useRef<THREE.Points>(null);
  const lineRefs = useRef<(THREE.Object3D | null)[]>([]);
  const nodeRefs = useRef<(THREE.Group | null)[]>([]);
  const rippleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const orbit = useRef<THREE.Group>(null);
  const orbitMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const time = useRef(0);
  const [hoverNode, setHoverNode] = useState<number | null>(null);
  const focus = hoverNode ?? hovered;
  const aspect = useThree((s) => s.size.width / s.size.height);

  // Selecting sends a burst of particles down that line.
  useEffect(() => {
    burst.at = performance.now() / 1000;
  }, [selected]);
  // Hovering a sphere shows the pointer cursor; clean up if it unmounts mid-hover.
  useEffect(() => {
    document.body.style.cursor = hoverNode === null ? "" : "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoverNode]);

  // Project each card's brain-facing edge onto the node plane, so every card
  // gets its own sphere wherever the layout puts it.
  const nodes = useMemo(() => {
    if (!anchors || anchors.length !== NODES.length) return NODES;
    // A private copy of the scene camera, so the shared one is never mutated.
    const camera = new THREE.PerspectiveCamera(CAMERA.fov, aspect, 0.1, 100);
    camera.position.set(...CAMERA.position);
    camera.lookAt(0, 0, 0); // R3F aims its default camera at the origin too
    camera.updateMatrixWorld();
    return anchors.map(([x, y]) => {
      const ray = new THREE.Vector3(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
      const t = (NODE_Z - camera.position.z) / ray.z;
      return camera.position.clone().addScaledVector(ray, t).toArray() as [number, number, number];
    });
  }, [anchors, aspect]);
  const { curves, mids, lines, positions, colors } = useMemo(() => {
    const curves = nodes.map((n, i) => {
      const start = new THREE.Vector3(...n);
      const end = new THREE.Vector3(...REGION_ANCHORS[i]);
      const bend = start.x < 0 ? -0.35 : 0.35;
      const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(bend, 0.25, 0.9));
      return new THREE.QuadraticBezierCurve3(start, mid, end);
    });
    const count = curves.length * PARTICLES_PER_PATH;
    return {
      curves,
      /** Resting control points; the live ones lean toward the pointer. */
      mids: curves.map((c) => c.v1.clone()),
      lines: curves.map(() => new Float32Array((DOTS_PER_PATH + 1) * 3)),
      positions: new Float32Array(count * 3),
      colors: new Float32Array(count * 3),
    };
  }, [nodes]);

  useFrame((state, delta) => {
    if (playing) time.current += Math.min(delta, 0.05);
    const t = time.current;
    const now = performance.now() / 1000;
    const burstLeft = Math.max(0, 1 - (now - burst.at) / 1.4);
    const { x: px, y: py } = state.pointer;

    for (let c = 0; c < curves.length; c++) {
      const active = c === selected;
      const lit = active || c === focus;
      // Lines lean toward the pointer, the lit ones more.
      const pull = lit ? 0.9 : 0.4;
      curves[c].v1.set(
        mids[c].x + px * pull + Math.sin(t * 1.3 + c) * 0.05,
        mids[c].y + py * pull * 0.8 + Math.cos(t * 1.1 + c) * 0.05,
        mids[c].z,
      );
      const line = lineRefs.current[c] as THREE.Points | null;
      if (line) {
        const attr = line.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i <= DOTS_PER_PATH; i++) {
          curves[c].getPoint(i / DOTS_PER_PATH, scratchPoint);
          attr.setXYZ(i, scratchPoint.x, scratchPoint.y, scratchPoint.z);
        }
        attr.needsUpdate = true;
        const m = line.material as THREE.PointsMaterial;
        m.opacity += ((active ? 0.95 : c === focus ? 0.85 : 0.35) - m.opacity) * 0.15;
        m.size += ((lit ? 0.05 : 0.032) - m.size) * 0.15;
      }

      const node = nodeRefs.current[c];
      if (node) {
        const target = c === focus ? 1.45 : active ? 1.25 : 1;
        const k = node.scale.x + (target - node.scale.x) * 0.18;
        node.scale.setScalar(k);
        node.rotation.set(Math.sin(t * 0.7 + c) * 0.4, t * (active ? 1.1 : 0.35), 0);
      }
      const glow = glowMaterials[c].uniforms.uStrength;
      glow.value += ((active ? 0.55 : c === focus ? 0.45 : 0.18) - glow.value) * 0.12;
      // Ripples spread from the selected and hovered spheres.
      const ripple = rippleRefs.current[c];
      if (ripple) {
        const phase = ((t + c * 0.37) % 1.6) / 1.6;
        ripple.visible = lit;
        ripple.scale.setScalar(1 + phase * 1.6);
        (ripple.material as THREE.MeshBasicMaterial).opacity = (1 - phase) ** 2 * (active ? 0.5 : 0.35);
      }
    }

    const pts = particles.current;
    if (pts) {
      const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
      const col = pts.geometry.attributes.color as THREE.BufferAttribute;
      for (let c = 0; c < curves.length; c++) {
        const active = c === selected;
        const speed = active ? 0.16 + burstLeft * 0.5 : c === focus ? 0.12 : 0.07;
        for (let i = 0; i < PARTICLES_PER_PATH; i++) {
          const k = c * PARTICLES_PER_PATH + i;
          // flow from node → model; the selected path runs faster and brighter
          const u = (i / PARTICLES_PER_PATH + t * speed + (active ? burstLeft * 0.4 : 0)) % 1;
          curves[c].getPoint(u, scratchPoint);
          pos.setXYZ(k, scratchPoint.x, scratchPoint.y, scratchPoint.z);
          const fade = Math.sin(u * Math.PI);
          const gain = active ? 1.3 + burstLeft : c === focus ? 1 : 0.5;
          scratchColor.set(NODE_COLORS[c]).multiplyScalar(gain * fade);
          col.setXYZ(k, scratchColor.r, scratchColor.g, scratchColor.b);
        }
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }

    // The orbit ring tilts with the pointer and takes the selected colour.
    if (orbit.current) {
      orbit.current.rotation.set(1.25 - py * 0.25, 0.2 + px * 0.3, -0.35 + t * 0.05);
    }
    orbitMaterial.current?.color.lerp(scratchColor.set(NODE_COLORS[selected]), 0.05);
  });

  return (
    <>
      {lines.map((array, i) => (
        <points
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[array, 3]} />
          </bufferGeometry>
          <pointsMaterial
            color={NODE_COLORS[i]}
            size={0.035}
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </points>
      ))}
      <points ref={particles}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      {nodes.map((position, i) => (
        <group key={i} position={position}>
          <mesh
            ref={(el) => {
              rippleRefs.current[i] = el;
            }}
            visible={false}
          >
            <ringGeometry args={[0.2, 0.206, 64]} />
            <meshBasicMaterial color={NODE_COLORS[i]} transparent depthWrite={false} />
          </mesh>
          <group
            ref={(el) => {
              nodeRefs.current[i] = el;
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoverNode(i);
            }}
            onPointerOut={() => setHoverNode((h) => (h === i ? null : h))}
          >
            {/* soft coloured halo behind the orb */}
            <mesh material={glowMaterials[i]} position={[0, 0, -0.05]}>
              <planeGeometry args={[0.95, 0.95]} />
            </mesh>
            {/* pearl orb: white clearcoat with an iridescent sheen, lit from
                inside by the service colour */}
            <mesh>
              <sphereGeometry args={[0.115, 48, 32]} />
              <meshPhysicalMaterial
                color={pearlColors[i]}
                emissive={NODE_COLORS[i]}
                emissiveIntensity={selected === i ? 0.55 : focus === i ? 0.4 : 0.18}
                roughness={0.12}
                clearcoat={1}
                clearcoatRoughness={0.04}
                iridescence={0.6}
                iridescenceIOR={1.4}
                sheen={0.8}
                sheenColor={NODE_COLORS[i]}
              />
            </mesh>
            {/* gyroscope rings: one at rest, two crossing when lit */}
            <mesh rotation={[Math.PI / 2.4, 0, 0]}>
              <torusGeometry args={[0.19, 0.0045, 8, 64]} />
              <meshBasicMaterial
                color={NODE_COLORS[i]}
                transparent
                opacity={selected === i || focus === i ? 0.95 : 0.4}
                toneMapped={false}
              />
            </mesh>
            {(selected === i || focus === i) && (
              <mesh rotation={[0, Math.PI / 2.6, Math.PI / 5]}>
                <torusGeometry args={[0.22, 0.0035, 8, 64]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
              </mesh>
            )}
          </group>
        </group>
      ))}
      {/* orbit ring around the model */}
      <group ref={orbit} visible={selected !== 3}>
        <mesh>
          <torusGeometry args={[2.75, 0.009, 8, 160]} />
          <meshBasicMaterial ref={orbitMaterial} color="#9fb3cf" transparent opacity={0.35} />
        </mesh>
        {/* a bead riding the ring */}
        <mesh position={[2.75, 0, 0]}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
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

export default function ServiceScene(props: {
  selected: number;
  hovered: number | null;
  onSelect: (i: number) => void;
  playing: boolean;
  onReady?: () => void;
  anchors?: NodeAnchors;
}) {
  const [supported, setSupported] = useState(supportsWebGL2);
  if (!supported) return null;
  return (
    <Canvas
      camera={CAMERA}
      dpr={[1, 1.5]}
      frameloop={props.playing ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        applyEnvironment(gl, scene);
        gl.domElement.addEventListener(
          "webglcontextlost",
          () => setSupported(false),
          { once: true },
        );
      }}
    >
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#ffffff", "#9db0cc", 0.8]} />
      <directionalLight position={[-3, 5, 5]} intensity={2} />
      {/* warm rim from behind */}
      <directionalLight position={[2.5, -1.5, -4]} intensity={2.2} color="#ff9a82" />
      <Stage selected={props.selected} playing={props.playing} onReady={props.onReady} />
      <Signals
        selected={props.selected}
        hovered={props.hovered}
        onSelect={props.onSelect}
        playing={props.playing}
        anchors={props.anchors}
      />
    </Canvas>
  );
}
