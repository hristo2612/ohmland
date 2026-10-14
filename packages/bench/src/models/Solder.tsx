// Unit 3 in 3D: the solder station and its iron, spools and braid, perfboard (top and copper side, with legs,
// bends, links and every joint's shape), the plan card, heat-sink clips, the wire stripper, heat-shrink, the heat
// gun, the barrel-jack board and wall adapters. Simple shapes in the bench's paper look, like the other parts.

import { memo, useEffect, useLayoutEffect, useMemo, type ReactElement } from "react";
import * as THREE from "three";
import { useBenchMaybe as useBench, useBenchStoreMaybe } from "../store";
import type { BenchState, PartParamsMap, PlacedPart, PlacedPartOf, Vec3 } from "../types";
import { ALLOYS } from "../solder/alloys";
import type { JointLook } from "../solder/joint";
import { GEOM } from "../solder/parts";
import { PERF, ROW_LETTERS, padLocal, padMetal, padsOf, perfSize, type PlanGhost } from "../solder/perfboard";
import { tubeMm } from "../solder/shrink";
import { ironPose } from "../solder/spots";
import { readJoint } from "../solder/station";
import { NOTCHES } from "../solder/strip";
import { FONT, canvasTexture, makeCanvas } from "../three/canvas";
import { latheY, memoGeo, roundedBox, roundedSlab } from "../three/geometry";
import { WIRE_HEX, mat } from "../three/materials";
import type { ModelProps } from "./common";

const G = GEOM;
const RED_PENCIL = "#B23A1C";
const BLUE_INK = "#1F3C9A";

const solderMat = {
  bright: () => mat.chrome(),
  satin: () => mat.plastic("#c9ced3", 0.42),
  dull: () => mat.plastic("#a3a7ac", 0.78),
  liquid: () => mat.glossy("#eef2f6"),
  flux: () => mat.plastic("#6b4a2a", 0.6),
};

// ---------------------------------------------------------------------------------------------------------------
// The iron: built along +x from its tip (origin) to its grip, then turned to lie from `tip` to `grip`.

function IronBody({ tinning }: { tinning: string }) {
  const tipMat = tinning === "oxidised" ? mat.blackMatte() : tinning === "tinned" ? mat.chrome() : mat.steel();
  return (
    <group>
      <mesh geometry={memoGeo("iron-tip", () => new THREE.ConeGeometry(1.6, 9, 16).rotateZ(Math.PI / 2).translate(4.5, 0, 0))} material={tipMat} castShadow />
      <mesh geometry={memoGeo("iron-shaft", () => new THREE.CylinderGeometry(2, 2, 30, 16).rotateZ(Math.PI / 2).translate(24, 0, 0))} material={mat.steel()} castShadow />
      <mesh geometry={memoGeo("iron-collar", () => new THREE.CylinderGeometry(3.6, 3.2, 5, 20).rotateZ(Math.PI / 2).translate(41.5, 0, 0))} material={mat.plastic("#2b2d31", 0.5)} castShadow />
      <mesh geometry={memoGeo("iron-grip", () => latheY([[0, 0], [4.4, 1], [4.8, 8], [4.6, 30], [4.2, 40], [2.2, 44], [0, 44]], 24).rotateZ(-Math.PI / 2).translate(44, 0, 0))} material={mat.rubber("#3e6e57")} castShadow />
      {[50, 54, 58].map((x) => (
        <mesh key={x} geometry={memoGeo("iron-ridge", () => new THREE.TorusGeometry(4.75, 0.3, 6, 24).rotateY(Math.PI / 2))} material={mat.rubber("#2f5a46")} position={[x, 0, 0]} />
      ))}
    </group>
  );
}

/** The iron wherever it is: in its stand, resting on work, or on the desk (hidden while the learner holds it). */
export const IronModel = memo(function IronModel({ bench }: { bench: BenchState }) {
  const held = useBench((s) => !!s.station?.held);
  const tinning = useBench((s) => s.station?.iron.tinning ?? "tinned");
  const pose = ironPose(bench);
  const q = useMemo(() => {
    if (!pose) return null;
    const tip = new THREE.Vector3(...pose.tip);
    const grip = new THREE.Vector3(...pose.grip);
    const dir = grip.clone().sub(tip).normalize();
    return { tip, quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir) };
  }, [pose?.tip[0], pose?.tip[1], pose?.tip[2], pose?.grip[0], pose?.grip[1], pose?.grip[2]]);
  const st = bench.parts.find((p) => p.kind === "solder-station");
  const cord = useMemo(() => {
    if (!q || !st || !pose) return null;
    // From the back of the grip to the side of the base.
    const end = q.tip.clone().add(new THREE.Vector3(88, 0, 0).applyQuaternion(q.quat));
    const r = (st.rot * Math.PI) / 180;
    const bx = G.station.base.x + G.station.base.w / 2;
    const bz = 14;
    const home = new THREE.Vector3(st.pos[0] + bx * Math.cos(r) + bz * Math.sin(r), 8, st.pos[1] - bx * Math.sin(r) + bz * Math.cos(r));
    const mid = end.clone().lerp(home, 0.5).setY(1.2);
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([end, end.clone().lerp(mid, 0.4).setY(Math.max(2, end.y * 0.5)), mid, home.clone().setY(2), home]), 48, 1.2, 8);
  }, [q, st?.pos[0], st?.pos[1], st?.rot, pose?.at]);
  useLayoutEffect(() => () => cord?.dispose(), [cord]);
  if (!pose || !q || held) return null;
  return (
    <group>
      <group position={q.tip} quaternion={q.quat}>
        <IronBody tinning={tinning} />
      </group>
      {cord && <mesh geometry={cord} material={mat.insulation("#3a3d42")} castShadow />}
    </group>
  );
});

/** Brown singes where the tip lay on the desk paper. */
export function ScorchMarks() {
  const marks = useBench((s) => s.station?.scorch ?? EMPTY);
  return (
    <group>
      {marks.map((m, i) => (
        <mesh key={i} position={[m.x + 1, 0.05, m.z]} rotation={[-Math.PI / 2, 0, 0.4]} scale={[1, 0.7, 1]} material={scorchMat(Math.round(m.amount * 10))}>
          <circleGeometry args={[4 + 3 * m.amount, 20]} />
        </mesh>
      ))}
    </group>
  );
}
const EMPTY: { x: number; z: number; amount: number }[] = [];
const scorchCache = new Map<number, THREE.Material>();
function scorchMat(k: number): THREE.Material {
  let m = scorchCache.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: "#7a4a24", transparent: true, opacity: 0.2 + k * 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    scorchCache.set(k, m);
  }
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// The station: base with display, dial and switch; the stand with sponge, brass wool and the coil.

function useDisplay(text: string, on: boolean): THREE.CanvasTexture {
  const tex = useMemo(() => {
    const c = makeCanvas(256, 96);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => {
    const ctx = (tex.image as HTMLCanvasElement).getContext("2d")!;
    ctx.fillStyle = on ? "#cfd8c0" : "#b9c0ad";
    ctx.fillRect(0, 0, 256, 96);
    if (text) {
      ctx.fillStyle = "#22261e";
      ctx.font = `700 64px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 128, 52);
    }
    tex.needsUpdate = true;
  }, [tex, text, on]);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

export function SolderStationModel({ params }: ModelProps<PartParamsMap["solder-station"]>) {
  const S = G.station;
  const B = S.base;
  const tip = useBench((s) => Math.round(s.station?.iron.tipC ?? 25));
  const tex = useDisplay(params.on || tip > 60 ? `${tip}°` : "", params.on);
  const lcd = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), [tex]);
  useLayoutEffect(() => () => lcd.dispose(), [lcd]);
  const angle = -((-135 + ((params.setC - 150) / 300) * 270) * Math.PI) / 180;
  const coil = memoGeo("station-coil", () => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const a = t * Math.PI * 2 * 6;
      pts.push(new THREE.Vector3(-12 + 24 * t, Math.cos(a) * 5.5, Math.sin(a) * 5.5));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.55, 6);
  });
  return (
    <group>
      {/* Base unit. */}
      <mesh geometry={memoGeo("station-base", () => roundedSlab(B.w, B.d, B.h, 5, 1.2))} material={mat.plastic("#dfe3e8", 0.5)} position={[B.x, 0, B.z]} castShadow receiveShadow />
      <mesh material={lcd} position={[S.display.x, B.h + 0.2, S.display.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[S.display.w, S.display.d]} />
      </mesh>
      <mesh geometry={memoGeo("station-bezel", () => roundedSlab(S.display.w + 3, S.display.d + 3, 0.6, 1.4, 0.2))} material={mat.greyPlastic()} position={[S.display.x, B.h - 0.55, S.display.z]} />
      <group position={[S.dial.x, B.h, S.dial.z]} rotation={[0, angle, 0]}>
        <mesh geometry={memoGeo("station-knob", () => new THREE.CylinderGeometry(S.dial.r, S.dial.r + 0.6, 6, 28).translate(0, 3, 0))} material={mat.plastic("#2a2c30", 0.45)} castShadow />
        <mesh geometry={memoGeo("station-pointer", () => new THREE.BoxGeometry(1.2, 0.4, S.dial.r - 1).translate(0, 6.2, -(S.dial.r - 1) / 2))} material={mat.white()} />
      </group>
      <group position={[S.power.x, B.h, S.power.z]}>
        <mesh geometry={memoGeo("station-rocker", () => roundedBox(10, 3, 8, 0.8, 2).translate(0, 1.5, 0))} material={mat.blackPlastic()} castShadow />
        <mesh geometry={memoGeo("station-rocker-on", () => roundedBox(4.6, 1, 7, 0.4, 2))} material={params.on ? mat.glossy("#d3282b") : mat.greyPlastic()} position={[params.on ? 2.4 : -2.4, 3.2, 0]} />
      </group>
      {/* Stand. */}
      <mesh geometry={memoGeo("station-tray", () => roundedSlab(S.stand.w, S.stand.d, 6, 6, 0.8))} material={mat.plastic("#3a3d42", 0.55)} position={[S.stand.x, 0, S.stand.z]} castShadow receiveShadow />
      <mesh geometry={memoGeo("station-sponge", () => roundedBox(S.sponge.w, 4, S.sponge.d, 1.2, 2))} material={mat.rubber("#e9c95e")} position={[S.sponge.x, 8, S.sponge.z]} castShadow />
      <mesh geometry={memoGeo("station-cup", () => new THREE.CylinderGeometry(S.wool.r, S.wool.r, 9, 28))} material={mat.aluminium()} position={[S.wool.x, 4.5 + 6, S.wool.z]} castShadow />
      <mesh geometry={memoGeo("station-wool", () => new THREE.SphereGeometry(S.wool.r - 1.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2))} material={mat.brass()} position={[S.wool.x, 14.5, S.wool.z]} scale={[1, 0.5, 1]} />
      <group position={[S.coil.x, 14, S.coil.z]} rotation={[0, -0.68, 0.3]}>
        <mesh geometry={coil} material={mat.steel()} castShadow />
      </group>
      <mesh geometry={memoGeo("station-post", () => new THREE.CylinderGeometry(1.6, 2.4, 10, 12))} material={mat.steel()} position={[S.coil.x + 6, 10, S.coil.z + 4]} castShadow />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Spools and braid.

function spoolLabel(alloy: keyof typeof ALLOYS): THREE.CanvasTexture {
  return canvasTexture(`spool:${alloy}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#fbf8f1";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24221e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(alloy === "leaded" ? "Sn63 Pb37" : alloy === "lead-free" ? "SAC305" : "ACID CORE", w / 2, h / 2 - 50);
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(alloy === "acid" ? "plumbing" : "rosin core 0.8 mm", w / 2, h / 2 + 52);
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(`${ALLOYS[alloy].liquidus} °C`, w / 2, h / 2 + 84);
  });
}

export function SpoolModel({ params }: ModelProps<PartParamsMap["solder-spool"]>) {
  const R = G.spool.r;
  const W = 14;
  const flange = params.alloy === "acid" ? "#d2573a" : params.alloy === "leaded" ? "#4e74c2" : "#2f7a4a";
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: spoolLabel(params.alloy), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1 }), [params.alloy]);
  useLayoutEffect(() => () => label.dispose(), [label]);
  const end = G.spool.end;
  const wire = useMemo(
    () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(R - 4, W * 0.6, 9), new THREE.Vector3(R + 1, W * 0.3, 12), new THREE.Vector3(end[0] - 3, 1.2, end[1] - 0.6), new THREE.Vector3(end[0], 0.6, end[1])]), 24, 0.4, 6),
    [R, end],
  );
  useLayoutEffect(() => () => wire.dispose(), [wire]);
  return (
    <group>
      <mesh geometry={memoGeo("spool-flange", () => new THREE.CylinderGeometry(R, R, 1.2, 40))} material={mat.plastic(flange, 0.45)} position={[0, 0.6, 0]} castShadow receiveShadow />
      <mesh geometry={memoGeo("spool-wound", () => new THREE.CylinderGeometry(R - 3.5, R - 3.5, W - 2, 40))} material={mat.aluminium()} position={[0, W / 2, 0]} castShadow />
      <mesh geometry={memoGeo("spool-flange", () => new THREE.CylinderGeometry(R, R, 1.2, 40))} material={mat.plastic(flange, 0.45)} position={[0, W - 0.6, 0]} castShadow />
      <mesh material={label} position={[0, W + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R - 3, 40]} />
      </mesh>
      <mesh geometry={memoGeo("spool-hub", () => new THREE.CylinderGeometry(4, 4, 0.4, 24))} material={mat.darkInset()} position={[0, W + 0.1, 0]} />
      <mesh geometry={wire} material={mat.aluminium()} castShadow />
    </group>
  );
}

export function BraidModel({ params }: ModelProps<PartParamsMap["solder-braid"]>) {
  const R = G.braid.r;
  const e = G.braid.end;
  const used = params.used ?? 0;
  const len = Math.hypot(e[0] - R + 3, e[1]);
  const ang = Math.atan2(-e[1], e[0] - (R - 3));
  return (
    <group>
      <mesh geometry={memoGeo("braid-bobbin", () => new THREE.CylinderGeometry(R, R, 7, 32))} material={mat.plastic("#2f7a4a", 0.5)} position={[0, 3.5, 0]} castShadow receiveShadow />
      <mesh geometry={memoGeo("braid-wound", () => new THREE.CylinderGeometry(R - 2.5, R - 2.5, 7.2, 32))} material={mat.copper()} position={[0, 3.6, 0]} />
      <group position={[R - 3, 0.5, 0]} rotation={[0, ang, 0]}>
        <mesh material={mat.copper()} position={[len / 2, 0, 0]} castShadow>
          <boxGeometry args={[len, 0.6, 2.6]} />
        </mesh>
        {used > 0 && (
          <mesh material={solderMat.satin()} position={[len - (len * 0.4 * used) / 2, 0.05, 0]}>
            <boxGeometry args={[len * 0.4 * used, 0.7, 2.7]} />
          </mesh>
        )}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Perfboard.

function jointMeshes(look: JointLook, toward: [number, number] | null, key: string) {
  const fin = look.finish === "liquid" ? solderMat.liquid() : look.finish === "bright" ? solderMat.bright() : look.finish === "satin" ? solderMat.satin() : look.finish === "dark" ? solderMat.satin() : solderMat.dull();
  const out: ReactElement[] = [];
  const cone = memoGeo("joint-volcano", () => latheY([[0, 0], [1.05, 0], [0.9, 0.12], [0.6, 0.35], [0.42, 0.7], [0.34, 1.0], [0, 1.0]], 20));
  switch (look.shape) {
    case "volcano":
    case "frosty":
    case "burnt":
      out.push(<mesh key={`${key}c`} geometry={cone} material={fin} castShadow />);
      if (look.shape === "burnt") out.push(<mesh key={`${key}f`} geometry={memoGeo("joint-flux", () => new THREE.RingGeometry(1, 1.9, 20).rotateX(-Math.PI / 2))} material={solderMat.flux()} position={[0, 0.03, 0]} />);
      break;
    case "ball":
      out.push(<mesh key={`${key}b`} geometry={memoGeo("joint-ball", () => new THREE.SphereGeometry(1.25, 18, 12))} material={fin} position={[0, 0.75, 0]} scale={[1, 0.8, 1]} castShadow />);
      break;
    case "ring":
      out.push(<mesh key={`${key}r`} geometry={memoGeo("joint-ring", () => new THREE.TorusGeometry(0.72, 0.2, 8, 20).rotateX(Math.PI / 2))} material={fin} position={[0, 0.15, 0]} />);
      break;
    case "lump":
      out.push(<mesh key={`${key}l`} geometry={memoGeo("joint-lump", () => new THREE.IcosahedronGeometry(0.95, 1))} material={solderMat.dull()} position={[0.15, 0.7, -0.1]} scale={[1, 0.85, 0.9]} castShadow />);
      break;
    case "bridge":
      out.push(<mesh key={`${key}c`} geometry={cone} material={fin} castShadow />);
      if (toward) {
        const len = Math.hypot(toward[0], toward[1]);
        out.push(
          <mesh key={`${key}n`} material={fin} position={[toward[0] / 2, 0.35, toward[1] / 2]} rotation={[0, -Math.atan2(toward[1], toward[0]), Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, len, 10]} />
          </mesh>,
        );
        out.push(<mesh key={`${key}m`} geometry={cone} material={fin} position={[toward[0], 0, toward[1]]} scale={[0.85, 0.7, 0.85]} />);
      }
      break;
    default:
      break;
  }
  return out;
}

/** A flat strip on the board (ghost outlines and plan lines), from a to b in board-local mm. */
function Strip({ a, b, y, w, material }: { a: [number, number]; b: [number, number]; y: number; w: number; material: THREE.Material }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.01) return null;
  return (
    <mesh material={material} position={[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]} rotation={[-Math.PI / 2, 0, Math.atan2(-(b[1] - a[1]), b[0] - a[0])]}>
      <planeGeometry args={[len, w]} />
    </mesh>
  );
}

const ghostMat = () => mat.basic(RED_PENCIL);
const planMat = new THREE.MeshBasicMaterial({ color: BLUE_INK, transparent: true, opacity: 0.45, depthWrite: false });

function PlanGhost3D({ ghost, at, top }: { ghost: PlanGhost; at: (pad: string) => [number, number]; top: number }) {
  const pts = Object.values(ghost.legs).map(at);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - 1.4;
  const x1 = Math.max(...xs) + 1.4;
  const z0 = Math.min(...zs) - 1.4;
  const z1 = Math.max(...zs) + 1.4;
  const y = top + 0.04;
  const m = ghostMat();
  if (ghost.kind === "battery")
    return (
      <group>
        {pts.map((p, i) => (
          <mesh key={i} material={m} position={[p[0], y, p[1]]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.1, 1.35, 20]} />
          </mesh>
        ))}
      </group>
    );
  return (
    <group>
      <Strip a={[x0, z0]} b={[x1, z0]} y={y} w={0.22} material={m} />
      <Strip a={[x1, z0]} b={[x1, z1]} y={y} w={0.22} material={m} />
      <Strip a={[x1, z1]} b={[x0, z1]} y={y} w={0.22} material={m} />
      <Strip a={[x0, z1]} b={[x0, z0]} y={y} w={0.22} material={m} />
    </group>
  );
}

export const PerfboardModel = memo(function PerfboardModel({ part }: { part: PlacedPartOf<"perfboard"> }) {
  const p = part.params;
  const bench = useBench((s) => s.bench);
  // Live joints on this board re-render it while they are made.
  useBench((s) => {
    const st = s.station;
    let k = "";
    if (st) for (const [id, j] of Object.entries(st.joints)) if (id.startsWith(`${part.id}.`)) k += `${id}:${Math.round(j.volume * 20)}:${j.phase}:${j.bridgeTo ?? ""};`;
    return k;
  });
  const store = useBenchStoreMaybe();
  const station = store?.getState().station ?? null;
  const flipped = !!p.flipped;
  const { w, d } = perfSize(p);
  const top = PERF.top;
  const pads = padsOf(p);
  const at = (pad: string): [number, number] => {
    const l = padLocal(p, pad)!;
    return [l[0], l[1]];
  };
  // One instanced draw for the holes (and one for the pads on the copper side).
  const holes = useMemo(() => {
    const geo = new THREE.CircleGeometry(flipped ? 0.4 : 0.5, 12).rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(geo, mat.darkInset(), pads.length);
    const o = new THREE.Object3D();
    pads.forEach((pad, i) => {
      const [x, z] = padLocal(p, pad)!;
      o.position.set(x, top + 0.03, z);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    return m;
  }, [p.cols, p.rows, flipped]);
  const rings = useMemo(() => {
    if (!flipped) return null;
    const geo = new THREE.RingGeometry(0.4, 0.95, 16).rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(geo, mat.copper(), pads.length);
    const o = new THREE.Object3D();
    pads.forEach((pad, i) => {
      const [x, z] = padLocal(p, pad)!;
      o.position.set(x, top + 0.02, z);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    return m;
  }, [p.cols, p.rows, flipped]);
  useLayoutEffect(() => () => {
    holes.geometry.dispose();
    holes.dispose();
  }, [holes]);
  useLayoutEffect(() => () => {
    rings?.geometry.dispose();
    rings?.dispose();
  }, [rings]);
  const metal = useMemo(() => (flipped ? padMetal(bench, part) : null), [bench, part, flipped]);
  const plan = p.plan ? (bench.parts.find((x) => x.id === p.plan && x.kind === "plan-card") as PlacedPartOf<"plan-card"> | undefined) : undefined;
  return (
    <group>
      <mesh geometry={memoGeo(`perf-slab:${p.cols}x${p.rows}`, () => roundedBox(w, PERF.thick, d, 0.6, 2))} material={mat.plastic("#e3cf96", 0.7)} position={[0, top - PERF.thick / 2, 0]} castShadow receiveShadow />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={memoGeo("perf-foot", () => new THREE.CylinderGeometry(1.2, 1.4, top - PERF.thick, 12))} material={mat.plastic("#2b2d31", 0.6)} position={[sx * (w / 2 - 2), (top - PERF.thick) / 2, sz * (d / 2 - 2)]} />
        )),
      )}
      <primitive object={holes} />
      {rings && <primitive object={rings} />}
      {p.flexed && (
        <mesh position={[0, top + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[w * 0.22, d * 0.28, 1]} material={planMat}>
          <circleGeometry args={[1, 24]} />
        </mesh>
      )}
      {flipped &&
        metal &&
        [...metal.entries()].flatMap(([pad, m]) =>
          m.legs.map((leg) => {
            const a = at(pad);
            const to = p.bends?.[`${leg.part}.${leg.leg}`];
            const b = to && to !== pad ? at(to) : null;
            return (
              <group key={`${leg.part}.${leg.leg}`}>
                {!(p.snipped ?? []).includes(leg.part) && (
                  <mesh geometry={memoGeo("perf-stub", () => new THREE.CylinderGeometry(0.3, 0.3, 1.4, 8))} material={mat.lead()} position={[a[0], top + 0.7, a[1]]} castShadow />
                )}
                {b && (
                  <mesh material={mat.lead()} position={[(a[0] + b[0]) / 2, top + 0.35, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(b[1] - a[1], b[0] - a[0]), Math.PI / 2]} castShadow>
                    <cylinderGeometry args={[0.3, 0.3, Math.hypot(b[0] - a[0], b[1] - a[1]), 8]} />
                  </mesh>
                )}
              </group>
            );
          }),
        )}
      {flipped &&
        (p.links ?? []).map((l) => {
          const a = at(l.a);
          const b = at(l.b);
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          return (
            <mesh key={l.id} material={l.insulated ? mat.insulation(WIRE_HEX[l.color ?? "blue"] ?? "#2459c9") : mat.lead()} position={[(a[0] + b[0]) / 2, top + 0.45, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(b[1] - a[1], b[0] - a[0]), Math.PI / 2]} castShadow>
              <cylinderGeometry args={[l.insulated ? 0.6 : 0.32, l.insulated ? 0.6 : 0.32, l.insulated ? len - 2 : len, 10]} />
            </mesh>
          );
        })}
      {flipped &&
        pads.map((pad) => {
          const r = readJoint(bench, station, `${part.id}.${pad}`);
          if (!r || r.phase === "bare") return null;
          const [x, z] = at(pad);
          const toward = r.bridgeTo ? at(r.bridgeTo) : null;
          return (
            <group key={pad} position={[x, top + (r.look.lifted ? 0.5 : 0), z]}>
              {jointMeshes(r.look, toward ? [toward[0] - x, toward[1] - z] : null, pad)}
            </group>
          );
        })}
      {plan && !flipped && (plan.params.ghosts ?? []).map((gh) => <PlanGhost3D key={gh.id} ghost={gh} at={at} top={top} />)}
      {plan &&
        flipped &&
        (plan.params.lines ?? []).map(([a, b], i) => <Strip key={i} a={at(a)} b={at(b)} y={top + 0.05} w={0.5} material={planMat} />)}
      {/* Row letters and column numbers printed on the board. */}
      <PerfPrint cols={p.cols} rows={p.rows} flipped={flipped} w={w} d={d} />
    </group>
  );
});

function PerfPrint({ cols, rows, flipped, w, d }: { cols: number; rows: number; flipped: boolean; w: number; d: number }) {
  const tex = useMemo(
    () =>
      canvasTexture(`perf-print:${cols}x${rows}:${flipped}`, Math.round(w * 24), Math.round(d * 24), (ctx, cw, ch) => {
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = "#6b655b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `600 ${Math.round(1.6 * 24)}px ${FONT}`;
        const px = (mm: number) => (mm + w / 2) * 24;
        const pz = (mm: number) => (mm + d / 2) * 24;
        for (let c = 1; c <= cols; c++) {
          const x = (c - (cols + 1) / 2) * PERF.pitch * (flipped ? -1 : 1);
          ctx.fillText(String(c), px(x), pz(-d / 2 + 1.3));
        }
        for (let r = 1; r <= rows; r++) {
          const z = (r - (rows + 1) / 2) * PERF.pitch;
          ctx.fillText(ROW_LETTERS[r - 1]!, px(flipped ? w / 2 - 1.3 : -w / 2 + 1.3), pz(z));
        }
      }),
    [cols, rows, flipped, w, d],
  );
  const m = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), [tex]);
  useLayoutEffect(() => () => m.dispose(), [m]);
  return (
    <mesh material={m} position={[0, PERF.top + 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The plan card: a printed card (top view with ghosts, underside with numbered lines).

function planTexture(p: PartParamsMap["plan-card"]): THREE.CanvasTexture {
  const key = `plan:${JSON.stringify(p)}`;
  const W = G.plan.w;
  const D = G.plan.d;
  const k = 8;
  return canvasTexture(key, W * k, D * k, (ctx, cw, ch) => {
    ctx.fillStyle = "#fcfaf5";
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = "#24221e";
    ctx.font = `700 ${4 * k}px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(p.title ?? "PLAN", 6 * k, 6 * k);
    ctx.font = `600 ${2.6 * k}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#6b655b";
    ctx.fillText("TOP", (W / 4) * k, 13 * k);
    ctx.fillText("UNDERSIDE", ((3 * W) / 4) * k, 13 * k);
    ctx.strokeStyle = "#d8d0c1";
    ctx.setLineDash([2 * k, 2 * k]);
    ctx.beginPath();
    ctx.moveTo((W / 2) * k, 12 * k);
    ctx.lineTo((W / 2) * k, (D - 4) * k);
    ctx.stroke();
    ctx.setLineDash([]);
    const pitch = Math.min(4.6, (W / 2 - 10) / Math.max(1, p.cols), (D - 22) / Math.max(1, p.rows));
    const pos = (pad: string, ox: number, mirror: boolean): [number, number] => {
      const m = /^([A-Z])(\d{1,2})$/.exec(pad);
      const col = m ? Number(m[2]) : 1;
      const row = m ? ROW_LETTERS.indexOf(m[1]!) + 1 : 1;
      const cc = mirror ? p.cols + 1 - col : col;
      return [(ox + (cc - (p.cols + 1) / 2) * pitch) * k, (D / 2 + 6 + (row - (p.rows + 1) / 2) * pitch) * k];
    };
    for (const [ox, mirror] of [[W / 4, false], [(3 * W) / 4, true]] as const) {
      ctx.fillStyle = "#6b655b";
      for (let r = 1; r <= p.rows; r++)
        for (let c = 1; c <= p.cols; c++) {
          const [x, y] = pos(`${ROW_LETTERS[r - 1]}${c}`, ox, mirror);
          ctx.beginPath();
          ctx.arc(x, y, 0.45 * k, 0, Math.PI * 2);
          ctx.fill();
        }
      if (!mirror) {
        ctx.strokeStyle = RED_PENCIL;
        ctx.lineWidth = 0.35 * k;
        ctx.setLineDash([1.2 * k, 0.9 * k]);
        for (const g of p.ghosts ?? []) {
          const pts = Object.values(g.legs).map((pad) => pos(pad, ox, false));
          const xs = pts.map((q) => q[0]);
          const ys = pts.map((q) => q[1]);
          if (g.kind === "battery") for (const [x, y] of pts) ctx.strokeRect(x - 1.2 * k, y - 1.2 * k, 2.4 * k, 2.4 * k);
          else ctx.strokeRect(Math.min(...xs) - 1.6 * k, Math.min(...ys) - 1.6 * k, Math.max(...xs) - Math.min(...xs) + 3.2 * k, Math.max(...ys) - Math.min(...ys) + 3.2 * k);
        }
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = BLUE_INK;
        ctx.fillStyle = BLUE_INK;
        ctx.lineWidth = 0.55 * k;
        (p.lines ?? []).forEach(([a, b], i) => {
          const A = pos(a, ox, true);
          const B = pos(b, ox, true);
          ctx.beginPath();
          ctx.moveTo(A[0], A[1]);
          ctx.lineTo(B[0], B[1]);
          ctx.stroke();
          ctx.font = `700 ${2.4 * k}px ${FONT}`;
          ctx.fillText(String(i + 1), (A[0] + B[0]) / 2 + 1.6 * k, (A[1] + B[1]) / 2 - 1.6 * k);
        });
      }
    }
  });
}

export function PlanCardModel({ params }: ModelProps<PartParamsMap["plan-card"]>) {
  const tex = useMemo(() => planTexture(params), [params]);
  const top = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), [tex]);
  useLayoutEffect(() => () => top.dispose(), [top]);
  return (
    <group>
      <mesh geometry={memoGeo("plan-slab", () => roundedSlab(G.plan.w, G.plan.d, 0.8, 1.5, 0.15))} material={mat.white()} castShadow receiveShadow />
      <mesh material={top} position={[0, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[G.plan.w - 0.4, G.plan.d - 0.4]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Heat-sink clip: across the lead it grips (the lead runs along local x).

export function ClipModel({ params }: ModelProps<PartParamsMap["heat-sink-clip"]>) {
  const m = params.metal === "copper" ? mat.copperBright() : mat.steel();
  const on = !!params.on;
  return (
    <group rotation={[0, on ? Math.PI / 2 : 0, 0]} position={[0, on ? -0.4 : 1.6, 0]}>
      <mesh geometry={memoGeo("clip-body", () => roundedBox(G.clip.len, 2.6, G.clip.w, 0.6, 2))} material={m} castShadow />
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={x} geometry={memoGeo("clip-fin", () => roundedBox(1, 3.2, G.clip.w + 1.2, 0.3, 1))} material={m} position={[x, 1.2, 0]} castShadow />
      ))}
      <mesh geometry={memoGeo("clip-jaw", () => roundedBox(3, 1, G.clip.w - 1, 0.3, 1))} material={m} position={[0, -1.6, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Wire stripper, heat-shrink, heat gun.

export function StripperModel({ params }: ModelProps<PartParamsMap["wire-stripper"]>) {
  return (
    <group position={[0, 2.4, 0]}>
      <mesh geometry={memoGeo("ws-jaw", () => roundedBox(48, 4, 12, 1.5, 2))} material={mat.steel()} position={[-36, 0, 0]} castShadow />
      {NOTCHES.map((n, i) => (
        <mesh key={n} geometry={memoGeo("ws-notch", () => new THREE.CylinderGeometry(0.9, 0.9, 4.2, 10))} material={n === params.notch ? mat.basic(BLUE_INK) : mat.darkInset()} position={[-54 + i * 5, 0.1, 0]} />
      ))}
      <mesh geometry={memoGeo("ws-pivot", () => new THREE.CylinderGeometry(2.2, 2.2, 5, 16))} material={mat.nickel()} position={[-12, 0.4, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={memoGeo("ws-handle", () => roundedBox(62, 5, 7, 2.4, 2))} material={mat.rubber("#c2412b")} position={[20, 0, s * 6.5]} rotation={[0, s * 0.1, 0]} castShadow />
      ))}
    </group>
  );
}

export function TubeModel({ params }: ModelProps<PartParamsMap["heat-shrink"]>) {
  const shrink = params.shrink ?? 0;
  const r = Math.max(0.6, tubeMm(params.size, shrink) / 2);
  const len = G.tube.len * (1 - 0.06 * shrink);
  return (
    <group position={[0, params.on ? 0 : r, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={params.split ? mat.plastic("#4a4640", 0.85) : mat.plastic("#2f2d2a", 0.6)} castShadow>
        <cylinderGeometry args={[r, r, len, 20, 1, true]} />
      </mesh>
      {params.split && (
        <mesh position={[-2, r * 0.9, 0]} material={mat.darkInset()}>
          <boxGeometry args={[8, 0.3, 0.5]} />
        </mesh>
      )}
    </group>
  );
}

export function GunModel({ params }: ModelProps<PartParamsMap["heat-gun"]>) {
  const N = G.gun.nozzle;
  return (
    <group position={[0, 10, 0]}>
      <mesh geometry={memoGeo("gun-body", () => latheY([[0, 0], [9, 2], [10, 20], [10, 95], [8, 108], [0, 112]], 28).rotateZ(-Math.PI / 2).translate(-40, 0, 0))} material={mat.paint("#d2573a")} castShadow />
      <mesh geometry={memoGeo("gun-nozzle", () => new THREE.CylinderGeometry(5, 5.6, 24, 24).rotateZ(Math.PI / 2))} material={mat.steel()} position={[N[0] + 12, 0, 0]} castShadow />
      <mesh geometry={memoGeo("gun-handle", () => roundedBox(18, 14, 34, 4, 2))} material={mat.plastic("#2b2d31", 0.6)} position={[29, -3, 22]} castShadow />
      <mesh geometry={memoGeo("gun-switch", () => roundedBox(10, 3, 7, 1, 2))} material={params.on ? mat.glossy("#d3282b") : mat.greyPlastic()} position={[34, 9.5, 0]} />
      {params.on && (
        <mesh position={[N[0] - 0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mat.basic("#f2a531")}>
          <circleGeometry args={[3.6, 20]} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Barrel-jack board and wall adapters.

export function JackModel({ mount }: ModelProps<PartParamsMap["barrel-jack"]>) {
  const J = G.jack;
  // On the board: pins in the holes, the board hanging off past them; on the desk: lying flat, pins toward +z.
  const board = mount !== "desk";
  return (
    <group position={board ? [0, 0, J.socket - 2] : [0, 0, 0]}>
      <mesh geometry={memoGeo("jack-pcb", () => roundedBox(J.w + 2, 1.6, J.d, 0.6, 1))} material={mat.plastic("#2f7a4a", 0.55)} position={[0, board ? 2.2 : 0.8, 0]} castShadow receiveShadow />
      <mesh geometry={memoGeo("jack-body", () => roundedBox(J.w - 2, J.h, J.d - 6, 1.2, 2))} material={mat.blackPlastic()} position={[0, (board ? 3 : 1.6) + J.h / 2, 2]} castShadow />
      <mesh geometry={memoGeo("jack-hole", () => new THREE.CylinderGeometry(3, 3, 0.4, 20).rotateX(Math.PI / 2))} material={mat.darkInset()} position={[0, (board ? 3 : 1.6) + J.h / 2, J.d / 2 - 0.9]} />
      <mesh geometry={memoGeo("jack-pin", () => new THREE.CylinderGeometry(1, 1, 0.5, 12).rotateX(Math.PI / 2))} material={mat.nickel()} position={[0, (board ? 3 : 1.6) + J.h / 2, J.d / 2 - 0.6]} />
      {board &&
        [0, 2.54].map((z) => (
          <mesh key={z} geometry={memoGeo("jack-leg", () => new THREE.CylinderGeometry(0.32, 0.32, 5, 8))} material={mat.lead()} position={[0, 0, z - (J.socket - 2)]} />
        ))}
    </group>
  );
}

function adapterLabel(p: PartParamsMap["wall-adapter"]): THREE.CanvasTexture {
  return canvasTexture(`adapter:${p.volts}:${p.amps}:${p.type}:${p.centre}`, 320, 240, (ctx, w, h) => {
    ctx.fillStyle = "#fbf8f1";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#24221e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 40px ${FONT}`;
    const amps = p.amps >= 1 ? `${p.amps} A` : `${Math.round(p.amps * 1000)} mA`;
    ctx.fillText(`${p.volts} V ${p.type === "ac" ? "~" : "⎓"} ${amps}`, w / 2, 56);
    ctx.font = `600 24px ${FONT}`;
    ctx.fillText(p.type === "unregulated" ? "UNREGULATED" : p.type === "ac" ? "AC OUTPUT" : "REGULATED", w / 2, 190);
    if (p.type !== "ac") {
      // The polarity drawing: a dot in a C, with + and minus either side.
      const cx = w / 2;
      const cy = 124;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#24221e";
      ctx.beginPath();
      ctx.arc(cx, cy, 18, Math.PI * 0.25, Math.PI * 1.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 5, cy);
      ctx.lineTo(cx + 48, cy);
      ctx.moveTo(cx - 18, cy);
      ctx.lineTo(cx - 48, cy);
      ctx.stroke();
      ctx.font = `700 34px ${FONT}`;
      ctx.fillText(p.centre === "plus" ? "+" : "−", cx + 66, cy);
      ctx.fillText(p.centre === "plus" ? "−" : "+", cx - 66, cy);
    }
  });
}

export function AdapterModel({ params }: ModelProps<PartParamsMap["wall-adapter"]>) {
  const A = G.adapter;
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: adapterLabel(params), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1 }), [params.volts, params.amps, params.type, params.centre]);
  useLayoutEffect(() => () => label.dispose(), [label]);
  return (
    <group>
      <mesh geometry={memoGeo("adapter-body", () => roundedSlab(A.w, A.d, A.h, 4, 1.2))} material={mat.blackPlastic()} castShadow receiveShadow />
      <mesh material={label} position={[0, A.h + 0.02, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[A.w - 8, A.d - 12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={memoGeo("adapter-prong", () => roundedBox(2, 10, 6, 0.4, 1))} material={mat.nickel()} position={[s * 6, A.h * 0.5, -A.d / 2 - 4]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  );
}

/** The barrel plug at the end of an adapter's cord (in world space, at the cord's end). */
export function BarrelPlug({ at, dir }: { at: THREE.Vector3; dir: THREE.Vector3 }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()), [dir.x, dir.y, dir.z]);
  return (
    <group position={at} quaternion={q}>
      <mesh geometry={memoGeo("plug-boot", () => new THREE.CylinderGeometry(2.6, 2, 12, 16).rotateX(Math.PI / 2).translate(0, 0, 6))} material={mat.blackPlastic()} castShadow />
      <mesh geometry={memoGeo("plug-barrel", () => new THREE.CylinderGeometry(1.4, 1.4, 6, 16).rotateX(Math.PI / 2).translate(0, 0, -3))} material={mat.nickel()} castShadow />
    </group>
  );
}

/** Lead ends a Unit 3 part leaves for the scene's flying-lead drawing. */
export function solderFlying(kind: PlacedPart["kind"], params: Record<string, unknown>): Record<string, { pos: Vec3; dir: Vec3; color: string; radius: number; length: number }> | null {
  if (kind === "hookup-wire") {
    const len = (params.len as number) ?? 90;
    const color = (params.color as string) ?? "red";
    return {
      a: { pos: [0, 0.8, 0], dir: [-1, 0, 0], color, radius: 0.8, length: len / 2 + 6 },
      b: { pos: [0, 0.8, 0], dir: [1, 0, 0], color, radius: 0.8, length: len / 2 + 6 },
    };
  }
  if (kind === "wall-adapter") return { plug: { pos: [0, 6, G.adapter.d / 2], dir: [0, 0, 1], color: "black", radius: 1.4, length: 260 } };
  return null;
}
