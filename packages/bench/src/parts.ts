// Part catalog: leads, breadboard footprints, defaults and the mapping to simulator PartSpecs. Pure data.

import type { NodeId, PartSpec } from "@ohmland/sim";
import {
  BATTERY,
  BLOCK,
  CERAMIC,
  CUP,
  DIODE,
  LED,
  LEMON,
  NPN,
  RESISTOR,
  TOGGLE_BASE,
  blockPitch,
  electrolyticSize,
  PITCH,
} from "./dims";
import type { BenchPartKind, PartParamsMap, PlacedPart, PlacedPartOf, Vec3, WaterKind } from "./types";

/** A lead position in board pitches at rotation 0, relative to the first lead. */
export type FootprintLeg = { leg: string; dx: number; dz: number };

export type SpanRule = { legs: [string, string]; min: number; max: number; default: number };

export type PartDef<K extends BenchPartKind = BenchPartKind> = {
  kind: K;
  /** Reference designator prefix for new parts. */
  prefix: string;
  /** Physical leads (every lead the kind can have; see `legsFor`). */
  legs: readonly string[];
  /** The leads a part actually has with these params, when that depends on them (a single-pole relay). */
  legsFor?: (params: PartParamsMap[K]) => readonly string[];
  /** Footprint on the board at rotation 0 (absent for desk-only and flying-lead parts). */
  footprint?: (params: PartParamsMap[K]) => FootprintLeg[];
  /** Two-lead axial parts whose lead spacing can be stretched. */
  span?: SpanRule;
  /** Leads on flexible wires that go into holes one by one (battery snap, speaker). */
  flying?: boolean | ((params: PartParamsMap[K]) => boolean);
  /** Leads joined inside the part. */
  bridges?: readonly (readonly [string, string])[];
  defaults: PartParamsMap[K];
  /** Lead end positions when the part lies on the desk, local mm before rotation. */
  deskLegs: (params: PartParamsMap[K]) => Record<string, Vec3>;
  /** Simulator parts for this bench part. `node(leg)` gives the node a lead is on. */
  toSpecs: (part: PlacedPartOf<K>, node: (leg: string) => NodeId) => PartSpec[];
};

const WATER_OHMS: Record<WaterKind, number> = { distilled: 600_000, tap: 30_000, salty: 1_200 };

export function waterOhms(water: WaterKind): number {
  return WATER_OHMS[water];
}

const line = (...legs: string[]): FootprintLeg[] => legs.map((leg, i) => ({ leg, dx: i, dz: 0 }));

/** Upright parts resting on their legs: legs centred on the footprint, ends on the desk. */
function deskFromFootprint(fp: FootprintLeg[], y = 0.6): Record<string, Vec3> {
  const cx = (Math.min(...fp.map((f) => f.dx)) + Math.max(...fp.map((f) => f.dx))) / 2;
  const cz = (Math.min(...fp.map((f) => f.dz)) + Math.max(...fp.map((f) => f.dz))) / 2;
  const out: Record<string, Vec3> = {};
  for (const f of fp) out[f.leg] = [(f.dx - cx) * PITCH, y, (f.dz - cz) * PITCH];
  return out;
}

/** Axial part lying on the desk along x, legs straight out. */
function deskAxial(len: number, dia: number, lead: number, a: string, b: string): Record<string, Vec3> {
  const x = len / 2 + lead * 0.8;
  return { [a]: [-x, dia / 2, 0], [b]: [x, dia / 2, 0] };
}

/** Radial part lying on its side, body toward -x, legs along +x, spread across z. */
function deskRadial(legs: string[], lengths: number[], y: number, spread = PITCH): Record<string, Vec3> {
  const out: Record<string, Vec3> = {};
  const n = legs.length;
  legs.forEach((leg, i) => {
    out[leg] = [(lengths[i] ?? lengths[0]!) * 0.85, y, (i - (n - 1) / 2) * spread];
  });
  return out;
}

const PUSH_FP: FootprintLeg[] = [
  { leg: "a1", dx: 0, dz: 0 },
  { leg: "b1", dx: 2, dz: 0 },
  { leg: "a2", dx: 0, dz: -3 },
  { leg: "b2", dx: 2, dz: -3 },
];

const RELAY_FP: FootprintLeg[] = [
  { leg: "coil1", dx: 0, dz: 0 },
  { leg: "com1", dx: 3, dz: 0 },
  { leg: "nc1", dx: 5, dz: 0 },
  { leg: "no1", dx: 7, dz: 0 },
  { leg: "coil2", dx: 0, dz: -3 },
  { leg: "com2", dx: 3, dz: -3 },
  { leg: "nc2", dx: 5, dz: -3 },
  { leg: "no2", dx: 7, dz: -3 },
];

const TOGGLE_FP: FootprintLeg[] = [
  { leg: "a", dx: 0, dz: 0 },
  { leg: "com", dx: 2, dz: 0 },
  { leg: "b", dx: 4, dz: 0 },
];

const RELAY_1POLE = ["coil1", "coil2", "com1", "nc1", "no1"] as const;

const isBase = (pp: unknown): boolean => !!(pp as { base?: boolean }).base;

/** Screw terminals along the front of a desk block, left to right, for these legs. */
export function blockTerminals(legs: readonly string[]): Record<string, Vec3> {
  const n = legs.length;
  const pitch = blockPitch(n);
  const out: Record<string, Vec3> = {};
  legs.forEach((leg, i) => {
    out[leg] = [(i - (n - 1) / 2) * pitch, BLOCK.h + 1.2, BLOCK.screwZ];
  });
  return out;
}

/** Bendable leads: a radial capacitor's legs reach holes up to seven apart, in any direction. */
const CAP_SPAN = (legs: [string, string], natural: number): SpanRule => ({ legs, min: 1, max: 7, default: natural });

const defs: { [K in BenchPartKind]: PartDef<K> } = {
  resistor: {
    kind: "resistor",
    prefix: "R",
    legs: ["a", "b"],
    span: { legs: ["a", "b"], min: 3, max: 8, default: 4 },
    footprint: () => [
      { leg: "a", dx: 0, dz: 0 },
      { leg: "b", dx: 4, dz: 0 },
    ],
    defaults: { ohms: 470, bands: 4, watts: 0.25, tolerance: 5 },
    deskLegs: () => deskAxial(RESISTOR.len, RESISTOR.dia, RESISTOR.deskLead, "a", "b"),
    toSpecs: (p, n) => {
      // The simulator spreads each part's real value within its tolerance (seeded by id); bands show the nominal.
      const spec: PartSpec = {
        id: p.id,
        kind: "resistor",
        pins: { a: n("a"), b: n("b") },
        ohms: p.params.ohms,
        watts: p.params.watts ?? 0.25,
        tolerance: (p.params.tolerance ?? 5) / 100,
      };
      if (p.params.actualOhms !== undefined) spec.actualOhms = p.params.actualOhms;
      return [spec];
    },
  },
  diode: {
    kind: "diode",
    prefix: "D",
    legs: ["anode", "cathode"],
    span: { legs: ["anode", "cathode"], min: 3, max: 8, default: 4 },
    footprint: () => [
      { leg: "anode", dx: 0, dz: 0 },
      { leg: "cathode", dx: 4, dz: 0 },
    ],
    defaults: { model: "1N4001" },
    deskLegs: () => deskAxial(DIODE.len, DIODE.dia, DIODE.deskLead, "anode", "cathode"),
    toSpecs: (p, n) => [
      { id: p.id, kind: "diode", pins: { anode: n("anode"), cathode: n("cathode") }, model: p.params.model ?? "1N4001" },
    ],
  },
  led: {
    kind: "led",
    prefix: "D",
    legs: ["anode", "cathode"],
    footprint: () => line("anode", "cathode"),
    defaults: { color: "red", size: 5, lens: "diffused" },
    deskLegs: (pp) => {
      const d = LED[pp.size ?? 5];
      return deskRadial(["anode", "cathode"], [d.deskLeadA, d.deskLeadK], d.rim / 2);
    },
    toSpecs: (p, n) => {
      const spec: PartSpec = { id: p.id, kind: "led", pins: { anode: n("anode"), cathode: n("cathode") }, color: p.params.color };
      if (p.params.maxmA !== undefined) spec.maxmA = p.params.maxmA;
      return [spec];
    },
  },
  phototransistor: {
    kind: "phototransistor",
    prefix: "Q",
    legs: ["e", "c"],
    footprint: () => line("e", "c"),
    defaults: { size: 5 },
    deskLegs: (pp) => {
      const d = LED[pp.size ?? 5];
      return deskRadial(["e", "c"], [d.deskLeadA, d.deskLeadK], d.rim / 2);
    },
    toSpecs: (p, n) => [{ id: p.id, kind: "phototransistor", pins: { c: n("c"), e: n("e") } }],
  },
  npn: {
    kind: "npn",
    prefix: "Q",
    legs: ["e", "b", "c"],
    footprint: () => line("e", "b", "c"),
    defaults: { model: "2N3904" },
    // Lies on its rounded back with the marked flat face up; the emitter ends up nearest the viewer.
    deskLegs: () => deskRadial(["c", "b", "e"], [NPN.deskLead], NPN.dia / 2),
    toSpecs: (p, n) => [{ id: p.id, kind: "npn", pins: { c: n("c"), b: n("b"), e: n("e") }, model: p.params.model ?? "2N3904" }],
  },
  "ceramic-cap": {
    kind: "ceramic-cap",
    prefix: "C",
    legs: ["a", "b"],
    span: CAP_SPAN(["a", "b"], 2),
    footprint: () => [
      { leg: "a", dx: 0, dz: 0 },
      { leg: "b", dx: 2, dz: 0 },
    ],
    defaults: { farads: 100e-9, volts: 50 },
    deskLegs: () => deskRadial(["a", "b"], [CERAMIC.deskLead, CERAMIC.deskLead], CERAMIC.thick / 2, PITCH * 2),
    toSpecs: (p, n) => [
      {
        id: p.id,
        kind: "capacitor",
        pins: { pos: n("a"), neg: n("b") },
        farads: p.params.farads,
        volts: p.params.volts ?? 50,
        polarized: false,
        ...(p.params.actualFarads !== undefined ? { actualFarads: p.params.actualFarads } : {}),
      },
    ],
  },
  "electrolytic-cap": {
    kind: "electrolytic-cap",
    prefix: "C",
    legs: ["pos", "neg"],
    span: CAP_SPAN(["pos", "neg"], 1),
    footprint: (pp) => {
      const s = electrolyticSize(pp.farads, pp.volts);
      return [
        { leg: "pos", dx: 0, dz: 0 },
        { leg: "neg", dx: s.pitch, dz: 0 },
      ];
    },
    defaults: { farads: 100e-6, volts: 16 },
    deskLegs: (pp) => {
      const s = electrolyticSize(pp.farads, pp.volts);
      return deskRadial(["pos", "neg"], [16, 14], s.d / 2, s.lead);
    },
    toSpecs: (p, n) => [
      {
        id: p.id,
        kind: "capacitor",
        pins: { pos: n("pos"), neg: n("neg") },
        farads: p.params.farads,
        volts: p.params.volts ?? 16,
        polarized: true,
        ...(p.params.actualFarads !== undefined ? { actualFarads: p.params.actualFarads } : {}),
      },
    ],
  },
  trimmer: {
    kind: "trimmer",
    prefix: "RV",
    legs: ["a", "wiper", "b"],
    footprint: (pp) => (pp.base ? [] : line("a", "wiper", "b")),
    defaults: { ohms: 10_000, position: 0.5 },
    deskLegs: (pp) => (pp.base ? blockTerminals(["a", "wiper", "b"]) : deskFromFootprint(line("a", "wiper", "b"))),
    toSpecs: (p, n) => [
      { id: p.id, kind: "pot", pins: { a: n("a"), wiper: n("wiper"), b: n("b") }, ohms: p.params.ohms, position: p.params.position },
    ],
  },
  "slide-switch": {
    kind: "slide-switch",
    prefix: "S",
    legs: ["a", "com", "b"],
    footprint: (pp) => (pp.base ? [] : line("a", "com", "b")),
    defaults: { to: "a" },
    deskLegs: (pp) => (pp.base ? blockTerminals(["a", "com", "b"]) : deskFromFootprint(line("a", "com", "b"))),
    toSpecs: (p, n) => [{ id: p.id, kind: "spdt", pins: { com: n("com"), a: n("a"), b: n("b") }, to: p.params.to }],
  },
  "toggle-switch": {
    kind: "toggle-switch",
    prefix: "S",
    legs: ["a", "com", "b"],
    legsFor: (pp) => (pp.throws === 1 ? ["com", "b"] : ["a", "com", "b"]),
    // On its wooden block the switch is a desk part with screw terminals; it never goes into the board.
    footprint: (pp) => (pp.base ? [] : TOGGLE_FP),
    defaults: { to: "a" },
    deskLegs: (pp) =>
      pp.base
        ? {
            a: [-TOGGLE_BASE.screwX, TOGGLE_BASE.h + 1.2, TOGGLE_BASE.screwZ],
            com: [pp.throws === 1 ? -TOGGLE_BASE.screwX / 2 : 0, TOGGLE_BASE.h + 1.2, TOGGLE_BASE.screwZ],
            b: [pp.throws === 1 ? TOGGLE_BASE.screwX / 2 : TOGGLE_BASE.screwX, TOGGLE_BASE.h + 1.2, TOGGLE_BASE.screwZ],
          }
        : deskFromFootprint(TOGGLE_FP),
    toSpecs: (p, n) => [{ id: p.id, kind: "spdt", pins: { com: n("com"), a: n("a"), b: n("b") }, to: p.params.to }],
  },
  pushbutton: {
    kind: "pushbutton",
    prefix: "S",
    legs: ["a1", "a2", "b1", "b2"],
    // On a desk block only one terminal per side is brought out.
    legsFor: (pp) => (pp.base ? ["a1", "b1"] : ["a1", "a2", "b1", "b2"]),
    footprint: (pp) => (pp.base ? [] : PUSH_FP),
    bridges: [
      ["a1", "a2"],
      ["b1", "b2"],
    ],
    defaults: { cap: "black" },
    deskLegs: (pp) => (pp.base ? blockTerminals(["a1", "b1"]) : deskFromFootprint(PUSH_FP)),
    toSpecs: (p, n) => [
      { id: p.id, kind: "pushbutton", pins: { a: n("a1"), b: n("b1") }, ...(p.params.normallyClosed ? { normallyClosed: true } : {}) },
    ],
  },
  relay: {
    kind: "relay",
    prefix: "K",
    legs: ["coil1", "coil2", "com1", "nc1", "no1", "com2", "nc2", "no2"],
    legsFor: (pp) => (pp.poles === 1 ? RELAY_1POLE : ["coil1", "coil2", "com1", "nc1", "no1", "com2", "nc2", "no2"]),
    footprint: (pp) => (pp.base ? [] : pp.poles === 1 ? RELAY_FP.filter((f) => !f.leg.endsWith("2") || f.leg === "coil2") : RELAY_FP),
    defaults: { coilVolts: 9, coilOhms: 540, pullIn: 6.75, dropOut: 1.5 },
    deskLegs: (pp) =>
      pp.base
        ? blockTerminals(pp.poles === 1 ? RELAY_1POLE : ["coil1", "coil2", "com1", "nc1", "no1", "com2", "nc2", "no2"])
        : deskFromFootprint(pp.poles === 1 ? RELAY_FP.filter((f) => !f.leg.endsWith("2") || f.leg === "coil2") : RELAY_FP),
    toSpecs: (p, n) => {
      const extra = p.params.coilHenries !== undefined ? { coilHenries: p.params.coilHenries } : {};
      if (p.params.poles === 1) {
        const one = { coilOhms: p.params.coilOhms ?? 540, pullIn: p.params.pullIn ?? 6.75, dropOut: p.params.dropOut ?? 1.5, ...extra };
        return [{ id: p.id, kind: "relay", pins: { coilA: n("coil1"), coilB: n("coil2"), com: n("com1"), no: n("no1"), nc: n("nc1") }, ...one }];
      }
      // The simulator relay has one changeover contact. A DPDT relay becomes two relays whose coils sit in
      // parallel at twice the resistance each: same coil current, same pull-in and drop-out voltages.
      const coilOhms = (p.params.coilOhms ?? 540) * 2;
      const henries = p.params.coilHenries !== undefined ? { coilHenries: p.params.coilHenries * 2 } : {};
      const common = { coilOhms, pullIn: p.params.pullIn ?? 6.75, dropOut: p.params.dropOut ?? 1.5, ...henries };
      return [
        { id: p.id, kind: "relay", pins: { coilA: n("coil1"), coilB: n("coil2"), com: n("com1"), no: n("no1"), nc: n("nc1") }, ...common },
        { id: `${p.id}:2`, kind: "relay", pins: { coilA: n("coil1"), coilB: n("coil2"), com: n("com2"), no: n("no2"), nc: n("nc2") }, ...common },
      ];
    },
  },
  "dpdt-switch": {
    kind: "dpdt-switch",
    prefix: "S",
    legs: ["a1", "com1", "b1", "a2", "com2", "b2"],
    defaults: { to: "a" },
    deskLegs: () => blockTerminals(["a1", "com1", "b1", "a2", "com2", "b2"]),
    toSpecs: (p, n) => [
      { id: p.id, kind: "dpdt", pins: { com1: n("com1"), a1: n("a1"), b1: n("b1"), com2: n("com2"), a2: n("a2"), b2: n("b2") }, to: p.params.to },
    ],
  },
  "touch-pads": {
    kind: "touch-pads",
    prefix: "TP",
    legs: ["a", "b"],
    footprint: () => [
      { leg: "a", dx: 0, dz: 0 },
      { leg: "b", dx: 2, dz: 0 },
    ],
    defaults: { ohms: 2_000_000 },
    deskLegs: () => deskFromFootprint([
      { leg: "a", dx: 0, dz: 0 },
      { leg: "b", dx: 2, dz: 0 },
    ]),
    toSpecs: (p, n) => [{ id: p.id, kind: "probe-resistance", pins: { a: n("a"), b: n("b") }, ohms: p.params.ohms ?? 2_000_000 }],
  },
  fuse: {
    kind: "fuse",
    prefix: "F",
    legs: ["a", "b"],
    footprint: () => [
      { leg: "a", dx: 0, dz: 0 },
      { leg: "b", dx: 4, dz: 0 },
    ],
    defaults: { amps: 1 },
    deskLegs: () => ({ a: [-15.5, 1.6, 0], b: [15.5, 1.6, 0] }),
    toSpecs: (p, n) => [{ id: p.id, kind: "fuse", pins: { a: n("a"), b: n("b") }, amps: p.params.amps }],
  },
  battery: {
    kind: "battery",
    prefix: "B",
    legs: ["pos", "neg"],
    flying: (pp) => !!pp.snap,
    defaults: { snap: false, emf: 9.5, internalOhms: 1.7, mAh: 500 },
    deskLegs: (pp) =>
      pp.snap
        ? { pos: [-24, 0.7, 34], neg: [-12, 0.7, 38] }
        : { pos: [-BATTERY.termSpacing / 2, BATTERY.len - 0.9, 0], neg: [BATTERY.termSpacing / 2, BATTERY.len - 0.9, 0] },
    toSpecs: (p, n) => {
      const spec: PartSpec = {
        id: p.id,
        kind: "battery",
        pins: { pos: n("pos"), neg: n("neg") },
        emf: p.params.emf ?? 9.5,
        internalOhms: p.params.internalOhms ?? 1.7,
      };
      if (p.params.mAh !== undefined) spec.mAh = p.params.mAh;
      return [spec];
    },
  },
  speaker: {
    kind: "speaker",
    prefix: "LS",
    legs: ["a", "b"],
    flying: true,
    defaults: { ohms: 8, size: 40 },
    deskLegs: () => ({ a: [-6, 0.7, 34], b: [6, 0.7, 36] }),
    toSpecs: (p, n) => [{ id: p.id, kind: "speaker", pins: { a: n("a"), b: n("b") }, ohms: p.params.ohms ?? 8 }],
  },
  cup: {
    kind: "cup",
    prefix: "WC",
    legs: ["a", "b"],
    defaults: { water: "tap" },
    deskLegs: () => ({ a: [-12, CUP.water, 2], b: [12, CUP.water, 2] }),
    toSpecs: (p, n) => [
      { id: p.id, kind: "probe-resistance", pins: { a: n("a"), b: n("b") }, ohms: p.params.ohms ?? waterOhms(p.params.water) },
    ],
  },
  lemon: {
    kind: "lemon",
    prefix: "LC",
    legs: ["pos", "neg"],
    defaults: { emf: 0.9, internalOhms: 1000 },
    deskLegs: () => ({
      pos: [-10, LEMON.height + LEMON.stripUp - 2.5, 0],
      neg: [10, LEMON.height + LEMON.stripUp - 2.5, 0],
    }),
    toSpecs: (p, n) => [
      { id: p.id, kind: "cell", pins: { pos: n("pos"), neg: n("neg") }, emf: p.params.emf ?? 0.9, internalOhms: p.params.internalOhms ?? 1000 },
    ],
  },
};

export const PART_KINDS = Object.keys(defs) as BenchPartKind[];

export function partDef<K extends BenchPartKind>(kind: K): PartDef<K> {
  return defs[kind] as unknown as PartDef<K>;
}

export function isFlying(part: PlacedPart): boolean {
  const d = partDef(part.kind) as PartDef;
  const f = d.flying;
  return typeof f === "function" ? (f as (p: unknown) => boolean)(part.params) : !!f;
}

export function canMountOnBoard(part: PlacedPart): boolean {
  return !!partDef(part.kind).footprint && !isFlying(part);
}

/** Footprint of a part at rotation 0 (in pitches, first lead at the origin), respecting its current span. */
export function footprintOf(part: Pick<PlacedPart, "kind" | "params">, span?: number): FootprintLeg[] {
  const d = partDef(part.kind) as PartDef;
  if (!d.footprint) return [];
  const fp = (d.footprint as (p: unknown) => FootprintLeg[])(part.params);
  if (d.span && span !== undefined) {
    return [
      { leg: d.span.legs[0], dx: 0, dz: 0 },
      { leg: d.span.legs[1], dx: span, dz: 0 },
    ];
  }
  return fp;
}

/** Rotate a local (x, z) offset by `rot` degrees around +y, the same way three.js rotation.y does. */
export function rotateXZ(x: number, z: number, rot: number): [number, number] {
  const r = (rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const rx = x * c + z * s;
  const rz = -x * s + z * c;
  return [Math.abs(rx) < 1e-9 ? 0 : rx, Math.abs(rz) < 1e-9 ? 0 : rz];
}

export function defaultParams<K extends BenchPartKind>(kind: K): PartParamsMap[K] {
  return { ...partDef(kind).defaults };
}

/** Switches with a slider or lever thrown to "a" or "b" (flipped by a click, Space or the Flip button). */
export function isThrowSwitch(kind: BenchPartKind): kind is "slide-switch" | "toggle-switch" | "dpdt-switch" {
  return kind === "slide-switch" || kind === "toggle-switch" || kind === "dpdt-switch";
}

/** The leads this part has (a single-pole relay has five, an on/off toggle two, a block pushbutton two). */
export function partLegs(part: Pick<PlacedPart, "kind" | "params">): readonly string[] {
  const d = partDef(part.kind) as PartDef;
  return d.legsFor ? (d.legsFor as (p: unknown) => readonly string[])(part.params) : d.legs;
}

/** A mystery part's permutation as numbers (terminal i is wired as leg perm[i]), or null when it is not one. */
export function mysteryOrder(part: Pick<PlacedPart, "kind" | "params">): number[] | null {
  const m = (part.params as { mystery?: unknown }).mystery;
  if (typeof m !== "string") return null;
  const n = partLegs(part).length;
  const perm = [...m].map(Number);
  if (perm.length !== n || new Set(perm).size !== n || perm.some((k) => !(k >= 0 && k < n))) return null;
  return perm;
}

/**
 * The terminal that is wired inside as leg `fn`. Ordinary parts: `fn` itself. Mystery parts: the leg standing where
 * that terminal is (so a clip on "pin:K1.coil1" touches whatever the shuffle put first).
 */
export function physicalLeg(part: Pick<PlacedPart, "kind" | "params">, fn: string): string {
  const perm = mysteryOrder(part);
  if (!perm) return fn;
  const legs = partLegs(part);
  const i = perm.indexOf(legs.indexOf(fn));
  return i >= 0 ? legs[i]! : fn;
}

/** What a terminal of a mystery part is wired as inside (the inverse of `physicalLeg`). */
export function wiredAs(part: Pick<PlacedPart, "kind" | "params">, leg: string): string {
  const perm = mysteryOrder(part);
  if (!perm) return leg;
  const legs = partLegs(part);
  return legs[perm[legs.indexOf(leg)] ?? -1] ?? leg;
}

/** The number printed by a mystery part's terminal (1 to n, left to right), or null for ordinary parts. */
export function terminalNumber(part: Pick<PlacedPart, "kind" | "params">, leg: string): number | null {
  if (!mysteryOrder(part)) return null;
  const i = partLegs(part).indexOf(leg);
  return i >= 0 ? i + 1 : null;
}

/** A permutation for `n` legs from a seed string (deterministic; never the identity for n > 1). */
export function shuffleFor(seed: string, n: number): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const next = () => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    return h / 4294967296;
  };
  const p = Array.from({ length: n }, (_, i) => i);
  for (let tries = 0; tries < 8; tries++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [p[i], p[j]] = [p[j]!, p[i]!];
    }
    if (n < 2 || p.some((k, i) => k !== i)) break;
  }
  return p.join("");
}
