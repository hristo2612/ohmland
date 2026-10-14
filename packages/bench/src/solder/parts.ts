// Part definitions for the Unit 3 kinds, merged into the catalog in ../parts.ts. Desk geometry lives in GEOM so the
// layout, the spots and both renderers agree.

import type { NodeId, PartSpec } from "@ohmland/sim";
import type { BenchState, PlacedPart, Vec3 } from "../types";
import type { PartDef } from "../parts";
import { ALLOYS } from "./alloys";
import { jointElectric } from "./joint";
import { PERF, hasPad, padLocal, padsOf, perfContacts, perfJointWires } from "./perfboard";
import { NOTCHES } from "./strip";
import { snipEnd, stripNearest, twistEnds } from "./ops";
import { TUBE_SIZES } from "./shrink";
import type { SolderKind } from "../types";

/** Desk geometry of the Unit 3 props (mm, local frame: x right, z toward the viewer, y up). */
export const GEOM = {
  station: {
    /** The base unit (dial, display, switch) and the stand beside it. */
    base: { x: -34, z: 0, w: 66, d: 60, h: 34 },
    display: { x: -34, z: 1, w: 34, d: 13 },
    dial: { x: -34, z: 19, r: 7.5 },
    power: { x: -9, z: 23 },
    stand: { x: 34, z: 2, w: 60, d: 46 },
    sponge: { x: 26, z: 12, w: 26, d: 17 },
    wool: { x: 50, z: -10, r: 9 },
    /** The coil the iron rests in, and the iron lying in it (tip end, grip end). */
    coil: { x: 30, z: -12 },
    ironTip: [16, -22] as [number, number],
    ironGrip: [70, 22] as [number, number],
  },
  spool: { r: 22, w: 28, end: [30, 16] as [number, number] },
  braid: { r: 11, end: [17, 4] as [number, number] },
  clip: { len: 20, w: 7 },
  stripper: { len: 120, w: 26 },
  gun: { len: 150, w: 44, nozzle: [-64, 0] as [number, number] },
  jack: { w: 14, d: 22, h: 11, socket: 17 },
  adapter: { w: 44, d: 36, h: 28 },
  plan: { w: 128, d: 84 },
  tube: { len: 25 },
};

const STEPS = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

type Defs = { [K in SolderKind]: PartDef<K> };

/** Hookup wire ends lying on the desk: straight out either side. */
function wireDeskLegs(len: number): Record<string, Vec3> {
  const h = Math.min(60, len / 2);
  return { a: [-h, 0.8, 0], b: [h, 0.8, 0] };
}

export const SOLDER_DEFS: Defs = {
  "solder-station": {
    kind: "solder-station",
    prefix: "ST",
    legs: [],
    defaults: { on: false, setC: 330, iron: "stand" },
    deskLegs: () => ({}),
    settings: [
      { key: "on", values: [false, true] },
      { key: "setC", values: STEPS(150, 450, 10) },
    ],
    hotspots: (pp) => {
      const g = GEOM.station;
      return [
        { pick: { type: "setting", key: "on", value: !pp.on }, at: [g.power.x, g.base.h, g.power.z], size: [12, 8, 10], on: pp.on },
        { pick: { type: "setting", key: "setC", value: Math.max(150, pp.setC - 10) }, at: [g.dial.x - 7, g.base.h, g.dial.z], size: [8, 8, 14] },
        { pick: { type: "setting", key: "setC", value: Math.min(450, pp.setC + 10) }, at: [g.dial.x + 7, g.base.h, g.dial.z], size: [8, 8, 14] },
      ];
    },
    toSpecs: () => [],
  },
  "solder-spool": {
    kind: "solder-spool",
    prefix: "SD",
    legs: [],
    defaults: { alloy: "lead-free" },
    deskLegs: () => ({}),
    toSpecs: () => [],
  },
  "solder-braid": {
    kind: "solder-braid",
    prefix: "BR",
    legs: [],
    defaults: { used: 0 },
    deskLegs: () => ({}),
    actions: [{ id: "snip", apply: () => ({ used: 0 }) }],
    toSpecs: () => [],
  },
  perfboard: {
    kind: "perfboard",
    prefix: "PB",
    legs: [],
    legsFor: (pp) => padsOf(pp),
    defaults: { cols: 10, rows: 6 },
    // Pads, as seen from above now (mirrored when flipped), on the board's top surface.
    deskLegs: (pp) => Object.fromEntries(padsOf(pp).map((pad) => {
      const l = padLocal(pp, pad)!;
      return [pad, [l[0], PERF.top, l[1]] as Vec3];
    })),
    settings: [
      { key: "flipped", values: [false, true] },
      { key: "flexed", values: [false, true] },
    ],
    contacts: (p, bench) => perfContacts(bench, p),
    toSpecs: (p, _n, ctx) =>
      perfJointWires(ctx.bench, p).map((w) => ({ id: w.id, kind: "wire", pins: { a: ctx.node(w.a), b: ctx.node(w.b) }, ohms: w.ohms }) as PartSpec),
  },
  "plan-card": {
    kind: "plan-card",
    prefix: "PC",
    legs: [],
    defaults: { cols: 10, rows: 6, ghosts: [], lines: [] },
    deskLegs: () => ({}),
    toSpecs: () => [],
  },
  "heat-sink-clip": {
    kind: "heat-sink-clip",
    prefix: "HS",
    legs: [],
    defaults: { metal: "copper", on: null },
    deskLegs: () => ({}),
    settings: [{ key: "metal", values: ["copper", "steel"] }],
    toSpecs: () => [],
  },
  "hookup-wire": {
    kind: "hookup-wire",
    prefix: "HW",
    legs: ["a", "b"],
    flying: true,
    // A wire is one conductor end to end.
    bridges: [["a", "b"]],
    defaults: { color: "red", awg: 22, len: 90 },
    deskLegs: (pp) => wireDeskLegs(pp.len),
    actions: [
      { id: "twist", apply: () => ({}), run: (b, id) => twistEnds(b, id) },
      { id: "snip-a", apply: () => ({}), run: (b, id) => snipEnd(b, id, "a") },
      { id: "snip-b", apply: () => ({}), run: (b, id) => snipEnd(b, id, "b") },
    ],
    contacts: (p) => spliceContacts(p),
    toSpecs: (p, _n, ctx) => spliceWires(p).map((w) => ({ id: w.id, kind: "wire", pins: { a: ctx.node(w.a), b: ctx.node(w.b) }, ohms: w.ohms }) as PartSpec),
  },
  "wire-stripper": {
    kind: "wire-stripper",
    prefix: "WS",
    legs: [],
    defaults: { notch: 22, scale: "solid", stopMm: 10 },
    deskLegs: () => ({}),
    settings: [
      { key: "notch", values: [...NOTCHES] },
      { key: "scale", values: ["solid", "stranded"] },
    ],
    // Strips the wire end lying in its jaws.
    actions: [{ id: "strip", apply: () => ({}), run: (b, id) => stripNearest(b, id) }],
    toSpecs: () => [],
  },
  "heat-shrink": {
    kind: "heat-shrink",
    prefix: "T",
    legs: [],
    defaults: { size: 3.2, on: null, shrink: 0 },
    deskLegs: () => ({}),
    settings: [{ key: "size", values: [...TUBE_SIZES] }],
    toSpecs: () => [],
  },
  "heat-gun": {
    kind: "heat-gun",
    prefix: "HG",
    legs: [],
    defaults: { on: false },
    deskLegs: () => ({}),
    settings: [{ key: "on", values: [false, true] }],
    hotspots: (pp) => [{ pick: { type: "setting", key: "on", value: !pp.on }, at: [34, 30, 0], size: [16, 10, 18], on: pp.on }],
    toSpecs: () => [],
  },
  "barrel-jack": {
    kind: "barrel-jack",
    prefix: "J",
    legs: ["tip", "sleeve"],
    footprint: () => [
      { leg: "tip", dx: 0, dz: 0 },
      { leg: "sleeve", dx: 0, dz: 1 },
    ],
    defaults: {},
    // Lying on the desk, pins toward the viewer.
    deskLegs: () => ({ tip: [-1.27, 1.2, GEOM.jack.d / 2 + 3], sleeve: [1.27, 1.2, GEOM.jack.d / 2 + 3] }),
    toSpecs: () => [],
  },
  "wall-adapter": {
    kind: "wall-adapter",
    prefix: "AD",
    legs: ["plug"],
    flying: true,
    defaults: { volts: 9, amps: 1, type: "regulated", centre: "plus", into: null },
    deskLegs: () => ({ plug: [0, 3, 80] }),
    toSpecs: (p, _n, ctx) => {
      const jack = p.params.into ? ctx.part(p.params.into) : undefined;
      if (!jack || jack.kind !== "barrel-jack") return [];
      const tip = ctx.pin(jack.id, "tip");
      const sleeve = ctx.pin(jack.id, "sleeve");
      const plus = p.params.centre === "minus" ? sleeve : tip;
      const minus = p.params.centre === "minus" ? tip : sleeve;
      return [adapterSpec(p, plus, minus)];
    },
  },
};

/** The simulator supply for an adapter's label. Unregulated "9 V" adapters read high on a light load. */
export function adapterSpec(p: PlacedPart & { kind: "wall-adapter" }, pos: NodeId, neg: NodeId): PartSpec {
  const pp = p.params;
  if (pp.type === "ac") return { id: p.id, kind: "supply", pins: { pos, neg }, emf: pp.emf ?? pp.volts, ac: true, ...(pp.ohms !== undefined ? { ohms: pp.ohms } : {}) };
  if (pp.type === "regulated") return { id: p.id, kind: "supply", pins: { pos, neg }, emf: pp.emf ?? pp.volts, regulated: true, amps: pp.amps, ...(pp.ohms !== undefined ? { ohms: pp.ohms } : {}) };
  // An unregulated adapter: about 1.4 x its label with no load, sagging through its winding, with a filter.
  return {
    id: p.id,
    kind: "supply",
    pins: { pos, neg },
    emf: pp.emf ?? Math.round(pp.volts * 1.45 * 10) / 10,
    ohms: pp.ohms ?? Math.max(1, (pp.volts * 0.3) / Math.max(0.05, pp.amps)),
    filterFarads: pp.filterFarads ?? 400e-6,
  };
}

// Splices: two stripped wire ends soldered together. The joint lives on one of the wires (the one listed first).

function spliceContacts(p: PlacedPart & { kind: "hookup-wire" }): [string, string][] {
  const out: [string, string][] = [];
  for (const end of ["a", "b"] as const) {
    const j = p.params.joints?.[end];
    if (!j) continue;
    const e = jointElectric({ ...j, phase: "set" });
    if (!e.open && !e.intermittent) out.push([`pin:${p.id}.${end}`, `pin:${j.with}`]);
  }
  return out;
}

function spliceWires(p: PlacedPart & { kind: "hookup-wire" }): { id: string; a: string; b: string; ohms: number }[] {
  const out: { id: string; a: string; b: string; ohms: number }[] = [];
  for (const end of ["a", "b"] as const) {
    const j = p.params.joints?.[end];
    if (!j) continue;
    const e = jointElectric({ ...j, phase: "set" });
    if (!e.open && e.intermittent) out.push({ id: `${p.id}:J${end}`, a: `pin:${p.id}.${end}`, b: `pin:${j.with}`, ohms: e.ohms });
  }
  return out;
}

/** The label printed on a spool. */
export const spoolLabel = (alloy: keyof typeof ALLOYS) => ALLOYS[alloy].label;

export { hasPad };
export type { BenchState };
