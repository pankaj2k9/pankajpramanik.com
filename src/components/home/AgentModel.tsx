"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** A compact agent, a visible feedback loop, and two quiet context panels. */
const PANEL_POSITIONS: [number, number, number][] = [
  [-1.5, 0.08, -0.05],
  [1.42, 0.2, -0.12],
];
const PACKET_COUNT = 9;
/** Thought particles swirling around the agent, like the Data model's records. */
const THOUGHTS = 120;
const sample = new THREE.Vector3();
const transform = new THREE.Object3D();

/** A broad, extruded arc with a proper arrow tip, rather than a thin orbit. */
function processArrow() {
  const r = 1.02,
    start = 0.16,
    end = Math.PI - 0.34;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r + 0.075, start, end, false);
  shape.lineTo((r + 0.18) * Math.cos(end), (r + 0.18) * Math.sin(end));
  shape.lineTo(r * Math.cos(end + 0.23), r * Math.sin(end + 0.23));
  shape.lineTo((r - 0.18) * Math.cos(end), (r - 0.18) * Math.sin(end));
  shape.lineTo((r - 0.075) * Math.cos(end), (r - 0.075) * Math.sin(end));
  shape.absarc(0, 0, r - 0.075, end, start, true);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.014,
    bevelSegments: 2,
    curveSegments: 32,
  });
  g.translate(0, 0, -0.035);
  return g;
}

function lineGeometry(points: [number, number, number][], radius = 0.016) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    "centripetal",
  );
  return new THREE.TubeGeometry(curve, 24, radius, 5, false);
}

/** Shallow plates get their own bevels, avoiding stretched specular edges. */
function roundedPlate(
  width: number,
  height: number,
  depth: number,
  radius: number,
) {
  const x = width / 2,
    y = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -y);
  shape.lineTo(x - radius, -y);
  shape.quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius);
  shape.quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y);
  shape.quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius);
  shape.quadraticCurveTo(-x, -y, -x + radius, -y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.005,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** A light tint of the AI Agents node colour: white lerped toward it. */
const tint = (color: string, amount: number) => new THREE.Color("#ffffff").lerp(new THREE.Color(color), amount);

function useAgentResources(color: string) {
  const resources = useMemo(() => {
    // Same recipe as the Data model: a glossy pastel body tinted toward the
    // node colour, with self-lit accents in the full colour.
    const pearl = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#f3f5fb").lerp(new THREE.Color(color), 0.12),
      roughness: 0.26,
      clearcoat: 0.85,
      clearcoatRoughness: 0.18,
      sheen: 0.5,
      sheenColor: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.04,
    });
    const silver = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d9dfeb").lerp(new THREE.Color(color), 0.08),
      metalness: 0.15,
      roughness: 0.42,
    });
    const ice = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#f3f5fb").lerp(new THREE.Color(color), 0.3),
      roughness: 0.24,
      clearcoat: 0.9,
      clearcoatRoughness: 0.15,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.06,
    });
    const lavender = new THREE.MeshStandardMaterial({
      color: tint(color, 0.7),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    // A deep navy screen makes the glowing eyes read from across the hero.
    const visor = new THREE.MeshPhysicalMaterial({
      color: "#121a2e",
      roughness: 0.18,
      metalness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
    const blue = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const violet = new THREE.MeshStandardMaterial({
      color: tint(color, 0.8),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });
    const light = new THREE.MeshBasicMaterial({
      color: tint(color, 0.9),
      toneMapped: false,
    });
    // Eyes: brightness is animated per frame (hover, thinking, click).
    const eyeColor = tint(color, 0.55);
    const whiteLight = new THREE.MeshBasicMaterial({
      color: eyeColor.clone(),
      toneMapped: false,
    });
    const shadow = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv; void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(.33,.40,.59,pow(max(0.,1.-d),2.4)*.23);}`,
    });
    const detail = new THREE.BoxGeometry(1, 1, 1);
    const rounded = new RoundedBoxGeometry(1, 1, 1, 3, 0.15);
    const soft = new RoundedBoxGeometry(1, 1, 1, 4, 0.24);
    const arrow = processArrow();
    const panel = roundedPlate(1.08, 0.87, 0.12, 0.13);
    const panelInset = roundedPlate(0.96, 0.75, 0.026, 0.1);
    const bezel = roundedPlate(0.83, 0.58, 0.035, 0.2);
    const faceplate = roundedPlate(0.76, 0.51, 0.03, 0.18);
    const controls = roundedPlate(0.69, 0.28, 0.021, 0.06);
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 0.24);
    shieldShape.quadraticCurveTo(0.09, 0.17, 0.19, 0.16);
    shieldShape.lineTo(0.18, -0.04);
    shieldShape.quadraticCurveTo(0.14, -0.2, 0, -0.28);
    shieldShape.quadraticCurveTo(-0.14, -0.2, -0.18, -0.04);
    shieldShape.lineTo(-0.19, 0.16);
    shieldShape.quadraticCurveTo(-0.09, 0.17, 0, 0.24);
    const shield = new THREE.ExtrudeGeometry(shieldShape, {
      depth: 0.055,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.014,
      bevelSegments: 3,
      curveSegments: 10,
    });
    const check = lineGeometry(
      [
        [-0.1, 0, 0.09],
        [-0.025, -0.065, 0.09],
        [0.105, 0.09, 0.09],
      ],
      0.023,
    );
    const trend = lineGeometry(
      [
        [-0.31, -0.22, 0.12],
        [-0.18, -0.11, 0.12],
        [-0.04, -0.16, 0.12],
        [0.13, 0.035, 0.12],
        [0.32, 0.12, 0.12],
      ],
      0.013,
    );
    const routes = [
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(-1.44, -0.45, 0),
        new THREE.Vector3(-1.5, -0.86, 0.2),
        new THREE.Vector3(-0.8, -0.93, 0.65),
        new THREE.Vector3(-0.52, -0.69, 0.68),
      ),
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(0.52, -0.69, 0.68),
        new THREE.Vector3(0.95, -0.93, 0.65),
        new THREE.Vector3(1.44, -0.72, 0.2),
        new THREE.Vector3(1.43, -0.35, 0),
      ),
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(-1.1, -0.87, 0.8),
        new THREE.Vector3(-0.8, -1.12, 1.0),
        new THREE.Vector3(0.8, -1.12, 1.0),
        new THREE.Vector3(1.1, -0.87, 0.8),
      ),
    ];
    const paths = routes.map(
      (c) => new THREE.TubeGeometry(c, 32, 0.014, 6, false),
    );
    return {
      eyeColor,
      pearl,
      silver,
      ice,
      lavender,
      visor,
      blue,
      violet,
      light,
      whiteLight,
      shadow,
      detail,
      rounded,
      panel,
      panelInset,
      bezel,
      faceplate,
      controls,
      soft,
      arrow,
      shield,
      check,
      trend,
      routes,
      paths,
    };
  }, [color]);
  useEffect(
    () => () => {
      const r = resources;
      [
        r.pearl,
        r.silver,
        r.ice,
        r.lavender,
        r.visor,
        r.blue,
        r.violet,
        r.light,
        r.whiteLight,
        r.shadow,
      ].forEach((m) => m.dispose());
      [
        r.detail,
        r.rounded,
        r.panel,
        r.panelInset,
        r.bezel,
        r.faceplate,
        r.controls,
        r.soft,
        r.arrow,
        r.shield,
        r.check,
        r.trend,
        ...r.paths,
      ].forEach((g) => g.dispose());
    },
    [resources],
  );
  return resources;
}
type Resources = ReturnType<typeof useAgentResources>;

function ContextPanel({
  kind,
  r,
}: {
  kind: "analytics" | "verification";
  r: Resources;
}) {
  return (
    <>
      <mesh geometry={r.panel} material={r.pearl} />
      <mesh geometry={r.panelInset} material={r.ice} position={[0, 0, 0.105]} />
      <group position={[0, 0, 0.07]}>
        {kind === "analytics" ? (
          <>
            <mesh
              geometry={r.rounded}
              material={r.pearl}
              scale={[0.4, 0.4, 0.04]}
              position={[-0.22, 0.12, 0.1]}
            />
            {[0.1, 0.19, 0.28].map((h, i) => (
              <mesh
                key={h}
                geometry={r.rounded}
                material={i === 2 ? r.blue : r.silver}
                scale={[0.065, h, 0.025]}
                position={[-0.33 + i * 0.1, -0.035 + h / 2, 0.14]}
              />
            ))}
            <mesh
              geometry={r.trend}
              material={r.blue}
              position={[0, -0.02, 0.04]}
            />
            {[0.06, -0.025].map((y, i) => (
              <mesh
                key={y}
                geometry={r.detail}
                material={r.silver}
                scale={[i === 0 ? 0.26 : 0.2, 0.022, 0.012]}
                position={[0.23, y + 0.14, 0.107]}
              />
            ))}
          </>
        ) : (
          <>
            <mesh
              geometry={r.rounded}
              material={r.pearl}
              scale={[0.44, 0.54, 0.04]}
              position={[-0.21, 0.065, 0.1]}
            />
            <group position={[-0.21, 0.075, 0.13]} scale={0.73}>
              <mesh geometry={r.shield} material={r.lavender} />
              <mesh geometry={r.check} material={r.violet} />
            </group>
            {[0, 1, 2].map((i) => (
              <mesh
                key={i}
                geometry={r.rounded}
                material={i === 2 ? r.blue : r.silver}
                scale={[0.08, 0.085, 0.026]}
                position={[0.1 + i * 0.12, -0.045, 0.108]}
              />
            ))}
            {[0.05, -0.03].map((y, i) => (
              <mesh
                key={y}
                geometry={r.detail}
                material={r.silver}
                scale={[i === 0 ? 0.28 : 0.18, 0.022, 0.012]}
                position={[0.22, y + 0.2, 0.107]}
              />
            ))}
            <mesh
              geometry={r.detail}
              material={r.silver}
              scale={[0.72, 0.025, 0.015]}
              position={[0, -0.28, 0.104]}
            />
          </>
        )}
        {/* Small status pips, rather than text on a decorative canvas. */}
        {[-0.04, 0.04].map((x) => (
          <mesh
            key={x}
            material={x < 0 ? r.light : r.silver}
            position={[x, 0.35, 0.086]}
          >
            <sphereGeometry args={[0.014, 10, 6]} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function AgentModel({ color, playing }: { color: string; playing: boolean }) {
  const r = useAgentResources(color);
  const invalidate = useThree((state) => state.invalidate);
  const viewportWidth = useThree((state) => state.viewport.width);
  const time = useRef(0);
  const dirty = useRef(true);
  const interaction = useRef({ started: -10, hovered: false });
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const process = useRef<THREE.Group>(null);
  const ringAngle = useRef(0);
  const panels = useRef<(THREE.Group | null)[]>([]);
  const packets = useRef<THREE.InstancedMesh>(null);
  const antenna = useRef<THREE.Mesh>(null);
  const dots = useRef<(THREE.Mesh | null)[]>([]);
  /** Per-route packet clocks, so a speed change never makes packets jump. */
  const routePhase = useRef(new Float32Array(3));
  /** Panel under the pointer, and each panel's eased "in use" amount. */
  const panelHover = useRef<number | null>(null);
  const panelPop = useRef([0, 0]);
  /** Panel chosen by the last click, or null to alternate on its own. */
  const forcedTarget = useRef<number | null>(null);
  const cloud = useRef<THREE.Points>(null);
  const cloudPositions = useMemo(() => new Float32Array(THOUGHTS * 3), []);
  const cloudPhase = useRef(0);
  const glow = useRef(0);
  /** Materials animated per frame are reached through meshes, not `r`. */
  const eyeMesh = useRef<THREE.Mesh>(null);
  const accentMesh = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!playing && !dirty.current) return;
    dirty.current = false;
    const dt = playing ? Math.min(delta, 0.05) : 0;
    time.current += dt;
    const t = time.current;
    const active = Math.max(0, 1 - (t - interaction.current.started) / 1.8);
    const hovered = interaction.current.hovered;
    const { x: px, y: py } = state.pointer;
    // The agent loops through a small routine: think, act on one context
    // panel (alternating sides), then confirm. A click restarts it at "act".
    const CYCLE = 4.8;
    const clicked = t - interaction.current.started < CYCLE;
    const local = clicked ? (t - interaction.current.started + 1.6) % CYCLE : t % CYCLE;
    const cycleIndex = Math.floor(t / CYCLE);
    const thinking = local < 1.6;
    const acting = local >= 1.6 && local < 3.4;
    const done = local >= 3.4;
    if (!clicked) forcedTarget.current = null;
    // 0 = left panel, 1 = right panel. A hovered panel is the one in use.
    const target = panelHover.current ?? forcedTarget.current ?? cycleIndex % 2;
    const actAmount = acting ? Math.sin(((local - 1.6) / 1.8) * Math.PI) : 0;
    const ease = dt > 0 ? 1 - Math.exp(-dt * 8) : 1;
    // Overall excitement: hover, a recent click, or the thinking phase.
    const wantGlow = Math.min(1, (hovered ? 0.6 : 0) + active + (thinking ? 0.25 : 0));
    glow.current += (wantGlow - glow.current) * ease;

    ringAngle.current += dt * (0.35 + (thinking ? 1.2 : 0) + active * 2.4 + (hovered ? 0.8 : 0));
    if (process.current) process.current.rotation.z = ringAngle.current;
    // The whole model floats and turns gently on its own, like a turntable.
    if (root.current) {
      root.current.position.y = 0.04 + Math.sin(t * 0.9) * 0.035;
      root.current.rotation.y = -0.2 + Math.sin(t * 0.35) * 0.22;
    }
    if (head.current) {
      head.current.position.y = 0.18 + Math.sin(t * 1.3) * 0.025;
      // Looks at the pointer; while acting it turns toward the panel it uses.
      const look =
        panelHover.current !== null
          ? panelHover.current === 0
            ? -0.4
            : 0.4
          : acting
            ? (target === 0 ? -0.32 : 0.32) * actAmount
            : 0;
      const follow = hovered ? 0.4 : 0.22;
      const wantY = THREE.MathUtils.clamp(px * follow, -0.35, 0.35) + look;
      head.current.rotation.y += (wantY - head.current.rotation.y) * 0.08;
      // A small nod when a task is confirmed.
      const nod = done ? Math.sin(((local - 3.4) / 1.4) * Math.PI * 2) * 0.12 * (1 - (local - 3.4) / 1.4) : 0;
      const wantX = -py * 0.12 + nod;
      head.current.rotation.x += (wantX - head.current.rotation.x) * 0.12;
      head.current.rotation.z = Math.sin(t * 0.7) * 0.018;
    }
    if (eyes.current) {
      const blink = (t + 1.4) % 5.2;
      const blinkY = blink < 0.15 ? Math.max(0.12, Math.abs(blink - 0.075) / 0.075) : 1;
      // Narrow, scanning eyes while thinking; happy squint when done.
      const mood = thinking ? 0.62 : done ? 0.75 : 1;
      eyes.current.scale.y = blinkY * mood;
      const scan = thinking ? Math.sin(t * 5) * 0.035 : 0;
      eyes.current.position.x = THREE.MathUtils.clamp(px * 0.06, -0.05, 0.05) + scan;
      eyes.current.position.y = THREE.MathUtils.clamp(py * 0.04, -0.03, 0.03);
    }
    // Eyes flare on hover and click. toneMapped is off, so >1 reads as bloom-bright.
    const eyeMaterial = eyeMesh.current?.material as THREE.MeshBasicMaterial | undefined;
    eyeMaterial?.color.copy(r.eyeColor).multiplyScalar(1 + glow.current * 0.9);
    const accent = accentMesh.current?.material as THREE.MeshStandardMaterial | undefined;
    if (accent) accent.emissiveIntensity = 0.9 + glow.current * 0.8;
    antenna.current?.scale.setScalar(
      1 +
        (thinking ? Math.max(0, Math.sin(t * 9)) * 0.3 : Math.max(0, Math.sin(t * 2.2)) * 0.12) +
        active * 0.28 +
        (hovered ? 0.1 : 0),
    );
    panels.current.forEach((panel, i) => {
      if (!panel) return;
      const want = panelHover.current === i ? 1 : i === target ? actAmount : 0;
      panelPop.current[i] += (want - panelPop.current[i]) * ease;
      const pop = panelPop.current[i];
      panel.position.y = PANEL_POSITIONS[i][1] + Math.sin(t * 0.8 + i * 2) * 0.05 + pop * 0.12;
      panel.rotation.y = (i === 0 ? 0.2 : -0.22) + Math.sin(t * 0.6 + i) * 0.1 - pop * (i === 0 ? 0.2 : -0.2);
      panel.scale.setScalar(1 + pop * 0.12);
    });
    // Packets rush along the route to the panel in use.
    for (let k = 0; k < 3; k++) {
      const busy = (acting || panelHover.current !== null) && (k === target || k === 2);
      routePhase.current[k] += dt * (busy ? 0.7 : 0.18) * (1 + active * 2);
    }
    for (let i = 0; i < PACKET_COUNT; i++) {
      const k = Math.floor(i / 3);
      const route = r.routes[k];
      route.getPoint((routePhase.current[k] + (i % 3) / 3) % 1, sample);
      transform.position.copy(sample);
      transform.scale.setScalar((acting && k === target ? 0.045 : 0.032) * (1 + active * 0.6));
      transform.updateMatrix();
      packets.current?.setMatrixAt(i, transform.matrix);
    }
    if (packets.current) packets.current.instanceMatrix.needsUpdate = true;
    dots.current.forEach((dot, i) =>
      dot?.scale.setScalar(1 + Math.max(0, Math.sin(t * 2.8 - i * 0.8)) * 0.2),
    );
    // Thoughts spiral up around the agent, faster while it thinks or is
    // hovered; a click throws them outward in a burst.
    cloudPhase.current += dt * (0.08 + (thinking ? 0.06 : 0) + glow.current * 0.12);
    const pts = cloud.current;
    if (pts) {
      const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < THOUGHTS; i++) {
        const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
        const h0 = seed - Math.floor(seed);
        const h = (h0 + cloudPhase.current) % 1;
        const angle = h0 * 40 + h * 6 + t * 0.35;
        const radius = 1.25 - h * 0.55 + active * 0.9 * (0.5 + h0);
        pos.setXYZ(i, Math.cos(angle) * radius, -0.95 + h * 2.1, Math.sin(angle) * radius);
      }
      pos.needsUpdate = true;
    }
  });

  function activate(e: ThreeEvent<MouseEvent>) {
    if (e.delta > 6) return;
    interaction.current.started = time.current;
    dirty.current = true;
    invalidate(); // Stage still receives the click for its shared pulse behavior.
  }

  function setPanelHover(i: number | null) {
    panelHover.current = i;
    dirty.current = true;
    invalidate();
  }

  return (
    <group
      ref={root}
      name="agent-studio"
      rotation={[0.24, -0.2, 0]}
      position={[-0.13, 0.04, 0]}
      scale={Math.min(0.96, viewportWidth * 0.12)}
    >
      <mesh
        material={r.shadow}
        position={[0, -1.04, 0.06]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[4.8, 3.7]} />
      </mesh>

      {/* A low, ceramic plinth keeps the silhouette grounded. */}
      <mesh material={r.silver} position={[0, -0.94, 0]}>
        <cylinderGeometry args={[0.92, 0.92, 0.13, 64]} />
      </mesh>
      <mesh material={r.pearl} position={[0, -0.83, 0]}>
        <cylinderGeometry args={[0.97, 0.97, 0.15, 64]} />
      </mesh>
      <mesh material={r.ice} position={[0, -0.735, 0]}>
        <cylinderGeometry args={[0.82, 0.86, 0.05, 64]} />
      </mesh>
      <mesh
        material={r.light}
        position={[0, -0.893, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.955, 0.008, 6, 80]} />
      </mesh>

      {/* Open space behind the agent: two broad arrows replace the old busy orbits. */}
      <group ref={process} position={[0, 0.18, -0.42]}>
        <mesh geometry={r.arrow} material={r.violet} />
        <mesh
          geometry={r.arrow}
          material={r.lavender}
          rotation={[0, 0, Math.PI]}
        />
      </group>

      <group
        onClick={activate}
        onPointerOver={(e) => {
          e.stopPropagation();
          interaction.current.hovered = true;
          dirty.current = true;
          invalidate();
        }}
        onPointerOut={() => {
          interaction.current.hovered = false;
          dirty.current = true;
          invalidate();
        }}
      >
        {/* Compact body, inset controls, and a single raised action button. */}
        <mesh
          geometry={r.soft}
          material={r.pearl}
          position={[0, -0.47, 0.15]}
          scale={[0.87, 0.48, 0.56]}
        />
        <mesh
          geometry={r.controls}
          material={r.ice}
          position={[0, -0.48, 0.47]}
        />
        {[-0.21, -0.11, -0.01].map((x, i) => (
          <mesh
            key={x}
            material={i === 0 ? r.light : r.silver}
            position={[x, -0.435, 0.5]}
          >
            <sphereGeometry args={[0.021, 12, 8]} />
          </mesh>
        ))}
        <mesh
          geometry={r.rounded}
          material={r.silver}
          position={[-0.115, -0.54, 0.5]}
          scale={[0.23, 0.024, 0.014]}
        />
        <mesh
          material={r.lavender}
          position={[0.21, -0.48, 0.51]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.075, 0.075, 0.03, 24]} />
        </mesh>
        <mesh material={r.silver} position={[0, -0.18, 0.06]}>
          <cylinderGeometry args={[0.13, 0.15, 0.13, 24]} />
        </mesh>

        <group ref={head} position={[0, 0.18, 0]}>
          <mesh
            geometry={r.soft}
            material={r.pearl}
            position={[0, 0, 0.1]}
            scale={[1.04, 0.81, 0.66]}
          />
          <mesh
            geometry={r.bezel}
            material={r.silver}
            position={[0, -0.005, 0.465]}
          />
          <mesh
            geometry={r.faceplate}
            material={r.visor}
            position={[0, -0.005, 0.524]}
          />
          <group ref={eyes} position={[0, 0, 0.57]}>
            {[-0.17, 0.17].map((x, i) => (
              <mesh
                key={x}
                ref={i === 0 ? eyeMesh : undefined}
                geometry={r.soft}
                material={r.whiteLight}
                position={[x, 0, 0]}
                scale={[0.105, 0.14, 0.024]}
              />
            ))}
          </group>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={r.soft}
              material={r.ice}
              position={[side * 0.535, -0.01, 0.06]}
              scale={[0.085, 0.27, 0.27]}
            />
          ))}
          <mesh material={r.silver} position={[0, 0.47, 0.045]}>
            <cylinderGeometry args={[0.023, 0.023, 0.18, 12]} />
          </mesh>
          <mesh ref={antenna} material={r.ice} position={[0, 0.59, 0.045]}>
            <sphereGeometry args={[0.082, 24, 16]} />
          </mesh>
          <mesh material={r.light} position={[0, 0.59, 0.1]}>
            <sphereGeometry args={[0.034, 16, 12]} />
          </mesh>
        </group>
      </group>

      {PANEL_POSITIONS.map((position, i) => (
        <group
          key={i}
          ref={(el) => {
            panels.current[i] = el;
          }}
          position={position}
          rotation={[0, i === 0 ? 0.2 : -0.22, i === 0 ? 0.035 : -0.035]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setPanelHover(i);
          }}
          onPointerOut={() => setPanelHover(panelHover.current === i ? null : panelHover.current)}
          onClick={(e) => {
            if (e.delta > 6) return;
            forcedTarget.current = i;
            activate(e);
          }}
        >
          <ContextPanel kind={i === 0 ? "analytics" : "verification"} r={r} />
        </group>
      ))}

      {r.paths.map((g, i) => (
        <mesh
          key={i}
          ref={i === 0 ? accentMesh : undefined}
          geometry={g}
          material={i === 1 ? r.violet : r.blue}
        />
      ))}
      <instancedMesh
        ref={packets}
        args={[undefined, undefined, PACKET_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 10, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
      <points ref={cloud}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[cloudPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.055}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Two small milestones on the front edge: approve and iterate. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.12, -0.91, 0.69]}>
          <mesh material={r.pearl}>
            <cylinderGeometry args={[0.27, 0.27, 0.1, 40]} />
          </mesh>
          <mesh
            material={r.ice}
            position={[0, 0.09, 0.01]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.185, 0.185, 0.07, 32]} />
          </mesh>
          {side < 0 ? (
            <mesh
              geometry={r.check}
              material={r.blue}
              position={[0, 0.09, 0.052]}
              scale={0.75}
            />
          ) : (
            <group position={[0, 0.09, 0.062]} scale={0.1}>
              <mesh
                geometry={r.arrow}
                material={r.violet}
                rotation={[0, 0, -0.8]}
              />
              <mesh
                geometry={r.arrow}
                material={r.violet}
                rotation={[0, 0, Math.PI - 0.8]}
              />
            </group>
          )}
        </group>
      ))}
      <group position={[0, -1.0, 1.03]}>
        <mesh
          geometry={r.rounded}
          material={r.pearl}
          scale={[0.5, 0.27, 0.2]}
        />
        {[-0.12, 0, 0.12].map((x, i) => (
          <mesh
            key={x}
            ref={(el) => {
              dots.current[i] = el;
            }}
            material={i === 1 ? r.violet : r.blue}
            position={[x, 0, 0.115]}
          >
            <sphereGeometry args={[0.024, 12, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
