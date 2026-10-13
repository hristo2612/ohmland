/**
 * Lab shorthand for bench places: holes ("e12", "rail+:12"), attach points ("R1.a", "W1.b"), spots ("desk:left").
 * Pure: shared by the bench builder, solution replays and the LabView.
 */
import { boardGeometry, parseHole, type BenchState, type BoardSpec, type HoleId, type Vec2 } from "@ohmland/bench/core";

const RAIL_ALIAS: Record<string, string> = { "rail+": "bp", "rail-": "bn", "top+": "tp", "top-": "tn" };

/** A hole id from lab shorthand, or null. Rail columns with no hole (the gaps) snap to the nearest rail hole. */
export function resolveHole(board: BoardSpec | null, s: string): HoleId | null {
  if (!board) return null;
  const raw = s.startsWith("hole:") ? s.slice(5) : s;
  const m = /^(rail\+|rail-|top\+|top-):(\d+)$/.exec(raw);
  const id = m ? `${RAIL_ALIAS[m[1]!]}${m[2]}` : raw;
  const geom = boardGeometry(board);
  if (geom.holes.has(id)) return id;
  const p = parseHole(id);
  if (!p || !["bp", "bn", "tp", "tn"].includes(p.row)) return null;
  let best: HoleId | null = null;
  let bestD = Infinity;
  for (const c of geom.railCols) {
    const d = Math.abs(c - p.col);
    if (d < bestD) {
      bestD = d;
      best = `${p.row}${c}`;
    }
  }
  return best;
}

/** Splits "e5-e12", "rail+:5-a5", "a12-rail-:12" or "a -> b" into hole tokens. */
export function splitHoles(s: string): string[] {
  const arrow = s.split(/\s*(?:->|→|\|| to )\s*/);
  if (arrow.length > 1) return arrow.map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  const re = /(rail[+-]:\d+|top[+-]:\d+|hole:[a-z]+\d+|tp\d+|tn\d+|bp\d+|bn\d+|[a-j]\d+)/g;
  for (const m of s.matchAll(re)) out.push(m[1]!);
  return out;
}

/**
 * A bench anchor from lab shorthand: "R1.a" -> "pin:R1.a", "e12" -> "hole:e12", "W1.b" -> "wire:W1.b",
 * "TL1.a" -> "lead:TL1.a", "red" or "probe:red" -> "probe:red". Raw anchors pass through. Null when it names nothing.
 */
export function resolveAttach(bench: BenchState, s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^(pin|hole|wire|lead|probe|socket):/.test(t)) {
    if (t.startsWith("hole:")) {
      const h = resolveHole(bench.board, t);
      return h ? `hole:${h}` : null;
    }
    return t;
  }
  if (t === "red" || t === "black") return `probe:${t}`;
  const dot = t.lastIndexOf(".");
  if (dot > 0) {
    const id = t.slice(0, dot);
    const end = t.slice(dot + 1);
    if (bench.parts.some((p) => p.id === id)) return `pin:${id}.${end}`;
    if ((end === "a" || end === "b") && bench.wires.some((w) => w.id === id)) return `wire:${id}.${end}`;
    if ((end === "a" || end === "b") && bench.leads.some((l) => l.id === id)) return `lead:${id}.${end}`;
    return null;
  }
  const h = resolveHole(bench.board, t);
  return h ? `hole:${h}` : null;
}

/** Named desk spots, in millimetres from the work centre. */
const SPOTS: Record<string, Vec2> = {
  center: [0, 0],
  centre: [0, 0],
  left: [-110, 0],
  right: [110, 0],
  front: [0, 55],
  back: [0, -70],
  "front-left": [-90, 55],
  "front-right": [90, 55],
  "back-left": [-95, -70],
  "back-right": [95, -70],
};

/** A desk position from "desk:left" or "desk:40,-20", or null when the spot is not a desk spot. */
export function deskSpot(s: string): Vec2 | null {
  if (!s.startsWith("desk:")) return null;
  const rest = s.slice(5);
  const xy = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(rest);
  if (xy) return [Number(xy[1]), Number(xy[2])];
  return SPOTS[rest] ?? null;
}
