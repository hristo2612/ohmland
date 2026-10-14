/**
 * Achievements against the course. Every lesson, lab task, bonus and trigger an achievement names (its `refs`, plus its
 * `labEvent`) must exist, and the learner must be able to reach it in a lesson: a bench lesson only lets its beats'
 * tasks, its fix-it, its secret and triggered bonuses complete. Then a learner who does everything the course offers
 * must earn every achievement, which also catches a check that names something its `refs` forgot.
 */
import { describe, expect, it } from "vitest";
import { loadCourse, type LessonData } from "../content/load";
import { defineLab, isOptional, type LabDefinition } from "../lab/define";
import { replayLab } from "../lab/replay";
import { sandboxKit } from "../lab/sandbox-parts";
import { BUILT_IN_TRIGGERS } from "../lab/session";
import { isGraded, momentsOf } from "../lesson/bench/flow";
import { ACHIEVEMENTS, achievementById, newlyEarned, type LabEvent } from "./achievements";
import { emptyLearner } from "./state";
import type { LearnerState } from "./types";

const labs = new Map(
  Object.values(import.meta.glob<{ default: LabDefinition }>("../../../../content/labs/*.ts", { eager: true })).map((mod) => [mod.default.id, mod.default]),
);
/** Lab sources, for triggers fired from goal code with `lab.trigger("name")`. */
const sources = new Map(
  Object.entries(import.meta.glob<string>("../../../../content/labs/*.ts", { eager: true, query: "?raw", import: "default" })).map(([path, src]) => [
    path.split("/").pop()!.replace(/\.ts$/, ""),
    src,
  ]),
);
const course = loadCourse();
const lessons = new Map(course.lessons.map((l) => [l.id, l]));

const labsOf = (l: LessonData): LabDefinition[] =>
  (l.format === "bench" ? [l.lab] : l.steps.flatMap((s) => (s.type === "lab" ? [s.lab] : []))).flatMap((id) => labs.get(id) ?? []);

/**
 * The tasks a learner can complete in a lesson. A stepper lesson's lab arms every task. A bench lesson arms one task
 * at a time (its beats' and the fix-it's, which are the lab's required tasks), its secret, and any bonus that fires a
 * trigger (apps/web/src/lesson/bench/Stage.tsx).
 */
function reachable(l: LessonData): Set<string> {
  const out = new Set<string>();
  for (const lab of labsOf(l))
    for (const t of lab.tasks) if (l.format !== "bench" || !isOptional(t) || t.id === l.secret?.task || t.trigger) out.add(t.id);
  return out;
}

/** The bonus tasks a lesson offers: optional, and reachable. */
const bonusOf = (l: LessonData): string[] =>
  labsOf(l).flatMap((lab) => lab.tasks.filter((t) => isOptional(t) && reachable(l).has(t.id)).map((t) => t.id));

/** Graded checks: a bench lesson's taps, picks and numbers with an answer; a stepper lesson's quiz items. */
const graded = (l: LessonData): number =>
  l.format === "bench" ? momentsOf(l).filter(isGraded).length : l.steps.reduce((n, s) => n + (s.type === "quiz" ? s.items.length : 0), 0);

/** The triggers each lesson's lab can fire: its `triggers`, its reachable tasks' `trigger`, and `lab.trigger(...)` calls. */
function triggersOf(l: LessonData): string[] {
  const can = reachable(l);
  return labsOf(l).flatMap((lab) => [
    ...Object.keys(lab.triggers ?? {}),
    ...lab.tasks.flatMap((t) => (t.trigger && can.has(t.id) ? [t.trigger] : [])),
    ...[...(sources.get(lab.id) ?? "").matchAll(/\.trigger\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((m) => m[1]!),
  ]);
}
const fired = new Set([...Object.keys(BUILT_IN_TRIGGERS), ...course.lessons.flatMap(triggersOf)]);

describe("achievement references", () => {
  it("finds the course and its labs", () => {
    expect(course.lessons.length).toBeGreaterThan(0);
    for (const l of course.lessons) expect(labsOf(l).length, `${l.id}'s lab`).toBeGreaterThan(0);
  });

  for (const a of ACHIEVEMENTS) {
    const refs = a.refs ?? {};
    const triggers = [...(refs.triggers ?? []), ...(a.labEvent ? [a.labEvent] : [])];

    it(`${a.id} names only what the course has, and the learner can reach`, () => {
      const problems: string[] = [];
      const lesson = (id: string, what: string) => {
        const l = lessons.get(id);
        if (!l) problems.push(`${what}: no lesson "${id}"`);
        return l;
      };
      const task = ([lessonId, taskId]: readonly [string, string]) => {
        const what = `task ${lessonId}/${taskId}`;
        const l = lesson(lessonId, what);
        if (!l) return undefined;
        const t = labsOf(l)
          .flatMap((lab) => lab.tasks)
          .find((x) => x.id === taskId);
        if (!t) problems.push(`${what}: the lab ${labsOf(l).map((lab) => lab.id).join(", ")} has no such task`);
        else if (!reachable(l).has(taskId)) problems.push(`${what}: an optional task the lesson never arms (not its secret, fires no trigger)`);
        return t;
      };

      for (const unit of refs.units ?? [])
        if (!course.lessons.some((l) => l.unit === unit)) problems.push(`unit "${unit}" has no lessons`);
      for (const id of refs.lessons ?? []) {
        const l = lesson(id, `lesson ${id}`);
        if (l && !graded(l)) problems.push(`lesson ${id}: has no graded check, so it can never be perfect`);
      }
      for (const ref of refs.tasks ?? []) task(ref);
      for (const ref of refs.bonus ?? []) {
        const t = task(ref);
        if (t && !isOptional(t)) problems.push(`bonus ${ref.join("/")}: a required task, not a bonus`);
      }
      // A bonus list scoped to units counts exactly the bonuses those units offer: a moved lesson leaves it, a new
      // secret joins it.
      if (refs.bonus && refs.units) {
        for (const [lessonId, taskId] of refs.bonus) {
          const unit = lessons.get(lessonId)?.unit;
          if (unit && !refs.units.includes(unit)) problems.push(`bonus ${lessonId}/${taskId}: its lesson is in ${unit} now`);
        }
        const listed = new Set(refs.bonus.map((r) => r.join("/")));
        for (const l of course.lessons.filter((x) => refs.units!.includes(x.unit)))
          for (const id of bonusOf(l)) if (!listed.has(`${l.id}/${id}`)) problems.push(`bonus ${l.id}/${id}: offered in ${l.unit} but not listed`);
      }
      for (const name of triggers) if (!fired.has(name)) problems.push(`trigger "${name}": no lab fires it, and neither does the runtime`);

      expect(problems).toEqual([]);
    });
  }
});

describe("earning every achievement", () => {
  it("a learner who does everything the course offers earns every achievement", () => {
    const at = "2026-01-01T00:00:00.000Z";
    const state: LearnerState = {
      ...emptyLearner(),
      lessons: Object.fromEntries(
        course.lessons.map((l) => [l.id, { at, version: l.version, firstTry: graded(l), items: graded(l), tasks: [...reachable(l)] }]),
      ),
      fried: ["led", "led", "led", "resistor", "fuse", "meter-fuse", "relay", "capacitor", "npn", "diode", "speaker", "phototransistor"].map(
        (kind) => ({ kind, label: kind, lessonId: null, at }),
      ),
    };
    const events: LabEvent[] = [
      ...Object.keys(BUILT_IN_TRIGGERS).map((name): LabEvent => ({ type: "trigger", name, lessonId: null })),
      ...course.lessons.flatMap((l) => triggersOf(l).map((name): LabEvent => ({ type: "trigger", name, lessonId: l.id }))),
    ];
    const earned = new Set(newlyEarned({ state, outline: course.outline, events }).map((a) => a.id));
    expect(ACHIEVEMENTS.map((a) => a.id).filter((id) => !earned.has(id))).toEqual([]);
  });

  // No lesson's tone lands near 440 Hz, so Tuning fork is the free bench's: prove its tray can get there.
  it("tuning-fork: a flasher built from the free bench's tray sings concert A", { timeout: 60_000 }, () => {
    const tray = sandboxKit(course.parts.map((p) => p.id)).tray;
    const lab = defineLab({
      id: "free-bench-concert-a",
      title: "Concert A",
      bench: {
        board: "full",
        parts: [
          { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true } },
          { id: "S1", kind: "slide-switch", at: "b1" },
          // Lesson 17's flasher with 100 nF beads and two 10 kΩ in each base.
          { id: "Q1", kind: "npn", at: "d10" },
          { id: "D1", kind: "led", at: "c13", rot: 180, params: { color: "red" } },
          { id: "R1", kind: "resistor", at: "rail+:13-b13", params: { ohms: 1000 } },
          { id: "R3", kind: "resistor", at: "rail+:7-b7", params: { ohms: 10_000 } },
          { id: "R5", kind: "resistor", at: "c7-c11", params: { ohms: 10_000 } },
          { id: "Q2", kind: "npn", at: "g10" },
          { id: "D2", kind: "led", at: "h13", rot: 180, params: { color: "red" } },
          { id: "R2", kind: "resistor", at: "top+:13-i13", params: { ohms: 1000 } },
          { id: "R4", kind: "resistor", at: "top+:7-i7", params: { ohms: 10_000 } },
          { id: "R6", kind: "resistor", at: "h7-h11", params: { ohms: 10_000 } },
          { id: "C1", kind: "ceramic-cap", at: "e12-f11", params: { farads: 100e-9 } },
          { id: "C2", kind: "ceramic-cap", at: "f12-e11", params: { farads: 100e-9 } },
          // The speaker driver.
          { id: "Q3", kind: "npn", at: "g16" },
          { id: "R7", kind: "resistor", at: "j12-j17", params: { ohms: 4700 } },
          { id: "R8", kind: "resistor", at: "top+:21-i20", params: { ohms: 470 } },
          { id: "SP1", kind: "speaker", at: "desk:-40,-58", holes: { a: "h20", b: "h18" } },
        ],
        wires: ["a3 -> rail+:3", "rail+:5 -> top+:5", "rail-:6 -> top-:6", "a10 -> rail-:10", "j10 -> top-:10", "i16 -> top-:16"],
        tray: [],
        instruments: [],
      },
      tasks: [{ id: "sing", prompt: "", hints: [], success: "", goal: (l) => (l.toneHz("SP1") ?? 0) > 0 }],
      solution: [{ do: "flip", part: "S1", to: "b" }, { do: "wait", seconds: 3 }, { do: "check", task: "sing" }],
    });
    const same = (a: object = {}, b: object = {}) => JSON.stringify(a) === JSON.stringify(b);
    for (const p of lab.bench.parts) expect(tray.some((x) => x.kind === p.kind && same(x.params, "params" in p ? p.params : undefined)), `${p.id} from the tray`).toBe(true);
    const r = replayLab(lab);
    expect(r.missing).toEqual([]);
    expect(r.triggers).toContain(achievementById("tuning-fork")!.labEvent);
  });
});
