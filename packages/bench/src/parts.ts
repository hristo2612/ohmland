// Part catalog: leads, breadboard footprints, defaults and the mapping to simulator PartSpecs. Pure data.

import type { NodeId, PartSpec } from "@ohmland/sim";
import { parseAnchor } from "./anchors";
import {
  AA,
  BATTERY,
  BIN,
  BOX,
  CABINET,
  PADLOCK,
  DRAWER,
  GATE,
  OBJECT,
  SCHEM,
  STATIC,
  TRAY,
  CARD,
  BLOCK,
  CERAMIC,
  COIN,
  CUP,
  DIODE,
  ELECTRODE,
  HOLDER,
  LED,
  LEMON,
  NPN,
  RESISTOR,
  RESISTOR_1W,
  RESISTOR_5W,
  RESISTOR_BANDS,
  SAMPLE,
  SKIN,
  STATION,
  TOGGLE_BASE,
  axialLift,
  blockPitch,
  electrolyticSize,
  PITCH,
} from "./dims";
import type { BenchPartKind, BenchState, Moisture, PartParamsMap, PlacedPart, PlacedPartOf, SampleMaterial, SymbolKind, Vec3, WaterKind } from "./types";
import { MCU_LEGS, MCU_SIM_PIN, mcuDeskLegs } from "./mcuBoard";
import { CHIP_DEFS } from "./chips";
import { ALARM_DEFS } from "./alarm";
import { SOLDER_DEFS } from "./solder/parts";

/** A lead position in board pitches at rotation 0, relative to the first lead. */
export type FootprintLeg = { leg: string; dx: number; dz: number };

export type SpanRule = { legs: [string, string]; min: number; max: number; default: number };

/**
 * A seat in a holder: resistor clips, a lemon's electrode slot, a battery test station's bay, a reject bin. The
 * holder keeps who sits where in `params.held` ({ seat: partId }); the held part follows the holder around.
 */
export type SeatDef = {
  name: string;
  /** Kinds that fit. */
  accepts: readonly BenchPartKind[];
  /** A finer test than `accepts` (a 16-pin chip does not fit an 8-pin socket). */
  fits?: (held: PlacedPart) => boolean;
  /**
   * Where the held part's origin sits in the holder's frame (mm, y up), its turn relative to the holder, and `lie`: a
   * 9 V battery laid on its back, terminals toward the back (a sealed box is not deep enough to stand it up). The frame
   * is the holder's body origin, or its footprint centre when it stands in the board (`at.board`, an IC socket).
   */
  place: (held: PlacedPart, at?: { board: boolean }) => { at: Vec3; rot?: number; lie?: boolean };
  /** Metal contacts: a held part's lead -> the holder's lead it touches (leads the held part lacks are ignored). */
  joins?: Readonly<Record<string, string>> | ((held: PlacedPart) => Readonly<Record<string, string>>);
  /** Turning a seated part (R) sets these params on the holder instead (a chip turned round in its socket). */
  turn?: () => Record<string, unknown>;
};

/** A setting the learner can change on a placed part from its selection bar (moisture, a test load switch). */
export type SettingDef = {
  key: string;
  values: readonly (string | number | boolean)[];
  /** More params to set along with a value (a pencil line drawn longer also gets its first layer). */
  also?: (value: string | number | boolean, params: Record<string, unknown>) => Record<string, unknown>;
  /** Shown only when this holds (contact bounce shows once a lab gives the part a `bounce` param). */
  when?: (params: Record<string, unknown>) => boolean;
};

/** A spot on a part's model: clicking a setting sets it; dragging over a "draw" spot draws (the pencil card). */
export type Hotspot = {
  pick: { type: "setting"; key: string; value: string | number | boolean } | { type: "draw" };
  /** Centre (local mm, before the part's turn) and size of the hit box. */
  at: Vec3;
  size: Vec3;
  /** The setting is the current one (for the model's look). */
  on?: boolean;
};

/**
 * A one-shot action on a placed part (erase the pencil line). `run`, when given, changes the whole bench instead (a
 * stripper stripping the wire end in its jaws).
 */
export type ActionDef = {
  id: string;
  apply: (params: Record<string, unknown>) => Record<string, unknown>;
  run?: (bench: BenchState, partId: string) => BenchState;
};

/** What a part's netlist mapping can look up beyond its own leads. */
export type NetContext = {
  part: (id: string) => PlacedPart | undefined;
  /** The node another part's lead is on. */
  pin: (partId: string, leg: string) => NodeId;
  /** The node of any anchor (a perfboard's wire link, another part's lead). */
  node: (anchor: string) => NodeId;
  bench: BenchState;
};

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
  /** Lead positions while the part sits in a holder's seat (local to the seat), when they differ from the desk. */
  heldLegs?: (params: PartParamsMap[K]) => Record<string, Vec3>;
  /** Seats that hold other parts. */
  seats?: (params: PartParamsMap[K]) => SeatDef[];
  /** Settings shown on the selection bar. */
  settings?: readonly SettingDef[];
  /** One-shot actions shown on the selection bar. */
  actions?: readonly ActionDef[];
  /**
   * Clickable or draggable spots on the model (a moisture tab, a load switch, a card's drawing strip), local mm in the
   * part's frame for that mount (first lead's hole on the board, body origin on the desk).
   */
  hotspots?: (params: PartParamsMap[K], mount?: "board" | "desk") => Hotspot[];
  /** Will not seat in the holes (a surface mount chip): dropped over the board it lies askew on top of it. */
  perch?: (params: PartParamsMap[K]) => boolean;
  /** Another name for a lead ("trig" for a 555's pin "2"); anchors and the netlist accept it. */
  alias?: (params: PartParamsMap[K], name: string) => string | null;
  /**
   * A flying lead that is the body's own tip (the logic probe's): it sits at the body origin, is not dragged on its
   * own, and drops into the hole under the part when the part is moved over the board.
   */
  nose?: string;
  /**
   * On the board, a quarter turn that does not fit tries a half turn: a DIP across the channel cannot stand
   * sideways, so turning it turns it round (pin 1 to the far end).
   */
  turnsRound?: boolean;
  /**
   * Insulated spots a clip can bite that join nothing (a battery's plastic wrapper, a switch's wooden block, a paper
   * clip's coating), local mm like `deskLegs`. Their anchors are `pin:<id>.<spot>`; they are not leads.
   */
  spots?: (params: PartParamsMap[K]) => Record<string, Vec3>;
  /**
   * Named points on the model for `part:<id>/<name>` targets (project, focus, notes, tap checks): a schematic's symbols,
   * a padlock's wheels, a gate's unit button, a resistor's bands. Local mm; `at` is how the part is mounted (a resistor
   * on the board sits between its holes, or stands up when they are too close).
   */
  marks?: (params: PartParamsMap[K], at?: MarkMount) => Record<string, Vec3>;
  /** Simulator parts for this bench part. `node(leg)` gives the node a lead is on. */
  toSpecs: (part: PlacedPartOf<K>, node: (leg: string) => NodeId, ctx: NetContext) => PartSpec[];
  /** Metal contacts the part makes between anchors (a perfboard's solder joints, a splice), for connectivity. */
  contacts?: (part: PlacedPartOf<K>, bench: BenchState) => [string, string][];
};

const WATER_OHMS: Record<WaterKind, number> = { distilled: 600_000, tap: 30_000, salty: 1_200 };

export function waterOhms(water: WaterKind): number {
  return WATER_OHMS[water];
}

/**
 * A pinch of salt stirred into a cup: its ions alone would conduct like 7.5 kΩ between the probes. Conductances add,
 * so a pinch in tap water (30 to 40 kΩ) brings it to about 6 kΩ, and each pinch after that lowers it further.
 */
const PINCH_OHMS = 7_500;
/** The most pinches a cup takes (about 750 Ω): past that the water is as salty as it gets here. */
export const SALT_MAX = 10;

/** Resistance between a cup's two probes: its water, plus whatever salt was stirred in. */
export function cupOhms(params: { water: WaterKind; ohms?: number; salt?: number }): number {
  const base = params.ohms ?? waterOhms(params.water);
  const salt = Math.max(0, Math.min(SALT_MAX, params.salt ?? 0));
  return 1 / (1 / base + salt / PINCH_OHMS);
}

type WheelKey = "wheel1" | "wheel2" | "wheel3" | "wheel4";

/**
 * What each wheel of a cabinet's padlock shows: with `faces`, the face it is turned to (null until first turned);
 * without, its answer once `set` (null before).
 */
export function padlockFaces(pp: PartParamsMap["box"]): (string | null)[] {
  const lock = pp.lock;
  if (!lock) return [];
  return lock.wheels.map((answer, i) => {
    const faces = lock.faces?.[i];
    if (!faces) return lock.set[i] ? answer : null;
    const at = pp[`wheel${i + 1}` as WheelKey];
    return at === undefined ? null : (faces[at % faces.length] ?? null);
  });
}

/** Every wheel of the padlock shows its answer: the lid may be lifted. */
export function padlockOpen(pp: PartParamsMap["box"]): boolean {
  const lock = pp.lock;
  if (!lock) return true;
  const shown = padlockFaces(pp);
  return lock.wheels.every((answer, i) => shown[i] === answer);
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

/** The contact bounce a switch or pushbutton was given, for its simulator part. */
const bounceOf = (pp: { bounce?: boolean | number }) => (pp.bounce !== undefined ? { bounce: pp.bounce } : {});

/** Contact bounce on the selection bar, once a lab gives the part a `bounce` param (Unit 4). */
const BOUNCE_SETTING: SettingDef = { key: "bounce", values: [false, true], when: (pp) => pp["bounce"] !== undefined };

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
    marks: (pp, at) => resistorBandMarks(pp, at),
    deskLegs: (pp) => {
      const w = pp.watts ?? 0.25;
      if (w >= 2) return deskAxial(RESISTOR_5W.len, RESISTOR_5W.w, RESISTOR_5W.deskLead, "a", "b");
      if (w >= 0.75) return deskAxial(RESISTOR_1W.len, RESISTOR_1W.dia, RESISTOR_1W.deskLead, "a", "b");
      return deskAxial(RESISTOR.len, RESISTOR.dia, RESISTOR.deskLead, "a", "b");
    },
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
        ...(p.params.tolerance !== undefined ? { tolerance: p.params.tolerance / 100 } : {}),
        ...(p.params.leakOhms !== undefined ? { leakOhms: p.params.leakOhms } : {}),
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
    settings: [BOUNCE_SETTING],
    toSpecs: (p, n) => [{ id: p.id, kind: "spdt", pins: { com: n("com"), a: n("a"), b: n("b") }, to: p.params.to, ...bounceOf(p.params) }],
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
    // The wooden block a desk switch sits on: a clip biting it joins nothing.
    spots: (pp): Record<string, Vec3> => (pp.base ? { base: [-TOGGLE_BASE.w / 2 + 3.6, TOGGLE_BASE.h + 0.4, 1.5] } : {}),
    settings: [BOUNCE_SETTING],
    toSpecs: (p, n) => [{ id: p.id, kind: "spdt", pins: { com: n("com"), a: n("a"), b: n("b") }, to: p.params.to, ...bounceOf(p.params) }],
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
    settings: [BOUNCE_SETTING],
    toSpecs: (p, n) => [
      { id: p.id, kind: "pushbutton", pins: { a: n("a1"), b: n("b1") }, ...(p.params.normallyClosed ? { normallyClosed: true } : {}), ...bounceOf(p.params) },
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
    settings: [BOUNCE_SETTING],
    toSpecs: (p, n) => [
      { id: p.id, kind: "dpdt", pins: { com1: n("com1"), a1: n("a1"), b1: n("b1"), com2: n("com2"), a2: n("a2"), b2: n("b2") }, to: p.params.to, ...bounceOf(p.params) },
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
    deskLegs: (pp) => {
      if (pp.size === "aa") return { pos: [AA.len / 2 + 0.7, AA.lift + AA.dia / 2, 0], neg: [-AA.len / 2 - 0.2, AA.lift + AA.dia / 2, 0] };
      if (pp.size === "coin") return { pos: [COIN.tab, 2.6, 0], neg: [-COIN.tab, 2.6, 0] };
      return pp.snap
        ? { pos: [-24, 0.7, 34], neg: [-12, 0.7, 38] }
        : { pos: [-BATTERY.termSpacing / 2, BATTERY.len - 0.9, 0], neg: [BATTERY.termSpacing / 2, BATTERY.len - 0.9, 0] };
    },
    // The plastic wrapper: on a 9 V battery beside the + snap, on an AA or a coin cell its side.
    spots: (pp): Record<string, Vec3> => {
      if (pp.size === "aa") return { wrap: [-6, AA.lift + AA.dia - 0.4, 0] };
      if (pp.size === "coin") return {};
      return { wrap: [-BATTERY.wid / 2 + 2.6, BATTERY.len - 0.8, BATTERY.thick / 2 - 2.2] };
    },
    // An AA cell set up for it (`xray` given, true or false) can be cut open: tap it to see inside. Other cells are
    // plain batteries to pick up.
    hotspots: (pp) => (pp.size === "aa" && pp.xray !== undefined ? [{ pick: { type: "setting", key: "xray", value: !pp.xray }, at: [-4, AA.lift + AA.dia / 2, 0], size: [32, AA.dia, AA.dia], on: !!pp.xray }] : []),
    toSpecs: (p, n) => {
      const spec: PartSpec = {
        id: p.id,
        kind: "battery",
        pins: { pos: n("pos"), neg: n("neg") },
        emf: p.params.emf ?? 9.5,
        internalOhms: p.params.internalOhms ?? 1.7,
      };
      if (p.params.mAh !== undefined) spec.mAh = p.params.mAh;
      // A starting charge is the simulator's state of charge (only a battery new to the circuit takes it).
      if (p.params.charge !== undefined && spec.kind === "battery") spec.soc = Math.max(0, Math.min(1, p.params.charge));
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
    // A pinch of salt from the selection bar, one per press.
    actions: [{ id: "salt", apply: (pp) => ({ salt: Math.min(SALT_MAX, ((pp["salt"] as number | undefined) ?? 0) + 1) }) }],
    toSpecs: (p, n) => [{ id: p.id, kind: "probe-resistance", pins: { a: n("a"), b: n("b") }, ohms: cupOhms(p.params) }],
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

  // ---- Lab props ----------------------------------------------------------------------------------------------

  holder: {
    kind: "holder",
    prefix: "H",
    legs: ["a", "b"],
    defaults: {},
    deskLegs: () => ({ a: [-HOLDER.termX, HOLDER.h + 2.6, 0], b: [HOLDER.termX, HOLDER.h + 2.6, 0] }),
    seats: () => [
      {
        name: "r",
        accepts: ["resistor", "diode"],
        // Whatever its size, the part's leads run through the clips.
        place: (held) => ({ at: [0, HOLDER.leadY - axialLift(held.kind, held.params as { watts?: number }), 0] }),
        joins: { a: "a", b: "b", anode: "a", cathode: "b" },
      },
    ],
    // Pure metal: the clips join the held part's leads to the terminals (see `joins`).
    toSpecs: () => [],
  },
  station: {
    kind: "station",
    prefix: "T",
    legs: ["a", "b"],
    defaults: { load: false, loadOhms: 100 },
    deskLegs: () => ({ a: [-STATION.postX, STATION.h + STATION.postH, STATION.postZ], b: [STATION.postX, STATION.h + STATION.postH, STATION.postZ] }),
    seats: () => [
      {
        name: "cell",
        accepts: ["battery"],
        // Plus toward the + post on the left: the 9 V battery's round stud is already on its left, AA and coin cells turn.
        place: (held) => {
          const size = held.kind === "battery" ? held.params.size ?? "9v" : "9v";
          return { at: [0, STATION.h, STATION.bayZ], rot: size === "9v" ? 0 : 180 };
        },
        joins: { pos: "a", neg: "b" },
      },
    ],
    settings: [{ key: "load", values: [false, true] }],
    hotspots: (pp) => [{ pick: { type: "setting", key: "load", value: !pp.load }, at: [0, STATION.h + 4, STATION.d / 2 - 12], size: [22, 10, 16] }],
    toSpecs: (p, n) =>
      p.params.load
        ? [{ id: `${p.id}:load`, kind: "resistor", pins: { a: n("a"), b: n("b") }, ohms: p.params.loadOhms ?? 100, watts: 2, tolerance: 0 }]
        : [],
  },
  fruit: {
    kind: "fruit",
    prefix: "FC",
    legs: [],
    defaults: { touching: false },
    deskLegs: () => ({}),
    // Electrodes stand face to the viewer, 22 mm apart; pushed together they overlap face to face.
    seats: (pp) => {
      const x = pp.touching ? 3 : 11;
      const z = pp.touching ? 1.1 : 0;
      return [
        { name: "left", accepts: ["electrode"], place: () => ({ at: [-x, LEMON.height, -z] }) },
        { name: "right", accepts: ["electrode"], place: () => ({ at: [x, LEMON.height, z] }) },
      ];
    },
    settings: [{ key: "touching", values: [false, true] }],
    toSpecs: (p, _n, ctx) => {
      const held = p.params.held ?? {};
      const l = held["left"] ? ctx.part(held["left"]) : undefined;
      const r = held["right"] ? ctx.part(held["right"]) : undefined;
      if (l?.kind !== "electrode" || r?.kind !== "electrode") return [];
      const nl = ctx.pin(l.id, "tip");
      const nr = ctx.pin(r.id, "tip");
      const r0 = p.params.internalOhms ?? 1200;
      if (p.params.touching) return [{ id: p.id, kind: "cell", pins: { pos: nl, neg: nr }, emf: 0, internalOhms: 1 }];
      if (l.params.metal === r.params.metal) return [{ id: p.id, kind: "cell", pins: { pos: nl, neg: nr }, emf: 0.004 * spread(p.id), internalOhms: r0 }];
      const copperLeft = l.params.metal === "copper";
      return [
        {
          id: p.id,
          kind: "cell",
          pins: { pos: copperLeft ? nl : nr, neg: copperLeft ? nr : nl },
          emf: p.params.emf ?? 0.92 + 0.03 * spread(p.id),
          internalOhms: r0,
        },
      ];
    },
  },
  electrode: {
    kind: "electrode",
    prefix: "E",
    legs: ["tip"],
    defaults: { metal: "copper" },
    // Lying flat on the desk: the clip point is the coin's rim or the strip's end.
    deskLegs: (pp) => (pp.metal === "copper" ? { tip: [ELECTRODE.coin / 2 - 1, ELECTRODE.coinT, 0] } : { tip: [ELECTRODE.stripL / 2 - 1.5, ELECTRODE.stripT, 0] }),
    // Standing in a lemon slot (origin on the cut face): the exposed top.
    heldLegs: (pp) => (pp.metal === "copper" ? { tip: [0, ELECTRODE.coin - ELECTRODE.inside - 1.2, 0] } : { tip: [0, ELECTRODE.stripL - ELECTRODE.inside - 2, 0] }),
    toSpecs: () => [],
  },
  skin: {
    kind: "skin",
    prefix: "P",
    legs: ["m0", "m1", "m2", "m3", "m4"],
    defaults: { moisture: "dry", pressure: "light" },
    deskLegs: () => Object.fromEntries([0, 1, 2, 3, 4].map((k) => [`m${k}`, [(k - 2) * SKIN.mark, SKIN.h + 0.2, SKIN.padZ] as Vec3])),
    hotspots: (pp) =>
      SKIN_TABS.map((m, i) => ({
        pick: { type: "setting" as const, key: "moisture", value: m },
        at: skinTab(i),
        size: [20, 4, 12] as Vec3,
        on: pp.moisture === m,
      })),
    // The moisture tabs by name (part:P1/wet), so a lesson can point at one.
    marks: () => Object.fromEntries(SKIN_TABS.map((m, i) => [m, skinTab(i)])),
    settings: [
      { key: "moisture", values: ["dry", "damp", "wet", "salty"] },
      { key: "pressure", values: ["light", "firm"] },
    ],
    // A ladder: each mark meets the skin through a contact resistance, and the skin between marks has its bulk.
    toSpecs: (p, n) => {
      const contact = skinContact(p.params.moisture, p.params.pressure);
      const bulk = SKIN_BULK[p.params.moisture] ?? SKIN_BULK.dry;
      const specs: PartSpec[] = [];
      for (let k = 0; k <= 4; k++) specs.push({ id: `${p.id}:c${k}`, kind: "probe-resistance", pins: { a: n(`m${k}`), b: `${p.id}#${k}` }, ohms: contact });
      for (let k = 0; k < 4; k++) specs.push({ id: `${p.id}:s${k}`, kind: "probe-resistance", pins: { a: `${p.id}#${k}`, b: `${p.id}#${k + 1}` }, ohms: bulk });
      return specs;
    },
  },
  sample: {
    kind: "sample",
    prefix: "P",
    legs: ["a", "b"],
    defaults: { material: "copper" },
    deskLegs: (pp) => {
      if (pp.material === "plastic") return { a: [-SAMPLE.ruler / 2 + 9, SAMPLE.rulerT + 0.1, 3], b: [SAMPLE.ruler / 2 - 9, SAMPLE.rulerT + 0.1, 3] };
      if (pp.material === "copper") return { a: [-SAMPLE.wire / 2 + 3, SAMPLE.wireR * 2, 0], b: [SAMPLE.wire / 2 - 3, SAMPLE.wireR * 2, 0] };
      const o = OBJECT[pp.material];
      const y = pp.material === "marble" ? o.t / 2 : o.t;
      // The coated paper clip's two cut ends poke out of its loops, one each side (see CLIP_PATH).
      if (pp.material === "clip") return { a: [CLIP_PATH.a[0], y, CLIP_PATH.a[1]], b: [CLIP_PATH.b[0], y, CLIP_PATH.b[1]] };
      return { a: [-o.len / 2 + o.clip, y, 0], b: [o.len / 2 - o.clip, y, 0] };
    },
    // A coated paper clip is bare only at its cut ends: a clip on the coating joins nothing.
    spots: (pp): Record<string, Vec3> => (pp.material === "clip" ? { coat: [CLIP_PATH.coat[0], OBJECT.clip.t, CLIP_PATH.coat[1]] } : {}),
    toSpecs: (p, n) => [{ id: p.id, kind: "probe-resistance", pins: { a: n("a"), b: n("b") }, ohms: p.params.ohms ?? materialOhms(p.params.material) }],
  },
  card: {
    kind: "card",
    prefix: "P",
    legs: Array.from({ length: 21 }, (_, k) => `p${k}`),
    defaults: { length: 0, layers: 0, wide: false },
    deskLegs: () => Object.fromEntries(Array.from({ length: 21 }, (_, k) => [`p${k}`, [CARD.x0 + k * 5, CARD.t + 0.15, CARD.lineZ] as Vec3])),
    settings: [
      {
        key: "length",
        values: Array.from({ length: 19 }, (_, k) => 1 + k * 0.5),
        also: (_v, pp) => ((pp["layers"] as number) > 0 ? {} : { layers: 1 }),
      },
      { key: "layers", values: [1, 2, 3, 4], also: (_v, pp) => ((pp["length"] as number) > 0 ? {} : { length: 5 }) },
      { key: "wide", values: [false, true] },
    ],
    actions: [{ id: "erase", apply: () => ({ length: 0, layers: 0 }) }],
    // The strip the pencil runs along, from just before the 0 mark to just past 10 cm.
    hotspots: () => [{ pick: { type: "draw" }, at: [CARD.x0 + 50, CARD.t + 1, CARD.lineZ], size: [112, 3, 16] }],
    // Each probe point meets the graphite through about 1 kΩ; the line itself is 20 kΩ per cm for one narrow layer.
    toSpecs: (p, n) => {
      const segs = Math.round(Math.max(0, Math.min(10, p.params.length)) * 2);
      const layers = Math.max(0, Math.min(4, Math.round(p.params.layers)));
      if (!segs || !layers) return [];
      const seg = PENCIL_PER_CM / 2 / layers / (p.params.wide ? 2 : 1);
      const specs: PartSpec[] = [];
      for (let k = 0; k <= segs; k++) specs.push({ id: `${p.id}:c${k}`, kind: "probe-resistance", pins: { a: n(`p${k}`), b: `${p.id}#${k}` }, ohms: PENCIL_CONTACT });
      for (let k = 0; k < segs; k++) specs.push({ id: `${p.id}:s${k}`, kind: "probe-resistance", pins: { a: `${p.id}#${k}`, b: `${p.id}#${k + 1}` }, ohms: seg });
      return specs;
    },
  },
  tag: {
    kind: "tag",
    prefix: "L",
    legs: [],
    defaults: { text: "" },
    deskLegs: () => ({}),
    // Tap the label: the value written out without its prefix, and back.
    hotspots: (pp) => [{ pick: { type: "setting", key: "alt", value: !pp.alt }, at: [1, 0.5, 0], size: [22, 2, 12], on: !!pp.alt }],
    marks: () => ({ text: [1.6, 0.6, 0] }),
    toSpecs: () => [],
  },
  bin: {
    kind: "bin",
    prefix: "BIN",
    legs: [],
    defaults: {},
    deskLegs: () => ({}),
    seats: (pp) => {
      const accepts = pp.accepts ?? (pp.style === "drawer" && pp.face ? FACE_KINDS[pp.face] : pp.style === "tray" ? TRAY_KINDS : BIN_KINDS);
      if (pp.style === "tray") {
        return [0, 1, 2, 3, 4].map((i) => ({ name: `s${i + 1}`, accepts, place: () => ({ at: [(i - 2) * 24, 2.6, -4] as Vec3, rot: 90 }) }));
      }
      if (pp.style === "drawer") {
        return [0, 1, 2].map((i) => ({ name: `s${i + 1}`, accepts, place: (held: PlacedPart) => ({ at: [(i - 1) * 20, 2.4, -4] as Vec3, rot: held.kind === "battery" ? 0 : 90 }) }));
      }
      return [0, 1, 2, 3, 4].map((i) => ({ name: `s${i + 1}`, accepts, place: () => ({ at: [(i - 2) * 12, 2.4, 0] as Vec3, rot: 90 }) }));
    },
    marks: (pp): Record<string, Vec3> => (pp.style === "drawer" ? { face: [0, DRAWER.h * 0.6, DRAWER.d / 2 + 1] } : pp.style === "tray" ? { label: [0, TRAY.h, TRAY.d / 2 + 2] } : { label: [0, BIN.h, BIN.d / 2 + 2] }),
    toSpecs: () => [],
  },
  chart: { kind: "chart", prefix: "CH", legs: [], defaults: { bands: 4 }, deskLegs: () => ({}), toSpecs: () => [] },
  clock: { kind: "clock", prefix: "CK", legs: [], defaults: {}, deskLegs: () => ({}), toSpecs: () => [] },
  showcase: { kind: "showcase", prefix: "SC", legs: [], defaults: {}, deskLegs: () => ({}), toSpecs: () => [] },

  // ---- Start here -------------------------------------------------------------------------------------------------

  gate: {
    kind: "gate",
    prefix: "G",
    legs: [],
    defaults: { mode: "ticks", unit: "A" },
    deskLegs: () => ({}),
    // In number mode the unit on the flag is a button: A or mA.
    // (The flag stands above the collar in 3D and is drawn up the page in ink: z is -lift there.)
    hotspots: (pp) => (pp.mode === "number" ? [{ pick: { type: "setting", key: "unit", value: pp.unit === "mA" ? "A" : "mA" }, at: [GATE.flagW / 2 - 5.8, GATE.lift, -GATE.lift], size: [10, 9, 9] }] : []),
    marks: () => ({ flag: [0, GATE.lift, 0], unit: [GATE.flagW / 2 - 5.8, GATE.lift, 0] }),
    settings: [
      { key: "mode", values: ["ticks", "number"] },
      { key: "unit", values: ["A", "mA"] },
    ],
    toSpecs: () => [],
  },
  box: {
    kind: "box",
    prefix: "BX",
    legs: ["t1", "t2"],
    legsFor: (pp) => (pp.style === "cabinet" ? [] : ["t1", "t2"]),
    defaults: { lid: false, marks: "pm" },
    deskLegs: (pp): Record<string, Vec3> => (pp.style === "cabinet" ? {} : { t1: [-BOX.termX, BOX.h + 3.6, BOX.d / 2 - BOX.strip / 2], t2: [BOX.termX, BOX.h + 3.6, BOX.d / 2 - BOX.strip / 2] }),
    seats: (pp) => {
      const cab = pp.style === "cabinet";
      const floor = cab ? CABINET.wall : BOX.wall;
      const spots: [number, number][] = cab
        ? [-62, -21, 21, 62].flatMap((x) => [[x, -24], [x, 12]] as [number, number][])
        : [[-20, -7], [27, -7], [-20, 12], [27, 12]];
      const wiring = pp.wiring ?? {};
      return spots.map(([x, z], i) => {
        const name = `s${i + 1}`;
        const joins: Record<string, string> = {};
        for (const [k, v] of Object.entries(wiring)) if (k.startsWith(`${name}.`)) joins[k.slice(name.length + 1)] = v;
        return {
          name,
          accepts: BOX_KINDS,
          place: (held: PlacedPart) => {
            if (held.kind === "battery" && (held.params.size ?? "9v") === "9v" && !held.params.snap) {
              // A 9 V battery lies on its back, its snaps toward the back of the box.
              const front = (cab ? CABINET.d / 2 - CABINET.strip : BOX.d / 2 - BOX.strip) - 4;
              return { at: [x, floor + BATTERY.thick / 2, Math.min(z + BATTERY.len / 2, front)] as Vec3, lie: true };
            }
            // An AA lies plus to the left, by the + terminal (so its wires do not cross).
            return { at: [x, floor, z] as Vec3, rot: held.kind === "battery" && held.params.size === "aa" ? 180 : 0 };
          },
          joins,
        };
      });
    },
    settings: [{ key: "lid", values: [false, true] }],
    // The lid: tap it to open it (a closed cabinet stays locked while its padlock has wheels to set).
    hotspots: (pp) => {
      const cab = pp.style === "cabinet";
      const W = cab ? CABINET.w : BOX.w;
      const D = cab ? CABINET.d : BOX.d;
      const H = cab ? CABINET.h : BOX.h;
      const strip = cab ? CABINET.strip : BOX.strip;
      const locked = cab && !!pp.lock && !padlockOpen(pp) && !pp.lid;
      const lidD = D - strip;
      // Shut, the whole lid opens it; open, the lid standing up at the back shuts it (the parts inside stay reachable).
      const lid: Hotspot = pp.lid
        ? { pick: { type: "setting", key: "lid", value: false }, at: [0, H + lidD * 0.4, -D / 2 - lidD * 0.16], size: [W - 8, lidD * 0.8, lidD * 0.32], on: true }
        : { pick: { type: "setting", key: "lid", value: true }, at: [0, H, -strip / 2], size: [W - 8, 6, lidD - 6] };
      const out: Hotspot[] = locked ? [] : [lid];
      // A padlock with faces: tap a wheel to turn it to its next face.
      const faces = cab && !pp.lid ? pp.lock?.faces : undefined;
      if (faces) {
        const n = faces.length;
        faces.forEach((f, i) => {
          const at = pp[`wheel${i + 1}` as WheelKey];
          const next = at === undefined ? 0 : (at + 1) % Math.max(1, f.length);
          out.push({ pick: { type: "setting", key: `wheel${i + 1}`, value: next }, at: [(i - (n - 1) / 2) * PADLOCK.wheel, H + 3, D / 2 - strip / 2], size: [PADLOCK.wheel - 2, 6, 12] });
        });
      }
      if (pp.tag) out.push({ pick: { type: "setting", key: "tagAlt", value: !pp.tagAlt }, at: [W / 2 + 8, H * 0.5, D / 2 - 6], size: [22, 6, 14], on: !!pp.tagAlt });
      return out;
    },
    marks: (pp) => {
      const cab = pp.style === "cabinet";
      const D = cab ? CABINET.d : BOX.d;
      const H = cab ? CABINET.h : BOX.h;
      const strip = cab ? CABINET.strip : BOX.strip;
      const out: Record<string, Vec3> = { lid: [0, H, -strip / 2], front: [0, H, D / 2 - strip / 2] };
      if (pp.knob) out.knob = [0, H + 4, D / 2 - strip / 2];
      if (pp.tag) out.tag = [(cab ? CABINET.w : BOX.w) / 2 + 8, H * 0.5, D / 2 - 6];
      if (pp.lock) pp.lock.wheels.forEach((_, i) => (out[`wheel${i + 1}`] = [(i - (pp.lock!.wheels.length - 1) / 2) * PADLOCK.wheel, H + 2, D / 2 - strip / 2]));
      return out;
    },
    // Pure metal: the seats join the held parts' leads to the terminals and to each other (see `wiring`).
    toSpecs: () => [],
  },
  schematic: {
    kind: "schematic",
    prefix: "SD",
    legs: [],
    defaults: { symbols: [] },
    deskLegs: () => ({}),
    // The torn-off symbol's place is a seat: a piece dropped near it lies in the gap (`turn` decides which way).
    seats: (pp) => {
      if (pp.torn === undefined) return [];
      const [x, z] = schematicSlot(pp.symbols.length, pp.torn);
      return [{ name: "torn", accepts: ["piece"], place: () => ({ at: [x, SCHEM.t + 0.2, z] }) }];
    },
    marks: (pp) => {
      const out: Record<string, Vec3> = {};
      pp.symbols.forEach((sym, i) => {
        const [x, z] = schematicSlot(pp.symbols.length, i);
        out[sym.part ?? `s${i + 1}`] = [x, SCHEM.t, z];
      });
      return out;
    },
    toSpecs: () => [],
  },
  piece: {
    kind: "piece",
    prefix: "PC",
    legs: [],
    defaults: { symbol: "led", turn: 0 },
    deskLegs: () => ({}),
    // Tap it to turn it a quarter (it can be turned while it sits in the card's gap, too).
    hotspots: (pp) => [{ pick: { type: "setting", key: "turn", value: (((pp.turn ?? 0) + 90) % 360 + 360) % 360 }, at: [0, 0.8, 0], size: [SCHEM.piece - 6, 2, SCHEM.piece - 6] }],
    toSpecs: () => [],
  },
  balloon: { kind: "balloon", prefix: "BL", legs: [], defaults: { color: "red" }, deskLegs: () => ({}), marks: () => ({ patch: [0, STATIC.balloon * 0.9, STATIC.balloon * 0.3] }), toSpecs: () => [] },
  scarf: { kind: "scarf", prefix: "SF", legs: [], defaults: {}, deskLegs: () => ({}), toSpecs: () => [] },
  paper: { kind: "paper", prefix: "PB", legs: [], defaults: {}, deskLegs: () => ({}), toSpecs: () => [] },
  comb: { kind: "comb", prefix: "CB", legs: [], defaults: {}, deskLegs: () => ({}), toSpecs: () => [] },
  wall: { kind: "wall", prefix: "WL", legs: [], defaults: {}, deskLegs: () => ({}), toSpecs: () => [] },
  // ---- Unit 5 ---------------------------------------------------------------------------------------------------

  "mcu-board": {
    kind: "mcu-board",
    prefix: "U",
    legs: MCU_LEGS,
    // The two GND sockets are one conductor on the board.
    bridges: [["gnd", "gnd2"]],
    defaults: { power: "usb" },
    deskLegs: () => mcuDeskLegs(),
    toSpecs: (p, n) => {
      const pins: Record<string, NodeId> = {};
      for (const leg of MCU_LEGS) if (leg !== "gnd2") pins[MCU_SIM_PIN[leg]] = n(leg);
      const spec: PartSpec = { id: p.id, kind: "mcuboard", pins, power: p.params.power ?? "usb" };
      if (p.params.program !== undefined) spec.program = p.params.program;
      if (p.params.upload !== undefined) spec.upload = p.params.upload;
      if (p.params.clockStart !== undefined) spec.clockStart = p.params.clockStart;
      if (p.params.seed !== undefined) spec.seed = p.params.seed;
      return [spec];
    },
  },
  // ---- Chips (Unit 4): see chips.ts ------------------------------------------------------------------------------
  ...CHIP_DEFS,
  // ---- Unit 4's door guard: a door with a reed switch, plug-in modules (see alarm.ts) ----------------------------
  ...ALARM_DEFS,
  // ---- Unit 3: soldering, perfboard, wire and power from the wall (src/solder) ---------------------------------
  ...SOLDER_DEFS,
};

/**
 * The coated paper clip, lying flat (x, z in mm): the bare cut end `a` pokes out left of the outer loop, `b` out right
 * of the inner tongue, and `coat` is a spot on the plastic coating. `coated` is the coated wire as an SVG path.
 */
export const CLIP_PATH = {
  a: [-15.8, 3.2] as [number, number],
  b: [15.8, 1.6] as [number, number],
  coat: [0, -3.8] as [number, number],
  coated: "M-12.4 3.2H10A3.5 3.5 0 0 0 10 -3.8H-10A2.7 2.7 0 0 0 -10 1.6H12.4",
  bare: "M-15.8 3.2H-12.4M12.4 1.6H15.8",
};

/** Where symbol `i` of `n` sits on a schematic card's loop (card mm): the first on the left, the rest clockwise. */
export function schematicSlot(n: number, i: number): [number, number] {
  const W = SCHEM.loopW / 2;
  const D = SCHEM.loopD / 2;
  const z0 = 4;
  if (n <= 1) return [-W, z0];
  if (n === 2) return i === 0 ? [-W, z0] : [W, z0];
  if (n === 3) return ([[-W, z0], [0, z0 - D], [W, z0]] as [number, number][])[i]!;
  return ([[-W, z0], [0, z0 - D], [W, z0], [0, z0 + D]] as [number, number][])[i % 4]!;
}

/** The kinds a drawer with this symbol on it takes (when it sets no `accepts`). */
const FACE_KINDS: Record<SymbolKind, BenchPartKind[]> = {
  battery: ["battery"],
  cell: ["battery"],
  resistor: ["resistor"],
  led: ["led"],
  switch: ["toggle-switch", "slide-switch", "pushbutton"],
  lamp: ["led"],
};
const BIN_KINDS: BenchPartKind[] = ["resistor", "led", "fuse", "diode", "sample"];
const TRAY_KINDS: BenchPartKind[] = ["sample", "resistor", "led", "diode", "fuse", "electrode", "battery", "tag"];
const BOX_KINDS: BenchPartKind[] = ["battery", "resistor", "trimmer", "led", "diode", "toggle-switch", "slide-switch", "pushbutton", "fuse", "tag", "sample", "electrolytic-cap", "ceramic-cap"];

/** Resistance between a material sample's two clip points. */
export function materialOhms(material: SampleMaterial): number {
  return MATERIAL_OHMS[material] ?? 1e13;
}

const MATERIAL_OHMS: Record<SampleMaterial, number> = {
  copper: 0.02,
  plastic: 1e13,
  key: 0.02,
  coin: 0.02,
  foil: 0.01,
  pencil: 5,
  spoon: 1e13,
  "metal-spoon": 0.02,
  eraser: 1e13,
  marble: 1e13,
  wood: 1e12,
  string: 1e12,
  clip: 0.03,
};

/** The materials that let flow through (the junk drawer's "conductors"). */
export function conducts(material: SampleMaterial): boolean {
  return materialOhms(material) < 1e3;
}

// Material numbers for the lab props (docs/curriculum/unit-1.md, L4 and L5).

const SKIN_CONTACT: Record<Moisture, [number, number]> = { dry: [400e3, 250e3], damp: [80e3, 50e3], wet: [18e3, 12e3], salty: [4e3, 3e3] };
const SKIN_BULK: Record<Moisture, number> = { dry: 20e3, damp: 10e3, wet: 5e3, salty: 2e3 };
/** The skin patch's moisture tabs, left to right along the front of its base, and where each one sits (local mm). */
const SKIN_TABS = ["dry", "damp", "wet", "salty"] as const;
function skinTab(i: number): Vec3 {
  return [(i - 1.5) * 22, SKIN.base + 1, SKIN.baseD / 2 - 9];
}

function skinContact(moisture: Moisture, pressure: "light" | "firm"): number {
  const c = SKIN_CONTACT[moisture] ?? SKIN_CONTACT.dry;
  return pressure === "firm" ? c[1] : c[0];
}

/** Resistance between two skin marks `cm` apart: a contact at each probe plus the skin between them. */
export function skinOhms(moisture: Moisture, pressure: "light" | "firm", cm: number): number {
  return 2 * skinContact(moisture, pressure) + cm * (SKIN_BULK[moisture] ?? SKIN_BULK.dry);
}

const PENCIL_CONTACT = 1000;
const PENCIL_PER_CM = 20_000;

/** Resistance of a pencil line between two probe points `cm` apart. */
export function pencilOhms(cm: number, layers: number, wide = false): number {
  return 2 * PENCIL_CONTACT + (PENCIL_PER_CM * cm) / Math.max(1, layers) / (wide ? 2 : 1);
}

/** A repeatable number in [-1, 1] from a part id (a seeded spread, as the simulator does for tolerances). */
function spread(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (((h >>> 0) % 2001) - 1000) / 1000;
}

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

/**
 * The lead a name stands for on this part: the name itself when the part has that lead, else what its kind calls it
 * ("trig" is a 555's lead "2", "co" a 4026B's "5"), else null.
 */
export function resolveLeg(part: Pick<PlacedPart, "kind" | "params">, name: string): string | null {
  const legs = partLegs(part);
  if (legs.includes(name)) return name;
  const d = partDef(part.kind) as PartDef;
  const a = d.alias ? (d.alias as (p: unknown, n: string) => string | null)(part.params, name) : null;
  return a && legs.includes(a) ? a : null;
}

/** A pin anchor with its lead's alias resolved ("pin:U1.trig" -> "pin:U1.2"); other anchors unchanged. */
export function canonicalAnchor(parts: readonly PlacedPart[], anchor: string): string {
  const a = parseAnchor(anchor);
  if (a?.type !== "pin") return anchor;
  const part = parts.find((p) => p.id === a.part);
  const leg = part ? resolveLeg(part, a.leg) : null;
  return leg && leg !== a.leg ? `pin:${a.part}.${leg}` : anchor;
}

/** True for a part whose legs will not seat in the holes (a surface mount chip): over the board it lies on top. */
export function perches(part: Pick<PlacedPart, "kind" | "params">): boolean {
  const d = partDef(part.kind) as PartDef;
  return !!d.perch && (d.perch as (p: unknown) => boolean)(part.params);
}

/** Insulated spots a clip can bite on this part (local mm), keyed by name. */
export function partSpots(part: Pick<PlacedPart, "kind" | "params">): Record<string, Vec3> {
  const d = partDef(part.kind) as PartDef;
  return d.spots ? (d.spots as (p: unknown) => Record<string, Vec3>)(part.params) : {};
}

/**
 * Props that carry print the learner reads (a colour chart, a value tag, a card's ruler, a drawing, a bin's label, a
 * clock face): a beat about one of them frames it close, and the 3D view keeps it upright on a tall screen.
 */
export const PRINTED_KINDS: ReadonlySet<string> = new Set(["chart", "tag", "card", "schematic", "bin", "clock"]);

/**
 * Parts read the right way up: the printed props, a chip's printed number, a display's digits, a regulator's type, a
 * DIP switch's numbers. A beat about one of them never turns the 3D view a quarter on a tall screen.
 */
export const UPRIGHT_KINDS: ReadonlySet<string> = new Set([...PRINTED_KINDS, "chip", "sevenseg", "regulator7805", "dip-switch"]);

/** Named points on this part for `part:<id>/<name>` targets (local mm). */
export function partMarks(part: Pick<PlacedPart, "kind" | "params">, at?: MarkMount): Record<string, Vec3> {
  const d = partDef(part.kind) as PartDef;
  return d.marks ? (d.marks as (p: unknown, at?: MarkMount) => Record<string, Vec3>)(part.params, at) : {};
}

/** How a part is mounted, for marks that depend on it: on the desk, or on the board `span` holes apart. */
export type MarkMount = { mount: "board" | "desk"; span?: number };

/**
 * A resistor's colour bands (`band1` toward lead a ... `band4` or `band5`), on top of the body as the 3D model draws
 * them: a 1 W body is the 1/4 W one scaled up; a ceramic block has none. The ink view draws desk parts larger than
 * life and places its bands itself (ink/kinds/axial.tsx, resistorBandX).
 */
function resistorBandMarks(pp: PartParamsMap["resistor"], at?: MarkMount): Record<string, Vec3> {
  const w = pp.watts ?? 0.25;
  const board = at?.mount === "board";
  if (!board && w >= 2) return {};
  const centres = RESISTOR_BANDS[pp.bands === 5 ? 5 : 4];
  const out: Record<string, Vec3> = {};
  if (board) {
    const L = (at?.span ?? 4) * PITCH;
    const half = RESISTOR.len / 2 + 0.32;
    // Holes too close for the body: it stands on one lead, its bands up the side.
    const upright = L < half * 2 + 1.6;
    centres.forEach((c, i) => (out[`band${i + 1}`] = upright ? [RESISTOR.dia / 2, 0.9 + half + c, 0] : [L / 2 + c, RESISTOR.lift + RESISTOR.dia, 0]));
    return out;
  }
  const big = w >= 0.75;
  const k = big ? RESISTOR_1W.len / RESISTOR.len : 1;
  const top = big ? RESISTOR_1W.dia : RESISTOR.dia;
  centres.forEach((c, i) => (out[`band${i + 1}`] = [c * k, top, 0]));
  return out;
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
