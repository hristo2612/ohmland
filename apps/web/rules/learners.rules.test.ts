/**
 * firestore.rules against the Firestore emulator (`pnpm test:rules`, which starts it with `firebase emulators:exec`).
 * The valid documents come from the client's own packer (toRemote), so the app and the rules cannot drift apart.
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CAPS, toRemote, type RemoteDoc } from "../src/account/remote";
import { emptyLearner } from "../src/progress/state";
import type { LearnerState } from "../src/progress/types";

const AT = "2026-10-12T09:00:00.000Z";
const BIG = "x".repeat(900_000);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const at = (i: number) => new Date(Date.parse(AT) + i * 1000).toISOString();

const sample: LearnerState = {
  ...emptyLearner(AT),
  lessons: { "first-glow": { at: AT, version: 1, firstTry: 3, items: 4, tasks: ["light-it", "measure-resistor"] } },
  achievements: { "first-spark": { at: AT } },
  fried: [
    { kind: "led", label: "Red LED", lessonId: "first-glow", at: AT },
    { kind: "resistor", label: "470 Ω resistor, 0.25 W", lessonId: null, at: "2026-10-12T09:05:00.000Z" },
  ],
  sandbox: { saved: { "bench-1": { name: "My LED", bench: { parts: [{ id: "D1", kind: "led" }] }, at: AT } } },
  settings: { muted: false, reducedMotion: "system", theme: "dark" },
};
const valid: RemoteDoc = toRemote(sample);

let env: RulesTestEnvironment;
/** A signed-in learner's Firestore, as Google (or `provider`) signed them in. */
const as = (uid: string, provider: "google.com" | "github.com" | "anonymous" = "google.com") =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).firestore();

beforeAll(async () => {
  // emulators:exec sets FIRESTORE_EMULATOR_HOST, so the test environment finds the emulator by itself.
  env = await initializeTestEnvironment({
    projectId: "ohmland",
    firestore: { rules: readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8") },
  });
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "learners/ana"), valid);
    await setDoc(doc(ctx.firestore(), "other/thing"), { a: 1 });
  });
});

describe("learners/{uid}: who", () => {
  it("lets the owner create, read, update and delete their own document, signed in with Google or GitHub", async () => {
    const ana = as("ana");
    await assertSucceeds(getDoc(doc(ana, "learners/ana")));
    await assertSucceeds(setDoc(doc(ana, "learners/ana"), { ...valid, updatedAt: "2026-10-13T09:00:00.000Z" }));
    await assertSucceeds(deleteDoc(doc(ana, "learners/ana")));
    await assertSucceeds(setDoc(doc(as("boris", "github.com"), "learners/boris"), valid));
  });

  it("gives nobody else anything: another learner, a signed-out client, an anonymous account, a list", async () => {
    const boris = as("boris");
    await assertFails(getDoc(doc(boris, "learners/ana")));
    await assertFails(setDoc(doc(boris, "learners/ana"), valid));
    await assertFails(deleteDoc(doc(boris, "learners/ana")));
    await assertFails(getDocs(collection(boris, "learners")));
    const nobody = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(nobody, "learners/ana")));
    await assertFails(setDoc(doc(nobody, "learners/new"), valid));
    const anonymous = as("anon", "anonymous");
    await assertFails(setDoc(doc(anonymous, "learners/anon"), valid));
    await assertFails(getDoc(doc(as("ana"), "other/thing")));
    await assertFails(setDoc(doc(as("ana"), "learners/ana/more/x"), { a: 1 }));
  });
});

describe("learners/{uid}: what", () => {
  const write = (d: unknown) => setDoc(doc(as("ana"), "learners/ana"), d as RemoteDoc);

  it("refuses anything but exactly the document's keys and types", async () => {
    const { settings: _settings, ...noSettings } = valid;
    for (const bad of [
      { ...valid, notes: "hello" },
      noSettings,
      { ...valid, v: 2 },
      { ...valid, v: "1" },
      { ...valid, updatedAt: BIG },
      { ...valid, updatedAt: "yesterday" },
      { ...valid, settings: { ...valid.settings, junk: true } },
      { ...valid, settings: { ...valid.settings, theme: "neon" } },
      { ...valid, settings: { ...valid.settings, muted: "no" } },
      { ...valid, lessons: [] },
      { ...valid, fried: {} },
    ])
      await assertFails(write(bad));
    await assertSucceeds(write(valid));
  });

  it("checks every lesson: its id, its packed record, and the caps", async () => {
    const entry = `${AT}|1|0|0|`;
    for (const lessons of [
      { "Bad Id": entry },
      { ["a".repeat(81)]: entry },
      { "two words": entry },
      { lesson: "hello" },
      { lesson: `${AT}|0|0|0|` },
      { lesson: `${AT}|1|0|0|bad task` },
      { lesson: `${entry}\n${entry}` },
      { lesson: { at: AT, version: 1 } },
      { lesson: `${AT}|1|0|0|${range(5000).map((i) => `t${i}-${"x".repeat(50)}`).join(",")}` },
      Object.fromEntries(range(CAPS.lessons + 1).map((i) => [`lesson-${i}`, entry])),
    ])
      await assertFails(write({ ...valid, lessons }));
  });

  it("checks achievements, fried parts and saved benches entry by entry, and caps them", async () => {
    for (const achievements of [{ "first-spark": "soon" }, { "first-spark": { at: AT } }, Object.fromEntries(range(CAPS.achievements + 1).map((i) => [`a-${i}`, AT]))])
      await assertFails(write({ ...valid, achievements }));
    for (const fried of [
      [`${AT}|led||${"x".repeat(81)}`],
      [`${AT}|LED||Red LED`],
      [`${AT}|led||`],
      [`${AT}|led||Red\n${AT}|led||LED`],
      [{ kind: "led", at: AT }],
      range(CAPS.fried + 1).map((i) => `${at(i)}|led||Red LED`),
    ])
      await assertFails(write({ ...valid, fried }));
    const bench = JSON.stringify({ name: "b", at: AT, bench: null });
    for (const sandbox of [
      { "bad id!": bench },
      { b: "not json" },
      { b: { name: "b" } },
      { b: `{"bench":"${"x".repeat(CAPS.sandboxChars)}"}` },
      Object.fromEntries(range(CAPS.sandbox + 1).map((i) => [`b${i}`, bench])),
    ])
      await assertFails(write({ ...valid, sandbox }));
  });

  it("accepts the biggest document the app ever writes, and it stays under Firestore's 1 MiB", async () => {
    const label = "x".repeat(CAPS.label);
    const big: LearnerState = {
      ...sample,
      lessons: Object.fromEntries(range(CAPS.lessons).map((i) => [`lesson-number-${i}`, { at: at(i), version: 12, firstTry: 8, items: 8, tasks: ["task-one", "task-two"] }])),
      achievements: Object.fromEntries(range(CAPS.achievements).map((i) => [`achievement-${i}`, { at: at(i) }])),
      fried: range(CAPS.fried).map((i) => ({ kind: "probe-resistance", label, lessonId: `lesson-number-${i}`, at: at(i) })),
      sandbox: { saved: Object.fromEntries(range(CAPS.sandbox).map((i) => [`bench-${i}`, { name: `Bench ${i}`, bench: "y".repeat(5000), at: at(i) }])) },
    };
    const d = toRemote(big);
    expect(Object.keys(d.lessons)).toHaveLength(CAPS.lessons);
    expect(d.fried).toHaveLength(CAPS.fried);
    expect(Object.keys(d.sandbox)).toHaveLength(CAPS.sandbox);
    expect(JSON.stringify(d).length).toBeLessThan(1_000_000);
    await assertSucceeds(write(d));
  });
});
