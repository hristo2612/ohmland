/**
 * Every lab ships a solution. Replay each one headlessly (bench actions + the in-thread simulator) and check that
 * every required task gets done, and every checkpoint is reached on time. Every lab must have a solution: none is
 * skipped.
 */
import { describe, expect, it } from "vitest";
import { buildBench } from "./build";
import { isOptional, type LabDefinition } from "./define";
import { replayLab, replayShowMe } from "./replay";

const labs = Object.entries(import.meta.glob<{ default: LabDefinition }>("../../../../content/labs/*.ts", { eager: true }))
  .map(([path, mod]) => ({ file: path.split("/").pop()!, lab: mod.default }))
  .sort((a, b) => a.file.localeCompare(b.file));

/** Labs used by the Start here and Basics lessons (their `lab:` steps, or a bench lesson's `lab:`): no bench warnings. */
const STRICT = new Set(
  Object.values(
    import.meta.glob<string>(["../../../../content/units/start-here/**/lesson.yaml", "../../../../content/units/basics/**/lesson.yaml"], { eager: true, query: "?raw", import: "default" }),
  ).flatMap((yaml) =>
    [...yaml.matchAll(/^\s*lab:\s*([a-z0-9-]+)\s*$/gm)].map((m) => m[1]!),
  ),
);

describe("lab solutions", () => {
  it("finds the labs", () => {
    expect(labs.length).toBeGreaterThan(0);
    // The Start here labs (six so far), and Basics' 15 classic labs plus the split halves salt-and-water, the-liar,
    // share-the-push, use-the-law, end-to-end, count-the-watts, big-current and how-long.
    expect(STRICT.size).toBeGreaterThanOrEqual(29);
  });

  for (const { file, lab } of labs) {
    it(`${lab.id} has a matching file name`, () => {
      expect(file).toBe(`${lab.id}.ts`);
    });

    it(`${lab.id} builds a bench`, () => {
      const built = buildBench(lab.bench);
      expect(built.bench.parts.length + built.bench.leads.length + (built.bench.meter ? 1 : 0)).toBeGreaterThan(0);
      if (STRICT.has(lab.id)) expect(built.warnings, "bench warnings").toEqual([]);
    });

    // Oscillators with a speaker step at the audio rate: the siren's replay takes several seconds.
    it(`${lab.id}: the solution completes every required task`, { timeout: 120_000 }, () => {
      expect(lab.solution.length, "every lab needs a solution").toBeGreaterThan(0);
      const r = replayLab(lab);
      expect(r.problems, "steps that did not apply").toEqual([]);
      expect(r.failedChecks, "checkpoints not done in time").toEqual([]);
      expect(r.missing, "required tasks never done").toEqual([]);
      // An achievement trigger that the lab's own solution never fires may be one no learner can fire either.
      const triggers = [...Object.keys(lab.triggers ?? {}), ...lab.tasks.flatMap((t) => (t.trigger ? [t.trigger] : []))];
      expect(r.triggers, "achievement triggers the solution never fires").toEqual(expect.arrayContaining(triggers));
    });

    // "Show me" rewinds to a task's checkpoint and plays only that task's steps: they must finish the task on their
    // own (a fade that needs a fill first, a reading that needs the probes back on), or a stuck learner stays stuck.
    it(`${lab.id}: Show me finishes every required task from its checkpoint`, { timeout: 180_000 }, () => {
      const failed: string[] = [];
      for (const task of lab.tasks.filter((t) => !isOptional(t))) {
        const r = replayShowMe(lab, task.id);
        if (r.error) failed.push(`${task.id}: ${r.error}`);
        else if (r.problems.length) failed.push(`${task.id}: ${r.problems.join("; ")}`);
        else if (!r.done) failed.push(`${task.id}: still open after its Show me`);
      }
      expect(failed, "tasks Show me cannot finish").toEqual([]);
    });
  }
});
