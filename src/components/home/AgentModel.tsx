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

function useAgentResources() {
  const resources = useMemo(() => {
    const pearl = new THREE.MeshPhysicalMaterial({
      color: "#f9fcff",
      roughness: 0.32,
      metalness: 0.06,
      clearcoat: 0.6,
      clearcoatRoughness: 0.24,
    });
    const silver = new THREE.MeshStandardMaterial({
      color: "#b6cadd",
      metalness: 0.3,
      roughness: 0.4,
    });
    const ice = new THREE.MeshPhysicalMaterial({
      color: "#c6e2f2",
      roughness: 0.26,
      clearcoat: 0.75,
      metalness: 0.08,
    });
    const lavender = new THREE.MeshPhysicalMaterial({
      color: "#d1c9ed",
      roughness: 0.3,
      clearcoat: 0.65,
    });
    const visor = new THREE.MeshPhysicalMaterial({
      color: "#88abc4",
      roughness: 0.23,
      metalness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
    });
    const blue = new THREE.MeshStandardMaterial({
      color: "#549dcf",
      emissive: "#4ba6d4",
      emissiveIntensity: 0.2,
      roughness: 0.3,
    });
    const violet = new THREE.MeshStandardMaterial({
      color: "#9d8bd8",
      emissive: "#a29ce7",
      emissiveIntensity: 0.16,
      roughness: 0.3,
    });
    const light = new THREE.MeshBasicMaterial({
      color: "#87d7f2",
      toneMapped: false,
    });
    const whiteLight = new THREE.MeshBasicMaterial({
      color: "#f5fdff",
      toneMapped: false,
    });
    const shadow = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv; void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(.33,.40,.59,pow(max(0.,1.-d),2.4)*.23);}`,
    });
    const rounded = new RoundedBoxGeometry(1, 1, 1, 3, 0.15);
    const soft = new RoundedBoxGeometry(1, 1, 1, 4, 0.24);
    const arrow = processArrow();
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
      (c) => new THREE.TubeGeometry(c, 32, 0.009, 5, false),
    );
    return {
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
      rounded,
      soft,
      arrow,
      shield,
      check,
      trend,
      routes,
      paths,
    };
  }, []);
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
        r.rounded,
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
      <mesh
        geometry={r.rounded}
        material={r.pearl}
        scale={[1.08, 0.87, 0.12]}
      />
      <mesh
        geometry={r.rounded}
        material={r.ice}
        scale={[0.96, 0.75, 0.026]}
        position={[0, 0, 0.105]}
      />
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
                geometry={r.rounded}
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
                geometry={r.rounded}
                material={r.silver}
                scale={[i === 0 ? 0.28 : 0.18, 0.022, 0.012]}
                position={[0.22, y + 0.2, 0.107]}
              />
            ))}
            <mesh
              geometry={r.rounded}
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

export function AgentModel({ playing }: { color: string; playing: boolean }) {
  const r = useAgentResources();
  const invalidate = useThree((state) => state.invalidate);
  const viewportWidth = useThree((state) => state.viewport.width);
  const time = useRef(0);
  const dirty = useRef(true);
  const interaction = useRef({ started: -10, hovered: false });
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const process = useRef<THREE.Group>(null);
  const ringAngle = useRef(0);
  const panels = useRef<(THREE.Group | null)[]>([]);
  const packets = useRef<THREE.InstancedMesh>(null);
  const antenna = useRef<THREE.Mesh>(null);
  const dots = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state, delta) => {
    if (!playing && !dirty.current) return;
    dirty.current = false;
    const dt = playing ? Math.min(delta, 0.05) : 0;
    time.current += dt;
    const t = time.current;
    const active = Math.max(0, 1 - (t - interaction.current.started) / 1.8);
    ringAngle.current += dt * (0.1 + active * 0.9);
    if (process.current) process.current.rotation.z = ringAngle.current;
    if (head.current) {
      head.current.position.y = 0.18 + Math.sin(t * 1.3) * 0.025;
      head.current.rotation.y = THREE.MathUtils.clamp(
        state.pointer.x * 0.1,
        -0.09,
        0.09,
      );
      head.current.rotation.z = Math.sin(t * 0.7) * 0.018;
    }
    if (eyes.current) {
      const blink = (t + 1.4) % 5.2;
      eyes.current.scale.y =
        blink < 0.15 ? Math.max(0.12, Math.abs(blink - 0.075) / 0.075) : 1;
      eyes.current.position.x = THREE.MathUtils.clamp(
        state.pointer.x * 0.025,
        -0.025,
        0.025,
      );
    }
    antenna.current?.scale.setScalar(
      1 + active * 0.28 + (interaction.current.hovered ? 0.1 : 0),
    );
    panels.current.forEach((panel, i) => {
      if (panel)
        panel.position.y =
          PANEL_POSITIONS[i][1] + Math.sin(t * 0.8 + i * 2) * 0.025;
    });
    for (let i = 0; i < PACKET_COUNT; i++) {
      const route = r.routes[Math.floor(i / 3)];
      route.getPoint((t * 0.18 + (i % 3) / 3) % 1, sample);
      transform.position.copy(sample);
      transform.scale.setScalar(0.027);
      transform.updateMatrix();
      packets.current?.setMatrixAt(i, transform.matrix);
    }
    if (packets.current) packets.current.instanceMatrix.needsUpdate = true;
    dots.current.forEach((dot, i) =>
      dot?.scale.setScalar(1 + Math.max(0, Math.sin(t * 2.8 - i * 0.8)) * 0.2),
    );
  });

  function activate(e: ThreeEvent<MouseEvent>) {
    if (e.delta > 6) return;
    interaction.current.started = time.current;
    dirty.current = true;
    invalidate(); // Stage still receives the click for its shared pulse behavior.
  }

  return (
    <group
      name="agent-studio"
      rotation={[0.24, -0.2, 0]}
      position={[-0.13, 0.04, 0]}
      scale={Math.min(0.94, viewportWidth * 0.125)}
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
        <mesh geometry={r.arrow} material={r.ice} />
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
          geometry={r.rounded}
          material={r.ice}
          position={[0, -0.48, 0.47]}
          scale={[0.69, 0.28, 0.021]}
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
            geometry={r.soft}
            material={r.silver}
            position={[0, -0.005, 0.465]}
            scale={[0.83, 0.58, 0.045]}
          />
          <mesh
            geometry={r.soft}
            material={r.visor}
            position={[0, -0.005, 0.524]}
            scale={[0.76, 0.51, 0.045]}
          />
          <group ref={eyes} position={[0, 0, 0.57]}>
            {[-0.17, 0.17].map((x) => (
              <mesh
                key={x}
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
        >
          <ContextPanel kind={i === 0 ? "analytics" : "verification"} r={r} />
        </group>
      ))}

      {r.paths.map((g, i) => (
        <mesh key={i} geometry={g} material={i === 1 ? r.violet : r.blue} />
      ))}
      <instancedMesh
        ref={packets}
        args={[undefined, undefined, PACKET_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 10, 6]} />
        <meshBasicMaterial color="#8adef8" toneMapped={false} />
      </instancedMesh>

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
