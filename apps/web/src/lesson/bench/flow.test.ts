/** The bench lesson's bookkeeping: moments, first tries, XP inputs, rules, the robot's eyes, hole checks. */
import { describe, expect, it } from "vitest";
import { buildBench } from "../../lab/build";
import type { BenchLessonData } from "../../content/load";
import { benchLessonSchema } from "../../content/schema";
import { answerKeys, holeName, isMomentDone, momentsOf, noteText, progressOf, recordTry, rulesFound, scoreOf } from "./flow";
import { judgeJoined, resolveAnchor } from "./marks";

const lesson = (extra: Record<string, unknown> = {}): BenchLessonData =>
  ({
    ...benchLessonSchema.parse({
      format: "bench",
      id: "demo",
      version: 1,
      title: "Demo",
      summary: "A demo.",
      minutes: 5,
      lab: "demo",
      start: { say: "Hello there." },
      beats: [
        { say: "This is an LED.", objective: "Meet it", meet: "D1", note: { at: "D1", text: "LED" } },
        { say: "Clip a loop.", do: "build", rule: "Loops carry current." },
        { say: "Tap the long leg.", objective: "Polarity", tap: { answer: "D1.anode", among: ["D1.anode", "D1.cathode"] } },
        { say: "What is this?", pick: { on: "S1", options: ["A switch", "A lamp"], answer: "A switch" } },
        { say: "Any guesses?", pick: { options: ["Yes", "No"] } },
      ],
      secret: { task: "fry", say: "Curious?", rule: "LEDs need resistors." },
      fixit: { say: "Fix it.", tasks: [{ task: "fix" }] },
      end: { say: "Done." },
      ...extra,
    }),
    unit: "u",
    module: "m",
    href: "/learn/u/demo",
    index: 0,
  }) as BenchLessonData;

describe("bench lesson flow", () => {
  it("walks the beats, then the secret, the fix-it benches and the sign-off", () => {
    const ms = momentsOf(lesson());
    expect(ms.map((m) => m.key)).toEqual(["b0", "b1", "b2", "b3", "b4", "secret", "fix0", "end"]);
    expect(ms.map((m) => m.action)).toEqual(["meet", "task", "tap", "pick", "pick", "task", "task", "finish"]);
    expect(ms[6]!.say).toBe("Fix it.");
  });

  it("settles first tries on the first try and counts only graded checks", () => {
    const l = lesson();
    const ms = momentsOf(l);
    let rec = recordTry(undefined, false, "D1.cathode");
    rec = recordTry(rec, true, "D1.anode");
    expect(rec).toEqual({ first: false, done: true, at: "D1.anode" });
    const answers = {
      [answerKeys.check("b2")]: rec,
      [answerKeys.check("b3")]: recordTry(undefined, true),
      [answerKeys.check("b4")]: recordTry(undefined, true),
      [answerKeys.tasks("demo")]: ["build", "fry"],
    };
    // The ungraded pick (b4) is not an item; the tap (wrong first) and the graded pick are.
    expect(scoreOf(l, ms, answers)).toEqual({ firstTry: 1, items: 2, tasks: ["build", "fry"] });
    expect(isMomentDone(ms[1]!, answers, ["build"])).toBe(true);
    expect(isMomentDone(ms[2]!, answers, [])).toBe(true);
  });

  it("finds rules as their beats finish, and the secret's whenever it is found", () => {
    const ms = momentsOf(lesson());
    expect(rulesFound(ms, 1, [], false)).toEqual([]);
    expect(rulesFound(ms, 1, [], true)).toEqual(["Loops carry current."]);
    expect(rulesFound(ms, 2, ["fry"], false)).toEqual(["Loops carry current.", "LEDs need resistors."]);
    // A beat with nothing to do stamps its rule as it begins.
    const plain = momentsOf(lesson({ beats: [{ say: "Look.", rule: "Loops carry current." }, { say: "Two." }] }));
    expect(rulesFound(plain, 0, [], false)).toEqual(["Loops carry current."]);
  });

  it("fills the robot's eyes in equal steps per objective and the fix-it round, never for the secret", () => {
    const ms = momentsOf(lesson());
    expect(progressOf(ms, 0, false)).toBe(0);
    // "Meet it" ends at b1; "Polarity" at b4; then the fix-it: three steps.
    expect(progressOf(ms, 1, true)).toBeCloseTo(1 / 3);
    expect(progressOf(ms, 4, true)).toBeCloseTo(2 / 3);
    expect(progressOf(ms, 5, true)).toBeCloseTo(2 / 3);
    expect(progressOf(ms, 6, true)).toBe(1);
  });

  it("fills the eyes moment by moment without objectives", () => {
    const l = lesson({ beats: [{ say: "One." }, { say: "Two." }] });
    const ms = momentsOf(l);
    // b0, b1, fix0 count; the secret and the sign-off do not.
    expect(progressOf(ms, 0, true)).toBeCloseTo(1 / 3);
    expect(progressOf(ms, 3, true)).toBe(1);
  });

  it("writes the tapped hole into a note", () => {
    expect(noteText("this is {hole}", "hole:c7")).toBe("this is c7");
    expect(holeName("bp21")).toBe("+21");
    expect(holeName("hole:bn3")).toBe("-3");
  });
});

describe("bench lesson schema", () => {
  it("keeps lines short and lessons under budget", () => {
    const long = "one two three four five six seven eight nine ten eleven twelve thirteen";
    expect(() => lesson({ start: { say: long } })).toThrow(/at most 12 words/);
    const beats = Array.from({ length: 14 }, () => ({ say: "one two three four five six seven eight nine ten eleven" }));
    expect(() => lesson({ beats })).toThrow(/main path/);
  });

  it("allows one thing per beat and one pop-up per lesson", () => {
    expect(() => lesson({ beats: [{ say: "Hi.", do: "a", pick: { options: ["A", "B"] } }] })).toThrow(/one thing/);
    const popup = { widget: "resistor-slider", at: "R1" };
    expect(() => lesson({ beats: [{ say: "A.", popup }, { say: "B.", popup }] })).toThrow(/at most one pop-up/);
  });
});

describe("hole checks", () => {
  const bench = buildBench({ board: "half", parts: [], tray: [], instruments: [] }).bench;

  it("knows which holes a strip joins", () => {
    expect(judgeJoined(bench, "b14", "d14")).toBe("right");
    expect(judgeJoined(bench, "b14", "b14")).toBe("self");
    expect(judgeJoined(bench, "e18", "f18")).toBe("across");
    expect(judgeJoined(bench, "e18", "e19")).toBe("other-strip");
    expect(judgeJoined(bench, "bp21", "bp3")).toBe("right");
    expect(judgeJoined(bench, "bp21", "bn21")).toBe("other-rail");
    expect(judgeJoined(bench, "bp21", "a21")).toBe("strip-for-rail");
    expect(judgeJoined(bench, "a21", "bp21")).toBe("rail-for-strip");
  });

  it("resolves the lab's shorthand to bench anchors", () => {
    expect(resolveAnchor(bench, "c7")).toBe("hole:c7");
    expect(resolveAnchor(bench, "rail+:21")).toBe("hole:bp21");
    expect(resolveAnchor(bench, "part:D1")).toBe("part:D1");
  });
});
