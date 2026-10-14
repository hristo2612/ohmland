// Unit 4's door guard (CH11, CH12): a door or a window on a short stretch of wall, with a magnet on its leaf and a reed
// switch on its frame, and plug-in modules: a small labelled board on a header row that plugs into the breadboard (the
// voice module is CH8's singer, a 555 that sings about 440 Hz while its EN pin is high). Pure data: sizes, the
// geometry of the swinging leaf and the part definitions, spread into the catalog in parts.ts. Models are in
// models/Alarm.tsx, ink drawings in ink/kinds/alarm.tsx.

import type { NodeId, PartSpec } from "@ohmland/sim";
import { PITCH } from "./board";
import type { FootprintLeg, Hotspot, PartDef } from "./parts";
import type { AlarmKind, PartParamsMap, Vec2, Vec3 } from "./types";

// ---------------------------------------------------------------------------------------------------------------
// The door (or window) and its reed switch.

/** How far an open leaf swings out toward you, in degrees. */
export const OPEN_DEG = 70;

/**
 * Sizes (mm) of the wall, the opening and its leaf: `w` wide along x, `t` thick, the opening from `sill` up to `top`
 * between jambs `jamb` wide. The reed module sits on one jamb, its two wires down to a little terminal block on the base
 * beside the wall, where clip leads bite; the leaf hangs on the other jamb. `side` says where the block is: "left"
 * (the default) for a door standing to the right of the board, "right" for one to its left, so the block faces the
 * board and the leads run short. `s` is 1 for a block on the left, -1 on the right: every x below is mirrored by it.
 */
export function doorDims(style: "door" | "window" = "door", side: DoorSide = "left") {
  const window = style === "window";
  const w = window ? 52 : 66;
  const jamb = 4;
  const s = side === "right" ? -1 : 1;
  return {
    s,
    w,
    t: 6,
    h: window ? 48 : 52,
    sill: window ? 18 : 1,
    top: window ? 42 : 48,
    jamb,
    /** The leaf: hinged on the jamb away from the block, as wide as the opening. */
    leaf: w - 2 * jamb,
    leafT: 2.4,
    /** The base plank the wall and the terminal block stand on. */
    base: { x0: s > 0 ? -w / 2 - 24 : -w / 2 - 3, x1: s > 0 ? w / 2 + 3 : w / 2 + 24, z0: -8, z1: 10, h: 3 },
    /** The terminal block: centre x and z, size. */
    block: { x: -s * (w / 2 + 12.5), z: 2, w: 19, d: 14, h: 7 },
  };
}

/** Which side of the wall a door's terminal block stands on. */
export type DoorSide = "left" | "right";

/** The params that shape a door (its leaf aside). */
type DoorLook = Pick<PartParamsMap["door"], "style" | "side">;

/** The leaf's angle in radians: 0 shut, OPEN_DEG open (swinging toward +z, toward you). */
export const leafAngle = (open: boolean | undefined): number => (open ? (OPEN_DEG * Math.PI) / 180 : 0);

/** The hinge and the leaf's free edge on the desk plane (x, z) for an open or shut leaf. */
export function leafLine(pp: DoorLook, open: boolean | undefined): { hinge: Vec2; tip: Vec2 } {
  const D = doorDims(pp.style, pp.side);
  const a = leafAngle(open);
  const hinge: Vec2 = [D.s * (D.w / 2 - D.jamb), 0];
  return { hinge, tip: [hinge[0] - D.s * D.leaf * Math.cos(a), hinge[1] + D.leaf * Math.sin(a)] };
}

/** Height (mm above the desk) of the middle of the opening: where the reed and the magnet sit. */
export const doorMidY = (style: "door" | "window" | undefined): number => {
  const D = doorDims(style);
  return D.base.h + (D.sill + D.top) / 2;
};

/** Where the reed module sits (on the block's jamb, front face) and the magnet (on the leaf's free edge), local mm. */
export function doorMarks(pp: Pick<PartParamsMap["door"], "open" | "style" | "side">): { reed: Vec3; magnet: Vec3; leaf: Vec3 } {
  const D = doorDims(pp.style, pp.side);
  const y = doorMidY(pp.style);
  const { hinge, tip } = leafLine(pp, pp.open);
  const a = leafAngle(pp.open);
  // The magnet sits on the leaf's front face, a few millimetres in from its free edge.
  const back = 4;
  const mx = tip[0] + D.s * (back * Math.cos(a) + 2.4 * Math.sin(a));
  const mz = tip[1] - back * Math.sin(a) + 2.4 * Math.cos(a) + D.t / 2 - 1;
  return {
    reed: [-D.s * (D.w / 2 - D.jamb / 2), y, D.t / 2 + 2.2],
    magnet: [mx, y, mz],
    leaf: [(hinge[0] + tip[0]) / 2, y, (hinge[1] + tip[1]) / 2],
  };
}

/** The reed module's terminals on the block (local mm): `a` on the left, `b` on the right. */
export function doorTerminals(pp: DoorLook): Record<"a" | "b", Vec3> {
  const D = doorDims(pp.style, pp.side);
  const B = D.block;
  const base = D.base.h;
  return { a: [B.x - 4.6, base + B.h + 1.2, B.z + 1], b: [B.x + 4.6, base + B.h + 1.2, B.z + 1] };
}

/** The part's outline on the desk (x0, z0, x1, z1), the open leaf's sweep included. */
export function doorBox(pp: Pick<PartParamsMap["door"], "open" | "style" | "side">): [number, number, number, number] {
  const D = doorDims(pp.style, pp.side);
  const { tip } = leafLine(pp, pp.open);
  return [D.base.x0, D.base.z0, D.base.x1, Math.max(D.base.z1, tip[1] + 3)];
}

// ---------------------------------------------------------------------------------------------------------------
// Plug-in modules.

/** The models of plug-in module there are. */
export type ModuleModel = "voice";

/** Header pins of each module, left to right (leads), and what is printed beside each. */
export const MODULE_PINS: Record<ModuleModel, readonly { leg: string; print: string }[]> = {
  voice: [
    { leg: "vcc", print: "+" },
    { leg: "en", print: "EN" },
    { leg: "out", print: "OUT" },
    { leg: "gnd", print: "−" },
  ],
};

/** What is printed on each module's board. */
export const MODULE_PRINT: Record<ModuleModel, string> = { voice: "VOICE" };

/**
 * A module board (mm): a header row of pins 2.54 mm apart, the board lifted `lift` above the breadboard on them, `d`
 * deep, reaching from `back` behind the pin row (over the gap and the far half, so the strips in front of the pins
 * stay free for wires) to just in front of it, `margin` past the end pins.
 */
export const MODULE = { lift: 8.5, t: 1.6, back: 16, d: 19, margin: 2.4 };

export function moduleLegs(model: ModuleModel | undefined): string[] {
  return (MODULE_PINS[model ?? "voice"] ?? MODULE_PINS.voice).map((p) => p.leg);
}

/** The board's outline in the frame of its first pin (x0, z0, x1, z1). */
export function moduleBox(model: ModuleModel | undefined): [number, number, number, number] {
  const n = moduleLegs(model).length;
  return [-MODULE.margin, -MODULE.back, (n - 1) * PITCH + MODULE.margin, -MODULE.back + MODULE.d];
}

/**
 * The voice module's insides, as simulator parts: a bipolar 555 astable (10 kΩ, 30 kΩ, 47 nF: about 440 Hz) whose
 * reset (pin 4) is the EN pin, held low by 100 kΩ when nothing drives it, and its output through 100 Ω and 100 µF to OUT.
 */
export function voiceSpecs(id: string, node: (leg: string) => NodeId): PartSpec[] {
  const vcc = node("vcc");
  const gnd = node("gnd");
  const en = node("en");
  const th = `${id}#th`;
  const dis = `${id}#dis`;
  const q = `${id}#q`;
  const mid = `${id}#mid`;
  return [
    { id: `${id}:U`, kind: "timer555", pins: { gnd, trig: th, out: q, reset: en, thresh: th, dis, vcc } } as PartSpec,
    { id: `${id}:R1`, kind: "resistor", pins: { a: vcc, b: dis }, ohms: 10_000, watts: 0.125, tolerance: 0.01 },
    { id: `${id}:R2`, kind: "resistor", pins: { a: dis, b: th }, ohms: 30_000, watts: 0.125, tolerance: 0.01 },
    { id: `${id}:C1`, kind: "capacitor", pins: { pos: th, neg: gnd }, farads: 47e-9, volts: 50, polarized: false, tolerance: 0.02 },
    { id: `${id}:REN`, kind: "resistor", pins: { a: en, b: gnd }, ohms: 100_000, watts: 0.125, tolerance: 0.01 },
    { id: `${id}:R3`, kind: "resistor", pins: { a: q, b: mid }, ohms: 100, watts: 0.25, tolerance: 0.01 },
    { id: `${id}:C2`, kind: "capacitor", pins: { pos: mid, neg: node("out") }, farads: 100e-6, volts: 16, polarized: true },
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// Part definitions.

type AlarmDefs = { [K in AlarmKind]: PartDef<K> };

export const ALARM_DEFS: AlarmDefs = {
  door: {
    kind: "door",
    prefix: "DR",
    legs: ["a", "b"],
    defaults: { open: false, style: "door" },
    deskLegs: (pp) => doorTerminals(pp),
    // The leaf: click it to open or shut the door (both views place the same box where the leaf is now).
    hotspots: (pp): Hotspot[] => {
      const D = doorDims(pp.style, pp.side);
      const { hinge, tip } = leafLine(pp, pp.open);
      const h = D.top - D.sill;
      return [
        {
          pick: { type: "setting", key: "open", value: !pp.open },
          at: [(hinge[0] + tip[0]) / 2, doorMidY(pp.style), (hinge[1] + tip[1]) / 2],
          size: [Math.abs(tip[0] - hinge[0]) + 6, h, Math.abs(tip[1] - hinge[1]) + 6],
          on: !!pp.open,
        },
      ];
    },
    settings: [{ key: "open", values: [false, true] }],
    marks: (pp) => doorMarks(pp),
    // The reed is normally open: the magnet on the shut leaf holds it closed. Open the door and the loop breaks.
    toSpecs: (p, n) => [{ id: p.id, kind: "switch", pins: { a: n("a"), b: n("b") }, closed: !p.params.open }],
  },
  "plug-module": {
    kind: "plug-module",
    prefix: "MOD",
    legs: MODULE_PINS.voice.map((p) => p.leg),
    legsFor: (pp) => moduleLegs(pp.model),
    footprint: (pp): FootprintLeg[] => moduleLegs(pp.model).map((leg, i) => ({ leg, dx: i, dz: 0 })),
    defaults: { model: "voice" },
    // On the desk it rests on its pins, the pins centred under the board.
    deskLegs: (pp) => {
      const legs = moduleLegs(pp.model);
      const c = ((legs.length - 1) * PITCH) / 2;
      return Object.fromEntries(legs.map((leg, i) => [leg, [i * PITCH - c, 0.6, 0] as Vec3]));
    },
    toSpecs: (p, n) => voiceSpecs(p.id, n),
  },
};
