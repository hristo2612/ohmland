/**
 * The coach mark's move (CoachMark.tsx): the first step of a task's own solution that the bench does not show done
 * yet, as a gesture to draw. Pure: coach.test.ts covers it.
 */
import { DIAL_MODES, partMarks, type BenchState } from "@ohmland/bench/core";
import { resolveAttach } from "../../lab/anchors";
import type { LabDefinition, SolutionStep } from "../../lab/define";
import { applyStep, solutionSegments } from "../../lab/steps";

export type CoachMove =
  /** Carry something (a part, a clip, a probe tip) from `from` to `to`, or pull it off (`to: null`). `from: "tray"`: a new part. */
  | { kind: "path"; from: string; to: string | null }
  /** Turn the meter's dial between two detents (indices into DIAL_MODES, clockwise from the top). */
  | { kind: "dial"; meter: string; from: number; to: number }
  /** Turn a control on a part from one share of its travel to another (0 to 1). */
  | { kind: "turn"; at: string; from: number; to: number }
  /** Tap or press something. */
  | { kind: "press"; at: string };

/** Where a solution's `at` puts a part, as an anchor to point at; null for a bare desk spot (it cannot be pointed at). */
function placeAnchor(bench: BenchState, at: string): string | null {
  const seat = /^(?:in|on):([A-Za-z][\w-]*)/.exec(at);
  if (seat) return `part:${seat[1]}`;
  if (at.startsWith("desk:") || at === "shelf") return null;
  return resolveAttach(bench, at.split("-")[0]!);
}

/** A part's spot for a setting it changes: its mark of that name (the skin's "wet" tab, a box's "lid"), else the part. */
function settingAnchor(bench: BenchState, partId: string, params: Record<string, unknown>): string {
  const part = bench.parts.find((p) => p.id === partId);
  const marks = part ? partMarks(part) : {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && marks[value]) return `part:${partId}/${value}`;
    if (marks[key]) return `part:${partId}/${key}`;
  }
  return `part:${partId}`;
}

/** The gesture a solution step stands for on this bench, or null when it is not one the learner makes on the bench. */
export function moveOf(step: SolutionStep, bench: BenchState, lab: LabDefinition, control: (id: string) => number | undefined = () => undefined): CoachMove | null {
  switch (step.do) {
    case "clip": {
      const to = step.to ? resolveAttach(bench, step.to) : null;
      return { kind: "path", from: `lead:${step.lead}.${step.end}`, to };
    }
    case "lead": {
      const from = resolveAttach(bench, step.from);
      const to = resolveAttach(bench, step.to);
      return from && to ? { kind: "path", from, to } : null;
    }
    case "wire": {
      const from = resolveAttach(bench, step.from);
      const to = resolveAttach(bench, step.to);
      return from && to ? { kind: "path", from, to } : null;
    }
    case "unwire":
      return { kind: "path", from: `wire:${step.wire}.b`, to: null };
    case "probe": {
      // The tip that has somewhere new to go.
      for (const c of ["red", "black"] as const) {
        const want = step[c];
        if (want === undefined) continue;
        const to = want === null ? null : resolveAttach(bench, want);
        if (bench.meter && bench.meter.probes[c].tip.to !== to) return { kind: "path", from: `probe:${c}`, to };
      }
      return null;
    }
    case "plug":
      return bench.meter && step.socket ? { kind: "press", at: `part:${bench.meter.id}/${step.socket}` } : null;
    case "move":
    case "place": {
      if (step.at === undefined) {
        // Flying leads only: the first one that moves.
        const [leg, hole] = Object.entries(step.holes)[0] ?? [];
        if (!leg) return null;
        const to = hole ? resolveAttach(bench, hole) : null;
        return { kind: "path", from: `pin:${step.part}.${leg}`, to };
      }
      const to = placeAnchor(bench, step.at);
      const from = step.do === "place" ? "tray" : `part:${step.part}`;
      return to ? { kind: "path", from, to } : step.do === "move" ? { kind: "press", at: from } : null;
    }
    case "dial": {
      const meter = bench.meter;
      if (!meter) return null;
      const from = DIAL_MODES.indexOf(meter.mode as (typeof DIAL_MODES)[number]);
      const to = DIAL_MODES.indexOf(step.mode as (typeof DIAL_MODES)[number]);
      // Only the range changes: that is on the meter's panel, not its dial.
      return from >= 0 && to >= 0 && from !== to ? { kind: "dial", meter: meter.id, from, to } : null;
    }
    case "control": {
      const c = lab.bench.controls?.find((x) => x.id === step.id);
      if (!c?.part || c.part === "*" || !c.key) return null;
      const share = (v: number) => (c.max === c.min ? 0 : Math.min(1, Math.max(0, (v - c.min) / (c.max - c.min))));
      const from = share(control(step.id) ?? c.value ?? c.min);
      const to = share(step.value);
      return Math.abs(to - from) > 0.01 ? { kind: "turn", at: `part:${c.part}`, from, to } : null;
    }
    case "param":
      return { kind: "press", at: settingAnchor(bench, step.part, step.params) };
    case "flip":
    case "press":
    case "rotate":
    case "remove":
    case "action":
      return { kind: "press", at: `part:${step.part}` };
    default:
      return null;
  }
}

/**
 * The bench anchors a move happens at (for framing it): what it carries and where to, the thing to press, or the
 * meter's dial with its display (the arc reaches past the knob, and the display shows what the turn did).
 */
export function coachAnchors(move: CoachMove | null): string[] {
  if (!move) return [];
  if (move.kind === "path") return [move.from, move.to].filter((a): a is string => !!a && a !== "tray");
  return move.kind === "dial" ? [`part:${move.meter}/dial`, `part:${move.meter}/display`] : [move.at];
}

/** Steps that leave the bench's layout as it was (a press, a slider): only `moveOf` can tell whether they are due. */
const NO_TRACE = new Set<SolutionStep["do"]>(["press", "action", "control"]);

/**
 * The first move of `taskId`'s own solution steps (after its setup) that the learner has not made yet: a step that
 * would leave this bench as it is counts as made.
 */
export function firstMove(lab: LabDefinition, taskId: string, bench: BenchState, control?: (id: string) => number | undefined): CoachMove | null {
  const seg = solutionSegments(lab.solution).get(taskId);
  if (!seg) return null;
  const skip = lab.tasks.find((t) => t.id === taskId)?.setup?.length ?? 0;
  const now = JSON.stringify(bench);
  for (const step of lab.solution.slice(seg.start + skip, seg.end)) {
    const move = moveOf(step, bench, lab, control);
    if (!move) continue;
    const after = applyStep(bench, step);
    if (after.problem || (!NO_TRACE.has(step.do) && JSON.stringify(after.bench) === now)) continue;
    return move;
  }
  return null;
}
