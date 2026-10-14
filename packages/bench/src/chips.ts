// Unit 4 parts: DIP chips (and a surface mount lookalike that will not seat), IC sockets, the 7-segment display, the
// 7805 regulator, the DIP switch, the logic probe, AA battery packs and an adjustable bench supply. Pure data: pin
// tables, sizes and part definitions, spread into the catalog in parts.ts.
//
// The bench never imports the simulator at run time, so the pin tables live here as well; test/chips.test.ts checks
// them against the simulator's own (TIMER555_PINS, LOGIC_PINOUTS, SEVENSEG_PINS, REGULATOR7805_PINS).

import type { NodeId, PartSpec } from "@ohmland/sim";
import { PITCH, boardGeometry, boardOrigin } from "./board";
import { BOARD_TOP } from "./dims";
import type { FootprintLeg, Hotspot, PartDef } from "./parts";
import type { BenchState, ChipKind, ChipModel, DipKey, PlacedPart, Vec2, Vec3 } from "./types";

// ---------------------------------------------------------------------------------------------------------------
// Pin tables (pin 1 first).

const TIMER555 = ["gnd", "trig", "out", "reset", "ctrl", "thresh", "dis", "vcc"] as const;
const QUAD2 = ["a1", "b1", "y1", "a2", "b2", "y2", "gnd", "y3", "a3", "b3", "y4", "a4", "b4", "vcc"] as const;
const HEX1 = ["a1", "y1", "a2", "y2", "a3", "y3", "gnd", "y4", "a4", "y5", "a5", "y6", "a6", "vcc"] as const;

/** Function names of a chip's pins in pin-number order (the simulator's netlist pin names). */
export const CHIP_PINOUTS: Record<ChipModel, readonly string[]> = {
  "555": TIMER555,
  "555-cmos": TIMER555,
  "74HC00": QUAD2,
  "74HC08": QUAD2,
  "74HC32": QUAD2,
  "74HC86": QUAD2,
  // The NOR has its outputs first in each group (pins 1, 4, 10, 13): the same names in other holes.
  "74HC02": ["y1", "a1", "b1", "y2", "a2", "b2", "gnd", "a3", "b3", "y3", "a4", "b4", "y4", "vcc"],
  "74HC04": HEX1,
  "74HC14": HEX1,
  "74HC27": ["a1", "b1", "a2", "b2", "c2", "y2", "gnd", "y3", "a3", "b3", "c3", "y1", "c1", "vcc"],
  "74HC74": ["clr1", "d1", "clk1", "pre1", "q1", "qn1", "gnd", "qn2", "q2", "pre2", "clk2", "d2", "clr2", "vcc"],
  "74HC393": ["clk1", "clr1", "qa1", "qb1", "qc1", "qd1", "gnd", "qd2", "qc2", "qb2", "qa2", "clr2", "clk2", "vcc"],
  "4026B": ["clk", "inh", "dei", "deo", "co", "f", "g", "vss", "d", "a", "e", "b", "c", "ucs", "rst", "vdd"],
};

/** The part number printed on each chip, in our own type (generic numbers, no maker names). */
export const CHIP_PRINT: Record<ChipModel, string> = {
  "555": "NE555",
  "555-cmos": "7555",
  "74HC00": "74HC00",
  "74HC02": "74HC02",
  "74HC04": "74HC04",
  "74HC08": "74HC08",
  "74HC14": "74HC14",
  "74HC27": "74HC27",
  "74HC32": "74HC32",
  "74HC74": "74HC74",
  "74HC86": "74HC86",
  "74HC393": "74HC393",
  "4026B": "CD4026B",
};

export const CHIP_MODELS = Object.keys(CHIP_PINOUTS) as ChipModel[];

/** Pins of a chip's package: 8 for timers, 14 for the 74HC parts, 16 for the 4026B. */
export function chipPinCount(model: ChipModel): 8 | 14 | 16 {
  return (CHIP_PINOUTS[model]?.length ?? 8) as 8 | 14 | 16;
}

/** 10-pin display: e, d, com, c, dp along the near row (pins 1 to 5), b, a, com2, f, g back along the far row. */
export const SEVENSEG_LEGS = ["e", "d", "com", "c", "dp", "b", "a", "com2", "f", "g"] as const;
export const SEGMENTS = ["a", "b", "c", "d", "e", "f", "g", "dp"] as const;
export type Segment = (typeof SEGMENTS)[number];

/** 7805 legs, left to right with the printed face toward you. */
export const REGULATOR_LEGS = ["in", "gnd", "out"] as const;

const NUMBERS = Array.from({ length: 16 }, (_, i) => String(i + 1));
const numbers = (n: number) => NUMBERS.slice(0, n);

/**
 * The lead (a pin number, "1" to "16") that carries a function on this chip: "trig" on a 555 is "2", "co" on a
 * 4026B is "5". Case does not matter; a pin number is returned as is. Null when the chip has no such pin.
 */
export function chipLeg(model: ChipModel, name: string): string | null {
  const names = CHIP_PINOUTS[model];
  if (!names) return null;
  if (/^\d+$/.test(name)) return Number(name) >= 1 && Number(name) <= names.length ? String(Number(name)) : null;
  const k = names.indexOf(name.toLowerCase());
  return k >= 0 ? String(k + 1) : null;
}

/** The function of a chip's pin ("2" on a 555 is "trig"). */
export function chipPinName(model: ChipModel, leg: string): string | null {
  return CHIP_PINOUTS[model]?.[Number(leg) - 1] ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Sizes (mm), after common datasheet packages.

/** DIP: rows 3 pitches (7.62 mm) apart, body 6.35 mm across, seated about 0.7 mm above the board. */
export const DIP = { w: 6.35, h: 3.2, lift: 0.7, row: 3, len: { 8: 9.4, 14: 19.1, 16: 19.6 } as Record<number, number> };

/** SOIC: 1.27 mm pitch, feet 6 mm apart across, a body 1.5 mm thick. */
export const SOIC = { w: 3.9, h: 1.5, pitch: 1.27, feet: 6.0, lift: 0.15, len: { 8: 4.9, 14: 8.65, 16: 9.9 } as Record<number, number> };

/** A DIP socket: a frame as long as its rows plus the ends, its top `h` above the board; on the desk it stands on its pins. */
export const SOCKET = { h: 3.0, w: 10.1, end: 1.4, pins: 3.0 };

/** 0.56 inch display: 12.6 x 19 mm face, 8 mm tall, rows 6 pitches apart (rows c and g). */
export const DISPLAY = { w: 12.6, d: 19.0, h: 8.0, rows: 6, lift: 0.4 };

/** The display's carrier board: the display on top, a resistor beside each segment pin, on 2.5 mm header shoulders. */
export const CARRIER = { w: 23.5, d: 22.5, t: 1.6, lift: 2.5 };

/** DIP switch body: as long as its rows, 9.6 mm across, 4.4 mm tall, a slider in a slot per switch. */
export const DIPSW = { w: 9.6, h: 4.4, lift: 0.6, slot: 3.6, knob: 1.5 };

/** TO-220: body, metal tab with its hole, legs 2.54 mm apart; standing on the board its body starts 3 mm up. */
export const TO220 = { w: 10.1, bodyH: 9.2, bodyD: 4.5, tabH: 6.3, tabD: 1.3, hole: 3.6, legW: 0.8, lift: 3.0, deskLeg: 12, sink: { w: 16, h: 21, d: 12, fins: 6 } };

/**
 * Logic probe: a pen about 100 mm long with a metal tip and lamps near the front (`lamp` mm apart). Held in a hole it
 * stands steeply, `lean` radians up from the board, its tail toward you.
 */
export const PROBE = { len: 100, dia: 10, needle: 13, lamps: 40, lamp: 6, lean: 1.15 };

/** The probe pen's outline along its axis (radius, distance from the tip): tapered nose, barrel, cable boot. */
export const PROBE_PROFILE: readonly Vec2[] = [
  [0.001, PROBE.needle - 0.2],
  [1.3, PROBE.needle + 0.6],
  [2.9, PROBE.needle + 6],
  [3.9, PROBE.needle + 13],
  [4.5, PROBE.needle + 18],
  [PROBE.dia / 2, PROBE.needle + 24],
  [PROBE.dia / 2, PROBE.len - 9],
  [PROBE.dia / 2 - 0.5, PROBE.len - 5],
  [2.7, PROBE.len - 4],
  [1.8, PROBE.len + 4],
  [1.5, PROBE.len + 8],
  [0.001, PROBE.len + 8],
];

/** AA battery holders: cells side by side. */
export const PACK = { cell: 14.5, cellLen: 50.5, wall: 1.6, h: 15.5, end: 5 };

/** Bench supply: a small box with the volts on top, a knob in the middle and two binding posts in front. */
export const SUPPLY = { w: 64, d: 72, h: 28, postX: 14, postZ: 24, knobR: 8.5, lcdX: -6, lcdZ: -23 };

/**
 * The seven bars and the dot of the display's digit, as outlines in its face's frame (mm, x right, z toward you, the
 * face's centre at 0). Bars lean 8 degrees like a real digit; dp sits at the lower right.
 */
export const SEGMENT_SHAPES: Record<Segment, Vec2[]> = (() => {
  const W = 3.3;
  const H = 6.4;
  const t = 1.25;
  const g = 0.32;
  const lean = Math.tan((8 * Math.PI) / 180);
  const dx = -0.7;
  const tilt = (pts: Vec2[]): Vec2[] => pts.map(([x, z]) => [Math.round((x - z * lean + dx) * 1000) / 1000, z] as Vec2);
  const across = (z: number): Vec2[] => {
    const x0 = -W + g;
    const x1 = W - g;
    return [[x0, z], [x0 + t / 2, z - t / 2], [x1 - t / 2, z - t / 2], [x1, z], [x1 - t / 2, z + t / 2], [x0 + t / 2, z + t / 2]];
  };
  const down = (x: number, z0: number, z1: number): Vec2[] => [[x, z0], [x + t / 2, z0 + t / 2], [x + t / 2, z1 - t / 2], [x, z1], [x - t / 2, z1 - t / 2], [x - t / 2, z0 + t / 2]];
  const dot: Vec2[] = Array.from({ length: 12 }, (_, i) => [W + 1.75 + Math.cos((i / 12) * Math.PI * 2) * 0.72, H + Math.sin((i / 12) * Math.PI * 2) * 0.72] as Vec2);
  return {
    a: tilt(across(-H)),
    b: tilt(down(W, -H + g, -g)),
    c: tilt(down(W, g, H - g)),
    d: tilt(across(H)),
    e: tilt(down(-W, g, H - g)),
    f: tilt(down(-W, -H + g, -g)),
    g: tilt(across(0)),
    dp: tilt(dot),
  };
})();

/** Height of the top of a held chip's seat (the socket's top). */
function socketTop(onBoard: boolean): number {
  return (onBoard ? BOARD_TOP : SOCKET.pins) + SOCKET.h;
}

// ---------------------------------------------------------------------------------------------------------------
// Footprints.

/** DIP pins at rotation 0: 1 to n/2 left to right along the near row, the rest right to left along the far row. */
export function dipFootprint(n: number): FootprintLeg[] {
  const half = n / 2;
  return Array.from({ length: n }, (_, i) => (i < half ? { leg: String(i + 1), dx: i, dz: 0 } : { leg: String(i + 1), dx: n - 1 - i, dz: -DIP.row }));
}

const SEVENSEG_FP: FootprintLeg[] = SEVENSEG_LEGS.map((leg, i) => (i < 5 ? { leg, dx: i, dz: 0 } : { leg, dx: 9 - i, dz: -DISPLAY.rows }));

/** Footprint centre at rotation 0, in pitches from pin 1. */
export function footprintCentre(fp: readonly FootprintLeg[]): Vec2 {
  const xs = fp.map((f) => f.dx);
  const zs = fp.map((f) => f.dz);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

/** Standing on its legs on the desk: legs centred on the body, ends at `y`. */
function centred(fp: readonly FootprintLeg[], y: number): Record<string, Vec3> {
  const [cx, cz] = footprintCentre(fp);
  return Object.fromEntries(fp.map((f) => [f.leg, [(f.dx - cx) * PITCH, y, (f.dz - cz) * PITCH] as Vec3]));
}

/** Pin positions with pin 1 at the origin (a chip sitting in a socket). */
function fromPin1(fp: readonly FootprintLeg[], y: number): Record<string, Vec3> {
  return Object.fromEntries(fp.map((f) => [f.leg, [f.dx * PITCH, y, f.dz * PITCH] as Vec3]));
}

/** A surface mount body's feet, centred: 1.27 mm apart along each side, numbered like a DIP. */
export function soicFeet(n: number): Record<string, Vec3> {
  const half = n / 2;
  const out: Record<string, Vec3> = {};
  for (let i = 0; i < n; i++) {
    const col = i < half ? i : n - 1 - i;
    out[String(i + 1)] = [(col - (half - 1) / 2) * SOIC.pitch, 0.25, (i < half ? 1 : -1) * (SOIC.feet / 2)];
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Sockets: which socket pin a seated chip's pin touches.

/**
 * The socket pin under chip pin `pin` (1-based) for an n-pin chip in an N-pin socket, its pin 1 at the socket's pin 1
 * end, or turned round in the same holes. Null when that pin hangs past the socket.
 */
export function socketPinFor(pin: number, n: number, N: number, turned: boolean): number | null {
  const half = n / 2;
  if (n > N) return null;
  // Column (from the socket's pin-1 end) and row (0 near, 1 far) of the chip pin.
  let col = pin <= half ? pin - 1 : n - pin;
  let row = pin <= half ? 0 : 1;
  if (turned) {
    col = half - 1 - col;
    row = 1 - row;
  }
  return row === 0 ? col + 1 : N - col;
}

function socketJoins(N: number, turned: boolean, held: PlacedPart): Record<string, string> {
  if (held.kind !== "chip") return {};
  const n = chipPinCount(held.params.model);
  const out: Record<string, string> = {};
  for (let k = 1; k <= n; k++) {
    const s = socketPinFor(k, n, N, turned);
    if (s) out[String(k)] = String(s);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The board under a part.

/** Whether a desk point lies over the board. */
export function overBoard(bench: BenchState, at: Vec2): boolean {
  if (!bench.board) return false;
  const g = boardGeometry(bench.board);
  const [ox, oz] = boardOrigin(bench.board);
  return Math.abs(at[0] - ox) < g.width / 2 && Math.abs(at[1] - oz) < g.depth / 2;
}

/** A part that will not seat lies askew on top of the board, this many degrees off its turn. */
export const PERCH_SKEW = 7;

// ---------------------------------------------------------------------------------------------------------------
// Netlist mapping.

/** A chip's simulator part: pin k of the package is the k-th name of its pinout. */
export function chipSpecs(id: string, model: ChipModel, node: (leg: string) => NodeId): PartSpec[] {
  const names = CHIP_PINOUTS[model];
  const pins = Object.fromEntries(names.map((name, i) => [name, node(String(i + 1))]));
  if (model === "555" || model === "555-cmos") return [{ id, kind: "timer555", pins, ...(model === "555-cmos" ? { cmos: true } : {}) } as PartSpec];
  return [{ id, kind: "logic", model, pins } as PartSpec];
}

/** DIP switch: switch k of n joins pin k and pin 2n + 1 - k. */
export function dipSwitchPins(k: number, positions: number): [string, string] {
  return [String(k), String(2 * positions + 1 - k)];
}

/** Volts a bench supply puts out for its knob position. */
export function supplyVolts(pp: { position: number; max?: number }): number {
  return Math.round(Math.max(0, Math.min(1, pp.position)) * (pp.max ?? 12) * 10) / 10;
}

/**
 * A short detail for a Unit 4 part or tray item (tray, selection bar, screen readers): what a chip has printed on it
 * (a taped one, its tape), a pack's or the supply's volts.
 */
export function chipDetail(kind: string, params: Record<string, unknown>): string | undefined {
  if (kind === "chip") {
    const model = (params["model"] as ChipModel | undefined) ?? "555";
    const print = params["hidden"] ? String(params["label"] ?? "?") : CHIP_PRINT[model];
    return params["package"] === "soic" ? `${print} SOIC` : print;
  }
  if (kind === "battery-pack") return `${Number(params["cells"] ?? 3) * 1.5} V`;
  if (kind === "bench-supply") return `${supplyVolts({ position: Number(params["position"] ?? 0.75), max: params["max"] as number | undefined })} V`;
  if (kind === "ic-socket") return `${params["pins"] ?? 8} pins`;
  return undefined;
}

/** Default emf and internal resistance of an AA pack (fresh alkaline cells, about 1.55 V and 0.15 ohm each). */
export function packDefaults(cells: number): { emf: number; internalOhms: number; mAh: number } {
  return { emf: Math.round(cells * 1.55 * 100) / 100, internalOhms: Math.round(cells * 0.15 * 100) / 100, mAh: 2400 };
}

// ---------------------------------------------------------------------------------------------------------------
// Part definitions.

type ChipDefs = { [K in ChipKind]: PartDef<K> };

const DIP_KEYS: readonly DipKey[] = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

export const CHIP_DEFS: ChipDefs = {
  chip: {
    kind: "chip",
    prefix: "U",
    turnsRound: true,
    legs: NUMBERS,
    legsFor: (pp) => numbers(chipPinCount(pp.model)),
    // A surface mount body has no footprint the holes fit: it lies on the desk (or on top of the board).
    footprint: (pp) => (pp.package === "soic" ? [] : dipFootprint(chipPinCount(pp.model))),
    defaults: { model: "555" },
    deskLegs: (pp) => (pp.package === "soic" ? soicFeet(chipPinCount(pp.model)) : centred(dipFootprint(chipPinCount(pp.model)), 0.6)),
    heldLegs: (pp) => fromPin1(dipFootprint(chipPinCount(pp.model)), 0.6),
    perch: (pp) => pp.package === "soic",
    alias: (pp, name) => chipLeg(pp.model, name),
    toSpecs: (p, n) => chipSpecs(p.id, p.params.model, n),
  },
  sevenseg: {
    kind: "sevenseg",
    prefix: "DS",
    turnsRound: true,
    legs: SEVENSEG_LEGS,
    footprint: () => SEVENSEG_FP,
    defaults: { common: "cathode", color: "red" },
    deskLegs: () => centred(SEVENSEG_FP, 0.6),
    // Pin numbers work too ("DS1.3" is com), and "com1" is com.
    alias: (_pp, name) => (/^\d+$/.test(name) ? (SEVENSEG_LEGS[Number(name) - 1] ?? null) : name === "com1" ? "com" : null),
    toSpecs: (p, n) => {
      const pp = p.params;
      const specs: PartSpec[] = [];
      const pins: Record<string, NodeId> = {};
      for (const leg of SEVENSEG_LEGS) {
        if (pp.carrier && leg !== "com" && leg !== "com2") {
          // The carrier's resistor sits between the pin and the segment.
          const inner = `${p.id}#${leg}`;
          specs.push({ id: `${p.id}:R${leg}`, kind: "resistor", pins: { a: n(leg), b: inner }, ohms: pp.segmentOhms ?? 3300, watts: 0.125, tolerance: 0.05 });
          pins[leg] = inner;
        } else pins[leg] = n(leg);
      }
      specs.unshift({ id: p.id, kind: "sevenseg", pins, common: pp.common, color: pp.color ?? "red" } as PartSpec);
      return specs;
    },
  },
  regulator7805: {
    kind: "regulator7805",
    prefix: "VR",
    legs: REGULATOR_LEGS,
    footprint: () => REGULATOR_LEGS.map((leg, i) => ({ leg, dx: i, dz: 0 })),
    defaults: {},
    // Lying on its back on the desk, print up, legs toward you.
    deskLegs: () => ({ in: [-PITCH, 1.2, 15.6], gnd: [0, 1.2, 15.6], out: [PITCH, 1.2, 15.6] }),
    settings: [{ key: "heatsink", values: [false, true], when: (pp) => pp["heatsink"] !== undefined }],
    toSpecs: (p, n) => [{ id: p.id, kind: "regulator7805", pins: { in: n("in"), gnd: n("gnd"), out: n("out") }, ...(p.params.heatsink ? { heatsink: true } : {}) }],
  },
  "ic-socket": {
    kind: "ic-socket",
    prefix: "XU",
    turnsRound: true,
    legs: NUMBERS,
    legsFor: (pp) => numbers(pp.pins),
    footprint: (pp) => dipFootprint(pp.pins),
    defaults: { pins: 8 },
    deskLegs: (pp) => centred(dipFootprint(pp.pins), 0.6),
    seats: (pp) => {
      const N = pp.pins;
      const turned = !!pp.turned;
      return [
        {
          name: "chip",
          accepts: ["chip"],
          fits: (held) => held.kind === "chip" && held.params.package !== "soic" && chipPinCount(held.params.model) <= N,
          // The chip's pin 1 over the socket's pin 1 (or, turned round, over the far row at the same end).
          place: (held, at) => {
            const n = held.kind === "chip" ? chipPinCount(held.params.model) : N;
            const x0 = (-(N / 2 - 1) / 2) * PITCH;
            const y = socketTop(!!at?.board);
            return turned ? { at: [x0 + (n / 2 - 1) * PITCH, y, -1.5 * PITCH], rot: 180 } : { at: [x0, y, 1.5 * PITCH], rot: 0 };
          },
          joins: (held) => socketJoins(N, turned, held),
          // Turning a seated chip turns it round in its socket.
          turn: () => ({ turned: !turned }),
        },
      ];
    },
    toSpecs: () => [],
  },
  "dip-switch": {
    kind: "dip-switch",
    prefix: "DIP",
    turnsRound: true,
    legs: NUMBERS,
    legsFor: (pp) => numbers(pp.positions * 2),
    footprint: (pp) => dipFootprint(pp.positions * 2),
    defaults: { positions: 8 },
    deskLegs: (pp) => centred(dipFootprint(pp.positions * 2), 0.6),
    // Each slider flips its own switch.
    hotspots: (pp, mount) => {
      const n = pp.positions;
      // On the board the frame starts at pin 1; on the desk at the body's centre.
      const cx = mount === "desk" ? (n - 1) / 2 : 0;
      const cz = mount === "desk" ? 0 : -1.5 * PITCH;
      const out: Hotspot[] = [];
      for (let k = 1; k <= n; k++) {
        const key = DIP_KEYS[k - 1]!;
        out.push({ pick: { type: "setting", key, value: !pp[key] }, at: [(k - 1 - cx) * PITCH, DIPSW.lift + DIPSW.h, cz], size: [2.3, 3, DIPSW.slot + 1.6], on: !!pp[key] });
      }
      return out;
    },
    toSpecs: (p, n) => {
      const pp = p.params;
      const out: PartSpec[] = [];
      for (let k = 1; k <= pp.positions; k++) {
        const [a, b] = dipSwitchPins(k, pp.positions);
        out.push({ id: `${p.id}:${k}`, kind: "switch", pins: { a: n(a), b: n(b) }, closed: !!pp[DIP_KEYS[k - 1]!], ...(pp.bounce !== undefined ? { bounce: pp.bounce } : {}) });
      }
      return out;
    },
  },
  "logic-probe": {
    kind: "logic-probe",
    prefix: "LP",
    legs: ["tip", "vcc", "gnd"],
    flying: true,
    nose: "tip",
    defaults: {},
    // The pen lies with its tip at the origin and its body toward you; the leads trail out of the back.
    deskLegs: () => ({ tip: [0, 1.2, 0], vcc: [-9, 0.7, PROBE.len + 34], gnd: [9, 0.7, PROBE.len + 40] }),
    // An instrument: it reads the circuit without loading it.
    toSpecs: () => [],
  },
  "battery-pack": {
    kind: "battery-pack",
    prefix: "B",
    legs: ["pos", "neg"],
    flying: true,
    defaults: { cells: 3 },
    // Cells lie side by side, their length toward you; the leads leave the near end.
    deskLegs: () => ({ pos: [-12, 0.7, PACK.cellLen / 2 + PACK.end + 62], neg: [10, 0.7, PACK.cellLen / 2 + PACK.end + 70] }),
    toSpecs: (p, n) => {
      const d = packDefaults(p.params.cells);
      return [
        {
          id: p.id,
          kind: "battery",
          pins: { pos: n("pos"), neg: n("neg") },
          emf: p.params.emf ?? d.emf,
          internalOhms: p.params.internalOhms ?? d.internalOhms,
          mAh: p.params.mAh ?? d.mAh,
        },
      ];
    },
  },
  "bench-supply": {
    kind: "bench-supply",
    prefix: "PS",
    legs: ["pos", "neg"],
    defaults: { position: 0.75, max: 12 },
    deskLegs: () => ({ pos: [-SUPPLY.postX, SUPPLY.h + 6, SUPPLY.postZ], neg: [SUPPLY.postX, SUPPLY.h + 6, SUPPLY.postZ] }),
    // A stiff source: a regulated supply sags very little under load.
    toSpecs: (p, n) => [{ id: p.id, kind: "battery", pins: { pos: n("pos"), neg: n("neg") }, emf: supplyVolts(p.params), internalOhms: 0.05 }],
  },
};

/** Kinds whose minus terminal can be the netlist's ground, in order of preference. */
export const SOURCE_KINDS = ["battery", "battery-pack", "bench-supply"] as const;
