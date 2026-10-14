// The microcontroller board's geometry: an original Uno-sized layout (70 x 54 mm), shared by the 3D model, the ink
// drawing and the clip points. Local frame: origin at the board's centre on the desk, x right, z toward the viewer,
// y up. Header sockets run along the two long edges: GND and 13 down to 0 on the far edge (0 and 1 are the serial
// line, RX and TX), 5V, GND and VIN, then A0 to A5, on the near edge. Pure data, no rendering.

import { PITCH } from "./board";
import type { Vec3 } from "./types";

export const MCU_BOARD = {
  w: 70,
  d: 54,
  /** Rubber feet under the board, and the board's thickness. */
  lift: 2.2,
  pcb: 1.6,
  /** Header sockets: height above the board, width, and their row positions (z). */
  headerH: 8.5,
  headerW: 2.5,
  topZ: -24,
  bottomZ: 20.5,
  /** Corner radius and mounting holes. */
  corner: 3,
  holes: [
    [-31, -23],
    [31, -23],
    [-31, 23],
    [31, 23],
  ] as [number, number][],
  usb: { x: -33.2, z: -12, w: 7.6, d: 9.2, h: 3.3 },
  jack: { x: -29.6, z: 12, w: 14, d: 9, h: 11 },
  reset: { x: -23, z: -19.5, size: 6 },
  chip: { x: 9, z: 1, size: 10 },
  crystal: { x: -5, z: 2, w: 3.2, d: 5.2 },
  regulator: { x: -17.5, z: 15.2, w: 6.5, d: 3.6 },
  lampL: { x: -7.5, z: -15.5 },
  lampOn: { x: 27, z: 15 },
} as const;

/** Top of the PCB above the desk. */
export const MCU_TOP = MCU_BOARD.lift + MCU_BOARD.pcb;
/** Clip point height: the top of a header socket. */
export const MCU_PIN_Y = MCU_TOP + MCU_BOARD.headerH;

const TOP_LEFT = ["gnd2", "d13", "d12", "d11", "d10", "d9", "d8"] as const;
const TOP_RIGHT = ["d7", "d6", "d5", "d4", "d3", "d2", "d1", "d0"] as const;
const POWER = ["5v", "gnd", "vin"] as const;
const ANALOG = ["a0", "a1", "a2", "a3", "a4", "a5"] as const;

/** Every header socket, in the order the bench lists the board's leads. */
export const MCU_LEGS = [
  "d0",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "d10",
  "d11",
  "d12",
  "d13",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "5v",
  "gnd",
  "gnd2",
  "vin",
] as const;

export type McuLeg = (typeof MCU_LEGS)[number];

/** Header groups (for drawing the black socket strips): the legs and the x of the first and last socket. */
export type HeaderGroup = { legs: readonly McuLeg[]; z: number; x0: number };

export const MCU_HEADERS: readonly HeaderGroup[] = [
  { legs: TOP_LEFT, z: MCU_BOARD.topZ, x0: -15.5 },
  { legs: TOP_RIGHT, z: MCU_BOARD.topZ, x0: -15.5 + (TOP_LEFT.length + 0.5) * PITCH },
  { legs: POWER, z: MCU_BOARD.bottomZ, x0: -13.5 },
  { legs: ANALOG, z: MCU_BOARD.bottomZ, x0: 6 },
];

/** Centre of each header socket on the board (x, z). */
export const MCU_PIN_XZ: Readonly<Record<McuLeg, [number, number]>> = (() => {
  const out = {} as Record<McuLeg, [number, number]>;
  for (const g of MCU_HEADERS) g.legs.forEach((leg, k) => (out[leg] = [g.x0 + k * PITCH, g.z]));
  return out;
})();

/** Clip points of the board's leads in its local frame (the top of each socket). */
export function mcuDeskLegs(): Record<string, Vec3> {
  const out: Record<string, Vec3> = {};
  for (const leg of MCU_LEGS) {
    const [x, z] = MCU_PIN_XZ[leg];
    out[leg] = [x, MCU_PIN_Y, z];
  }
  return out;
}

/** What is printed by each socket. 0 and 1 also carry RX and TX, and the PWM pins a ~. */
export const MCU_PIN_LABEL: Readonly<Record<McuLeg, string>> = {
  d0: "0",
  d1: "1",
  d2: "2",
  d3: "~3",
  d4: "4",
  d5: "~5",
  d6: "~6",
  d7: "7",
  d8: "8",
  d9: "~9",
  d10: "~10",
  d11: "~11",
  d12: "12",
  d13: "13",
  a0: "A0",
  a1: "A1",
  a2: "A2",
  a3: "A3",
  a4: "A4",
  a5: "A5",
  "5v": "5V",
  gnd: "GND",
  gnd2: "GND",
  vin: "VIN",
};

/**
 * Where each socket's name is printed: inside the far header (toward the middle of the board) and outside the near
 * one (toward its edge), so a camera looking from the front sees both rows of names past the sockets.
 */
export function mcuLabelZ(z: number): number {
  return z < 0 ? z + 3.0 : z + 3.15;
}

/** Name size (mm): three letters (GND, ~11) print smaller to fit the 2.54 mm pitch. */
export function mcuLabelSize(label: string): number {
  return label.length > 2 ? 1.0 : 1.45;
}

/** Group titles and where they sit (mm, centred). */
export const MCU_TITLES: readonly { text: string; x: number; z: number }[] = [
  { text: "DIGITAL  ~ PWM", x: 3, z: -13.2 },
  { text: "POWER", x: -11, z: MCU_BOARD.bottomZ + 5.25 },
  { text: "ANALOG IN", x: 12.35, z: MCU_BOARD.bottomZ + 5.25 },
];

/** Simulator pin for each bench lead (both GND sockets are the board's ground). */
export const MCU_SIM_PIN: Readonly<Record<McuLeg, string>> = {
  ...Object.fromEntries(MCU_LEGS.map((l) => [l, l])),
  gnd2: "gnd",
} as Record<McuLeg, string>;

/** The board's lamps from its simulator state: L (pin 13) and ON (power), glow 0..1. */
export function mcuLamps(extra: Record<string, unknown> | undefined): { L: number; ON: number } {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
  return { L: n(extra?.["L"]), ON: n(extra?.["ON"]) };
}
