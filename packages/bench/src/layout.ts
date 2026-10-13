// Where things are in the scene, derived from BenchState. Pure: shared by the renderer, snapping and picking.

import { parseAnchor } from "./anchors";
import { PITCH, boardGeometry, boardOrigin, holeWorld } from "./board";
import { BOARD_TOP, BOARD_CLIP_LIFT, LED, NPN, CERAMIC, electrolyticSize, RESISTOR, DIODE, blockWidth } from "./dims";
import { canMountOnBoard, footprintOf, isFlying, partDef, partLegs, rotateXZ } from "./parts";
import { holderOf, seatPose } from "./seats";
import type { Anchor, BenchState, MeterSocket, MeterState, PlacedPart, ProbeColor, Vec2, Vec3 } from "./types";

export type PartPose = {
  mount: "board" | "desk";
  /** World position of the model origin (first lead's hole on the board, body origin on the desk). */
  origin: Vec3;
  /** Rotation around y in degrees. */
  rot: number;
  /** Lead spacing in pitches for stretchable parts on the board. */
  span?: number;
  /** World clip point of each lead (where a crocodile clip or probe tip touches it). */
  legs: Record<string, Vec3>;
  /** Flexible leads: where each free end lies or which hole it is in (world). */
  ends?: Record<string, { pos: Vec3; inHole: boolean }>;
  /** Sitting in a holder's seat (the holder's id). */
  heldBy?: string;
};

const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Height of the clip point above the board for each kind of seated part. */
function boardClipLift(part: PlacedPart): number {
  switch (part.kind) {
    case "resistor":
      return RESISTOR.lift + RESISTOR.dia * 0.3;
    case "diode":
      return DIODE.lift + DIODE.dia * 0.3;
    case "led":
    case "phototransistor":
      return LED[part.params.size ?? 5].standoff * 0.5;
    case "npn":
      return NPN.standoff * 0.5;
    case "ceramic-cap":
      return CERAMIC.standoff * 0.5;
    case "electrolytic-cap":
      return 0.8;
    case "fuse":
      return 1.2;
    default:
      return 0.5;
  }
}

/** True when every footprint lead of a board-mountable part sits in a hole of the current board. */
export function isOnBoard(bench: BenchState, part: PlacedPart): boolean {
  if (!bench.board || !canMountOnBoard(part) || !part.holes) return false;
  const geom = boardGeometry(bench.board);
  return partLegs(part).every((leg) => {
    const h = part.holes?.[leg];
    return !!h && geom.holes.has(h);
  });
}

export function partPose(bench: BenchState, part: PlacedPart): PartPose {
  const def = partDef(part.kind);
  if (bench.board && isOnBoard(bench, part)) {
    const board = bench.board;
    const legs: Record<string, Vec3> = {};
    const lift = boardClipLift(part);
    for (const leg of partLegs(part)) {
      const p = holeWorld(board, part.holes![leg]!)!;
      legs[leg] = [p[0], BOARD_TOP + lift, p[1]];
    }
    const first = holeWorld(board, part.holes![partLegs(part)[0]!]!)!;
    let rot = part.rot;
    let span: number | undefined;
    if (def.span) {
      const a = holeWorld(board, part.holes![def.span.legs[0]]!)!;
      const b = holeWorld(board, part.holes![def.span.legs[1]]!)!;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      span = Math.hypot(dx, dz) / PITCH;
      rot = Math.round(((Math.atan2(-dz, dx) * 180) / Math.PI) * 1000) / 1000;
    }
    const pose: PartPose = { mount: "board", origin: [first[0], BOARD_TOP, first[1]], rot, legs };
    if (span !== undefined) pose.span = span;
    return pose;
  }

  const seat = holderOf(bench, part.id);
  if (seat) {
    const sp = seatPose(seat.holder, seat.seat, part);
    const local = ((def.heldLegs ?? def.deskLegs) as (p: unknown) => Record<string, Vec3>)(part.params);
    const legs: Record<string, Vec3> = {};
    for (const leg of def.legs) {
      const l = local[leg];
      if (!l) continue;
      const [rx, rz] = rotateXZ(l[0], l[2], sp.rot);
      legs[leg] = add3(sp.origin, [rx, l[1], rz]);
    }
    return { mount: "desk", origin: sp.origin, rot: sp.rot, legs, heldBy: seat.holder.id };
  }

  const origin: Vec3 = [part.pos[0], 0, part.pos[1]];
  const local = (def.deskLegs as (p: unknown) => Record<string, Vec3>)(part.params);
  const legs: Record<string, Vec3> = {};
  const pose: PartPose = { mount: "desk", origin, rot: part.rot, legs };
  if (isFlying(part)) {
    const ends: Record<string, { pos: Vec3; inHole: boolean }> = {};
    for (const leg of partLegs(part)) {
      const hole = part.holes?.[leg];
      const hp = hole && bench.board ? holeWorld(bench.board, hole) : null;
      if (hp) {
        ends[leg] = { pos: [hp[0], BOARD_TOP, hp[1]], inHole: true };
        legs[leg] = [hp[0], BOARD_TOP + 2.2, hp[1]];
        continue;
      }
      const free = part.ends?.[leg];
      let p: Vec3;
      if (free) p = [free[0], 0.7, free[1]];
      else {
        const l = local[leg]!;
        const [rx, rz] = rotateXZ(l[0], l[2], part.rot);
        p = [origin[0] + rx, 0.7, origin[2] + rz];
      }
      ends[leg] = { pos: p, inHole: false };
      legs[leg] = p;
    }
    pose.ends = ends;
    return pose;
  }
  for (const leg of partLegs(part)) {
    const l = local[leg]!;
    const [rx, rz] = rotateXZ(l[0], l[2], part.rot);
    legs[leg] = add3(origin, [rx, l[1], rz]);
  }
  return pose;
}

// ---------------------------------------------------------------------------------------------------------------
// Multimeter layout. Local frame: origin at the centre of the base, x across, z along (display far, sockets near).

export const METER = {
  width: 76,
  length: 150,
  height: 31,
  face: 29.2,
  lcd: { x0: -29, x1: 29, z0: -63, z1: -33 },
  dial: { z: 12, knob: 15, labels: 24 },
  sockets: { z: 53, xs: { a10: -25.5, ma: -8.5, com: 8.5, vohm: 25.5 } as Record<MeterSocket, number>, dia: 9.5 },
  plug: { insert: 9, body: 30 },
  probe: { tip: 14, guard: 16, handle: 98, boot: 116 },
};

/** Dial detents, clockwise from the top. */
export const DIAL_MODES = ["off", "dcv", "acv", "ohm", "continuity", "diode", "dca-10a", "dca-ma"] as const;
export const DIAL_STEP = 360 / DIAL_MODES.length;

export function meterLocalToWorld(meter: MeterState, local: Vec3): Vec3 {
  const [rx, rz] = rotateXZ(local[0], local[2], meter.rot);
  return [meter.pos[0] + rx, local[1], meter.pos[1] + rz];
}

export function socketWorld(meter: MeterState, socket: MeterSocket): Vec3 {
  return meterLocalToWorld(meter, [METER.sockets.xs[socket], METER.face, METER.sockets.z]);
}

/** Nearest socket to a desk point, within `maxDist` mm. */
export function nearestSocket(meter: MeterState, x: number, z: number, maxDist = 9): MeterSocket | null {
  let best: MeterSocket | null = null;
  let bestD = maxDist * maxDist;
  for (const s of Object.keys(METER.sockets.xs) as MeterSocket[]) {
    const p = socketWorld(meter, s);
    const d = (p[0] - x) ** 2 + (p[2] - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
// Anchor positions.

export function anchorPosition(bench: BenchState, anchor: Anchor, depth = 0): Vec3 | null {
  const a = parseAnchor(anchor);
  if (!a || depth > 4) return null;
  switch (a.type) {
    case "hole": {
      if (!bench.board) return null;
      const p = holeWorld(bench.board, a.hole);
      return p ? [p[0], BOARD_TOP + 0.15, p[1]] : null;
    }
    case "pin": {
      const part = bench.parts.find((p) => p.id === a.part);
      if (!part) return null;
      return partPose(bench, part).legs[a.leg] ?? null;
    }
    case "wire": {
      const w = bench.wires.find((x) => x.id === a.wire);
      if (!w || !bench.board) return null;
      const p = holeWorld(bench.board, a.end === "a" ? w.a : w.b);
      return p ? [p[0], BOARD_TOP + BOARD_CLIP_LIFT, p[1]] : null;
    }
    case "lead": {
      const l = bench.leads.find((x) => x.id === a.lead);
      if (!l) return null;
      const end = a.end === "a" ? l.a : l.b;
      if (end.to) return anchorPosition(bench, end.to, depth + 1);
      return [end.pos[0], 2.5, end.pos[1]];
    }
    case "probe": {
      if (!bench.meter) return null;
      return probeTip(bench, a.color, depth);
    }
    case "socket": {
      if (!bench.meter) return null;
      return socketWorld(bench.meter, a.socket);
    }
  }
}

export function probeTip(bench: BenchState, color: ProbeColor, depth = 0): Vec3 {
  const m = bench.meter!;
  const tip = m.probes[color].tip;
  if (tip.to) {
    const p = anchorPosition(bench, tip.to, depth + 1);
    if (p) return p;
  }
  return [tip.pos[0], 6.5, tip.pos[1]];
}

export type ClipTarget = { anchor: Anchor; pos: Vec3; kind: "pin" | "hole" | "wire" | "probe" | "lead" };

/** Every point a crocodile clip or probe tip can attach to. */
export function clipTargets(bench: BenchState, opts: { holes?: boolean; probes?: boolean; leads?: boolean } = {}): ClipTarget[] {
  const out: ClipTarget[] = [];
  for (const part of bench.parts) {
    const pose = partPose(bench, part);
    for (const [leg, pos] of Object.entries(pose.legs)) out.push({ anchor: `pin:${part.id}.${leg}`, pos, kind: "pin" });
  }
  if (bench.board) {
    for (const w of bench.wires) {
      for (const end of ["a", "b"] as const) {
        const p = anchorPosition(bench, `wire:${w.id}.${end}`);
        if (p) out.push({ anchor: `wire:${w.id}.${end}`, pos: p, kind: "wire" });
      }
    }
    if (opts.holes !== false) {
      const geom = boardGeometry(bench.board);
      const [ox, oz] = boardOrigin(bench.board);
      for (const h of geom.holes.values()) out.push({ anchor: `hole:${h.id}`, pos: [ox + h.x, BOARD_TOP + 0.15, oz + h.z], kind: "hole" });
    }
  }
  // Probe tips and clips can be touched together, wherever they are (on something or lying on the desk).
  if (opts.probes && bench.meter) {
    for (const c of ["red", "black"] as const) out.push({ anchor: `probe:${c}`, pos: probeTip(bench, c), kind: "probe" });
  }
  if (opts.leads) {
    for (const l of bench.leads) {
      for (const end of ["a", "b"] as const) {
        const p = anchorPosition(bench, `lead:${l.id}.${end}`);
        if (p) out.push({ anchor: `lead:${l.id}.${end}`, pos: p, kind: "lead" });
      }
    }
  }
  return out;
}

/** Centre of the work area: the board if there is one, else the parts. */
export function workCenter(bench: BenchState): Vec2 {
  if (bench.board) return boardOrigin(bench.board);
  if (!bench.parts.length) return [0, 0];
  const xs = bench.parts.map((p) => p.pos[0]);
  const zs = bench.parts.map((p) => p.pos[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

/**
 * Horizontal direction (unit x, z) a clip or probe should point from an attachment point: away from the work
 * area and toward a preferred side, so cables trail outward instead of across the board.
 */
export function outwardHeading(bench: BenchState, at: Vec3, toward?: Vec3, bias = 0): [number, number] {
  const [cx, cz] = workCenter(bench);
  let ox = at[0] - cx;
  let oz = at[2] - cz;
  const ol = Math.hypot(ox, oz);
  if (ol < 1e-3) {
    ox = 0;
    oz = 1;
  } else {
    ox /= ol;
    oz /= ol;
  }
  // Mostly toward the viewer (+z) so handles and clips stay readable from the default camera.
  let hx = ox * 0.55;
  let hz = oz * 0.55 + 0.6;
  if (toward) {
    const tx = toward[0] - at[0];
    const tz = toward[2] - at[2];
    const tl = Math.hypot(tx, tz) || 1;
    hx += (tx / tl) * 0.45;
    hz += (tz / tl) * 0.45;
  }
  const l = Math.hypot(hx, hz) || 1;
  hx /= l;
  hz /= l;
  if (bias) {
    const c = Math.cos(bias);
    const s = Math.sin(bias);
    [hx, hz] = [hx * c - hz * s, hx * s + hz * c];
  }
  return [hx, hz];
}

/** Room each desk part needs around its position when framing the bench (mm). */
const PROP_REACH: Partial<Record<PlacedPart["kind"], number>> = {
  cup: 52,
  lemon: 38,
  fruit: 38,
  battery: 30,
  speaker: 24,
  holder: 34,
  station: 58,
  skin: 42,
  card: 70,
  bin: 40,
  chart: 54,
  clock: 32,
  showcase: 66,
  tag: 14,
};

/** Desk rectangle covering the board, parts and meter: [x0, z0, x1, z1]. */
export function benchBounds(bench: BenchState): [number, number, number, number] {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  const grow = (x: number, z: number, r: number) => {
    x0 = Math.min(x0, x - r);
    x1 = Math.max(x1, x + r);
    z0 = Math.min(z0, z - r);
    z1 = Math.max(z1, z + r);
  };
  if (bench.board) {
    const g = boardGeometry(bench.board);
    const [ox, oz] = boardOrigin(bench.board);
    grow(ox - g.width / 2, oz - g.depth / 2, 0);
    grow(ox + g.width / 2, oz + g.depth / 2, 0);
  }
  for (const p of bench.parts) {
    if (isOnBoard(bench, p)) continue;
    // Tall props reach up toward the camera, so give them more room than their footprint.
    const block = p.kind === "dpdt-switch" || (p.params as { base?: boolean }).base;
    const big =
      block
        ? Math.max(26, blockWidth(partLegs(p).length) / 2 + 4)
        : p.kind === "sample"
          ? p.params.material === "plastic"
            ? 80
            : 54
          : p.kind === "battery" && p.params.size && p.params.size !== "9v"
            ? 28
            : (PROP_REACH[p.kind] ?? 14);
    grow(p.pos[0], p.pos[1], big);
  }
  // An empty desk still has a work area to frame (otherwise a lone meter fills the view).
  if (!bench.board && !bench.parts.length) {
    grow(-110, -55, 0);
    grow(110, 55, 0);
  }
  if (bench.meter) {
    const m = bench.meter;
    for (const [lx, lz] of [
      [-METER.width / 2, -METER.length / 2],
      [METER.width / 2, -METER.length / 2],
      [-METER.width / 2, METER.length / 2],
      [METER.width / 2, METER.length / 2],
    ] as [number, number][]) {
      const [rx, rz] = rotateXZ(lx, lz, m.rot);
      grow(m.pos[0] + rx, m.pos[1] + rz, 0);
    }
  }
  // Attached clips matter for framing; loose ends lying on the desk do not.
  for (const l of bench.leads) {
    for (const e of [l.a, l.b]) {
      const p = e.to ? anchorPosition(bench, e.to) : null;
      if (p) grow(p[0], p[2], 30);
    }
  }
  if (!Number.isFinite(x0)) return [-100, -60, 100, 60];
  return [x0, z0, x1, z1];
}

/** A camera that frames the whole bench for a viewport aspect (width / height). */
export function fitCamera(
  bench: BenchState,
  aspect: number,
  top = false,
  pad: { left?: number; bottom?: number } = {},
  fovDeg = 32,
  /** A desk rectangle [x0, z0, x1, z1] to frame instead of the whole bench (a lab's working area). */
  frame?: readonly [number, number, number, number] | null,
): { position: Vec3; target: Vec3 } {
  // On a tall, narrow screen frame the board alone (the learner can zoom out to reach the meter).
  const portrait = aspect < 0.85 && !!bench.board;
  const [x0, z0, x1, z1] = frame ?? (portrait ? benchBounds({ ...bench, parts: [], leads: [], meter: null }) : benchBounds(bench));
  // `pad` gives the fractions of the view covered by panels; fit into what is left and shift away from them.
  const visible = 1 - Math.min(0.6, Math.max(0, pad.left ?? 0));
  const visibleY = 1 - Math.min(0.5, Math.max(0, pad.bottom ?? 0));
  const margin = portrait ? 12 : 24;
  const bw = (x1 - x0 + margin) / visible;
  const bd = (z1 - z0 + margin) / visibleY;
  // Portrait screens look along the board from its left end, so its long side runs up the screen.
  const w = portrait ? (z1 - z0 + margin) / visible : bw;
  const d = portrait ? (x1 - x0 + margin) / visibleY : bd;
  const cx = (x0 + x1) / 2 - (portrait ? 0 : (w * (1 - visible)) / 2);
  const cz = (z0 + z1) / 2;
  const v = (fovDeg * Math.PI) / 360;
  const h = Math.atan(Math.tan(v) * aspect);
  const polar = top ? 0.001 : portrait ? 0.42 : 0.68;
  const az = portrait ? -Math.PI / 2 : 0;
  const distW = w / 2 / Math.tan(h);
  const distD = (d / 2 / Math.tan(v)) * (top ? 1 : 0.85);
  const dist = Math.max(distW, distD) * 1.02;
  // Clips, cables and probes rise toward the back of the view; leave them room above the parts.
  const shift = top ? 0 : -d * 0.07;
  const target: Vec3 = portrait ? [cx - shift - (d * (1 - visibleY)) / 2, 0, cz] : [cx, 0, cz + shift + (d * (1 - visibleY)) / 2];
  const s = dist * Math.sin(polar);
  return { target, position: [target[0] + s * Math.sin(az), dist * Math.cos(polar), target[2] + s * Math.cos(az)] };
}

/** Bounds of the electrolytic can for layout code that needs it. */
export { electrolyticSize };
