import { describe, expect, it } from "vitest";
import type { CourseOutline } from "../content/outline";
import { achievementById, achievementXp, describeAchievement, evaluateAchievements, type LabEvent } from "./achievements";
import { lessonStates, totalXp } from "./derive";
import { levelForXp, levelProgress, levelTitle, xpForLevel } from "./levels";
import { emptyLearner } from "./state";
import type { LearnerState } from "./types";
import { lessonXp, xpBreakdown } from "./xp";

const lesson = (id: string, mod: string, parts: string[] = []) => ({
  id,
  title: id,
  href: `/learn/u/${id}`,
  unit: "u",
  module: mod,
  minutes: 8,
  parts,
  rules: 3,
});

const outline: CourseOutline = {
  units: [{ id: "u", number: 1, title: "U", modules: ["m1", "m2"] }],
  modules: [
    { id: "m1", unit: "u", title: "M1", landmark: { id: "l1", name: "L1" }, lessons: ["a", "b"] },
    { id: "m2", unit: "u", title: "M2", landmark: { id: "l2", name: "L2" }, lessons: ["c"] },
  ],
  lessons: { a: lesson("a", "m1", ["led"]), b: lesson("b", "m1", ["resistor", "led"]), c: lesson("c", "m2") },
  order: ["a", "b", "c"],
};

const done = (state: LearnerState, id: string, firstTry: number, items: number, tasks: string[] = [], at = "2026-01-01T00:00:00.000Z") => ({
  ...state,
  lessons: { ...state.lessons, [id]: { at, version: 1, firstTry, items, tasks } },
});

describe("levels", () => {
  it("follows 50 L (L - 1)", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });

  it("maps XP to levels at and around each threshold", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(-5)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
    expect(levelForXp(600)).toBe(4);
    for (let level = 1; level <= 40; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      if (level > 1) expect(levelForXp(xpForLevel(level) - 1)).toBe(level - 1);
    }
  });

  it("reports progress inside a level", () => {
    expect(levelProgress(450)).toMatchObject({ level: 3, floor: 300, next: 600, into: 150, span: 300, ratio: 0.5 });
  });

  it("has a title for every level up to 20, then keeps the last", () => {
    expect(levelTitle(1)).toBe("Spark");
    expect(levelTitle(2)).toBe("Tinkerer");
    expect(levelTitle(20)).toBe(levelTitle(35));
    const titles = new Set(Array.from({ length: 20 }, (_, i) => levelTitle(i + 1)));
    expect(titles.size).toBe(20);
  });
});

describe("xp", () => {
  it("scores a lesson as 30 + 10 per first try + 15 per task", () => {
    expect(lessonXp({ firstTry: 0, tasks: [] })).toBe(30);
    expect(lessonXp({ firstTry: 4, tasks: ["x", "y"] })).toBe(30 + 40 + 30);
  });

  it("adds 100 per completed module and the XP of unlocked achievements", () => {
    let s = emptyLearner();
    s = done(s, "a", 3, 4, ["t1"]);
    expect(xpBreakdown(s, outline)).toEqual({ lessons: 75, modules: 0, achievements: 0, total: 75 });
    s = done(s, "b", 2, 2);
    expect(xpBreakdown(s, outline)).toMatchObject({ lessons: 75 + 50, modules: 100 });
    s = { ...s, achievements: { "first-spark": { at: "2026-01-01T00:00:00.000Z" }, "gone-achievement": { at: "2026-01-01T00:00:00.000Z" } } };
    expect(xpBreakdown(s, outline, achievementXp)).toMatchObject({ achievements: achievementXp("first-spark") });
    expect(totalXp(s, outline)).toBe(75 + 50 + 100 + achievementXp("first-spark"));
  });

  it("is derived only from the record: the same record gives the same XP", () => {
    const s = done(done(emptyLearner(), "a", 1, 1), "c", 0, 3);
    expect(totalXp(s, outline)).toBe(totalXp(structuredClone(s), outline));
  });
});

describe("achievements", () => {
  it("unlocks once, at the given time, and only when the check passes", () => {
    const now = "2026-02-02T00:00:00.000Z";
    const s0 = emptyLearner();
    expect(evaluateAchievements({ state: s0, outline, events: [] }, now).earned).toEqual([]);
    const s1 = done(s0, "a", 2, 2);
    const r1 = evaluateAchievements({ state: s1, outline, events: [] }, now);
    expect(r1.earned.map((a) => a.id).sort()).toEqual(["clean-sweep", "first-spark"]);
    expect(r1.state.achievements["first-spark"]).toEqual({ at: now });
    expect(evaluateAchievements({ state: r1.state, outline, events: [] }, now).earned).toEqual([]);
  });

  it("counts fried parts for the Hall of Fried Parts achievements", () => {
    const fried = Array.from({ length: 3 }, (_, i) => ({ kind: "led", label: "Red LED", lessonId: null, at: `2026-01-0${i + 1}T00:00:00.000Z` }));
    const r = evaluateAchievements({ state: { ...emptyLearner(), fried }, outline, events: [] }, "2026-02-02T00:00:00.000Z");
    expect(r.earned.map((a) => a.id).sort()).toEqual(["magic-smoke", "tiny-graves"]);
  });

  it("checks the Basics achievements against tasks, perfect modules and the whole unit", () => {
    const basics: CourseOutline = {
      units: [{ id: "basics", number: 1, title: "Basics", modules: ["m1", "m2"] }],
      modules: [
        { id: "m1", unit: "basics", title: "M1", landmark: { id: "l1", name: "L1" }, lessons: ["meet-the-meter", "first-glow"] },
        { id: "m2", unit: "basics", title: "M2", landmark: { id: "l2", name: "L2" }, lessons: ["lemon-cell"] },
      ],
      lessons: {},
      order: ["meet-the-meter", "first-glow", "lemon-cell"],
    };
    const earned = (s: LearnerState) => evaluateAchievements({ state: s, outline: basics, events: [] }, "2026-02-02T00:00:00.000Z").earned.map((a) => a.id);

    let s = done(emptyLearner(), "meet-the-meter", 6, 6, ["read-battery", "tired-battery"]);
    expect(earned(s)).toContain("first-reading");
    expect(earned(s)).not.toContain("spotless-module");
    s = done(s, "first-glow", 6, 6, ["build-loop", "no-resistor"]);
    expect(earned(s)).toEqual(expect.arrayContaining(["glow-getter", "spotless-module"]));
    expect(earned(s)).not.toContain("island-founder");
    s = done(s, "lemon-cell", 3, 6, ["one-lemon-led"]);
    expect(earned(s)).toContain("island-founder");
    // The lesson count comes from the outline, not from the copy.
    expect(describeAchievement(achievementById("island-founder")!, basics)).toContain("all 3 lessons");

    // About half of the Basics secrets unlock "curious-mind" (the list itself is checked in achievements.test.ts).
    const curious = achievementById("curious-mind")!;
    const secrets = curious.refs!.bonus!;
    const goal = Math.ceil(secrets.length / 2);
    expect(curious.description).toContain(`Find ${goal} secrets`);
    const withSecrets = (n: number) => secrets.slice(0, n).reduce((acc, [lesson, task]) => done(acc, lesson, 1, 1, [...(acc.lessons[lesson]?.tasks ?? []), task]), emptyLearner());
    expect(earned(withSecrets(goal - 1))).not.toContain("curious-mind");
    expect(earned(withSecrets(goal))).toContain("curious-mind");
  });

  it("brackets the current across two lessons: the 1 A fuse blown first, then the 3 A fuse's trigger", () => {
    const now = "2026-02-02T00:00:00.000Z";
    const trigger = { type: "trigger" as const, name: "bracketed", lessonId: "big-current" };
    const earned = (s: LearnerState, events: LabEvent[]) => evaluateAchievements({ state: s, outline, events }, now).earned.map((a) => a.id);
    const blown = done(emptyLearner(), "fuse-guard", 1, 1, ["blow-1a"]);
    expect(earned(emptyLearner(), [trigger])).not.toContain("bracketed");
    expect(earned(blown, [])).not.toContain("bracketed");
    expect(earned(blown, [trigger])).toContain("bracketed");
  });
});

describe("course map states", () => {
  it("marks done, current, open and locked", () => {
    expect(lessonStates(emptyLearner(), outline)).toEqual({ a: "current", b: "locked", c: "locked" });
    const s = done(emptyLearner(), "a", 1, 1);
    expect(lessonStates(s, outline)).toEqual({ a: "done", b: "current", c: "locked" });
    const skipped = done(emptyLearner(), "b", 1, 1);
    expect(lessonStates(skipped, outline)).toEqual({ a: "current", b: "done", c: "open" });
  });
});
