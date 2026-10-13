import { describe, expect, it } from "vitest";
import { mergeLearners } from "./merge";
import { emptyLearner, normalizeLearner } from "./state";
import { FRIED_CAP, type LearnerState } from "./types";

const T = (d: number) => new Date(Date.UTC(2026, 0, d)).toISOString();

function make(over: Partial<LearnerState>): LearnerState {
  return { ...emptyLearner(T(1)), ...over };
}

const device = make({
  lessons: {
    a: { at: T(5), version: 1, firstTry: 2, items: 4, tasks: ["t1"] },
    b: { at: T(6), version: 1, firstTry: 3, items: 3, tasks: [] },
  },
  inProgress: { c: { step: 2, answers: { q1: 1 }, at: T(7) } },
  achievements: { "first-spark": { at: T(5) } },
  fried: [{ kind: "led", label: "Red LED", lessonId: "a", at: T(5) }],
  settings: { muted: true, reducedMotion: "on", theme: "dark" },
  updatedAt: T(7),
});

const cloud = make({
  lessons: {
    a: { at: T(3), version: 2, firstTry: 1, items: 5, tasks: ["t2", "t1"] },
    d: { at: T(4), version: 1, firstTry: 0, items: 2, tasks: [] },
  },
  inProgress: { c: { step: 1, answers: {}, at: T(8) } },
  achievements: { "first-spark": { at: T(3) }, "magic-smoke": { at: T(4) } },
  fried: [
    { kind: "led", label: "Red LED", lessonId: "a", at: T(5) },
    { kind: "resistor", label: "470 Ω resistor", lessonId: null, at: T(2) },
  ],
  settings: { muted: false, reducedMotion: "system", theme: "light" },
  updatedAt: T(6),
});

describe("mergeLearners", () => {
  const merged = mergeLearners(device, cloud);

  it("keeps the earliest completion, the union of tasks and the best first-try count", () => {
    expect(merged.lessons.a).toEqual({ at: T(3), version: 2, firstTry: 2, items: 5, tasks: ["t1", "t2"] });
    expect(Object.keys(merged.lessons).sort()).toEqual(["a", "b", "d"]);
  });

  it("unions achievements with the earliest unlock time", () => {
    expect(merged.achievements).toEqual({ "first-spark": { at: T(3) }, "magic-smoke": { at: T(4) } });
  });

  it("unions fried parts by kind and time, oldest first", () => {
    expect(merged.fried.map((f) => `${f.kind}@${f.at}`)).toEqual([`resistor@${T(2)}`, `led@${T(5)}`]);
  });

  it("takes settings from the newer record and the newest in-progress entry", () => {
    expect(merged.settings).toEqual(device.settings);
    expect(merged.inProgress.c).toEqual(cloud.inProgress.c);
    expect(merged.updatedAt).toBe(T(7));
  });

  it("is commutative and idempotent", () => {
    expect(mergeLearners(cloud, device)).toEqual(merged);
    expect(mergeLearners(merged, merged)).toEqual(merged);
    expect(mergeLearners(merged, cloud)).toEqual(merged);
  });

  it("caps the Hall of Fried Parts, keeping the newest", () => {
    const many = (n: number, offset: number) =>
      Array.from({ length: n }, (_, i) => ({ kind: "led", label: "LED", lessonId: null, at: new Date(Date.UTC(2026, 0, 1, 0, 0, offset + i)).toISOString() }));
    const m = mergeLearners(make({ fried: many(400, 0) }), make({ fried: many(400, 300) }));
    expect(m.fried).toHaveLength(FRIED_CAP);
    expect(m.fried.at(-1)?.at).toBe(new Date(Date.UTC(2026, 0, 1, 0, 0, 699)).toISOString());
  });
});

describe("normalizeLearner", () => {
  it("round-trips a valid record and repairs a damaged one", () => {
    expect(normalizeLearner(JSON.parse(JSON.stringify(device)))).toEqual(device);
    expect(normalizeLearner({ v: 2 })).toBeNull();
    expect(normalizeLearner("nope")).toBeNull();
    const repaired = normalizeLearner({ v: 1, lessons: { a: { at: "bad" }, b: { at: T(2), firstTry: "x" } }, settings: { theme: "neon" } });
    expect(repaired?.lessons).toEqual({ b: { at: T(2), version: 1, firstTry: 0, items: 0, tasks: [] } });
    expect(repaired?.settings.theme).toBe("system");
  });
});
