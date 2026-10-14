/**
 * Bench lessons against their labs: every beat's task exists, the lab's required tasks are exactly the lesson's do
 * and fix-it tasks in the same order (the runtime checks them one at a time), setups open their task's solution
 * steps, and every anchor a beat names (and every terminal it traces from) exists on the bench. The content loader cannot see the TypeScript labs, so
 * this is where the two meet.
 */
import { describe, expect, it } from "vitest";
import { partLegs, type BenchState } from "@ohmland/bench/core";
import { targetPoint } from "@ohmland/bench/view";
import { loadCourse, type BenchLessonData } from "../../content/load";
import { resolveAttach } from "../../lab/anchors";
import { buildBench } from "../../lab/build";
import { isOptional, type LabDefinition, type SolutionStep } from "../../lab/define";
import { applyStep, solutionSegments } from "../../lab/steps";
import { paletteItem } from "../../lab/code/blocks";
import { uploadError } from "../../lab/mcu";
import { momentsOf } from "./flow";
import { resolveAnchor } from "./marks";

const labs = new Map(
  Object.values(import.meta.glob<{ default: LabDefinition }>("../../../../../content/labs/*.ts", { eager: true })).map((mod) => [mod.default.id, mod.default]),
);
const lessons = loadCourse().lessons.filter((l): l is BenchLessonData => l.format === "bench");

/** The bench at the start and after every solution step. */
function benches(lab: LabDefinition): BenchState[] {
  let b = buildBench(lab.bench).bench;
  const out = [b];
  for (const s of lab.solution) {
    b = applyStep(b, s).bench;
    out.push(b);
  }
  return out;
}

describe("bench lessons", () => {
  it("finds the reference lessons", () => {
    expect(lessons.map((l) => l.id)).toEqual(expect.arrayContaining(["first-glow", "welcome-to-the-bench", "how-a-breadboard-works"]));
  });

  for (const lesson of lessons) {
    describe(lesson.id, () => {
      const lab = labs.get(lesson.lab);
      it("has its lab", () => expect(lab, `content/labs/${lesson.lab}.ts`).toBeDefined());
      if (!lab) return;
      const moments = momentsOf(lesson);
      const taskIds = new Set(lab.tasks.map((t) => t.id));

      it("names only tasks the lab has", () => {
        for (const mo of moments) if (mo.task) expect(taskIds.has(mo.task), `${mo.key}: task "${mo.task}"`).toBe(true);
      });

      it("walks the lab's required tasks in order", () => {
        const required = lab.tasks.filter((t) => !isOptional(t)).map((t) => t.id);
        const walked = moments.filter((mo) => mo.task && mo.kind !== "secret").map((mo) => mo.task);
        expect(walked).toEqual(required);
      });

      it("keeps the secret a bonus", () => {
        if (!lesson.secret) return;
        const t = lab.tasks.find((x) => x.id === lesson.secret!.task);
        expect(t && isOptional(t)).toBe(true);
      });

      it("starts each setup task's solution with its setup", () => {
        const segments = solutionSegments(lab.solution);
        for (const t of lab.tasks) {
          if (!t.setup?.length) continue;
          const seg = segments.get(t.id);
          expect(seg, `a check for "${t.id}"`).toBeDefined();
          expect(lab.solution.slice(seg!.start, seg!.start + t.setup.length), `"${t.id}" solution steps`).toEqual(t.setup);
        }
      });

      it("names only tools the lab has", () => {
        const built = buildBench(lab.bench);
        const have = new Set<string>([...(lab.panels ?? []).map((p) => p.id)]);
        if (built.bench.meter) have.add("meter");
        if (built.scope) have.add("scope");
        if (built.logger) have.add("logger");
        if (built.stopwatch) have.add("stopwatch");
        if (built.tapper) have.add("tapper");
        if (built.controls.length) have.add("controls");
        if (built.overlays?.offer?.length) have.add("views");
        if (built.bench.parts.some((p) => p.kind === "mcu-board")) for (const t of ["code", "serial", "millis"]) have.add(t);
        const tools = [...lesson.beats.map((b) => b.tool), lesson.fixit?.tool, lesson.secret?.tool];
        for (const tool of tools) if (tool) expect(have.has(tool), `tool "${tool}"`).toBe(true);
      });

      it("offers palettes and programs the code drawer can read", () => {
        for (const b of lesson.beats) {
          for (const entry of b.palette ?? []) expect(paletteItem(entry), `palette entry "${entry}"`).not.toBeNull();
          if (b.program) expect(uploadError(b.program), `program of "${b.say}"`).toBeNull();
        }
        for (const entry of lab.bench.code?.palette ?? []) expect(paletteItem(entry), `lab palette entry "${entry}"`).not.toBeNull();
      });

      it("points only at things on the bench", () => {
        const all = benches(lab);
        const anchors = new Set<string>();
        for (const b of lesson.beats) {
          if (b.meet) anchors.add(b.meet);
          if (b.note && b.note.at !== "tap") anchors.add(b.note.at);
          for (const s of b.spot ?? []) anchors.add(s);
          if (b.pick?.on) anchors.add(b.pick.on);
          if (b.popup) anchors.add(b.popup.at);
          if (b.tap?.joinedTo) anchors.add(b.tap.joinedTo);
          for (const a of [b.tap?.answer ?? [], b.tap?.among ?? []].flat()) anchors.add(a);
        }
        if (lesson.secret?.note && lesson.secret.note.at !== "tap") anchors.add(lesson.secret.note.at);
        for (const s of lesson.secret?.spot ?? []) anchors.add(s);
        for (const s of lesson.fixit?.spot ?? []) anchors.add(s);
        // A mark (part:M1/dial) must be one its part really has.
        const on = (b: BenchState, a: string) => (/^part:[^/]+\//.test(a) ? targetPoint(b, a) !== null : resolveAnchor(b, a) !== null);
        for (const a of anchors) expect(all.some((b) => on(b, a)), `"${a}" on the bench`).toBe(true);
      });

      it("applies each check's then steps to the bench", () => {
        const all = benches(lab);
        for (const b of lesson.beats) {
          if (!b.then) continue;
          const steps = b.then as SolutionStep[];
          // Somewhere in the lab's run the steps fit: every part, lead and spot they name is there.
          const fits = all.some((bench) => {
            let cur = bench;
            for (const s of steps) {
              const e = applyStep(cur, s);
              if (e.problem) return false;
              cur = e.bench;
            }
            return true;
          });
          expect(fits, `then: ${JSON.stringify(steps)}`).toBe(true);
        }
      });

      it("traces only from terminals on the bench", () => {
        const all = benches(lab);
        for (const b of lesson.beats) {
          if (!b.trace) continue;
          const from = b.trace;
          // The tracer starts at a part's terminal or a lead's clip, as the lab's `trace` step does.
          const found = all.some((bench) => {
            const a = resolveAttach(bench, from);
            if (!a?.startsWith("pin:")) return !!a?.startsWith("lead:");
            const [id, leg] = a.slice(4).split(".");
            const part = bench.parts.find((p) => p.id === id);
            return !!part && partLegs(part).includes(leg!);
          });
          expect(found, `trace "${from}" on the bench`).toBe(true);
        }
      });
    });
  }
});
