// Physical dimensions shared by the part models, the layout (clip points) and snapping. Millimetres.
// Values follow common datasheet sizes for each package; models are simplified but keep these proportions.

import { PITCH } from "./board";

export const BOARD_TOP = 8.5;

export const LEAD_R = 0.3; // 0.6 mm tinned lead

export const RESISTOR = { len: 6.3, dia: 2.45, lift: 0.9, deskLead: 16 };
export const DIODE = { len: 5.2, dia: 2.7, lift: 0.8, deskLead: 16, leadR: 0.4 };

export const LED = {
  5: { dome: 5.0, rim: 5.8, rimH: 1.0, height: 8.6, flat: 0.5, standoff: 3.2, deskLeadA: 20, deskLeadK: 18 },
  3: { dome: 3.0, rim: 3.8, rimH: 0.9, height: 5.3, flat: 0.4, standoff: 3.0, deskLeadA: 18, deskLeadK: 16 },
} as const;

export const NPN = { dia: 4.9, height: 4.9, flatDepth: 1.55, standoff: 3.4, deskLead: 13 };

export const CERAMIC = { dia: 5.2, thick: 2.6, standoff: 3.0, deskLead: 12 };

export const PUSHBUTTON = { body: 6.0, bodyH: 3.4, capDia: 3.5, capH: 1.6, travel: 0.35 };

export const SLIDE = { len: 8.6, wid: 3.8, h: 3.8, knobW: 1.5, knobL: 1.6, knobH: 3.4, throw: 1.6 };

export const TOGGLE = { len: 12.8, wid: 7.0, h: 8.6, bushingDia: 6.0, bushingH: 6.0, lever: 10.0 };

/** The wooden block a desk toggle switch is mounted on, with three screw terminals along its front edge. */
export const TOGGLE_BASE = { w: 46, h: 15, d: 30, screwX: 14, screwZ: 8.5, switchZ: -5.5 };

/**
 * Desk module blocks (relay, slide switch, DPDT switch, pushbutton, panel pot): the same wooden block as the toggle's,
 * as wide as its row of screw terminals. `pitch` is the terminal spacing for n terminals.
 */
export const BLOCK = { h: 15, d: 30, screwZ: 8.5, deviceZ: -5.5, margin: 9 };

/** Terminal spacing on a desk block with `n` terminals (wider apart when there are few). */
export function blockPitch(n: number): number {
  return n <= 3 ? 14 : n <= 5 ? 11 : 10;
}

/** Width of a desk block with `n` terminals. */
export function blockWidth(n: number): number {
  return Math.max(34, (n - 1) * blockPitch(n) + 2 * BLOCK.margin + 6);
}

export const TRIMMER = { size: 6.6, h: 4.6, rotorDia: 4.6 };

export const RELAY = { len: 20.4, wid: 10.0, h: 11.4 };

export const FUSE = { len: 14.5, dia: 4.5, capLen: 4.2, clipPitch: 4 };

export const BATTERY = { len: 48.5, wid: 26.5, thick: 17.5, termSpacing: 12.7 };

export const SPEAKER = { depth: 14 };

export const CUP = { dia: 58, height: 66, water: 46 };

export const LEMON = { dia: 60, height: 29, stripW: 8, stripUp: 17 };

/** Bigger resistor bodies: a 1 W film resistor and a 5 W ceramic power resistor (body length, size, lead). */
export const RESISTOR_1W = { len: 11.5, dia: 4.4, deskLead: 14 };
export const RESISTOR_5W = { len: 22, w: 9.5, deskLead: 9 };

/** AA cell (lying in a cradle) and a 2032 coin cell (in a holder with two tabs). */
export const AA = { len: 50.5, dia: 14.5, lift: 4 };
export const COIN = { dia: 20, thick: 3.2, holder: 26, tab: 15 };

/** Resistor holder: a block with two spring clips; a seated part's leads run through the clips at `leadY`. */
export const HOLDER = { len: 62, h: 6, d: 16, clipX: 12, leadY: 10.6, termX: 26 };

/** Height of an axial part's leads above its origin when it lies on the desk (resistors by power rating, diodes). */
export function axialLift(kind: string, params: { watts?: number; model?: string }): number {
  if (kind === "diode") return params.model === "1N4148" ? 0.9 : DIODE.dia / 2;
  const w = params.watts ?? 0.25;
  if (w >= 2) return RESISTOR_5W.w / 2;
  if (w >= 0.75) return RESISTOR_1W.dia / 2;
  return RESISTOR.dia / 2;
}

/** Battery test station: a base with a battery bay, two terminal posts and a load switch. */
export const STATION = { w: 104, h: 7, d: 58, postX: 40, postZ: 16, postH: 15, bayZ: -6 };

/** Electrodes for the fruit cell. */
export const ELECTRODE = { coin: 19, coinT: 1.5, stripW: 8, stripL: 40, stripT: 0.7, inside: 12 };

/** Material samples: a bare copper wire and a plastic ruler, with a probe point near each end. */
export const SAMPLE = { wire: 100, wireR: 0.55, ruler: 150, rulerW: 28, rulerT: 2 };

/** Skin patch with probe marks 1 cm apart. */
export const SKIN = { w: 78, h: 12, d: 30, mark: 10, base: 4, padZ: -8, baseW: 100, baseD: 62 };

/** Pencil card: the line starts at x0 and runs +x, 10 mm per cm, probe points every 5 mm. */
export const CARD = { w: 132, d: 66, t: 0.8, x0: -55, lineZ: 2 };

export const TAG = { w: 24, d: 13 };
export const BIN = { w: 74, h: 13, d: 48 };
export const CHART = { w: 100, d: 66 };
export const CLOCK = { w: 54, h: 30, d: 22 };
export const SHOWCASE = { w: 120, h: 62, d: 64 };

/** Electrolytic can size and lead spacing (in board pitches) by value, after common radial series. */
export function electrolyticSize(farads: number, volts = 16): { d: number; h: number; pitch: 1 | 2; lead: number } {
  const uf = farads * 1e6 * Math.max(1, volts / 16);
  if (uf <= 22) return { d: 5, h: 11, pitch: 1, lead: 2.0 };
  if (uf <= 47) return { d: 5, h: 11, pitch: 1, lead: 2.0 };
  if (uf <= 100) return { d: 6.3, h: 11, pitch: 1, lead: 2.5 };
  if (uf <= 220) return { d: 8, h: 11.5, pitch: 2, lead: 3.5 };
  if (uf <= 470) return { d: 10, h: 12.5, pitch: 2, lead: 5.0 };
  if (uf <= 1000) return { d: 10, h: 16, pitch: 2, lead: 5.0 };
  return { d: 13, h: 21, pitch: 2, lead: 5.0 };
}

/** Lead clip point height above the board surface for parts seated in the board. */
export const BOARD_CLIP_LIFT = 1.3;

export { PITCH };

/**
 * Everyday objects for the junk drawer (Start here), lying on the desk along x with a clip point near each end:
 * length, width and thickness in mm, and how far in from each end the clip bites.
 */
export const OBJECT: Record<"key" | "coin" | "foil" | "pencil" | "spoon" | "eraser" | "marble" | "wood" | "string" | "clip", { len: number; w: number; t: number; clip: number }> = {
  key: { len: 54, w: 22, t: 2.2, clip: 4 },
  coin: { len: 24, w: 24, t: 2, clip: 2.5 },
  foil: { len: 64, w: 12, t: 0.3, clip: 4 },
  pencil: { len: 60, w: 2, t: 2, clip: 3 },
  spoon: { len: 92, w: 24, t: 3, clip: 6 },
  eraser: { len: 40, w: 20, t: 9, clip: 4 },
  marble: { len: 16, w: 16, t: 16, clip: 1.5 },
  wood: { len: 90, w: 10, t: 2, clip: 5 },
  string: { len: 78, w: 2, t: 1.6, clip: 3 },
  clip: { len: 34, w: 10, t: 1.4, clip: 1.2 },
};

/** A counting gate: a collar round a clip lead and its paper flag (the counter), which stands above it. */
export const GATE = { ring: 3.4, len: 7, flagW: 26, flagH: 13, lift: 16 };

/** A sealed box (front strip with terminals and a knob, lid behind it) and the parts cabinet. */
export const BOX = { w: 100, d: 74, h: 32, wall: 2.4, strip: 15, termX: 28, knob: 8 };
export const CABINET = { w: 170, d: 100, h: 34, wall: 2.6, strip: 18 };

/** The big sorting tray (`bin` style "tray") and a parts drawer (`bin` style "drawer"). */
export const TRAY = { w: 132, h: 14, d: 104 };
export const DRAWER = { w: 70, h: 26, d: 58 };

/** A schematic card and the torn piece that fits its gap (square, so it can be turned). */
export const SCHEM = { w: 110, d: 78, t: 0.8, loopW: 70, loopD: 46, piece: 26 };

/** The static toy: a balloon on its string, a wool scarf, a heap of paper bits, a comb and a strip of wall. */
export const STATIC = { balloon: 34, scarfW: 110, scarfD: 46, paper: 34, combW: 70, combD: 12, wallW: 150, wallD: 10, wallH: 80 };
