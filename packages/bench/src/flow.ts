// What the teaching overlays show, worked out from the bench and a simulator snapshot. Pure: both views draw from it,
// the lab runtime reads it, and tests cover it.
//
// - Flow dots: the current along every clip lead, jumper and part, and how fast its dots ride (`dotSpeed`).
// - Gates: the current through the lead a gate is clipped on, and the dots it counts (`advanceGates`).
// - Push: each lead's voltage above the battery's minus (hatching), each battery's and sealed box's push (a hill).
// - The loop tracer: from a terminal, part by part along the metal, until the loop closes or a gap stops it.

import type { NodeId, Snapshot } from "@ohmland/sim";
import { parseAnchor } from "./anchors";
import { boardGeometry } from "./board";
import { anchorPosition, partPose } from "./layout";
import { benchToNetlist, connectivity, UnionFind } from "./netlist";
import { isThrowSwitch, partLegs } from "./parts";
import { heldOf, hiddenParts } from "./seats";
import type { Anchor, BenchState, PlacedPart, Vec3 } from "./types";

// ---------------------------------------------------------------------------------------------------------------
// Flow dots

/** Space between two flow dots along a conductor (mm). A gate ticks once per dot, so it counts at speed / spacing. */
export const DOT_SPACING = 8;

/** Below this current nothing moves (the dots stop). */
export const DOT_MIN_AMPS = 1e-6;

/**
 * How fast flow dots ride (mm per second) for a current: a gentle power law, so a hundredth of the current still
 * creeps visibly and a short circuit never races. About 8 mm/s at 0.7 mA, 20 mm/s at the lamp's 7.5 mA, 27 mm/s at
 * 16 mA, capped at 40 mm/s.
 */
export function dotSpeed(amps: number): number {
  const a = Math.abs(amps);
  if (!(a >= DOT_MIN_AMPS)) return 0;
  return Math.min(40, 9 * Math.pow(a / 1e-3, 0.4));
}

/** Electrons drift the other way and far slower than the dots for conventional current: this share of their speed. */
export const ELECTRON_SLOWDOWN = 0.12;

/** Dots per second passing a point of a conductor carrying `amps` (what a gate counts). */
export function dotRate(amps: number): number {
  return dotSpeed(amps) / DOT_SPACING;
}

/** One stretch of the flow inside a part: from one lead's clip point to another's, and the current along it. */
export type PartFlow = { id: string; from: string; to: string; a: Vec3; b: Vec3; amps: number };

/** The flow along every conductor: amps from end a to end b of each clip lead and jumper, and through each part. */
export type FlowMap = {
  leads: Record<string, number>;
  wires: Record<string, number>;
  parts: PartFlow[];
};

/** Through a part, from its first lead to its second (as the simulator reports `i`), as stretches between leads. */
function partStretches(part: PlacedPart, snapshot: Snapshot): { from: string; to: string; amps: number }[] {
  const s = snapshot.parts[part.id];
  if (!s) return [];
  const legs = partLegs(part);
  if (isThrowSwitch(part.kind)) {
    if (part.kind === "dpdt-switch") return [];
    const to = (part.params as { to: "a" | "b" }).to;
    if (!legs.includes(to)) return [];
    return [{ from: "com", to, amps: s.i }];
  }
  if (part.kind === "pushbutton") return [{ from: "a1", to: "b1", amps: s.i }];
  if (part.kind === "trimmer") {
    const x = s.extra ?? {};
    return [
      { from: "a", to: "wiper", amps: s.i },
      { from: "wiper", to: "b", amps: -(typeof x["iWiperB"] === "number" ? (x["iWiperB"] as number) : 0) },
    ];
  }
  if (legs.length !== 2) return [];
  return [{ from: legs[0]!, to: legs[1]!, amps: s.i }];
}

/** Current into each part's pin (amps flowing from the node into the part), for the jumpers' share of a node. */
function pinCurrents(bench: BenchState, snapshot: Snapshot): Map<Anchor, number> {
  const out = new Map<Anchor, number>();
  const add = (a: Anchor, i: number) => out.set(a, (out.get(a) ?? 0) + i);
  for (const p of bench.parts) {
    for (const st of partStretches(p, snapshot)) {
      add(`pin:${p.id}.${st.from}`, st.amps);
      add(`pin:${p.id}.${st.to}`, -st.amps);
    }
  }
  for (const l of bench.leads) {
    const i = snapshot.parts[l.id]?.i ?? 0;
    if (l.a.to) add(l.a.to, i);
    if (l.b.to) add(l.b.to, -i);
  }
  return out;
}

/** For each jumper, the anchors on its `a` side when it is lifted out (null when another path joins the two sides). */
const wireSides = new WeakMap<BenchState, Map<string, Set<Anchor> | null>>();

function sidesOf(bench: BenchState): Map<string, Set<Anchor> | null> {
  const hit = wireSides.get(bench);
  if (hit) return hit;
  const out = new Map<string, Set<Anchor> | null>();
  if (!bench.board || !bench.wires.length) {
    wireSides.set(bench, out);
    return out;
  }
  const geom = boardGeometry(bench.board);
  for (const w of bench.wires) {
    const uf = new UnionFind();
    for (const strip of geom.strips.values()) for (const h of strip.holes) uf.union(`hole:${strip.holes[0]}`, `hole:${h}`);
    for (const o of bench.wires) if (o.id !== w.id) uf.union(`hole:${o.a}`, `hole:${o.b}`);
    for (const p of bench.parts) for (const [leg, h] of Object.entries(p.holes ?? {})) if (h) uf.union(`pin:${p.id}.${leg}`, `hole:${h}`);
    for (const l of bench.leads) {
      if (l.a.to) uf.union(`lead:${l.id}.a`, l.a.to);
      if (l.b.to) uf.union(`lead:${l.id}.b`, l.b.to);
    }
    if (uf.find(`hole:${w.a}`) === uf.find(`hole:${w.b}`)) {
      out.set(w.id, null);
      continue;
    }
    const root = uf.find(`hole:${w.a}`);
    const side = new Set<Anchor>();
    for (const k of uf.keys()) if (uf.find(k) === root) side.add(k);
    out.set(w.id, side);
  }
  wireSides.set(bench, out);
  return out;
}

/** The flow along every clip lead, jumper and part, from a snapshot (leads and parts carry their own currents). */
export function flowMap(bench: BenchState, snapshot: Snapshot | null): FlowMap {
  const out: FlowMap = { leads: {}, wires: {}, parts: [] };
  if (!snapshot) return out;
  for (const l of bench.leads) out.leads[l.id] = snapshot.parts[l.id]?.i ?? 0;
  const hidden = hiddenParts(bench);
  for (const p of bench.parts) {
    if (hidden.has(p.id)) continue;
    const legs = partPose(bench, p).legs;
    for (const st of partStretches(p, snapshot)) {
      const a = legs[st.from];
      const b = legs[st.to];
      if (a && b) out.parts.push({ id: p.id, from: st.from, to: st.to, a, b, amps: st.amps });
    }
  }
  if (bench.wires.length) {
    // A jumper merges two strips into one node, so its current comes from the parts on one side (current law).
    const pins = pinCurrents(bench, snapshot);
    for (const [id, side] of sidesOf(bench)) {
      if (!side) continue;
      let into = 0;
      for (const a of side) into += pins.get(a) ?? 0;
      out.wires[id] = -into;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Gates

/** The current through the lead a gate is clipped on (amps, from the lead's clip a toward clip b), 0 when off a lead. */
export function gateAmps(bench: BenchState, snapshot: Snapshot | null, gateId: string): number {
  const g = bench.parts.find((p) => p.id === gateId);
  if (g?.kind !== "gate" || !g.params.on || !snapshot) return 0;
  const lead = bench.leads.find((l) => l.id === g.params.on);
  if (!lead || !lead.a.to || !lead.b.to) return 0;
  return snapshot.parts[lead.id]?.i ?? 0;
}

/** Ticks each gate has counted: dots that rode past it. */
export type GateCounts = Record<string, number>;

/**
 * Counts the dots that passed every gate during `dt` seconds of simulated time, at the current the snapshot reports.
 * A gate off a lead (or on one carrying nothing) counts nothing; counts are kept to whole dots plus the fraction of
 * the next one, so two gates on one series loop always agree.
 */
export function advanceGates(prev: GateCounts, bench: BenchState, snapshot: Snapshot | null, dt: number): GateCounts {
  const out: GateCounts = {};
  for (const p of bench.parts) {
    if (p.kind !== "gate") continue;
    const before = prev[p.id] ?? 0;
    out[p.id] = dt > 0 && dt < 5 ? before + dotRate(gateAmps(bench, snapshot, p.id)) * dt : before;
  }
  return out;
}

/** A current written for a gate's readout: "0.0075 A" or "7.5 mA". */
export function formatGate(amps: number, unit: "A" | "mA"): string {
  const a = Math.abs(amps);
  if (unit === "mA") return `${trimNumber(a * 1000, 3)} mA`;
  return `${trimNumber(a, 4)} A`;
}

function trimNumber(x: number, sig: number): string {
  if (x === 0) return "0";
  const digits = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(x))));
  return Number(x.toFixed(Math.min(8, digits))).toString();
}

// ---------------------------------------------------------------------------------------------------------------
// Prefixes (a value tag tapped open)

const PREFIX: Record<string, number> = { k: 1e3, M: 1e6, m: 1e-3, µ: 1e-6, u: 1e-6 };

/** Groups thousands with commas: 4700 -> "4,700"; keeps decimals ("0.02"). */
export function groupThousands(x: number): string {
  const s = Number(x.toPrecision(12)).toString();
  if (s.includes("e")) return s;
  const [int, frac] = s.split(".");
  const neg = int!.startsWith("-");
  const digits = neg ? int!.slice(1) : int!;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

/**
 * A value written out without its prefix: "10 kΩ" -> "10,000 Ω", "4.7 kΩ" -> "4,700 Ω", "20 mA" -> "0.02 A",
 * "2.2 MΩ" -> "2,200,000 Ω". Text with no prefix comes back unchanged ("9 V").
 */
export function expandPrefix(text: string): string {
  const m = /^\s*(-?[\d.,]+)\s*([kMmµu])(Ω|A|V|F|W|Hz)\s*$/.exec(text);
  if (!m) return text;
  const n = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(n)) return text;
  return `${groupThousands(n * PREFIX[m[2]!]!)} ${m[3]}`;
}

/** What a tag shows: its text, or the text written out without its prefix when tapped open. */
export function tagText(text: string, alt: boolean | undefined): string {
  return alt ? expandPrefix(text) : text;
}

// ---------------------------------------------------------------------------------------------------------------
// Push

/** Volts at or above which push hatching is densest, and a hill its full height. */
export const PUSH_FULL = 9.5;

/** The node of each anchor, named as the simulator names it (memoised per bench). */
const netCache = new WeakMap<BenchState, (a: Anchor) => NodeId>();

export function simNodeOf(bench: BenchState): (a: Anchor) => NodeId {
  let f = netCache.get(bench);
  if (!f) {
    f = benchToNetlist(bench).nodeOf;
    netCache.set(bench, f);
  }
  return f;
}

/** Volts at an anchor above the reference (the first battery's minus), or null before the circuit has run. */
export function anchorVolts(bench: BenchState, snapshot: Snapshot | null, anchor: Anchor): number | null {
  if (!snapshot) return null;
  const n = simNodeOf(bench)(anchor);
  if (n === "gnd") return 0;
  const v = snapshot.nodes[n];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** What the push view shows: each lead's volts at its two clips, and each battery's or sealed box's own push. */
export type PushMap = {
  leads: Record<string, [number, number]>;
  /** Each jumper's volts (the same at both ends: a jumper joins two strips into one node). */
  wires: Record<string, number>;
  /** Volts between a source's (or a box's) two terminals, by part id. */
  hills: Record<string, number>;
};

export function pushMap(bench: BenchState, snapshot: Snapshot | null): PushMap {
  const out: PushMap = { leads: {}, wires: {}, hills: {} };
  if (!snapshot) return out;
  for (const w of bench.wires) {
    const v = anchorVolts(bench, snapshot, `wire:${w.id}.a`);
    if (v !== null) out.wires[w.id] = v;
  }
  for (const l of bench.leads) {
    const a = l.a.to ? anchorVolts(bench, snapshot, `lead:${l.id}.a`) : null;
    const b = l.b.to ? anchorVolts(bench, snapshot, `lead:${l.id}.b`) : null;
    if (a === null && b === null) continue;
    out.leads[l.id] = [a ?? b ?? 0, b ?? a ?? 0];
  }
  const hidden = hiddenParts(bench);
  // A battery in a sealed box shows its push as the box's hill, open or shut.
  const boxed = new Set<string>();
  for (const b of bench.parts) if (b.kind === "box") for (const id of Object.values(heldOf(b))) if (id) boxed.add(id);
  for (const p of bench.parts) {
    if (hidden.has(p.id) || boxed.has(p.id)) continue;
    if (p.kind === "battery" || p.kind === "lemon") {
      const v = snapshot.parts[p.id]?.v;
      if (typeof v === "number") out.hills[p.id] = Math.abs(v);
    } else if (p.kind === "box" && p.params.style !== "cabinet") {
      const a = anchorVolts(bench, snapshot, `pin:${p.id}.t1`);
      const b = anchorVolts(bench, snapshot, `pin:${p.id}.t2`);
      if (a !== null && b !== null) out.hills[p.id] = Math.abs(a - b);
    }
  }
  return out;
}

/** Space between push hatch strokes along a lead at `volts` (mm), or Infinity for no push. Denser is higher. */
export function hatchSpacing(volts: number): number {
  const v = Math.abs(volts);
  if (v < 0.15) return Infinity;
  return Math.max(1.6, Math.min(14, 14 / Math.pow(v / 1.2, 0.85)));
}

/** A hill's height as a share of its full height, for a push in volts. */
export function hillShare(volts: number): number {
  return Math.max(0, Math.min(1, Math.abs(volts) / PUSH_FULL));
}

// ---------------------------------------------------------------------------------------------------------------
// The loop tracer

export type TraceStep =
  /** Along a clip lead, from one clip to the other. */
  | { kind: "lead"; id: string; from: "a" | "b"; a: Vec3; b: Vec3 }
  /** Through a part, from one lead to another. */
  | { kind: "part"; id: string; from: string; to: string; a: Vec3; b: Vec3 }
  /** Along metal from one connection point to the next (a breadboard strip or a jumper, a holder's clip). */
  | { kind: "metal"; a: Vec3; b: Vec3 };

export type Trace = {
  /** Where it started (an anchor) and the steps it inked, in order. */
  from: Anchor;
  steps: TraceStep[];
  /** It came all the way round, back through the part it started from. */
  closed: boolean;
  /** Where the ink stopped short: what the last clip bites (an insulated spot), a loose clip, an open switch's lead. */
  gap: Anchor | null;
  /** Parts and leads it passed through, in order. */
  parts: string[];
  leads: string[];
};

export type TraceOptions = {
  /** Pushbuttons held down (the bench store's `ui.pressed`). */
  pressed?: Readonly<Record<string, boolean>>;
  snapshot?: Snapshot | null;
};

/** Which leads of a part the tracer can pass between: through its body (switches only when closed). */
function passes(part: PlacedPart, opts: TraceOptions): [string, string][] {
  const legs = partLegs(part);
  if (isThrowSwitch(part.kind)) {
    const to = (part.params as { to: "a" | "b" }).to;
    if (part.kind === "dpdt-switch") return [["com1", `${to}1`], ["com2", `${to}2`]];
    return legs.includes(to) ? [["com", to]] : [];
  }
  if (part.kind === "pushbutton") {
    const down = !!opts.pressed?.[part.id] || opts.snapshot?.parts[part.id]?.extra?.["pressed"] === true;
    const nc = !!part.params.normallyClosed;
    return down !== nc ? [["a1", "b1"]] : [];
  }
  if (part.kind === "relay") {
    const closed = opts.snapshot?.parts[part.id]?.closed === true;
    return [["coil1", "coil2"], ["com1", closed ? "no1" : "nc1"]];
  }
  if (part.kind === "fuse" && opts.snapshot?.parts[part.id]?.health === "dead") return [];
  if (part.kind === "trimmer") return [["a", "wiper"], ["wiper", "b"], ["a", "b"]];
  if (part.kind === "box") return part.params.style === "cabinet" ? [] : [["t1", "t2"]];
  if (legs.length === 2) return [[legs[0]!, legs[1]!]];
  return [];
}

/**
 * Traces the loop from a terminal: out along the metal, through the next part, and on, part by part, until it comes
 * back round through the part it started from (closed) or a gap stops it. Where there is a choice it takes the way
 * that closes the loop, else the one that goes furthest. Parts shut in a box count as the box.
 */
export function traceLoop(bench: BenchState, from: Anchor, opts: TraceOptions = {}): Trace {
  const empty: Trace = { from, steps: [], closed: false, gap: from, parts: [], leads: [] };
  // Each clip lead is its own step, so its two clips stay apart (jumpers and strips are plain metal).
  const conn = connectivity(bench, { splitLeads: true, splitProbes: true });
  const start = parseAnchor(from);
  if (!start || !conn.known.has(from)) return empty;
  const pos = (a: Anchor): Vec3 => anchorPosition(bench, a) ?? [0, 0, 0];
  const group = (a: Anchor) => conn.uf.find(a);
  const hidden = hiddenParts(bench);
  const parts = bench.parts.filter((p) => !hidden.has(p.id));
  const startLeg = start.type === "pin" ? start.leg : null;
  const startPart = start.type === "pin" ? bench.parts.find((p) => p.id === start.part) : undefined;
  // The loop closes by coming back through the start part, from another of its leads into `from`.
  const homeLegs = startPart ? passes(startPart, opts).filter(([x, y]) => x === startLeg || y === startLeg).map(([x, y]) => (x === startLeg ? y : x)) : [];

  /** One way on: along a lead or through a part, from anchor `a` to anchor `b`. */
  type Edge = { kind: "lead" | "part"; id: string; from: string; to: string; a: Anchor; b: Anchor };
  const keyOf = (e: Edge) => `${e.kind}:${e.id}`;
  /** Ways on from the anchor we stand on: leads clipped into this metal, parts with a lead in it. */
  const edgesFrom = (at: Anchor): Edge[] => {
    const g = group(at);
    const out: Edge[] = [];
    for (const l of bench.leads) {
      for (const end of ["a", "b"] as const) {
        const a = `lead:${l.id}.${end}`;
        if (group(a) !== g) continue;
        const other = end === "a" ? "b" : "a";
        out.push({ kind: "lead", id: l.id, from: end, to: other, a, b: `lead:${l.id}.${other}` });
      }
    }
    for (const p of parts) {
      for (const [x, y] of passes(p, opts)) {
        for (const [i, o] of [
          [x, y],
          [y, x],
        ] as const) {
          const a = `pin:${p.id}.${i}`;
          if (!conn.known.has(a) || group(a) !== g) continue;
          out.push({ kind: "part", id: p.id, from: i, to: o, a, b: `pin:${p.id}.${o}` });
        }
      }
    }
    return out;
  };

  type Path = { edges: Edge[]; closed: boolean; end: Anchor };
  let best: Path = { edges: [], closed: false, end: from };
  const used = new Set<string>();
  let budget = 4000;
  const walk = (at: Anchor, path: Edge[]) => {
    if (best.closed || --budget < 0) return;
    // Back at another lead of the start part: through it to where we began closes the loop.
    const home = path.length > 0 && startPart ? homeLegs.find((l) => group(`pin:${startPart.id}.${l}`) === group(at)) : undefined;
    if (home !== undefined && startPart && startLeg) {
      best = { edges: [...path, { kind: "part", id: startPart.id, from: home, to: startLeg, a: `pin:${startPart.id}.${home}`, b: from }], closed: true, end: from };
      return;
    }
    if (path.length > best.edges.length) best = { edges: [...path], closed: false, end: at };
    for (const e of edgesFrom(at)) {
      const key = keyOf(e);
      if (used.has(key) || (startPart && key === `part:${startPart.id}`)) continue;
      used.add(key);
      path.push(e);
      walk(e.b, path);
      path.pop();
      used.delete(key);
      if (best.closed) return;
    }
  };
  walk(from, []);

  // Steps with positions, plus the metal hops between one connection point and the next.
  const steps: TraceStep[] = [];
  let here: Anchor = from;
  for (const e of best.edges) {
    const pa = pos(here);
    const pb = pos(e.a);
    if (Math.hypot(pa[0] - pb[0], pa[2] - pb[2]) > 0.6) steps.push({ kind: "metal", a: pa, b: pb });
    if (e.kind === "lead") steps.push({ kind: "lead", id: e.id, from: e.from as "a" | "b", a: pos(e.a), b: pos(e.b) });
    else steps.push({ kind: "part", id: e.id, from: e.from, to: e.to, a: pos(e.a), b: pos(e.b) });
    here = e.b;
  }
  let gap: Anchor | null = null;
  if (!best.closed) {
    const a = parseAnchor(best.end);
    if (a?.type === "lead") {
      const l = bench.leads.find((x) => x.id === a.lead);
      gap = (a.end === "a" ? l?.a.to : l?.b.to) ?? best.end;
    } else gap = best.end;
  }
  return {
    from,
    steps,
    closed: best.closed,
    gap,
    parts: best.edges.filter((e) => e.kind === "part").map((e) => e.id),
    leads: best.edges.filter((e) => e.kind === "lead").map((e) => e.id),
  };
}

/**
 * A sealed box's inside wiring, by net ("t1", "t2", "j1"...): the points it joins, the box's terminal first when the
 * net has one. Both views draw a wire from the first point to each of the others.
 */
export function boxNets(bench: BenchState, box: PlacedPart): Map<string, Vec3[]> {
  const out = new Map<string, Vec3[]>();
  if (box.kind !== "box") return out;
  const wiring = box.params.wiring ?? {};
  const held = heldOf(box);
  const pose = partPose(bench, box);
  for (const [key, net] of Object.entries(wiring)) {
    const dot = key.indexOf(".");
    const id = held[key.slice(0, dot)];
    const part = id ? bench.parts.find((p) => p.id === id) : undefined;
    const p = part ? partPose(bench, part).legs[key.slice(dot + 1)] : undefined;
    if (!p) continue;
    let g = out.get(net);
    if (!g) {
      const t = pose.legs[net];
      g = t ? [[t[0], t[1] - 3, t[2] - 3]] : [];
      out.set(net, g);
    }
    g.push(p);
  }
  return out;
}
