/** The coach mark's move: the first step of a task's own solution the bench does not show done, as a gesture. */
import { describe, expect, it } from "vitest";
import welcome from "../../../../../content/labs/welcome-to-the-bench";
import whatResists from "../../../../../content/labs/what-resists";
import { buildBench } from "../../lab/build";
import { applyStep, solutionSegments } from "../../lab/steps";
import type { LabDefinition } from "../../lab/define";
import { firstMove } from "./coach";

/** The bench the solution reaches just before `task`'s own steps. */
const before = (lab: LabDefinition, task: string) =>
  lab.solution.slice(0, solutionSegments(lab.solution).get(task)!.start).reduce((b, s) => applyStep(b, s).bench, buildBench(lab.bench).bench);

describe("coach mark", () => {
  it("rings a switch to flip and draws a clip's carry onto its snap", () => {
    const start = buildBench(welcome.bench).bench;
    expect(firstMove(welcome, "close-the-switch", start)).toEqual({ kind: "press", at: "part:S1" });
    const switched = applyStep(start, { do: "flip", part: "S1", to: "b" }).bench;
    expect(firstMove(welcome, "find-the-gap", switched)).toEqual({ kind: "path", from: "lead:TL1.a", to: "pin:B1.pos" });
  });

  it("pulls a clip off, and knows a move already made", () => {
    const lit = before(welcome, "break-the-loop");
    expect(firstMove(welcome, "break-the-loop", lit)).toEqual({ kind: "path", from: "lead:TL4.b", to: null });
    // Mended already: nothing left to show.
    expect(firstMove(welcome, "mend-the-loop", lit)).toBeNull();
  });

  it("turns the meter's dial the short way and points at a setting's own tab", () => {
    const start = buildBench(whatResists.bench).bench;
    expect(firstMove(whatResists, "dry-skin", start)).toEqual({ kind: "dial", meter: "M1", from: 0, to: 3 });
    const dial = applyStep(start, { do: "dial", mode: "ohm" }).bench;
    expect(firstMove(whatResists, "dry-skin", dial)).toBeNull();
    expect(firstMove(whatResists, "wet-skin", dial)).toEqual({ kind: "press", at: "part:P1/wet" });
  });
});
