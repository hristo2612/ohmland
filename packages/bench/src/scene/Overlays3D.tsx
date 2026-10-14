// The teaching overlays in 3D (docs/BENCH-VIEWS.md, "Overlays"), drawn from the same pure data as the ink view:
// flow dots riding the cables and parts, push hatching across the cables with a hill by each battery and sealed box,
// the loop tracer's red pencil line, and the wiring inside an open sealed box. Dots move only while flow is on and
// not under reduced motion; everything else redraws on demand.

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useStore } from "zustand";
import type { Snapshot } from "@ohmland/sim";
import { DOT_MIN_AMPS, DOT_SPACING, ELECTRON_SLOWDOWN, boxNets, dotSpeed, flowMap, hatchSpacing, hillShare, pushMap, traceLoop } from "../flow";
import { BOARD_TOP, BOX } from "../dims";
import { holeWorld } from "../board";
import { jumperPath } from "../models/Leads";
import { partPose } from "../layout";
import type { BenchStore } from "../store";
import type { BenchState, Vec3 } from "../types";
import { bentTube, smoothTube, type FloorFn } from "../three/geometry";
import { WIRE_HEX, mat } from "../three/materials";
import { makeCanvas } from "../three/canvas";
import { prefersReducedMotion, useAnimating } from "../three/anim";
import { leadCable } from "./views";
import type { CableStyle } from "../cables/style";
import { usePaperPalette } from "./palette";

/** Overlays sit just above what they ride, and never count as part of a model's size or shadow. */
const OVERLAY = { fx: true };
const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

/** A polyline with its running lengths, for placing things along it by distance. */
type Line = { pts: THREE.Vector3[]; acc: number[]; length: number };

function line(pts: THREE.Vector3[]): Line {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
  return { pts, acc, length: acc[acc.length - 1] ?? 0 };
}

function pointAt(l: Line, d: number, out: THREE.Vector3): THREE.Vector3 {
  const x = Math.max(0, Math.min(l.length, d));
  let i = 1;
  while (i < l.acc.length - 1 && l.acc[i]! < x) i++;
  const a = l.acc[i - 1]!;
  const b = l.acc[i]!;
  const k = b > a ? (x - a) / (b - a) : 0;
  return out.copy(l.pts[i - 1]!).lerp(l.pts[i]!, k);
}

/** Every conductor the dots and hatching ride, as drawn in 3D: clip leads (clip to clip), jumpers (hole to hole). */
function rideLines(bench: BenchState, floor: FloorFn, style: CableStyle): Map<string, { line: Line; cable: Line }> {
  const out = new Map<string, { line: Line; cable: Line }>();
  if (bench.board) {
    for (const w of bench.wires) {
      const a = holeWorld(bench.board, w.a);
      const b = holeWorld(bench.board, w.b);
      if (!a || !b) continue;
      const j = jumperPath(new THREE.Vector3(a[0], BOARD_TOP, a[1]), new THREE.Vector3(b[0], BOARD_TOP, b[1]));
      const pts = [v3(j.legA[1]!), ...j.insul, v3(j.legB[1]!)].map((p) => p.clone().setY(p.y + 0.9));
      out.set(`wire:${w.id}`, { line: line(pts), cable: line(pts) });
    }
  }
  for (const l of bench.leads) {
    if (!l.a.to && !l.b.to) continue;
    const c = leadCable(bench, l, floor, style);
    // Ride a little above the cable's centre, so the dots sit on it.
    const lift = (p: THREE.Vector3) => p.clone().setY(p.y + 0.7);
    const cable = c.cable.map(lift);
    out.set(`lead:${l.id}`, { line: line([lift(c.a.tip), ...cable, lift(c.b.tip)]), cable: line(cable) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Flow dots

const MAX_DOTS = 600;

type Rider = { key: string; line: Line; amps: number };

function ridersOf(bench: BenchState, lines: Map<string, { line: Line }>, s: Snapshot | null): Rider[] {
  const f = flowMap(bench, s);
  const out: Rider[] = [];
  for (const [id, amps] of Object.entries(f.leads)) {
    const l = lines.get(`lead:${id}`);
    if (l) out.push({ key: `lead:${id}`, line: l.line, amps });
  }
  for (const [id, amps] of Object.entries(f.wires)) {
    const l = lines.get(`wire:${id}`);
    if (l) out.push({ key: `wire:${id}`, line: l.line, amps });
  }
  for (const p of f.parts) {
    const a = v3(p.a);
    const b = v3(p.b);
    if (a.distanceTo(b) < 1) continue;
    a.y += 1.4;
    b.y += 1.4;
    out.push({ key: `part:${p.id}:${p.from}`, line: line([a, b]), amps: p.amps });
  }
  return out;
}

const FlowDots3D = memo(function FlowDots3D({ bench, store, floor, electrons }: { bench: BenchState; store: BenchStore; floor: FloorFn; electrons: boolean }) {
  const style = useStore(store, (s) => s.cableStyle);
  const lines = useMemo(() => rideLines(bench, floor, style), [bench, floor, style]);
  const riders = useRef<Rider[]>([]);
  const travel = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const update = (s: Snapshot | null) => {
      riders.current = ridersOf(bench, lines, s).filter((r) => Math.abs(r.amps) >= DOT_MIN_AMPS);
    };
    update(store.getState().snapshot);
    return store.subscribe((s, prev) => s.snapshot !== prev.snapshot && update(s.snapshot));
  }, [bench, lines, store]);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const pal = usePaperPalette();
  const geo = useMemo(() => (electrons ? new THREE.CapsuleGeometry(0.28, 1.2, 3, 8).rotateZ(Math.PI / 2) : new THREE.SphereGeometry(0.85, 12, 8)), [electrons]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: electrons ? "#24221E" : pal.paper, toneMapped: false }), [electrons, pal.paper]);
  useLayoutEffect(
    () => () => {
      geo.dispose();
      material.dispose();
    },
    [geo, material],
  );
  const mesh = useRef<THREE.InstancedMesh>(null);
  useAnimating(!reduced);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), q: new THREE.Vector3(), m: new THREE.Matrix4(), quat: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1), x: new THREE.Vector3(1, 0, 0) }), []);
  useFrame((_, dt) => {
    const im = mesh.current;
    if (!im) return;
    let n = 0;
    for (const r of riders.current) {
      const v = Math.sign(r.amps) * dotSpeed(r.amps) * (electrons ? -ELECTRON_SLOWDOWN : 1);
      const x = reduced ? 0 : ((travel.current.get(r.key) ?? 0) + v * Math.min(0.1, dt)) % DOT_SPACING;
      travel.current.set(r.key, x);
      const L = r.line.length;
      for (let d = ((x % DOT_SPACING) + DOT_SPACING) % DOT_SPACING; d < L && n < MAX_DOTS; d += DOT_SPACING) {
        pointAt(r.line, d, tmp.p);
        pointAt(r.line, Math.min(L, d + 0.5), tmp.q);
        tmp.q.sub(tmp.p);
        if (tmp.q.lengthSq() > 1e-8) tmp.quat.setFromUnitVectors(tmp.x, tmp.q.normalize());
        tmp.m.compose(tmp.p, tmp.quat, tmp.s);
        im.setMatrixAt(n++, tmp.m);
      }
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, material, MAX_DOTS]} frustumCulled={false} renderOrder={12} userData={OVERLAY} />;
});

// ---------------------------------------------------------------------------------------------------------------
// Push

/** A small ink drawing of a hatched hill, for a billboard by a battery or on a box. */
function useHill(share: number) {
  const { canvas, texture } = useMemo(() => {
    const c = makeCanvas(256, 192);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, texture: t };
  }, []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }), [texture]);
  useLayoutEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );
  useLayoutEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const base = h - 14;
    const top = base - 8 - share * (h - 40);
    const hill = new Path2D();
    hill.moveTo(14, base);
    hill.bezierCurveTo(w * 0.32, base, w * 0.36, top, w / 2, top);
    hill.bezierCurveTo(w * 0.64, top, w * 0.68, base, w - 14, base);
    hill.closePath();
    ctx.fillStyle = "rgba(246,222,212,0.85)";
    ctx.fill(hill);
    ctx.save();
    ctx.clip(hill);
    ctx.strokeStyle = "rgba(178,58,28,0.8)";
    ctx.lineWidth = 3;
    for (let x = -h; x < w + h; x += 13) {
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x + h * 0.7, base - h);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "#B23A1C";
    ctx.lineWidth = 5;
    ctx.stroke(hill);
    ctx.beginPath();
    ctx.moveTo(4, base);
    ctx.lineTo(w - 4, base);
    ctx.stroke();
    texture.needsUpdate = true;
  }, [canvas, texture, share]);
  return material;
}

function Hill({ at, share }: { at: THREE.Vector3; share: number }) {
  const material = useHill(share);
  return (
    <Billboard position={at}>
      <mesh material={material} renderOrder={31} userData={OVERLAY}>
        <planeGeometry args={[30, 22.5]} />
      </mesh>
    </Billboard>
  );
}

const Push3D = memo(function Push3D({ bench, store, floor }: { bench: BenchState; store: BenchStore; floor: FloorFn }) {
  const key = useStore(store, (s) => {
    const p = pushMap(bench, s.snapshot);
    return JSON.stringify([Object.entries(p.leads).map(([k, v]) => [k, Math.round(((v[0] + v[1]) / 2) * 10)]), Object.entries(p.wires).map(([k, v]) => [k, Math.round(v * 10)]), Object.entries(p.hills).map(([k, v]) => [k, Math.round(v * 20)])]);
  });
  const p = useMemo(() => pushMap(bench, store.getState().snapshot), [bench, store, key]);
  const style = useStore(store, (s) => s.cableStyle);
  const lines = useMemo(() => rideLines(bench, floor, style), [bench, floor, style]);
  const pal = usePaperPalette();
  // Hatch strokes across each cable, spaced by its push.
  const ticks = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const spans: [string, number][] = [...Object.entries(p.leads).map(([id, [va, vb]]) => [`lead:${id}`, (va + vb) / 2] as [string, number]), ...Object.entries(p.wires).map(([id, v]) => [`wire:${id}`, v] as [string, number])];
    for (const [key, volts] of spans) {
      const l = lines.get(key)?.cable;
      const sp = hatchSpacing(volts) / (key.startsWith("wire:") ? 2 : 1);
      if (!l || !Number.isFinite(sp)) continue;
      for (let d = sp / 2; d < l.length; d += sp) {
        pointAt(l, d, a);
        pointAt(l, Math.min(l.length, d + 0.6), b);
        const along = b.sub(a).normalize();
        // Shorter strokes across a jumper, which is thinner and sits among the holes.
        const across = new THREE.Vector3().crossVectors(along, up).normalize().multiplyScalar(key.startsWith("wire:") ? 0.55 : 1);
        const m = new THREE.Matrix4().makeBasis(along, up, across);
        m.setPosition(a.x, a.y + 0.2, a.z);
        out.push(m);
      }
    }
    return out;
  }, [p, lines]);
  const tickGeo = useMemo(() => new THREE.BoxGeometry(0.45, 0.3, 6.2), []);
  const tickMat = useMemo(() => new THREE.MeshBasicMaterial({ color: pal.red, transparent: true, opacity: 0.7, toneMapped: false }), [pal.red]);
  useLayoutEffect(
    () => () => {
      tickGeo.dispose();
      tickMat.dispose();
    },
    [tickGeo, tickMat],
  );
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = mesh.current;
    if (!im) return;
    ticks.forEach((m, i) => im.setMatrixAt(i, m));
    im.count = ticks.length;
    im.instanceMatrix.needsUpdate = true;
  }, [ticks]);
  const hills = Object.entries(p.hills).filter(([, v]) => v >= 0.15);
  return (
    <group>
      <instancedMesh ref={mesh} args={[tickGeo, tickMat, Math.max(1, 2000)]} frustumCulled={false} renderOrder={11} userData={OVERLAY} />
      {hills.map(([id, volts]) => {
        const part = bench.parts.find((x) => x.id === id);
        if (!part) return null;
        const pose = partPose(bench, part);
        // Beside a battery, standing at its right; over a box's lid.
        const at = part.kind === "box" ? new THREE.Vector3(pose.origin[0], BOX.h + 15, pose.origin[2] - 8) : new THREE.Vector3(pose.origin[0] + 30, 16, pose.origin[2]);
        return <Hill key={id} at={at} share={hillShare(volts)} />;
      })}
    </group>
  );
});

// ---------------------------------------------------------------------------------------------------------------
// The loop tracer

const Tracer3D = memo(function Tracer3D({ bench, store, floor, from, at }: { bench: BenchState; store: BenchStore; floor: FloorFn; from: string; at: number }) {
  const pressed = useStore(store, (s) => s.ui.pressed);
  const trace = useMemo(() => traceLoop(bench, from, { pressed, snapshot: store.getState().snapshot }), [bench, from, pressed, store]);
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    const add = (p: THREE.Vector3) => {
      const q = out[out.length - 1];
      if (!q || q.distanceTo(p) > 0.2) out.push(p);
    };
    for (const s of trace.steps) {
      if (s.kind === "lead") {
        const l = bench.leads.find((x) => x.id === s.id);
        if (!l) continue;
        const c = leadCable(bench, l, floor, store.getState().cableStyle);
        const pts = [c.a.tip, ...c.cable, c.b.tip].map((p) => p.clone().setY(p.y + 0.8));
        for (const p of s.from === "a" ? pts : pts.reverse()) add(p);
      } else {
        add(v3(s.a).setY(s.a[1] + 1.5));
        add(v3(s.b).setY(s.b[1] + 1.5));
      }
    }
    // Beside the cables rather than on them, so the red pencil reads on a red lead too.
    const up = new THREE.Vector3(0, 1, 0);
    return out.map((p, i) => {
      const t = out[Math.min(out.length - 1, i + 1)]!.clone().sub(out[Math.max(0, i - 1)]!);
      t.y = 0;
      if (t.lengthSq() < 1e-8) return p;
      return p.clone().addScaledVector(new THREE.Vector3().crossVectors(up, t.normalize()), 2.2);
    });
  }, [trace, bench, floor]);
  const geo = useMemo(() => (pts.length >= 2 ? smoothTube(pts, 0.55, 6, 0.8) : null), [pts]);
  useLayoutEffect(() => () => geo?.dispose(), [geo]);
  const pal = usePaperPalette();
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: pal.red, toneMapped: false }), [pal.red]);
  useLayoutEffect(() => () => material.dispose(), [material]);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const dur = Math.max(1200, Math.min(3600, trace.steps.length * 320));
  const done = useRef(false);
  const mark = useRef<THREE.Group>(null);
  useAnimating(!reduced && !done.current);
  useFrame(() => {
    if (!geo) return;
    const k = reduced ? 1 : Math.max(0, Math.min(1, (performance.now() - at) / dur));
    const count = geo.index ? geo.index.count : geo.attributes.position!.count;
    // Index order runs along the tube, so a share of it is a share of the way.
    geo.setDrawRange(0, Math.floor((count * k) / 6) * 6);
    if (mark.current) mark.current.visible = k >= 1;
    done.current = k >= 1;
  });
  if (!geo) return null;
  const end = trace.closed ? pts[0]! : pts[pts.length - 1]!;
  return (
    <group userData={OVERLAY}>
      <mesh geometry={geo} material={material} renderOrder={14} userData={OVERLAY} />
      <group ref={mark} position={end} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={32} userData={OVERLAY}>
          <ringGeometry args={[2.4, 3.2, 28]} />
          <meshBasicMaterial color={pal.red} transparent opacity={0.95} depthTest={false} toneMapped={false} />
        </mesh>
        {!trace.closed &&
          [1, -1].map((s) => (
            <mesh key={s} rotation={[-Math.PI / 2, 0, (s * Math.PI) / 4]} renderOrder={32} userData={OVERLAY}>
              <planeGeometry args={[5.4, 0.7]} />
              <meshBasicMaterial color={pal.red} transparent opacity={0.95} depthTest={false} toneMapped={false} />
            </mesh>
          ))}
      </group>
    </group>
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Inside an open box

export const BoxWires3D = memo(function BoxWires3D({ bench }: { bench: BenchState }) {
  const wires = useMemo(() => {
    const out: { key: string; geo: THREE.BufferGeometry; color: string }[] = [];
    for (const box of bench.parts) {
      if (box.kind !== "box" || !box.params.lid) continue;
      for (const [net, pts] of boxNets(bench, box)) {
        const color = WIRE_HEX[net === "t1" ? "red" : net === "t2" ? "black" : "yellow"]!;
        const a = pts[0]!;
        pts.slice(1).forEach((p, i) => {
          const floorY = Math.min(a[1], p[1]) - 6;
          out.push({ key: `${box.id}:${net}:${i}`, geo: bentTube([a, [a[0], Math.max(4, floorY), a[2] - 4], [p[0], Math.max(4, floorY), p[2] + 2], p], 0.6, 3, 8), color });
        });
      }
    }
    return out;
  }, [bench]);
  useLayoutEffect(() => () => wires.forEach((w) => w.geo.dispose()), [wires]);
  return (
    <group>
      {wires.map((w) => (
        <mesh key={w.key} geometry={w.geo} material={mat.insulation(w.color)} castShadow />
      ))}
    </group>
  );
});

/** The overlays that are switched on. */
export function Overlays3D({ bench, store, floor }: { bench: BenchState; store: BenchStore; floor: FloorFn }) {
  const flow = useStore(store, (s) => s.overlay.flow);
  const push = useStore(store, (s) => s.overlay.push);
  const trace = useStore(store, (s) => s.overlay.trace);
  return (
    <group>
      {push && <Push3D bench={bench} store={store} floor={floor} />}
      {flow !== "off" && <FlowDots3D bench={bench} store={store} floor={floor} electrons={flow === "electrons"} />}
      {trace && <Tracer3D bench={bench} store={store} floor={floor} from={trace.from} at={trace.at} />}
    </group>
  );
}
