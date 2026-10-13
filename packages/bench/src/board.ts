// Solderless breadboard layout: hole positions, the hidden metal strips and the power rails. Pure data, no three.js.
//
// Board local frame: origin at the centre of the top surface, x along the long edge, z toward the viewer.
// Terminal rows run j (far) .. f, centre channel, e .. a (near). Each side has two rails:
// far side "tp" (+, outermost) and "tn" (-); near side "bp" (+) and "bn" (-, outermost).
// Printed lines read red, +, -, blue from far to near on both sides.

import type { BoardKind, BoardSpec, HoleId } from "./types";

/** Breadboard and DIP pitch: 0.1 inch. */
export const PITCH = 2.54;

export const ROWS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;
export type RowLetter = (typeof ROWS)[number];
export type RailId = "tp" | "tn" | "bp" | "bn";
export const RAILS: readonly RailId[] = ["tp", "tn", "bp", "bn"];

/** Row offsets across the board in pitches (z). */
const ROW_Z: Record<RowLetter | RailId, number> = {
  a: 5.5,
  b: 4.5,
  c: 3.5,
  d: 2.5,
  e: 1.5,
  f: -1.5,
  g: -2.5,
  h: -3.5,
  i: -4.5,
  j: -5.5,
  tp: -8.5,
  tn: -7.5,
  bp: 7.5,
  bn: 8.5,
};

export type HoleInfo = {
  id: HoleId;
  row: RowLetter | RailId;
  col: number;
  /** Board-local position in mm. */
  x: number;
  z: number;
  /** Id of the metal strip this hole belongs to (also the node name used for it). */
  strip: string;
  rail: boolean;
};

export type StripInfo = {
  id: string;
  holes: HoleId[];
  rail: RailId | null;
  /** Board-local extent of the metal clip in mm (for the x-ray view). */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
};

export type BoardGeometry = {
  kind: BoardKind;
  cols: number;
  splitRails: boolean;
  /** Overall size in mm. */
  width: number;
  depth: number;
  height: number;
  holes: Map<HoleId, HoleInfo>;
  strips: Map<string, StripInfo>;
  /** Columns that have rail holes. */
  railCols: number[];
};

const cache = new Map<string, BoardGeometry>();

export function boardGeometry(spec: BoardSpec | BoardKind): BoardGeometry {
  const kind = typeof spec === "string" ? spec : spec.kind;
  const split = typeof spec === "string" ? false : !!spec.splitRails && kind === "bb830";
  const key = `${kind}:${split}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const cols = kind === "bb830" ? 63 : 30;
  const width = kind === "bb830" ? 165.1 : 82.55;
  const depth = 54.6;
  const height = 8.5;
  const mid = (cols + 1) / 2;

  // Rail holes come in groups of five with a one-hole gap.
  const groups = kind === "bb830" ? 10 : 5;
  const firstCol = kind === "bb830" ? 3 : 1;
  const railCols: number[] = [];
  for (let g = 0; g < groups; g++) for (let i = 0; i < 5; i++) railCols.push(firstCol + g * 6 + i);
  const splitAfter = kind === "bb830" ? 31 : Infinity;

  const holes = new Map<HoleId, HoleInfo>();
  const strips = new Map<string, StripInfo>();
  const addToStrip = (strip: string, rail: RailId | null, h: HoleInfo) => {
    let s = strips.get(strip);
    if (!s) {
      s = { id: strip, holes: [], rail, x0: h.x, x1: h.x, z0: h.z, z1: h.z };
      strips.set(strip, s);
    }
    s.holes.push(h.id);
    s.x0 = Math.min(s.x0, h.x);
    s.x1 = Math.max(s.x1, h.x);
    s.z0 = Math.min(s.z0, h.z);
    s.z1 = Math.max(s.z1, h.z);
  };

  for (let col = 1; col <= cols; col++) {
    for (const row of ROWS) {
      const x = (col - mid) * PITCH;
      const z = ROW_Z[row] * PITCH;
      const near = ROWS.indexOf(row) < 5;
      const strip = `${col}${near ? "a-e" : "f-j"}`;
      const h: HoleInfo = { id: `${row}${col}`, row, col, x, z, strip, rail: false };
      holes.set(h.id, h);
      addToStrip(strip, null, h);
    }
  }
  for (const rail of RAILS) {
    for (const col of railCols) {
      const x = (col - mid) * PITCH;
      const z = ROW_Z[rail] * PITCH;
      const strip = split ? `${rail}${col <= splitAfter ? "-left" : "-right"}` : rail;
      const h: HoleInfo = { id: `${rail}${col}`, row: rail, col, x, z, strip, rail: true };
      holes.set(h.id, h);
      addToStrip(strip, rail, h);
    }
  }

  const geom: BoardGeometry = { kind, cols, splitRails: split, width, depth, height, holes, strips, railCols };
  cache.set(key, geom);
  return geom;
}

const HOLE_RE = /^(tp|tn|bp|bn|[a-j])(\d{1,2})$/;

export function parseHole(id: string): { row: RowLetter | RailId; col: number } | null {
  const m = HOLE_RE.exec(id);
  if (!m) return null;
  return { row: m[1] as RowLetter | RailId, col: Number(m[2]) };
}

export function rowZ(row: RowLetter | RailId): number {
  return ROW_Z[row] * PITCH;
}

/** Board-local hole position in mm, or null when the hole does not exist on this board. */
export function holeLocal(geom: BoardGeometry, id: HoleId): [number, number] | null {
  const h = geom.holes.get(id);
  return h ? [h.x, h.z] : null;
}

export function boardOrigin(spec: BoardSpec): [number, number] {
  return spec.pos ?? [0, 0];
}

/** Hole position on the desk plane (x, z) in mm. */
export function holeWorld(spec: BoardSpec, id: HoleId): [number, number] | null {
  const local = holeLocal(boardGeometry(spec), id);
  if (!local) return null;
  const [ox, oz] = boardOrigin(spec);
  return [ox + local[0], oz + local[1]];
}

/** The hole at a desk position, if one lies within `maxDist` mm. */
export function nearestHole(spec: BoardSpec, x: number, z: number, maxDist = PITCH * 0.75): HoleId | null {
  const geom = boardGeometry(spec);
  const [ox, oz] = boardOrigin(spec);
  const lx = x - ox;
  const lz = z - oz;
  let best: HoleId | null = null;
  let bestD = maxDist * maxDist;
  // Holes sit on a regular grid: only look at the few columns near the point.
  const mid = (geom.cols + 1) / 2;
  const c0 = Math.round(lx / PITCH + mid);
  for (let col = c0 - 1; col <= c0 + 1; col++) {
    for (const row of [...ROWS, ...RAILS]) {
      const h = geom.holes.get(`${row}${col}`);
      if (!h) continue;
      const d = (h.x - lx) ** 2 + (h.z - lz) ** 2;
      if (d < bestD) {
        bestD = d;
        best = h.id;
      }
    }
  }
  return best;
}

/** Hole at an integer grid offset (in pitches) from another hole, if it exists. */
export function holeAtOffset(geom: BoardGeometry, from: HoleId, dx: number, dz: number): HoleId | null {
  const h = geom.holes.get(from);
  if (!h) return null;
  const x = h.x + dx * PITCH;
  const z = h.z + dz * PITCH;
  const mid = (geom.cols + 1) / 2;
  const col = Math.round(x / PITCH + mid);
  for (const row of [...ROWS, ...RAILS]) {
    if (Math.abs(ROW_Z[row] * PITCH - z) < 0.01) {
      const id = `${row}${col}`;
      const hh = geom.holes.get(id);
      if (hh && Math.abs(hh.x - x) < 0.01) return id;
    }
  }
  return null;
}

/** Board-local z of the centre channel edges and print lines, shared with the renderer. */
export const BOARD_PRINT = {
  channelHalfWidth: 1.4,
  channelDepth: 2.6,
  holeSize: 1.05,
  holeChamfer: 1.55,
  /** z of the red and blue lines, far side then near side. */
  farRed: -9.3 * PITCH,
  farBlue: -6.92 * PITCH,
  nearRed: 6.92 * PITCH,
  nearBlue: 9.3 * PITCH,
  /** z of the column number rows. */
  farNumbers: -6.2 * PITCH,
  nearNumbers: 6.2 * PITCH,
};
