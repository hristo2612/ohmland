/**
 * Every lab ships a solution. Replay each one headlessly (bench actions + the in-thread simulator) and check that
 * every required task gets done, and every checkpoint is reached on time. Labs with an empty solution are skipped.
 */
import { describe, expect, it } from "vitest";
import { buildBench } from "./build";
import type { LabDefinition } from "./define";
import { replayLab } from "./replay";

const labs = Object.entries(import.meta.glob<{ default: LabDefinition }>("../../../../content/labs/*.ts", { eager: true }))
  .map(([path, mod]) => ({ file: path.split("/").pop()!, lab: mod.default }))
  .sort((a, b) => a.file.localeCompare(b.file));

describe("lab solutions", () => {
  it("finds the labs", () => {
    expect(labs.length).toBeGreaterThan(0);
  });

  for (const { file, lab } of labs) {
    it(`${lab.id} has a matching file name`, () => {
      expect(file).toBe(`${lab.id}.ts`);
    });

    it(`${lab.id} builds a bench`, () => {
      const built = buildBench(lab.bench);
      expect(built.bench.parts.length + built.bench.leads.length + (built.bench.meter ? 1 : 0)).toBeGreaterThan(0);
    });

    const run = lab.solution.length ? it : it.skip;
    run(`${lab.id}: the solution completes every required task`, () => {
      const r = replayLab(lab);
      expect(r.problems, "steps that did not apply").toEqual([]);
      expect(r.failedChecks, "checkpoints not done in time").toEqual([]);
      expect(r.missing, "required tasks never done").toEqual([]);
    });
  }
});
