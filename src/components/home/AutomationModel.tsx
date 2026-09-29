"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/** An intentionally irregular workflow, laid out on an elevated isometric plane. */
const NODES = [
  { kind: "hub", position: [-0.65, 0.12, 0.65], size: 1.4, tone: 0 },
  { kind: "data", position: [-2.05, 0.04, 0.35], size: 0.88, tone: 0 },
  { kind: "api", position: [-1.65, 0.24, -1.12], size: 0.87, tone: 1 },
  { kind: "integrations", position: [-0.22, 0.1, -1.85], size: 0.8, tone: 0 },
  { kind: "agent", position: [0.55, 0.45, -0.58], size: 1.03, tone: 1 },
  { kind: "email", position: [0.65, 0.08, 1.16], size: 0.85, tone: 2 },
  { kind: "crm", position: [1.78, 0.24, 0.22], size: 0.88, tone: 0 },
  { kind: "analytics", position: [1.5, 0.48, -1.7], size: 0.92, tone: 1 },
] as const;

type Kind = (typeof NODES)[number]["kind"];
const TONES = ["#56c6ef", "#a398f2", "#e5a6dc"];
// Routes form a branching workflow, rather than a radial diagram. Last route is a feedback loop.
const EDGES = [
  [1, 0],
  [2, 0],
  [2, 3],
  [3, 4],
  [0, 4],
  [0, 5],
  [4, 6],
  [5, 6],
  [6, 7],
  [7, 4],
] as const;
/**
 * For a click on each node: how many hops downstream every node and route is
 * (-1 = not reached). Breadth-first over the directed routes, so the feedback
 * loop is followed once and never cycles.
 */
const CASCADES = NODES.map((_, start) => {
  const nodeDepth = NODES.map(() => -1);
  const edgeDepth = EDGES.map(() => -1);
  nodeDepth[start] = 0;
  const queue = [start];
  while (queue.length) {
    const from = queue.shift()!;
    EDGES.forEach(([a, b], e) => {
      if (a !== from || edgeDepth[e] !== -1) return;
      edgeDepth[e] = nodeDepth[from];
      if (nodeDepth[b] === -1) {
        nodeDepth[b] = nodeDepth[from] + 1;
        queue.push(b);
      }
    });
  }
  return { nodeDepth, edgeDepth };
});
/** Seconds per hop of a click cascade. */
const HOP = 0.55;
/** Nodes nothing flows into: where an automatic run starts. */
const SOURCES = NODES.map((_, i) => i).filter((i) => !EDGES.some(([, b]) => b === i));
/** Idle seconds after a cascade before the next automatic run. */
const IDLE_RUN = 2.5;
const UP = new THREE.Vector3(0, 1, 0);
const point = new THREE.Vector3();
const tangent = new THREE.Vector3();
const packet = new THREE.Object3D();

/** Analytic cubic tangent avoids Curve.getTangent's temporary vectors per frame. */
function curveTangent(
  curve: THREE.CubicBezierCurve3,
  u: number,
  target: THREE.Vector3,
) {
  const a = 3 * (1 - u) * (1 - u),
    b = 6 * (1 - u) * u,
    c = 3 * u * u;
  const { v0, v1, v2, v3 } = curve;
  return target
    .set(
      a * (v1.x - v0.x) + b * (v2.x - v1.x) + c * (v3.x - v2.x),
      a * (v1.y - v0.y) + b * (v2.y - v1.y) + c * (v3.y - v2.y),
      a * (v1.z - v0.z) + b * (v2.z - v1.z) + c * (v3.z - v2.z),
    )
    .normalize();
}

function roundedShape(width: number, radius: number) {
  const h = width / 2;
  const s = new THREE.Shape();
  s.moveTo(-h + radius, -h);
  s.lineTo(h - radius, -h);
  s.quadraticCurveTo(h, -h, h, -h + radius);
  s.lineTo(h, h - radius);
  s.quadraticCurveTo(h, h, h - radius, h);
  s.lineTo(-h + radius, h);
  s.quadraticCurveTo(-h, h, -h, h - radius);
  s.lineTo(-h, -h + radius);
  s.quadraticCurveTo(-h, -h, -h + radius, -h);
  return s;
}

function tileGeometry() {
  const g = new THREE.ExtrudeGeometry(roundedShape(0.76, 0.13), {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.024,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.center();
  g.rotateX(-Math.PI / 2);
  return g;
}

function stroke(points: number[][], radius = 0.015, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    closed,
    "centripetal",
  );
  return new THREE.TubeGeometry(
    curve,
    Math.max(12, points.length * 5),
    radius,
    5,
    closed,
  );
}

/** Rounded, raised line icons. No fonts, textures, labels, or third-party logos. */
function iconGeometry(kind: Kind) {
  const y = 0.08;
  switch (kind) {
    case "email":
      return [
        stroke(
          [
            [-0.2, y, -0.14],
            [0.2, y, -0.14],
            [0.2, y, 0.14],
            [-0.2, y, 0.14],
          ],
          0.017,
          true,
        ),
        stroke(
          [
            [-0.19, y, -0.12],
            [0, y, 0.035],
            [0.19, y, -0.12],
          ],
          0.018,
        ),
      ];
    case "api":
      return [
        stroke(
          [
            [-0.1, y, -0.14],
            [-0.22, y, 0],
            [-0.1, y, 0.14],
          ],
          0.023,
        ),
        stroke(
          [
            [0.1, y, -0.14],
            [0.22, y, 0],
            [0.1, y, 0.14],
          ],
          0.023,
        ),
        stroke(
          [
            [0.045, y, -0.17],
            [-0.045, y, 0.17],
          ],
          0.018,
        ),
      ];
    case "integrations":
      return [
        stroke(
          [
            [-0.04, y, -0.16],
            [-0.17, y, -0.16],
            [-0.22, y, -0.07],
            [-0.17, y, 0.035],
            [-0.04, y, 0.035],
          ],
          0.026,
        ),
        stroke(
          [
            [0.04, y, 0.16],
            [0.17, y, 0.16],
            [0.22, y, 0.07],
            [0.17, y, -0.035],
            [0.04, y, -0.035],
          ],
          0.026,
        ),
        stroke(
          [
            [-0.09, y, 0.07],
            [0.09, y, -0.07],
          ],
          0.022,
        ),
      ];
    default:
      return [];
  }
}

function useWorkflowResources() {
  const resources = useMemo(() => {
    const white = new THREE.MeshPhysicalMaterial({
      color: "#f9fcff",
      roughness: 0.3,
      metalness: 0.08,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
    });
    const silver = new THREE.MeshStandardMaterial({
      color: "#c6d6e9",
      roughness: 0.38,
      metalness: 0.35,
    });
    // Frosted acrylic uses opacity, avoiding a second transmission render pass.
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#e0f5ff",
      transparent: true,
      opacity: 0.66,
      roughness: 0.2,
      metalness: 0.12,
      clearcoat: 1,
      depthWrite: false,
    });
    const accents = ["#529acc", "#8870dc", "#cd79b8"].map(
      (color) =>
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.25,
          roughness: 0.3,
          metalness: 0.18,
        }),
    );
    const lights = TONES.map(
      (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    );
    const halos = TONES.map(
      (color) =>
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms: { uColor: { value: new THREE.Color(color) } },
          vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader: `varying vec2 vUv; uniform vec3 uColor; void main(){float d=length(vUv-.5)*2.;float a=pow(max(0.,1.-d),2.4);gl_FragColor=vec4(uColor,a*.3);}`,
        }),
    );
    const shadow = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec2 vUv; void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(.29,.36,.55,pow(max(0.,1.-d),2.)*.2);}`,
    });
    const outline = roundedShape(0.79, 0.14)
      .getPoints(5)
      .map((p) => [p.x, 0, -p.y]);
    outline.pop(); // The closed curve provides its own last segment.
    const trim = stroke(outline, 0.009, true);
    const tile = tileGeometry();
    const icons = Object.fromEntries(
      NODES.map((n) => [n.kind, iconGeometry(n.kind)]),
    ) as Record<Kind, THREE.TubeGeometry[]>;
    const routes = EDGES.map(([from, to], i) => {
      const a = new THREE.Vector3(...NODES[from].position);
      const b = new THREE.Vector3(...NODES[to].position);
      const direction = b.clone().sub(a).setY(0).normalize();
      a.addScaledVector(direction, NODES[from].size * 0.4);
      b.addScaledVector(direction, -NODES[to].size * 0.4);
      a.y -= 0.025;
      b.y -= 0.025;
      const c1 = a.clone().lerp(b, 0.32);
      const c2 = a.clone().lerp(b, 0.68);
      const bend = i === EDGES.length - 1 ? 0.72 : i % 2 ? 0.22 : -0.22;
      c1.z += bend;
      c2.z += bend;
      c1.y += 0.08;
      c2.y += 0.08;
      const curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
      const arrowPosition = curve.getPoint(0.69);
      const arrowRotation = new THREE.Quaternion().setFromUnitVectors(
        UP,
        curve.getTangent(0.69).normalize(),
      );
      return {
        curve,
        geometry: new THREE.TubeGeometry(curve, 48, 0.011, 6, false),
        // Wider invisible tube, so a thin route is easy to hover.
        hit: new THREE.TubeGeometry(curve, 16, 0.07, 5, false),
        // Light dashes stream along the tube (uv.x runs from start to end).
        flow: new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(TONES[NODES[to].tone]) },
            uOpacity: { value: 0.85 },
            uBoost: { value: 0 },
          },
          vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform float uBoost;
            void main(){
              float dash = smoothstep(0.55, 1.0, fract(vUv.x * 5.0 - uTime));
              vec3 c = mix(uColor, vec3(1.0), dash * (0.55 + 0.45 * uBoost));
              float a = uOpacity * (0.45 + 0.55 * dash + 0.35 * uBoost);
              gl_FragColor = vec4(c, min(a, 1.0));
            }`,
        }),
        arrowPosition,
        arrowRotation,
        tone: NODES[to].tone,
      };
    });
    // A finite, softly fading grid; it never fills the whole canvas.
    const gridPositions: number[] = [],
      gridColors: number[] = [];
    for (let i = -6; i <= 6; i++) {
      for (let j = -6; j < 6; j++) {
        const fade = Math.max(0, 1 - Math.hypot(i, j + 0.5) / 8);
        const c = new THREE.Color("#edf2fc").lerp(
          new THREE.Color("#a2b9e1"),
          fade,
        );
        gridPositions.push(
          i * 0.45,
          -0.36,
          j * 0.45,
          i * 0.45,
          -0.36,
          (j + 1) * 0.45,
          j * 0.45,
          -0.36,
          i * 0.45,
          (j + 1) * 0.45,
          -0.36,
          i * 0.45,
        );
        for (let v = 0; v < 4; v++) gridColors.push(c.r, c.g, c.b);
      }
    }
    const grid = new THREE.BufferGeometry();
    grid.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(gridPositions, 3),
    );
    grid.setAttribute("color", new THREE.Float32BufferAttribute(gridColors, 3));
    return {
      white,
      silver,
      glass,
      accents,
      lights,
      halos,
      shadow,
      tile,
      trim,
      icons,
      routes,
      grid,
    };
  }, []);
  useEffect(
    () => () => {
      const r = resources;
      [
        r.white,
        r.silver,
        r.glass,
        r.shadow,
        ...r.routes.map((p) => p.flow),
        ...r.accents,
        ...r.lights,
        ...r.halos,
      ].forEach((m) => m.dispose());
      [
        r.tile,
        r.trim,
        r.grid,
        ...Object.values(r.icons).flat(),
        ...r.routes.flatMap((p) => [p.geometry, p.hit]),
      ].forEach((g) => g.dispose());
    },
    [resources],
  );
  return resources;
}
type Resources = ReturnType<typeof useWorkflowResources>;

function WorkflowIcon({
  kind,
  tone,
  r,
}: {
  kind: Kind;
  tone: number;
  r: Resources;
}) {
  const accent = r.accents[tone];
  if (r.icons[kind].length)
    return (
      <group>
        {r.icons[kind].map((g, i) => (
          <mesh key={i} geometry={g} material={accent} />
        ))}
      </group>
    );
  if (kind === "data")
    return (
      <group>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[0, 0.04 + i * 0.09, 0]}>
            <mesh material={i === 2 ? r.glass : r.white}>
              <cylinderGeometry args={[0.17, 0.17, 0.075, 24]} />
            </mesh>
            <mesh
              material={accent}
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, 0.039, 0]}
            >
              <torusGeometry args={[0.165, 0.012, 5, 32]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  if (kind === "analytics")
    return (
      <group>
        {[0.12, 0.24, 0.38].map((h, i) => (
          <mesh
            key={i}
            material={i === 1 ? r.glass : accent}
            position={[-0.17 + i * 0.17, h / 2, 0]}
            scale={[0.12, h, 0.15]}
          >
            <boxGeometry />
          </mesh>
        ))}
        <mesh
          material={r.silver}
          position={[0, 0, 0.02]}
          scale={[0.52, 0.018, 0.26]}
        >
          <boxGeometry />
        </mesh>
      </group>
    );
  if (kind === "crm")
    return (
      <group>
        {[-1, 0, 1].map((i) => (
          <group
            key={i}
            position={[i * 0.15, i === 0 ? 0.035 : 0, i === 0 ? 0.06 : -0.06]}
          >
            <mesh material={i === 0 ? accent : r.glass} position={[0, 0.2, 0]}>
              <sphereGeometry args={[0.063, 16, 10]} />
            </mesh>
            <mesh
              material={i === 0 ? accent : r.silver}
              position={[0, 0.067, 0]}
            >
              <capsuleGeometry args={[0.058, 0.08, 4, 12]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  if (kind === "agent")
    return (
      <group>
        <mesh
          geometry={r.tile}
          material={r.glass}
          scale={[0.5, 2.3, 0.43]}
          position={[0, 0.17, 0]}
        />
        <mesh
          material={r.white}
          position={[0, 0.2, 0.177]}
          scale={[0.28, 0.16, 0.024]}
        >
          <boxGeometry />
        </mesh>
        {[-0.07, 0.07].map((x) => (
          <mesh key={x} material={r.lights[tone]} position={[x, 0.22, 0.195]}>
            <sphereGeometry args={[0.025, 12, 8]} />
          </mesh>
        ))}
        <mesh material={accent} position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.038, 16, 12]} />
        </mesh>
        <mesh material={r.silver} position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.09, 8]} />
        </mesh>
      </group>
    );
  return (
    <group>
      {/* An orchestration core suspended inside two luminous gyroscope arcs. */}
      <mesh
        material={r.glass}
        position={[0, 0.25, 0]}
        rotation={[0, Math.PI / 4, 0]}
      >
        <octahedronGeometry args={[0.2, 0]} />
      </mesh>
      <mesh material={r.white} position={[0, 0.25, 0]}>
        <octahedronGeometry args={[0.095, 0]} />
      </mesh>
      <mesh
        material={accent}
        position={[0, 0.25, 0]}
        rotation={[0.55, 0, 0.35]}
      >
        <torusGeometry args={[0.27, 0.012, 6, 48]} />
      </mesh>
      <mesh
        material={r.lights[1]}
        position={[0, 0.25, 0]}
        rotation={[-0.4, 1.3, 0]}
      >
        <torusGeometry args={[0.27, 0.008, 6, 48]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={r.lights[0]}
          position={[side * 0.27, 0.25, 0]}
        >
          <sphereGeometry args={[0.026, 12, 8]} />
        </mesh>
      ))}
    </group>
  );
}

export function AutomationModel({
  playing,
}: {
  color: string;
  playing: boolean;
}) {
  const r = useWorkflowResources();
  const invalidate = useThree((state) => state.invalidate);
  const viewportWidth = useThree((state) => state.viewport.width);
  // Keep platforms well inside the service cards as the desktop column narrows.
  const modelScale = Math.min(0.74, viewportWidth * 0.095);
  const time = useRef(0);
  const dirty = useRef(true);
  const nodes = useRef<(THREE.Group | null)[]>([]);
  const symbols = useRef<(THREE.Group | null)[]>([]);
  const trims = useRef<(THREE.Mesh | null)[]>([]);
  const packets = useRef<THREE.InstancedMesh>(null);
  const triggers = useRef<THREE.InstancedMesh>(null);
  const routeMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const arrowMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const ripple = useRef<THREE.Mesh>(null);
  const activity = useRef({ hovered: -1, route: -1, selected: 0, started: -10, auto: false, runs: 0 });
  const flowPhase = useRef(new Float32Array(EDGES.length));
  const heat = useRef(new Float32Array(NODES.length));

  useFrame((_, delta) => {
    if (!playing && !dirty.current) return;
    dirty.current = false;
    // A cascade animates on its own clock, so it also plays while paused.
    if (!playing && time.current - activity.current.started < HOP * 6) {
      time.current += Math.min(delta, 0.05);
      dirty.current = true;
      invalidate();
    }
    const dt = Math.min(delta, 0.05);
    if (playing) time.current += dt;
    const t = time.current;
    const act = activity.current;
    // When nobody is interacting, a run starts by itself from an input node,
    // so the links between nodes keep animating hop by hop.
    const runLength = (c: (typeof CASCADES)[number]) => HOP * (Math.max(...c.nodeDepth) + 1.5);
    if (
      playing &&
      act.hovered < 0 &&
      act.route < 0 &&
      t - act.started > runLength(CASCADES[act.selected]) + IDLE_RUN
    ) {
      act.selected = SOURCES[act.runs++ % SOURCES.length];
      act.started = t;
      act.auto = true;
    }
    const since = t - act.started;
    heat.current.fill(0);
    const cascade = CASCADES[act.selected];
    const cascadeLive = since >= 0 && since < runLength(cascade);
    // Focus: the hovered node, else a clicked node while its cascade runs.
    // Automatic runs animate without dimming the rest.
    const focus = act.hovered >= 0 ? act.hovered : cascadeLive && !act.auto ? act.selected : -1;
    r.routes.forEach(({ curve }, i) => {
      const [from, to] = EDGES[i];
      const linked = focus === from || focus === to || act.route === i;
      const inCascade = cascadeLive && cascade.edgeDepth[i] !== -1;
      const firing = inCascade && since >= cascade.edgeDepth[i] * HOP && since < (cascade.edgeDepth[i] + 1) * HOP;
      const dimming = focus >= 0 || act.route >= 0;
      // Linked routes brighten, the rest step back while something is focused.
      const opacity = !dimming ? 0.85 : linked || (inCascade && !act.auto) ? 1 : 0.2;
      // The link itself streams light: faster and brighter when linked or firing.
      const flowSpeed = firing ? 2.4 : linked ? 1.6 : 0.55;
      flowPhase.current[i] += dt * flowSpeed;
      const route = routeMeshes.current[i];
      if (route) {
        const u = (route.material as THREE.ShaderMaterial).uniforms;
        u.uTime.value = flowPhase.current[i];
        u.uOpacity.value += (opacity - u.uOpacity.value) * 0.2;
        u.uBoost.value += ((firing || linked ? 1 : 0) - u.uBoost.value) * 0.15;
      }
      const arrow = arrowMeshes.current[i];
      if (arrow) {
        const m = arrow.material as THREE.MeshBasicMaterial;
        m.opacity += (opacity - m.opacity) * 0.2;
        arrow.scale.setScalar(1 + (firing ? 0.6 : linked ? 0.3 : 0));
      }
      const speed = linked ? 0.42 : 0.19;
      for (let p = 0; p < 2; p++) {
        const u = (t * speed + i * 0.137 + p * 0.5) % 1;
        curve.getPoint(u, point);
        curveTangent(curve, u, tangent);
        packet.position.copy(point);
        packet.quaternion.setFromUnitVectors(UP, tangent.normalize());
        const size = focus < 0 || linked ? 1 : 0.55;
        packet.scale.set(0.022 * size, 0.065 * size, 0.022 * size);
        packet.updateMatrix();
        packets.current?.setMatrixAt(i * 2 + p, packet.matrix);
        heat.current[EDGES[i][1]] = Math.max(
          heat.current[EDGES[i][1]],
          Math.pow(u, 5),
        );
      }
    });
    if (packets.current) packets.current.instanceMatrix.needsUpdate = true;
    // Click cascade: a bright trigger runs each downstream route in hop order.
    r.routes.forEach(({ curve }, i) => {
      const depth = cascade.edgeDepth[i];
      const u = (since - depth * HOP) / HOP;
      const visible = cascadeLive && depth !== -1 && u >= 0 && u <= 1;
      if (visible) {
        curve.getPoint(u, point);
        packet.position.copy(point);
        packet.quaternion.identity();
        packet.scale.setScalar(0.05);
      } else packet.scale.setScalar(0);
      packet.updateMatrix();
      triggers.current?.setMatrixAt(i, packet.matrix);
    });
    if (triggers.current) triggers.current.instanceMatrix.needsUpdate = true;
    NODES.forEach((n, i) => {
      // A node is reached by the cascade when its hop comes up.
      const reachedAt = cascade.nodeDepth[i] * HOP;
      const reached =
        cascadeLive && cascade.nodeDepth[i] !== -1 && since >= reachedAt && since < reachedAt + HOP * 1.4;
      const neighbour =
        (focus >= 0 && focus !== i && EDGES.some(([a, b]) => (a === focus && b === i) || (b === focus && a === i))) ||
        (act.route >= 0 && (EDGES[act.route][0] === i || EDGES[act.route][1] === i));
      const active = activity.current.hovered === i || reached;
      const lift = active ? 0.065 : neighbour ? 0.03 : 0;
      const node = nodes.current[i];
      if (node)
        node.position.y =
          n.position[1] + Math.sin(t * 0.85 + i * 1.4) * 0.018 + lift;
      const symbol = symbols.current[i];
      if (symbol) {
        symbol.position.y = 0.16 + Math.sin(t * 1.1 + i) * 0.012;
        if (i === 0) symbol.rotation.y = t * 0.3;
      }
      const trim = trims.current[i];
      if (trim)
        trim.scale.setScalar(
          1 + heat.current[i] * 0.025 + (active ? 0.035 : neighbour ? 0.02 : 0),
        );
    });
    if (ripple.current) {
      const phase = since >= 0 && since < 1.8 ? since / 1.8 : (t * 0.3) % 1;
      ripple.current.scale.setScalar(0.7 + phase * 2.4);
      (ripple.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - phase) * 0.22;
    }
  });

  function activate(event: ThreeEvent<MouseEvent>, index: number) {
    if (event.delta > 6) return;
    dirty.current = true;
    activity.current.selected = index;
    activity.current.started = time.current;
    activity.current.auto = false;
    invalidate();
    // Bubble to Stage to retain its existing click pulse and drag behavior.
  }

  return (
    <group
      name="automation-workflow"
      rotation={[0.72, -0.24, -0.075]}
      position={[-0.32, 0.02, 0]}
      scale={modelScale}
    >
      <lineSegments geometry={r.grid}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.38}
          depthWrite={false}
        />
      </lineSegments>
      {NODES.map((n, i) => (
        <mesh
          key={`shadow-${i}`}
          material={r.shadow}
          position={[n.position[0], -0.35, n.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={n.size}
        >
          <planeGeometry args={[1.8, 1.8]} />
        </mesh>
      ))}
      {r.routes.map((route, i) => (
        <group key={i}>
          <mesh
            ref={(el) => {
              routeMeshes.current[i] = el;
            }}
            geometry={route.geometry}
            material={route.flow}
          />
          {/* invisible, wider hover target for the thin route */}
          <mesh
            geometry={route.hit}
            onPointerOver={(e) => {
              e.stopPropagation();
              dirty.current = true;
              activity.current.route = i;
              invalidate();
            }}
            onPointerOut={() => {
              dirty.current = true;
              activity.current.route = -1;
              invalidate();
            }}
          >
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
          <mesh
            ref={(el) => {
              arrowMeshes.current[i] = el;
            }}
            position={route.arrowPosition}
            quaternion={route.arrowRotation}
          >
            <coneGeometry args={[0.035, 0.105, 3]} />
            <meshBasicMaterial color={TONES[route.tone]} transparent opacity={0.85} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <instancedMesh
        ref={packets}
        args={[undefined, undefined, EDGES.length * 2]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#75dfff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={triggers}
        args={[undefined, undefined, EDGES.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#e4f8ff" toneMapped={false} />
      </instancedMesh>
      {NODES.map((n, i) => (
        <group
          key={n.kind}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          position={[...n.position]}
          scale={n.size}
          onClick={(e) => activate(e, i)}
          onPointerOver={(e) => {
            e.stopPropagation();
            dirty.current = true;
            activity.current.hovered = i;
            invalidate();
          }}
          onPointerOut={() => {
            dirty.current = true;
            activity.current.hovered = -1;
            invalidate();
          }}
        >
          {/* Three layers: silver foundation, pearl body, floating frosted cap. */}
          <mesh
            geometry={r.tile}
            material={r.silver}
            position={[0, -0.12, 0]}
            scale={[1.03, 0.48, 1.03]}
          />
          <mesh geometry={r.tile} material={r.white} />
          <mesh
            geometry={r.tile}
            material={r.glass}
            position={[0, 0.12, 0]}
            scale={[0.88, 0.22, 0.88]}
          />
          <mesh
            ref={(el) => {
              trims.current[i] = el;
            }}
            geometry={r.trim}
            material={r.lights[n.tone]}
            position={[0, -0.065, 0]}
          />
          <mesh
            material={r.halos[n.tone]}
            position={[0, -0.17, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[1.65, 1.65]} />
          </mesh>
          {/* Discreet status LEDs on the near edge. */}
          {[-0.07, 0, 0.07].map((x) => (
            <mesh
              key={x}
              material={x === -0.07 ? r.lights[n.tone] : r.silver}
              position={[x, -0.015, 0.394]}
            >
              <sphereGeometry args={[0.012, 8, 6]} />
            </mesh>
          ))}
          <group
            ref={(el) => {
              symbols.current[i] = el;
            }}
            position={[0, 0.16, 0]}
          >
            <WorkflowIcon kind={n.kind} tone={n.tone} r={r} />
          </group>
          {i === 0 && (
            <mesh
              ref={ripple}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.12, 0]}
            >
              <ringGeometry args={[0.31, 0.316, 64]} />
              <meshBasicMaterial
                color="#7fcfff"
                transparent
                opacity={0.18}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
