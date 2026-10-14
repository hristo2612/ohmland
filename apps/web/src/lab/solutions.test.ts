/**
 * Every lab ships a solution. Replay each one headlessly (bench actions + the in-thread simulator) and check that
 * every required task gets done, and every checkpoint is reached on time. Every lab must have a solution: none is
 * skipped.
 */
import { describe, expect, it } from "vitest";
import { buildBench } from "./build";
import type { LabDefinition } from "./define";
import { replayLab } from "./replay";

const labs = Object.entries(import.meta.glob<{ default: LabDefinition }>("../../../../content/labs/*.ts", { eager: true }))
  .map(([path, mod]) => ({ file: path.split("/").pop()!, lab: mod.default }))
  .sort((a, b) => a.file.localeCompare(b.file));

/** Labs used by the basics unit's lessons (their `lab:` steps, or a bench lesson's `lab:`). */
const BASICS = new Set(
  Object.values(import.meta.glob<string>("../../../../content/units/basics/**/lesson.yaml", { eager: true, query: "?raw", import: "default" })).flatMap((yaml) =>
    [...yaml.matchAll(/^\s*lab:\s*([a-z0-9-]+)\s*$/gm)].map((m) => m[1]!),
  ),
);

describe("lab solutions", () => {
  it("finds the labs", () => {
    expect(labs.length).toBeGreaterThan(0);
    // 18 classic Unit 1 labs, plus how-a-breadboard-works (at the start of Your meter until Start here exists), plus
    // the split halves salt-and-water, the-liar, share-the-push, use-the-law, end-to-end, count-the-watts, big-current
    // and how-long.
    expect(BASICS.size).toBe(27);
  });

  for (const { file, lab } of labs) {
    it(`${lab.id} has a matching file name`, () => {
      expect(file).toBe(`${lab.id}.ts`);
    });

    it(`${lab.id} builds a bench`, () => {
      const built = buildBench(lab.bench);
      expect(built.bench.parts.length + built.bench.leads.length + (built.bench.meter ? 1 : 0)).toBeGreaterThan(0);
      if (BASICS.has(lab.id)) expect(built.warnings, "bench warnings").toEqual([]);
    });

    // Oscillators with a speaker step at the audio rate: the siren's replay takes several seconds.
    it(`${lab.id}: the solution completes every required task`, { timeout: 120_000 }, () => {
      expect(lab.solution.length, "every lab needs a solution").toBeGreaterThan(0);
      const r = replayLab(lab);
      expect(r.problems, "steps that did not apply").toEqual([]);
      expect(r.failedChecks, "checkpoints not done in time").toEqual([]);
      expect(r.missing, "required tasks never done").toEqual([]);
    });
  }
});
