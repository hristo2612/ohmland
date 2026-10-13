import { isPiece, makeIsle, seedFrom } from "@ohmland/isle";
import { describe, expect, it } from "vitest";
import type { CourseOutline } from "../content/outline";
import { START_SEED, isleCounts, isleEvents, revealRange } from "./isleEvents";
import { emptyLearner } from "./state";
import type { LearnerState } from "./types";

const lesson = (id: string, unit: string, mod: string, isle?: string) => ({ id, title: `Lesson ${id}`, href: `/learn/${unit}/${id}`, unit, module: mod, minutes: 8, parts: [], isle, rules: 2 });

// Two units; m1 has three lessons, m2 one, m3 (second unit) one. Lesson "c" names a piece the isle does not know.
const outline: CourseOutline = {
  units: [
    { id: "basics", number: 1, title: "Basics", modules: ["m1", "m2"] },
    { id: "switching", number: 2, title: "Switching", modules: ["m3"] },
  ],
  modules: [
    { id: "m1", unit: "basics", title: "First light", landmark: { id: "lighthouse", name: "Lighthouse" }, lessons: ["a", "b", "c"] },
    { id: "m2", unit: "basics", title: "Meters", landmark: { id: "meter-tower", name: "Meter tower" }, lessons: ["d"] },
    { id: "m3", unit: "switching", title: "Switches", landmark: { id: "no-such-landmark", name: "?" }, lessons: ["e"] },
  ],
  lessons: {
    a: lesson("a", "basics", "m1", "led-lamp"),
    b: lesson("b", "basics", "m1", "resistor"),
    c: lesson("c", "basics", "m1", "sample-mystery-piece"),
    d: lesson("d", "basics", "m2"),
    e: lesson("e", "switching", "m3", "relay"),
  },
  order: ["a", "b", "c", "d", "e"],
};

const T = (min: number) => new Date(Date.UTC(2026, 0, 1, 12, min)).toISOString();

function learner(done: Record<string, string>): LearnerState {
  const s = emptyLearner(T(0));
  for (const [id, at] of Object.entries(done)) s.lessons[id] = { at, version: 1, firstTry: 0, items: 0, tasks: [] };
  return s;
}

const ids = (state: LearnerState) => isleEvents(state, outline).events.map((e) => `${e.type}:${e.id}`);

describe("isleEvents", () => {
  it("gives a new learner no events and the fixed starting seed", () => {
    expect(isleEvents(learner({}), outline)).toEqual({ seed: START_SEED, events: [] });
  });

  it("orders lessons by completion time, ties in course order", () => {
    expect(ids(learner({ b: T(5), e: T(1), a: T(5) }))).toEqual(["lesson:e", "module:m3", "lesson:a", "lesson:b"]);
  });

  it("puts a module right after the lesson that finished it, whatever order its lessons were done in", () => {
    expect(ids(learner({ c: T(1), a: T(2), d: T(3), b: T(4), e: T(5) }))).toEqual([
      "lesson:c",
      "lesson:a",
      "lesson:d",
      "module:m2",
      "lesson:b",
      "module:m1",
      "lesson:e",
      "module:m3",
    ]);
  });

  it("seeds from the first finished lesson and its time", () => {
    expect(isleEvents(learner({ b: T(9), d: T(3) }), outline).seed).toBe(seedFrom("d", T(3)));
  });

  it("carries units, pieces, landmarks and titles from the outline, and skips lessons no longer in the course", () => {
    const { events } = isleEvents(learner({ gone: T(0), a: T(1), b: T(2), c: T(3) }), outline);
    expect(events).toEqual([
      { type: "lesson", unit: "basics", piece: "led-lamp", title: "Lesson a", id: "a" },
      { type: "lesson", unit: "basics", piece: "resistor", title: "Lesson b", id: "b" },
      { type: "lesson", unit: "basics", piece: "sample-mystery-piece", title: "Lesson c", id: "c" },
      { type: "module", unit: "basics", landmark: "lighthouse", title: "First light", id: "m1" },
    ]);
    expect(isleCounts(events)).toEqual({ lessons: 3, modules: 1 });
  });

  it("lets the planner fill in pieces and landmarks it does not know", () => {
    const { seed, events } = isleEvents(learner({ c: T(1), d: T(2), e: T(3) }), outline);
    const plan = makeIsle(seed, events);
    const placed = (at: number) => plan.items.filter((it) => it.tiers[0] === at);
    // c names an unknown piece and d names none: both still place a real piece from the deck
    expect(placed(0).map((it) => isPiece(it.kind))).toEqual([true]);
    expect(placed(1).map((it) => isPiece(it.kind))).toEqual([true]);
    // m3's unknown landmark becomes a real one on the switching island
    expect(plan.items.some((it) => it.landmark && it.story[0]?.ref === "m3")).toBe(true);
  });
});

describe("revealRange", () => {
  it("reveals the new lesson, and the module it finished", () => {
    const before = isleEvents(learner({ a: T(1), b: T(2) }), outline).events;
    const after = isleEvents(learner({ a: T(1), b: T(2), c: T(3) }), outline).events;
    expect(revealRange(before, after)).toEqual({ from: 1, to: 3 });
  });

  it("reveals from the bare plot for the first lesson", () => {
    expect(revealRange([], isleEvents(learner({ a: T(1) }), outline).events)).toEqual({ from: -1, to: 0 });
  });

  it("has nothing to reveal for a replay", () => {
    const events = isleEvents(learner({ a: T(1) }), outline).events;
    expect(revealRange(events, events)).toBeNull();
  });

  it("reveals everything after the shared start when a late record sorts earlier", () => {
    const before = isleEvents(learner({ a: T(1), b: T(5) }), outline).events;
    const after = isleEvents(learner({ a: T(1), b: T(5), d: T(3) }), outline).events;
    expect(revealRange(before, after)).toEqual({ from: 0, to: 3 });
  });
});
