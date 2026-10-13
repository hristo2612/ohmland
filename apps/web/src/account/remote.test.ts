import { describe, expect, it } from "vitest";
import { mergeLearners } from "../progress/merge";
import { emptyLearner } from "../progress/state";
import type { LearnerState } from "../progress/types";
import { CAPS, fingerprint, fromRemote, hasProgress, toRemote } from "./remote";

const T1 = "2026-10-01T09:00:00.000Z";
const T2 = "2026-10-02T09:00:00.000Z";
const T3 = "2026-10-03T09:00:00.000Z";

function learner(): LearnerState {
  return {
    ...emptyLearner(T3),
    lessons: {
      "first-glow": { at: T1, version: 2, firstTry: 3, items: 4, tasks: ["light-it", "measure-resistor"] },
      "read-a-resistor": { at: T2, version: 1, firstTry: 0, items: 5, tasks: [] },
    },
    inProgress: { "next-one": { step: 2, answers: { "item:q1": [1, 2] }, at: T3 } },
    achievements: { "first-spark": { at: T1 } },
    fried: [
      { kind: "led", label: "Red LED", lessonId: "first-glow", at: T1 },
      { kind: "resistor", label: "470 Ω resistor", lessonId: null, at: T2 },
    ],
    sandbox: { saved: { "bench-1": { name: "My LED", bench: { parts: [{ id: "D1" }] }, at: T2 } } },
    settings: { muted: true, reducedMotion: "on", theme: "dark" },
  };
}

describe("the cloud document", () => {
  it("packs every entry into a string the rules can check, and unpacks to the same record without inProgress", () => {
    const doc = toRemote(learner());
    expect(doc.lessons["first-glow"]).toBe(`${T1}|2|3|4|light-it,measure-resistor`);
    expect(doc.lessons["read-a-resistor"]).toBe(`${T2}|1|0|5|`);
    expect(doc.achievements).toEqual({ "first-spark": T1 });
    expect(doc.fried).toEqual([`${T1}|led|first-glow|Red LED`, `${T2}|resistor||470 Ω resistor`]);
    expect(JSON.parse(doc.sandbox["bench-1"] ?? "")).toEqual({ name: "My LED", at: T2, bench: { parts: [{ id: "D1" }] } });
    expect(JSON.stringify(doc)).not.toContain("next-one");

    const back = fromRemote(JSON.parse(JSON.stringify(doc)));
    expect(back).toEqual({ ...learner(), inProgress: {} });
  });

  it("keeps what does not fit the rules on the device: odd ids, odd times, long labels, oversized benches", () => {
    const s = learner();
    s.lessons["Bad Id"] = { at: T1, version: 1, firstTry: 0, items: 1, tasks: [] };
    s.lessons["no-time"] = { at: "whenever", version: 1, firstTry: 0, items: 1, tasks: ["ok", "not ok"] };
    s.fried.push({ kind: "LED!", label: "x", lessonId: null, at: T3 }, { kind: "led", label: `a|b\n${"z".repeat(200)}`, lessonId: "Nope", at: T3 });
    s.sandbox.saved["huge"] = { name: "Huge", bench: "x".repeat(CAPS.sandboxChars), at: T3 };
    s.sandbox.saved["bad id!"] = { name: "Bad", bench: null, at: T3 };
    const doc = toRemote(s);
    expect(Object.keys(doc.lessons).sort()).toEqual(["first-glow", "read-a-resistor"]);
    expect(doc.fried).toHaveLength(3);
    const last = doc.fried[2] ?? "";
    expect(last.startsWith(`${T3}|led||a b `)).toBe(true);
    expect(last.split("|")[3]).toHaveLength(CAPS.label);
    expect(Object.keys(doc.sandbox)).toEqual(["bench-1"]);
  });

  it("is deterministic, so equal records have equal fingerprints whatever the key order", () => {
    const a = learner();
    const b: LearnerState = { ...learner(), lessons: Object.fromEntries(Object.entries(learner().lessons).reverse()) };
    expect(JSON.stringify(toRemote(a))).toBe(JSON.stringify(toRemote(b)));
    // A step answered mid-lesson changes nothing the cloud keeps.
    const stepped = { ...a, inProgress: {}, updatedAt: "2026-10-09T09:00:00.000Z" };
    expect(fingerprint(stepped)).toBe(fingerprint(a));
    expect(fingerprint({ ...a, settings: { ...a.settings, muted: false } })).not.toBe(fingerprint(a));
  });

  it("round-trips through a merge with the device: nothing the cloud adds is lost, nothing is duplicated", () => {
    const device = learner();
    const cloud = fromRemote(toRemote({ ...emptyLearner(T1), lessons: { other: { at: T2, version: 1, firstTry: 1, items: 2, tasks: [] } } }));
    expect(cloud).not.toBeNull();
    const merged = mergeLearners(device, cloud as LearnerState);
    expect(Object.keys(merged.lessons).sort()).toEqual(["first-glow", "other", "read-a-resistor"]);
    expect(fingerprint(mergeLearners(merged, fromRemote(toRemote(merged)) as LearnerState))).toBe(fingerprint(merged));
  });

  it("reads anything else as no document", () => {
    expect(fromRemote(undefined)).toBeNull();
    expect(fromRemote({ v: 2 })).toBeNull();
    const junk = fromRemote({ v: 1, lessons: { a: 5, b: "nonsense" }, fried: [{}, 3], sandbox: { x: "{not json" }, achievements: [] });
    expect(junk && hasProgress(junk)).toBe(false);
  });
});
