// Scene views of bench state: placed parts, jumper wires, test leads and the meter with its probes.

import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PartState } from "@ohmland/sim";
import { Select } from "@react-three/postprocessing";
import { boardGeometry, boardOrigin, holeWorld } from "../board";
import { BOARD_TOP, PITCH, TOGGLE_BASE } from "../dims";
import { METER, anchorPosition, isOnBoard, outwardHeading, partPose, probeTip, socketWorld, meterLocalToWorld } from "../layout";
import { parseAnchor } from "../anchors";
import { partDef, rotateXZ } from "../parts";
import { PartModel, flyingLeads, type PartModelProps } from "../models/PartModel";
import { useBench, useBenchStore } from "../store";
import { MultimeterModel } from "../models/Multimeter";
import { AlligatorClip, BananaPlug, CLIP_LEN, Cable, JumperWire, PLUG_TOP, PROBE_LEN, Probe, StrippedEnd, quatFromY } from "../models/Leads";
import type { FloorFn } from "../three/geometry";
import type { BenchState, MeterState, PlacedPart, ProbeColor, Quality, TestLead, Vec3, Wire } from "../types";
import { Proxy, localBox } from "./pick";
import { prefersReducedMotion, useAnimating } from "../three/anim";
import { useFrame } from "@react-three/fiber";

export const ACCENT = "#ff8a1f";
export const SELECT_HEX = "#2f7df6";

const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

/** Height of whatever a cable would rest on at (x, z): the board, the meter, or the desk. */
export function makeFloor(bench: BenchState): FloorFn {
  const board = bench.board ? { o: boardOrigin(bench.board), g: boardGeometry(bench.board) } : null;
  const m = bench.meter;
  return (x, z) => {
    let y = 0;
    if (board) {
      const dx = Math.abs(x - board.o[0]);
      const dz = Math.abs(z - board.o[1]);
      if (dx < board.g.width / 2 && dz < board.g.depth / 2) y = BOARD_TOP;
    }
    if (m) {
      const [lx, lz] = rotateXZ(x - m.pos[0], z - m.pos[1], -m.rot);
      if (Math.abs(lx) < METER.width / 2 && Math.abs(lz) < METER.length / 2) y = Math.max(y, METER.height);
    }
    return y;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Selection frame: corner brackets on the surface around a box (always visible, both quality tiers).

function SelectionFrame({ box, color, pulse: wantPulse = false }: { box: THREE.Box3; color: string; pulse?: boolean }) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const pulse = wantPulse && !reduced;
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }), [color]);
  const ref = useRef<THREE.Group>(null);
  useAnimating(pulse);
  useFrame((s) => {
    if (pulse && ref.current) {
      const k = 0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 5);
      mat.opacity = 0.45 + 0.5 * k;
      ref.current.scale.setScalar(1 + 0.04 * k);
    }
  });
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const w = size.x + 3;
  const d = size.z + 3;
  const L = Math.min(w, d) * 0.3 + 1;
  const t = 0.45;
  const bars: [number, number, number, number][] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      bars.push([sx * (w / 2 - L / 2), sz * (d / 2), L, t]);
      bars.push([sx * (w / 2), sz * (d / 2 - L / 2), t, L]);
    }
  return (
    <group ref={ref} position={[c.x, Math.max(box.min.y, 0) + 0.15, c.z]}>
      {bars.map(([x, z, bw, bd], i) => (
        <mesh key={i} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={20}>
          <planeGeometry args={[bw, bd]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Placed parts.

type PartViewProps = {
  part: PlacedPart;
  board: BenchState["board"];
  selected: boolean;
  hinted: boolean;
  pressed: boolean;
  quality: Quality;
  floor: FloorFn;
};

const ACTUATOR: Partial<Record<PlacedPart["kind"], "press" | "flip" | "rotor">> = {
  pushbutton: "press",
  "slide-switch": "flip",
  "toggle-switch": "flip",
  "dpdt-switch": "flip",
  trimmer: "rotor",
};

/**
 * The model of a part, fed its simulator state straight from the store. Only this re-renders on each snapshot (about
 * 30 a second); the PartView around it, with its picking proxies and outline <Select>, re-renders only when the part
 * itself changes. (Re-rendering <Select> on every snapshot sent the outline composer into an update loop.)
 */
const LivePartModel = memo(function LivePartModel(props: Omit<PartModelProps, "state"> & { id: string }) {
  const store = useBenchStore();
  // Re-render only when something visible changed, not on every snapshot.
  const key = useBench((s) => visualKey(s.snapshot?.parts[props.id]));
  const state = useMemo(() => (store.getState().snapshot?.parts[props.id] as PartState | undefined) ?? null, [store, props.id, key]);
  const { id: _id, ...rest } = props;
  return <PartModel {...rest} state={state} />;
});

/** What a part's look depends on, as a string: health, glow (in 2% steps), contacts, display, relay armature. */
export function visualKey(p: PartState | undefined): string {
  if (!p) return "";
  const arm = typeof p.extra?.["armature"] === "number" ? Math.round((p.extra["armature"] as number) * 20) : "";
  return `${p.health}|${Math.round((p.glow ?? 0) * 50)}|${p.closed ? 1 : 0}|${p.display ?? ""}|${p.unit ?? ""}|${arm}`;
}

/** The visual keys of every part in a snapshot, joined: unchanged means the bench looks the same. */
export function snapshotKey(s: { parts: Record<string, PartState> } | null): string {
  if (!s) return "";
  let out = "";
  for (const id in s.parts) out += `${id}=${visualKey(s.parts[id])};`;
  return out;
}

function PartViewImpl({ part, board, selected, hinted, pressed, quality, floor }: PartViewProps) {
  const pose = useMemo(() => partPose({ v: 1, board, parts: [part], wires: [], leads: [], meter: null }, part), [part, board]);
  const model = useRef<THREE.Group>(null);
  const [box, setBox] = useState<THREE.Box3 | null>(null);
  const def = partDef(part.kind);
  const paramsKey = JSON.stringify(part.params);
  useLayoutEffect(() => {
    if (!model.current) return;
    const b = localBox(model.current);
    setBox((prev) => (prev && prev.equals(b) ? prev : b));
  }, [part.kind, paramsKey, pose.mount, pose.span]);
  const rotY = (pose.rot * Math.PI) / 180;
  const flying = useMemo(() => flyingLeads(part.kind, part.params as Record<string, unknown>), [part.kind, paramsKey]);
  const actuator = ACTUATOR[part.kind];
  const outline = quality === "high" && (selected || hinted);
  const body = (
    <group ref={model}>
      <LivePartModel id={part.id} kind={part.kind} params={part.params} mount={pose.mount} span={pose.span} quality={quality} pressed={pressed} />
    </group>
  );
  return (
    <group>
      <group position={pose.origin} rotation={[0, rotY, 0]}>
        <Select enabled={outline}>{body}</Select>
        {box && (
          <>
            <Proxy
              pick={{ type: "part", id: part.id }}
              size={[Math.max(box.max.x - box.min.x + 1.5, 6), Math.max(box.max.y - box.min.y + 1, 4), Math.max(box.max.z - box.min.z + 1.5, 6)]}
              position={[(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2]}
            />
            {actuator &&
              (((part.params as { base?: boolean }).base || part.kind === "dpdt-switch") && pose.mount === "desk" ? (
                // The lever, slider, button or knob on its wooden block: a generous target, since it is the one thing to press.
                <Proxy pick={{ type: actuator, id: part.id }} size={part.kind === "pushbutton" ? [16, 10, 16] : [24, 20, 16]} position={[0, part.kind === "toggle-switch" ? box.max.y - 8 : TOGGLE_BASE.h + 5, TOGGLE_BASE.switchZ]} />
              ) : (
                <Proxy
                  pick={{ type: actuator, id: part.id }}
                  size={part.kind === "toggle-switch" ? [7, 12, 7] : [5.2, 3.2, 5.2]}
                  position={[(box.min.x + box.max.x) / 2, part.kind === "toggle-switch" ? box.max.y - 5 : box.max.y - 0.8, (box.min.z + box.max.z) / 2]}
                />
              ))}
            {(selected || hinted) && <SelectionFrame box={box} color={hinted && !selected ? ACCENT : SELECT_HEX} pulse={hinted && !selected} />}
          </>
        )}
        {def.span && pose.mount === "board" && pose.span !== undefined && (
          <>
            <Proxy pick={{ type: "leg", id: part.id, leg: def.span.legs[0], flying: false }} size={[2.8, 5, 2.8]} position={[0, 1.6, 0]} />
            <Proxy pick={{ type: "leg", id: part.id, leg: def.span.legs[1], flying: false }} size={[2.8, 5, 2.8]} position={[pose.span * PITCH, 1.6, 0]} />
          </>
        )}
      </group>
      {flying &&
        pose.ends &&
        Object.entries(flying).map(([leg, f]) => {
          const end = pose.ends![leg];
          if (!end) return null;
          const [ex, ez] = rotateXZ(f.pos[0], f.pos[2], pose.rot);
          const from = new THREE.Vector3(pose.origin[0] + ex, pose.origin[1] + f.pos[1], pose.origin[2] + ez);
          const [dx, dz] = rotateXZ(f.dir[0], f.dir[2], pose.rot);
          const fromDir = new THREE.Vector3(dx, f.dir[1], dz).normalize();
          const tip = v3(end.pos);
          let to: THREE.Vector3;
          let toDir: THREE.Vector3;
          let stripDir: THREE.Vector3;
          if (end.inHole) {
            to = tip.clone().setY(BOARD_TOP + 1.6);
            toDir = new THREE.Vector3(0, 1, 0);
            stripDir = new THREE.Vector3(0, -1, 0);
          } else {
            const back = new THREE.Vector3(from.x - tip.x, 0, from.z - tip.z).normalize();
            to = tip.clone().addScaledVector(back, 5).setY(0.75);
            toDir = back;
            stripDir = back.clone().negate();
          }
          return (
            <group key={leg}>
              <Cable from={from} fromDir={fromDir} to={to} toDir={toDir} length={Math.min(f.length, from.distanceTo(to) * 1.08 + 30)} radius={f.radius} color={f.color} floor={floor} bend={0.42} stiff={1} />
              <StrippedEnd at={end.inHole ? tip : to.clone().setY(0.6)} dir={stripDir} inHole={end.inHole} />
              <Proxy pick={{ type: "leg", id: part.id, leg, flying: true }} size={[4, 4, 4]} position={end.inHole ? [tip.x, BOARD_TOP + 2, tip.z] : [tip.x, 1.5, tip.z]} />
            </group>
          );
        })}
    </group>
  );
}

export const PartView = memo(PartViewImpl);

// ---------------------------------------------------------------------------------------------------------------
// Jumper wires.

function WireViewImpl({ wire, board, selected, hinted }: { wire: Wire; board: NonNullable<BenchState["board"]>; selected: boolean; hinted: boolean }) {
  const a = holeWorld(board, wire.a);
  const b = holeWorld(board, wire.b);
  if (!a || !b) return null;
  const A = new THREE.Vector3(a[0], 0, a[1]);
  const B = new THREE.Vector3(b[0], 0, b[1]);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  const len = A.distanceTo(B);
  const ang = Math.atan2(-(B.z - A.z), B.x - A.x);
  const h = len <= PITCH * 3.2 ? 2.8 : Math.min(0.8 + len * 0.075, 12) + 2.8;
  const box = new THREE.Box3(new THREE.Vector3(-len / 2 - 1, 0, -1.2), new THREE.Vector3(len / 2 + 1, h + 1, 1.2));
  return (
    <group>
      <JumperWire a={new THREE.Vector3(a[0], BOARD_TOP, a[1])} b={new THREE.Vector3(b[0], BOARD_TOP, b[1])} color={wire.color} />
      <group position={[mid.x, BOARD_TOP, mid.z]} rotation={[0, ang, 0]}>
        <Proxy pick={{ type: "wire", id: wire.id }} size={[Math.max(len - 4, 1), h * 0.7 + 1.5, 2.6]} position={[0, h * 0.62, 0]} />
        {(selected || hinted) && <SelectionFrame box={box} color={hinted && !selected ? ACCENT : SELECT_HEX} pulse={hinted && !selected} />}
      </group>
      <Proxy pick={{ type: "wireEnd", id: wire.id, end: "a" }} size={[3, 4.5, 3]} position={[a[0], BOARD_TOP + 1.5, a[1]]} />
      <Proxy pick={{ type: "wireEnd", id: wire.id, end: "b" }} size={[3, 4.5, 3]} position={[b[0], BOARD_TOP + 1.5, b[1]]} />
    </group>
  );
}

export const WireView = memo(WireViewImpl);

// ---------------------------------------------------------------------------------------------------------------
// Crocodile-clip test leads.

type ClipPose = { tip: THREE.Vector3; tailDir: THREE.Vector3; quat: THREE.Quaternion; tail: THREE.Vector3 };

/** Orientation for a clip whose jaws are at `tip` and whose body runs toward `tailDir` (unit). */
function clipPose(tip: THREE.Vector3, tailDir: THREE.Vector3, lying: boolean): ClipPose {
  const x = tailDir.clone().negate().normalize(); // local +x points from the tail to the tip
  const upHint = new THREE.Vector3(0, 1, 0);
  let y = upHint.clone().sub(x.clone().multiplyScalar(upHint.dot(x))).normalize();
  if (y.lengthSq() < 1e-6) y = new THREE.Vector3(0, 0, 1);
  let z = new THREE.Vector3().crossVectors(x, y).normalize();
  if (lying) {
    // Roll a quarter turn so the clip rests on its side.
    const ty = y.clone();
    y = z.clone();
    z = ty.negate();
  }
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  const quat = new THREE.Quaternion().setFromRotationMatrix(m);
  const tail = tip.clone().addScaledVector(tailDir, CLIP_LEN);
  return { tip, tailDir, quat, tail };
}

/**
 * For a clip on the lead of a part lying on the desk: the direction from the part's body out through that lead, so
 * the clip carries on along the lead instead of lying across the part. Null for anything else.
 */
function deskLeadHeading(bench: BenchState, anchor: string): [number, number] | null {
  const a = parseAnchor(anchor);
  if (a?.type !== "pin") return null;
  const part = bench.parts.find((p) => p.id === a.part);
  if (!part || isOnBoard(bench, part)) return null;
  const pin = anchorPosition(bench, anchor);
  if (!pin) return null;
  const dx = pin[0] - part.pos[0];
  const dz = pin[2] - part.pos[1];
  const l = Math.hypot(dx, dz);
  return l < 2 ? null : [dx / l, dz / l];
}

function leadEndPose(bench: BenchState, lead: TestLead, end: "a" | "b"): ClipPose {
  const me = end === "a" ? lead.a : lead.b;
  const other = end === "a" ? lead.b : lead.a;
  const otherPos = other.to ? anchorPosition(bench, other.to) : null;
  const otherXZ = otherPos ? new THREE.Vector3(otherPos[0], 0, otherPos[2]) : new THREE.Vector3(other.pos[0], 0, other.pos[1]);
  if (me.to) {
    const at = anchorPosition(bench, me.to);
    const own = at ? deskLeadHeading(bench, me.to) : null;
    if (at && own) {
      // Along the lead, turned a little toward the viewer so the clip's profile reads.
      let hx = own[0];
      let hz = own[1] * 0.8 + 0.3;
      const hl = Math.hypot(hx, hz) || 1;
      hx /= hl;
      hz /= hl;
      const pitch = 0.32;
      const tailDir = new THREE.Vector3(hx * Math.cos(pitch), Math.sin(pitch), hz * Math.cos(pitch)).normalize();
      return clipPose(v3(at).addScaledVector(tailDir, -3.2), tailDir, false);
    }
    if (at) {
      // Clips come in from the side so their profile reads from the usual camera and the board stays visible.
      const [ox, oz] = outwardHeading(bench, at, [otherXZ.x, 0, otherXZ.z], end === "a" ? 0.15 : -0.15);
      let hx = Math.abs(ox) < 0.2 ? (end === "a" ? -1 : 1) : Math.sign(ox);
      let hz = oz * 0.45;
      const hl = Math.hypot(hx, hz);
      hx /= hl;
      hz /= hl;
      const pitch = 0.32;
      const tailDir = new THREE.Vector3(hx * Math.cos(pitch), Math.sin(pitch), hz * Math.cos(pitch)).normalize();
      // Jaws bite slightly past the lead.
      const tip = v3(at).addScaledVector(tailDir, -3.2);
      return clipPose(tip, tailDir, false);
    }
  }
  const here = new THREE.Vector3(me.pos[0], 4.4, me.pos[1]);
  const toward = otherXZ.clone().setY(4.4).sub(here);
  const tailDir = toward.lengthSq() > 1 ? toward.normalize() : new THREE.Vector3(1, 0, 0);
  return clipPose(here, tailDir, true);
}

export function LeadView({
  lead,
  bench,
  selected,
  hinted,
  open,
  floor,
}: {
  lead: TestLead;
  bench: BenchState;
  selected: boolean;
  hinted: boolean;
  open: { a: number; b: number };
  floor: FloorFn;
}) {
  const pa = leadEndPose(bench, lead, "a");
  const pb = leadEndPose(bench, lead, "b");
  return (
    <group>
      {(["a", "b"] as const).map((end) => {
        const p = end === "a" ? pa : pb;
        return (
          <group key={end}>
            <group position={p.tip} quaternion={p.quat}>
              <AlligatorClip color={lead.color} open={open[end]} />
              <Proxy pick={{ type: "clip", id: lead.id, end }} size={[CLIP_LEN + 4, 12, 12]} position={[-CLIP_LEN / 2 + 1, 0, 0]} />
            </group>
            {(selected || hinted) && (
              <mesh position={p.tip} renderOrder={20}>
                <sphereGeometry args={[2.4, 16, 12]} />
                <meshBasicMaterial color={hinted && !selected ? ACCENT : SELECT_HEX} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
              </mesh>
            )}
          </group>
        );
      })}
      <Cable from={pa.tail} fromDir={pa.tailDir} to={pb.tail} toDir={pb.tailDir} length={Math.min(320, pa.tail.distanceTo(pb.tail) * 1.1 + 45)} radius={1.25} color={lead.color} floor={floor} bend={0.28} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Meter with plugs, cables and probes.

function probePose(bench: BenchState, meter: MeterState, color: ProbeColor): { tip: THREE.Vector3; axis: THREE.Vector3 } {
  const tipArr = probeTip(bench, color);
  const tip = v3(tipArr);
  const pr = meter.probes[color];
  const sock = pr.socket ? socketWorld(meter, pr.socket) : ([pr.plugPos[0], 0, pr.plugPos[1]] as Vec3);
  if (pr.tip.to) {
    // Lean the probe back toward the meter (and a little away from the viewer) so it does not hide the board.
    const tx = sock[0] - tip.x;
    const tz = sock[2] - tip.z;
    const tl = Math.hypot(tx, tz) || 1;
    let hx = tx / tl;
    let hz = tz / tl - 0.55;
    const hl = Math.hypot(hx, hz) || 1;
    hx /= hl;
    hz /= hl;
    const bias = color === "red" ? 0.22 : -0.22;
    const c = Math.cos(bias);
    const sn = Math.sin(bias);
    [hx, hz] = [hx * c - hz * sn, hx * sn + hz * c];
    const el = 0.88;
    return { tip, axis: new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize() };
  }
  const toward = new THREE.Vector3(sock[0] - tip.x, 0, sock[2] - tip.z);
  const axis = toward.lengthSq() > 1 ? toward.normalize() : new THREE.Vector3(1, 0, 0);
  return { tip: tip.setY(6.4), axis };
}

/** The meter body with its LCD, reading its own simulator state from the store (so only it re-renders per snapshot). */
const LiveMultimeter = memo(function LiveMultimeter({ id, mode }: { id: string; mode: MeterState["mode"] }) {
  const display = useBench((s) => (mode === "off" ? "" : (s.snapshot?.parts[id]?.display ?? "")));
  const unit = useBench((s) => s.snapshot?.parts[id]?.unit);
  return <MultimeterModel mode={mode} display={display} unit={unit} />;
});

export function MeterView({
  meter,
  bench,
  selected,
  floor,
}: {
  meter: MeterState;
  bench: BenchState;
  selected: boolean;
  floor: FloorFn;
}) {
  const rotY = (meter.rot * Math.PI) / 180;
  const dialLabelPos = (i: number): [number, number, number] => {
    const a = (i * 45 * Math.PI) / 180;
    return [Math.sin(a) * METER.dial.labels, METER.face + 1, METER.dial.z - Math.cos(a) * METER.dial.labels];
  };
  const modes = ["off", "dcv", "acv", "ohm", "continuity", "diode", "dca-10a", "dca-ma"] as const;
  return (
    <group>
      <group position={[meter.pos[0], 0, meter.pos[1]]} rotation={[0, rotY, 0]}>
        <LiveMultimeter id={meter.id} mode={meter.mode} />
        <Proxy pick={{ type: "meter" }} size={[METER.width, METER.height, METER.length]} position={[0, METER.height / 2, 0]} />
        <Proxy pick={{ type: "dial" }} size={[METER.dial.knob * 2, 10, METER.dial.knob * 2]} position={[0, METER.face + 4, METER.dial.z]} shape="cylinder" />
        {modes.map((mode, i) => (
          <Proxy key={mode} pick={{ type: "dialMode", mode }} size={[8, 4, 6]} position={dialLabelPos(i)} />
        ))}
        {selected && (
          <SelectionFrame box={new THREE.Box3(new THREE.Vector3(-METER.width / 2, 0, -METER.length / 2), new THREE.Vector3(METER.width / 2, 1, METER.length / 2))} color={SELECT_HEX} />
        )}
      </group>
      {(["red", "black"] as const).map((color) => {
        const pr = meter.probes[color];
        const { tip, axis } = probePose(bench, meter, color);
        const back = tip.clone().addScaledVector(axis, PROBE_LEN);
        let plugPos: THREE.Vector3;
        let plugQuat: THREE.Quaternion;
        let plugTop: THREE.Vector3;
        let plugDir: THREE.Vector3;
        if (pr.socket) {
          const s = v3(socketWorld(meter, pr.socket));
          plugPos = s;
          plugQuat = new THREE.Quaternion();
          plugTop = s.clone().setY(s.y + PLUG_TOP);
          plugDir = new THREE.Vector3(0, 1, 0);
        } else {
          const p = new THREE.Vector3(pr.plugPos[0], 4.3, pr.plugPos[1]);
          const toward = new THREE.Vector3(tip.x - p.x, 0, tip.z - p.z);
          const d = toward.lengthSq() > 1 ? toward.normalize() : new THREE.Vector3(1, 0, 0);
          plugPos = p;
          plugQuat = quatFromY(d);
          plugTop = p.clone().addScaledVector(d, PLUG_TOP);
          plugDir = d;
        }
        return (
          <group key={color}>
            <group position={plugPos} quaternion={plugQuat}>
              <BananaPlug color={color} />
              <Proxy pick={{ type: "plug", color }} size={[10, PLUG_TOP + 4, 10]} position={[0, PLUG_TOP / 2, 0]} />
            </group>
            <group position={tip} quaternion={quatFromY(axis)}>
              <Probe color={color} />
              <Proxy pick={{ type: "probe", color }} size={[12, PROBE_LEN - 10, 12]} position={[0, PROBE_LEN / 2 + 4, 0]} />
            </group>
            <Cable from={back} fromDir={axis} to={plugTop} toDir={plugDir} length={back.distanceTo(plugTop) * 1.12 + 70} radius={1.6} color={color} floor={floor} bend={0.42} stiff={1} />
          </group>
        );
      })}
    </group>
  );
}

/** Small glowing ring marking a snap target or a lab hint anchor. */
export function TargetMarker({ at, color = ACCENT, pulse: wantPulse = false, size = 2.2, onTop = true }: { at: Vec3; color?: string; pulse?: boolean; size?: number; onTop?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const pulse = wantPulse && !reduced;
  useAnimating(pulse);
  useFrame((s) => {
    if (pulse && ref.current) ref.current.scale.setScalar(1 + 0.25 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 5)));
  });
  return (
    <mesh ref={ref} position={at} rotation={[-Math.PI / 2, 0, 0]} renderOrder={30}>
      <ringGeometry args={[size * 0.62, size, 28]} />
      <meshBasicMaterial color={color} transparent opacity={0.95} depthTest={!onTop} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export { meterLocalToWorld };
