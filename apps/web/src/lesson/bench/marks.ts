/**
 * Ink marks the lesson draws over the bench (Annotations.tsx renders them through BenchController.project, so they
 * look the same over the 3D and the ink view). Pure helpers: anchor resolution and hole judging for tap checks.
 */
import { boardGeometry, type BenchState } from "@ohmland/bench/core";
import { resolveAttach } from "../../lab/anchors";

export type MarkKind =
  /** A short line of ink with an arrow to the anchor: a discovery. Fades to a dot when the lesson moves on. */
  | "note"
  /** A part's name, written onto it (the three-period lesson's first period). */
  | "label"
  /** A tick written at the anchor. */
  | "tick"
  /** A pencil ring around the anchor (a marked hole, a wrong tap). */
  | "ring"
  /** An outline around a breadboard hole's whole strip (x-ray finds). */
  | "strip";

export type Mark = {
  id: string;
  kind: MarkKind;
  /** Lab shorthand or a raw anchor. */
  at: string;
  text?: string;
  tone: "ink" | "blue" | "red";
  /** Faded: a note that has had its moment shows as a small dot. */
  faded?: boolean;
};

/**
 * A raw bench anchor for lab shorthand: "D1" -> "part:D1", "D1.anode" -> "pin:D1.anode", "e12" -> "hole:e12". Raw anchors
 * and marks ("part:M1/dial") pass through.
 */
export function resolveAnchor(bench: BenchState, s: string): string | null {
  if (/^(pin|hole|wire|lead|probe|socket|part):/.test(s)) return s;
  if (bench.parts.some((p) => p.id === s) || bench.meter?.id === s) return `part:${s}`;
  if (bench.wires.some((w) => w.id === s)) return `wire:${s}.b`;
  if (bench.leads.some((l) => l.id === s)) return `lead:${s}.a`;
  return resolveAttach(bench, s);
}

export type HoleVerdict = "right" | "self" | "across" | "other-strip" | "rail-for-strip" | "strip-for-rail" | "other-rail";

/** Judges a tapped hole against "a hole joined to `marker`" on the bench's board. */
export function judgeJoined(bench: BenchState, marker: string, tapped: string): HoleVerdict {
  if (!bench.board) return "other-strip";
  const g = boardGeometry(bench.board);
  const a = g.holes.get(marker.replace(/^hole:/, ""));
  const b = g.holes.get(tapped.replace(/^hole:/, ""));
  if (!a || !b) return "other-strip";
  if (a.id === b.id) return "self";
  if (a.strip === b.strip) return "right";
  if (a.rail && b.rail) return "other-rail";
  if (a.rail) return "strip-for-rail";
  if (b.rail) return "rail-for-strip";
  return a.col === b.col ? "across" : "other-strip";
}

/** The holes of the strip a hole belongs to (for the x-ray outline). */
export function stripHoles(bench: BenchState, hole: string): string[] {
  if (!bench.board) return [];
  const g = boardGeometry(bench.board);
  const h = g.holes.get(hole.replace(/^hole:/, ""));
  return h ? (g.strips.get(h.strip)?.holes ?? []) : [];
}

/** Every hole id on the bench's board. */
export function allHoles(bench: BenchState): string[] {
  return bench.board ? [...boardGeometry(bench.board).holes.keys()] : [];
}
