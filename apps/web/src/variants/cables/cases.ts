/**
 * Benches for the cable variants page (/variants/cables) and its audit: a lab's starting bench, or the bench a task's
 * setup lays out (on top of the bench the solution reaches at the previous check, as the lesson player does).
 */
import type { BenchState } from "@ohmland/bench/core";
import { buildBench, type BuiltBench } from "../../lab/build";
import type { LabDefinition } from "../../lab/define";
import { applyStep, solutionSegments } from "../../lab/steps";

export type CaseBench = { bench: BenchState; built: BuiltBench };

/** Every bench a learner meets in a lab: the start, then one per task with a setup. */
export function labCases(lab: LabDefinition): (string | null)[] {
  return [null, ...lab.tasks.filter((t) => t.setup?.length).map((t) => t.id)];
}

/** The bench at a lab's start (`task` null) or right after a task's setup. */
export function caseBench(lab: LabDefinition, task: string | null): CaseBench {
  const built = buildBench(lab.bench);
  if (!task) return { bench: built.bench, built };
  const t = lab.tasks.find((x) => x.id === task);
  const seg = solutionSegments(lab.solution).get(task);
  let bench = built.bench;
  if (seg) for (let i = 0; i < seg.start; i++) bench = applyStep(bench, lab.solution[i]!).bench;
  for (const step of t?.setup ?? []) bench = applyStep(bench, step).bench;
  return { bench, built };
}

export type CableCase = { key: string; lab: string; task: string | null };

export function parseCase(key: string): CableCase {
  const [lab, task] = key.split(":");
  return { key, lab: lab!, task: task || null };
}

/**
 * The benches the variants page compares: the six most cluttered the cable audit found (one per lab), and the first
 * bench every learner meets.
 */
export const CASES: readonly CableCase[] = [
  "welcome-to-the-bench",
  "relay-thresholds:fix-wiper",
  "meet-the-relay:fix-lamp-no",
  "switch-anatomy:fix-selector",
  "both-switches:fix-safety",
  "the-diode:fix-forwards",
  "share-the-push:fix-stray-lead",
].map(parseCase);

/**
 * The lab's own leads whose colour it did not choose (they took the next colour in the box). They build in order,
 * after any written the old way as parts.
 */
export function autoColoured(lab: LabDefinition, built: BuiltBench): Set<string> {
  const out = new Set<string>();
  const specs = lab.bench.leads ?? [];
  const skip = built.bench.leads.length - specs.length;
  specs.forEach((l, i) => {
    const id = built.bench.leads[skip + i]?.id;
    if (id && (typeof l === "string" || !l.color)) out.add(id);
  });
  return out;
}
