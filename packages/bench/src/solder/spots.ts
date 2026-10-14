// Spots: where the iron can rest and solder can be fed, derived from BenchState alone, so both views and the lesson
// player agree on them (anchors `spot:<id>`, see anchorPosition). Pure.
//
// - `PB1.B4`: a perfboard pad (only while the board shows its copper side);
// - `D1.anode`: a lead of a part lying on the desk, at the iron mark 12 mm from the body;
// - `HW1.b`: a splice where a stripped wire end meets another (named after the end listed first);
// - `ST1.stand`, `ST1.wool`, `ST1.sponge`: the station's stand, brass wool and sponge;
// and points that are not resting places: `ST1.tip` and `ST1.grip` (the iron as it is now), `SD1.end` (a spool's
// free end), `BR1.end` (the braid's end), `J1.socket` (a barrel jack's socket).

import { BOARD_TOP, LED, NPN } from "../dims";
import { partPose } from "../layout";
import type { BenchState, PlacedPart, Vec2, Vec3 } from "../types";
import { GEOM } from "./parts";
import { PERF, hasPad, padWorld, padsOf, type JointRecord } from "./perfboard";
import type { WorkKind } from "./joint";

export type SpotKind = "pad" | "lead" | "splice" | "stand" | "wool" | "sponge";

export type Spot = {
  id: string;
  kind: SpotKind;
  pos: Vec3;
  /** The part it belongs to (the board, the leaded part, the wire, the station). */
  host: string;
  /** For joints: the kind of work under the iron. */
  work?: WorkKind;
  /** Pads: the pad. Leads: the leg. Splices: the end and the other wire's end ("HW2.a"). */
  pad?: string;
  leg?: string;
  mm?: number;
  end?: "a" | "b";
  with?: string;
};

/** Where the iron mark sits on a lead (mm from the body), as in MP5. */
export const LEAD_SPOT_MM = 12;
/** Stripped wire ends this close (mm) meet: a splice. */
const SPLICE_REACH = 5;
/** Kinds whose leads the iron can rest on (lying on the desk). */
const LEADED = new Set<PlacedPart["kind"]>(["led", "npn", "diode", "electrolytic-cap", "ceramic-cap", "phototransistor"]);

const rot2 = (x: number, z: number, rot: number): Vec2 => {
  const r = (rot * Math.PI) / 180;
  return [x * Math.cos(r) + z * Math.sin(r), -x * Math.sin(r) + z * Math.cos(r)];
};

/** A point in a part's own desk frame, in the world. */
export function local(part: PlacedPart, x: number, y: number, z: number): Vec3 {
  const [rx, rz] = rot2(x, z, part.rot);
  return [part.pos[0] + rx, y, part.pos[1] + rz];
}

/** A lead from where it leaves the body to its end, as it lies now. Null for parts without that lead. */
export function leadLine(bench: BenchState, part: PlacedPart, leg: string): { start: Vec3; end: Vec3; len: number } | null {
  const pose = partPose(bench, part);
  const end = pose.legs[leg];
  if (!end) return null;
  if (pose.mount === "board") {
    // Standing in holes: the lead runs down from the body to the hole.
    const standoff = part.kind === "led" ? LED[(part.params as { size?: 3 | 5 }).size ?? 5].standoff : part.kind === "npn" ? NPN.standoff : 3;
    const base = pose.perf ? PERF.top : BOARD_TOP;
    const start: Vec3 = [end[0], base + standoff, end[2]];
    return { start, end: [end[0], base, end[2]], len: standoff };
  }
  // Lying on the desk: from the body edge out to the end (leads leave the body side by side).
  const o = pose.origin;
  const dx = end[0] - o[0];
  const dz = end[2] - o[2];
  const along = rot2(1, 0, pose.rot);
  // Offset across the lead's direction stays; the start sits at the body's edge.
  const fwd = dx * along[0] + dz * along[1];
  const side: Vec2 = [dx - fwd * along[0], dz - fwd * along[1]];
  const start: Vec3 = [o[0] + side[0] + along[0] * 1.2, end[1], o[2] + side[1] + along[1] * 1.2];
  const len = Math.max(1, Math.hypot(end[0] - start[0], end[2] - start[2]));
  return { start, end, len };
}

/** A point `mm` along a lead from the body. */
export function leadPoint(line: { start: Vec3; end: Vec3; len: number }, mm: number): Vec3 {
  const k = Math.max(0, Math.min(1, mm / line.len));
  return [line.start[0] + (line.end[0] - line.start[0]) * k, line.start[1] + (line.end[1] - line.start[1]) * k, line.start[2] + (line.end[2] - line.start[2]) * k];
}

/** Where a heat-sink clip grips its lead, and which way it lies. */
export function clipPose(bench: BenchState, clip: PlacedPart): { origin: Vec3; rot: number; part: string; leg: string; mm: number } | null {
  if (clip.kind !== "heat-sink-clip" || !clip.params.on) return null;
  const dot = clip.params.on.lastIndexOf(".");
  const partId = clip.params.on.slice(0, dot);
  const leg = clip.params.on.slice(dot + 1);
  const part = bench.parts.find((p) => p.id === partId);
  if (!part) return null;
  const line = leadLine(bench, part, leg);
  if (!line) return null;
  const mm = Math.max(0.5, Math.min(line.len - 0.5, clip.params.mm ?? 6));
  const at = leadPoint(line, mm);
  const rot = (Math.atan2(-(line.end[2] - line.start[2]), line.end[0] - line.start[0]) * 180) / Math.PI;
  return { origin: at, rot, part: partId, leg, mm };
}

/** Where a heat-shrink tube sits on its wire (`at` mm from end a) and which way the wire runs there. */
export function tubePose(bench: BenchState, tube: PlacedPart): { origin: Vec3; rot: number; wire: string; len: number } | null {
  if (tube.kind !== "heat-shrink" || !tube.params.on) return null;
  const wire = bench.parts.find((p) => p.id === tube.params.on);
  if (!wire || wire.kind !== "hookup-wire") return null;
  const pose = partPose(bench, wire);
  const a = pose.ends?.a?.pos ?? pose.legs.a;
  const b = pose.ends?.b?.pos ?? pose.legs.b;
  if (!a || !b) return null;
  const len = Math.max(1, Math.hypot(b[0] - a[0], b[2] - a[2]));
  const k = Math.max(0, Math.min(1, (tube.params.at ?? len / 2) / len));
  const rot = (Math.atan2(-(b[2] - a[2]), b[0] - a[0]) * 180) / Math.PI;
  return { origin: [a[0] + (b[0] - a[0]) * k, 1.2, a[2] + (b[2] - a[2]) * k], rot, wire: wire.id, len };
}

// ---------------------------------------------------------------------------------------------------------------
// Splices: two stripped wire ends lying together.

type WireEnd = { wire: PlacedPart & { kind: "hookup-wire" }; end: "a" | "b"; pos: Vec3 };

function strippedEnds(bench: BenchState): WireEnd[] {
  const out: WireEnd[] = [];
  for (const p of bench.parts) {
    if (p.kind !== "hookup-wire") continue;
    const pose = partPose(bench, p);
    for (const end of ["a", "b"] as const) {
      const e = pose.ends?.[end];
      if (!e || e.inHole || !((p.params.ends?.[end]?.mm ?? 0) > 0)) continue;
      out.push({ wire: p, end, pos: e.pos });
    }
  }
  return out;
}

/** Pairs of stripped ends lying together, each named after its first end ("HW1.b" with "HW2.a"). */
export function splices(bench: BenchState): { id: string; a: WireEnd; b: WireEnd; pos: Vec3; crossed: boolean }[] {
  const ends = strippedEnds(bench);
  const out: { id: string; a: WireEnd; b: WireEnd; pos: Vec3; crossed: boolean }[] = [];
  const taken = new Set<string>();
  for (let i = 0; i < ends.length; i++) {
    for (let k = i + 1; k < ends.length; k++) {
      const a = ends[i]!;
      const b = ends[k]!;
      if (a.wire.id === b.wire.id) continue;
      const ka = `${a.wire.id}.${a.end}`;
      const kb = `${b.wire.id}.${b.end}`;
      if (taken.has(ka) || taken.has(kb)) continue;
      if (Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]) > SPLICE_REACH) continue;
      taken.add(ka);
      taken.add(kb);
      const [first, second] = ka < kb ? [a, b] : [b, a];
      const crossed = wireAngle(bench, a) !== null && wireAngle(bench, b) !== null && Math.abs(Math.sin(wireAngle(bench, a)! - wireAngle(bench, b)!)) > 0.5;
      out.push({ id: `${first.wire.id}.${first.end}`, a: first, b: second, pos: [(a.pos[0] + b.pos[0]) / 2, 1.2, (a.pos[2] + b.pos[2]) / 2], crossed });
    }
  }
  return out;
}

function wireAngle(bench: BenchState, e: WireEnd): number | null {
  const pose = partPose(bench, e.wire);
  const other = pose.ends?.[e.end === "a" ? "b" : "a"];
  if (!other) return null;
  return Math.atan2(e.pos[2] - other.pos[2], e.pos[0] - other.pos[0]);
}

// ---------------------------------------------------------------------------------------------------------------
// The station.

export type IronPose = {
  /** Where the tip touches (world), and where the grip is. */
  tip: Vec3;
  grip: Vec3;
  at: "stand" | "spot" | "desk";
  spot?: string;
};

function stationOf(bench: BenchState, id?: string): (PlacedPart & { kind: "solder-station" }) | null {
  const s = bench.parts.find((p) => p.kind === "solder-station" && (!id || p.id === id));
  return (s as (PlacedPart & { kind: "solder-station" }) | undefined) ?? null;
}

/** Where the iron is now: in its stand, resting on a spot, or lying on the desk. */
export function ironPose(bench: BenchState, stationId?: string): IronPose | null {
  const st = stationOf(bench, stationId);
  if (!st) return null;
  const g = GEOM.station;
  const where = st.params.iron ?? "stand";
  const inStand = (): IronPose => ({ tip: local(st, g.ironTip[0], 14, g.ironTip[1]), grip: local(st, g.ironGrip[0], 26, g.ironGrip[1]), at: "stand" });
  if (where === "stand") return inStand();
  // The grip leans back toward the station, as a hand would hold it.
  const lean = (tip: Vec3): Vec3 => {
    const home = local(st, g.stand.x, 0, g.stand.z);
    const dx = home[0] - tip[0];
    const dz = home[2] - tip[2];
    const l = Math.hypot(dx, dz) || 1;
    const reach = 92;
    return [tip[0] + (dx / l) * reach * 0.82, tip[1] + reach * 0.55, tip[2] + (dz / l) * reach * 0.82];
  };
  if (where === "desk") {
    const at = st.params.ironAt ?? [st.pos[0] - 60, st.pos[1] + 40];
    const tip: Vec3 = [at[0], 1, at[1]];
    const g2 = lean(tip);
    return { tip, grip: [g2[0], 6, g2[2]], at: "desk" };
  }
  const p = spotPosition(bench, where);
  if (!p) return inStand();
  return { tip: p, grip: lean(p), at: "spot", spot: where };
}

/** Every resting place for the iron and feeding place for solder on the bench. */
export function stationSpots(bench: BenchState): Spot[] {
  const out: Spot[] = [];
  for (const p of bench.parts) {
    if (p.kind === "perfboard" && p.params.flipped) {
      for (const pad of padsOf(p.params)) out.push({ id: `${p.id}.${pad}`, kind: "pad", pos: padWorld(p, pad)!, host: p.id, work: "pad", pad });
    } else if (p.kind === "solder-station") {
      const g = GEOM.station;
      out.push({ id: `${p.id}.stand`, kind: "stand", pos: local(p, g.coil.x, 12, g.coil.z), host: p.id });
      out.push({ id: `${p.id}.wool`, kind: "wool", pos: local(p, g.wool.x, 10, g.wool.z), host: p.id });
      out.push({ id: `${p.id}.sponge`, kind: "sponge", pos: local(p, g.sponge.x, 9, g.sponge.z), host: p.id });
    } else if (LEADED.has(p.kind) && !p.holes) {
      const pose = partPose(bench, p);
      if (pose.mount !== "desk" || pose.heldBy) continue;
      for (const leg of Object.keys(pose.legs)) {
        const line = leadLine(bench, p, leg);
        if (!line) continue;
        const mm = Math.min(LEAD_SPOT_MM, line.len - 1);
        out.push({ id: `${p.id}.${leg}`, kind: "lead", pos: leadPoint(line, mm), host: p.id, leg, mm });
      }
    }
  }
  for (const s of splices(bench)) {
    const heavy = (s.a.wire.params.awg ?? 22) <= 16;
    out.push({ id: s.id, kind: "splice", pos: s.pos, host: s.a.wire.id, work: heavy ? "heavy" : s.crossed ? "crossed" : "splice", end: s.a.end, with: `${s.b.wire.id}.${s.b.end}` });
  }
  return out;
}

/** One spot by id (or null when it is not a resting place now). */
export function spotById(bench: BenchState, id: string): Spot | null {
  return stationSpots(bench).find((s) => s.id === id) ?? null;
}

/** The world position of any spot anchor, including the iron's tip and grip and the tools' ends. */
export function spotPosition(bench: BenchState, id: string): Vec3 | null {
  const dot = id.lastIndexOf(".");
  const owner = dot > 0 ? id.slice(0, dot) : id;
  const sub = dot > 0 ? id.slice(dot + 1) : "";
  const part = bench.parts.find((p) => p.id === owner);
  if (part?.kind === "solder-station") {
    if (sub === "tip" || sub === "grip") {
      const pose = ironPose(bench, part.id);
      return pose ? (sub === "tip" ? pose.tip : pose.grip) : null;
    }
    const g = GEOM.station;
    if (sub === "stand") return local(part, g.coil.x, 12, g.coil.z);
    if (sub === "wool") return local(part, g.wool.x, 10, g.wool.z);
    if (sub === "sponge") return local(part, g.sponge.x, 9, g.sponge.z);
    if (sub === "display") return local(part, g.display.x, g.base.h, g.display.z);
    if (sub === "dial") return local(part, g.dial.x, g.base.h, g.dial.z);
    if (sub === "power") return local(part, g.power.x, g.base.h, g.power.z);
    return null;
  }
  if (part?.kind === "solder-spool" && sub === "end") return local(part, GEOM.spool.end[0], 1.5, GEOM.spool.end[1]);
  if (part?.kind === "solder-braid" && sub === "end") return local(part, GEOM.braid.end[0], 1.2, GEOM.braid.end[1]);
  if (part?.kind === "barrel-jack" && sub === "socket") return jackSocket(bench, part);
  if (part?.kind === "perfboard" && hasPad(part.params, sub)) return padWorld(part, sub);
  if (part && LEADED.has(part.kind)) {
    const line = leadLine(bench, part, sub);
    return line ? leadPoint(line, Math.min(LEAD_SPOT_MM, line.len - 1)) : null;
  }
  if (part?.kind === "hookup-wire") {
    const s = splices(bench).find((x) => x.id === id || `${x.b.wire.id}.${x.b.end}` === id);
    if (s) return s.pos;
    const e = partPose(bench, part).ends?.[sub as "a" | "b"];
    return e ? e.pos : null;
  }
  return null;
}

/** Where an adapter's plug goes into a barrel jack (world). */
export function jackSocket(bench: BenchState, jack: PlacedPart): Vec3 {
  const pose = partPose(bench, jack);
  const tip = pose.legs.tip;
  const sleeve = pose.legs.sleeve;
  if (pose.mount === "board" && tip && sleeve) {
    // On the board: the socket hangs off past the pins, away from the board.
    const dx = sleeve[0] - tip[0];
    const dz = sleeve[2] - tip[2];
    const l = Math.hypot(dx, dz) || 1;
    const k = GEOM.jack.socket + 2.54;
    return [tip[0] + (dx / l) * k, pose.origin[1] + 6, tip[2] + (dz / l) * k];
  }
  return local(jack, 0, 6, -GEOM.jack.d / 2 + 1);
}

// ---------------------------------------------------------------------------------------------------------------
// Joint records: where the bench keeps each joint once it has set.

/** The joint record at a pad or splice spot. */
export function jointRecordAt(bench: BenchState, spotId: string): JointRecord | null {
  const dot = spotId.lastIndexOf(".");
  const owner = spotId.slice(0, dot);
  const sub = spotId.slice(dot + 1);
  const part = bench.parts.find((p) => p.id === owner);
  if (part?.kind === "perfboard") return part.params.joints?.[sub] ?? null;
  if (part?.kind === "hookup-wire") return part.params.joints?.[sub as "a" | "b"] ?? null;
  return null;
}

/** Write a joint record at a pad or splice spot (null clears it). */
export function writeJointRecord(bench: BenchState, spot: Spot, rec: JointRecord | null): BenchState {
  const part = bench.parts.find((p) => p.id === spot.host);
  if (!part) return bench;
  let next: PlacedPart | null = null;
  if (part.kind === "perfboard" && spot.pad) {
    const joints = { ...(part.params.joints ?? {}) };
    if (rec) joints[spot.pad] = rec;
    else delete joints[spot.pad];
    next = { ...part, params: { ...part.params, joints } };
  } else if (part.kind === "hookup-wire" && spot.end) {
    const joints = { ...(part.params.joints ?? {}) };
    if (rec) joints[spot.end] = { ...rec, with: spot.with ?? "" };
    else delete joints[spot.end];
    next = { ...part, params: { ...part.params, joints } };
  }
  if (!next) return bench;
  const n = next;
  return { ...bench, parts: bench.parts.map((p) => (p.id === n.id ? n : p)) };
}
