// Circuit symbols in ink, as SVG path data: the drawers' faces, a schematic card and its torn piece. Pure: the ink
// view draws the paths as they are, the 3D view strokes them onto canvas textures (Path2D takes the same strings).
//
// Every symbol is drawn along x in a 24 mm wide frame centred on the origin, its leads running out to x = ±12, and
// points the way conventional current goes through it: in at -x, out at +x (a battery's + plate is on the +x side,
// an LED's triangle points to +x).

import type { SymbolKind } from "./types";

export type SymbolInk = {
  /** Lines and outlines (stroked). */
  stroke: string;
  /** Solid shapes (filled with the ink colour): an LED's triangle, a switch's contacts. */
  fill?: string;
  /** Small marks drawn thinner (an LED's light arrows, the + by a battery). */
  thin?: string;
};

export const SYMBOL_HALF = 12;

const SYMBOLS: Record<SymbolKind, SymbolInk> = {
  battery: {
    stroke: "M-12 0H-1.8M-1.8 -3.4V3.4M1.8 -7V7M1.8 0H12",
    thin: "M5.4 -9.2h3.4M7.1 -10.9v3.4",
  },
  cell: {
    stroke: "M-12 0H-1.8M-1.8 -3.4V3.4M1.8 -7V7M1.8 0H12",
    thin: "M5.4 -9.2h3.4M7.1 -10.9v3.4",
  },
  resistor: {
    stroke: "M-12 0H-7.5L-6.25 -3.2L-3.75 3.2L-1.25 -3.2L1.25 3.2L3.75 -3.2L6.25 3.2L7.5 0H12",
  },
  led: {
    stroke: "M-12 0H-4M-4 -4.4L3.6 0L-4 4.4ZM3.6 -4.6V4.6M3.6 0H12",
    fill: "M-4 -4.4L3.6 0L-4 4.4Z",
    thin: "M0.4 -5.6l2.8 -3.6M1.6 -9.6l1.6 0.4l-0.2 1.6M3.6 -4.6l2.8 -3.6M4.8 -8.6l1.6 0.4l-0.2 1.6",
  },
  switch: {
    stroke: "M-12 0H-5.4M-5 -0.4L4.4 -6M5.4 0H12",
    fill: "M-5.4 0a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0ZM3.2 0a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0Z",
  },
  lamp: {
    stroke: "M-12 0H-5M5 0H12M-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0ZM-3.5 -3.5L3.5 3.5M-3.5 3.5L3.5 -3.5",
  },
};

export function symbolInk(kind: SymbolKind): SymbolInk {
  return SYMBOLS[kind] ?? SYMBOLS.resistor;
}

/**
 * The direction conventional current takes through slot `i` of a schematic card's loop of `n` symbols, as a turn in
 * degrees of the symbol's +x axis on the card (x right, z down the card): up the left side, along the top to the right,
 * down the right side, back along the bottom.
 */
export function slotTurn(n: number, i: number): number {
  if (n <= 1) return -90;
  if (n === 2) return i === 0 ? -90 : 90;
  if (n === 3) return [-90, 0, 90][i]!;
  return [-90, 0, 90, 180][i % 4]!;
}
