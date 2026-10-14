/**
 * Soldering helpers shared by the Unit 3 labs (docs/curriculum/unit-3.md, docs/LABS.md "Unit 3 kinds").
 *
 * Setups and solutions cannot hold an iron, so they write the joints a beat needs as records on the bench. `joint`
 * builds the record the station engine keeps once a joint has set (the same fields and numbers as `madeJoint` in
 * packages/bench/src/solder/station.ts, which content labs cannot import), and `jointsStep` and `spliceStep` turn
 * records into `param` steps.
 */
import type { LabView, SolutionStep } from "@ohmland/lab";

export type Verdict = "good" | "cold" | "disturbed" | "too-much" | "too-little" | "bridge" | "burnt";
export type WorkKind = "pad" | "crossed" | "splice" | "heavy";
export type Alloy = "leaded" | "lead-free" | "acid";

/** Solder for a good fillet (mm³), as the joint model's WORK table. */
const IDEAL: Record<WorkKind, number> = { pad: 1.5, crossed: 3, splice: 4, heavy: 9 };
const MELT: Record<Alloy, number> = { leaded: 183, "lead-free": 220, acid: 190 };

export type JointRecord = {
  kind: WorkKind;
  alloy: Alloy;
  volume: number;
  wetted: number;
  peakC: number;
  moved: boolean;
  fedAt: "work" | "tip" | null;
  bridgeTo: string | null;
  lifted: boolean;
  coldTouch: boolean;
  flux: number;
  verdict: Verdict;
};

/** A joint as if it had been made and judged `verdict` (a bridge needs `bridgeTo`, a pad). */
export function joint(verdict: Verdict, opts: { alloy?: Alloy; kind?: WorkKind; bridgeTo?: string; fedAt?: "work" | "tip" } = {}): JointRecord {
  const kind = opts.kind ?? "pad";
  const alloy = opts.alloy ?? "lead-free";
  const ideal = IDEAL[kind];
  const melt = MELT[alloy];
  const base: JointRecord = { kind, alloy, volume: ideal, wetted: 0.95, peakC: melt + 60, moved: false, fedAt: opts.fedAt ?? "work", bridgeTo: null, lifted: false, coldTouch: false, flux: 0.3, verdict };
  switch (verdict) {
    case "too-much":
      return { ...base, volume: ideal * 2.1 };
    case "too-little":
      return { ...base, volume: ideal * 0.35 };
    case "cold":
      return { ...base, wetted: 0.3, peakC: melt + 5 };
    case "disturbed":
      return { ...base, moved: true };
    case "bridge":
      return { ...base, volume: ideal * 2.8, bridgeTo: opts.bridgeTo ?? null };
    case "burnt":
      return { ...base, peakC: 440, flux: 0 };
    default:
      return base;
  }
}

/** A `param` step that sets a perfboard's joints (every joint it should have: the param replaces the whole map). */
export function jointsStep(board: string, joints: Record<string, JointRecord>): SolutionStep {
  return { do: "param", part: board, params: { joints } as never };
}

/** A `param` step that solders wire end `end` of `wire` to the other wire's end `with` ("HW2.a"). */
export function spliceStep(wire: string, end: "a" | "b", withEnd: string, rec: JointRecord): SolutionStep {
  return { do: "param", part: wire, params: { joints: { [end]: { ...rec, with: withEnd } } } as never };
}

/** A joint at a spot (a pad "PB1.C7" or a splice "HW1.b") has set with one of these verdicts. */
export function setAs(lab: LabView, spot: string, ...verdicts: Verdict[]): boolean {
  const j = lab.solder.joint(spot);
  return !!j && j.state === "set" && j.verdict !== null && verdicts.includes(j.verdict);
}

/** The joint at a spot has set and holds metal to metal: good, or a little too much solder. */
export const sound = (lab: LabView, spot: string): boolean => setAs(lab, spot, "good", "too-much");

/** A clip on a lead between the body and the iron's mark (12 mm along the lead). */
export const clipBetween = (lab: LabView, clip: string, lead: string): boolean => {
  const c = lab.solder.clip(clip);
  return !!c && c.on === lead && c.mm !== null && c.mm < 12;
};
