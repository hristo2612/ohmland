// Blueprint: docs/curriculum/unit-1.md, L15, trimmed (docs/curriculum/conversion-guide.md, B3 15). The lab of a bench
// lesson (docs/LESSONS.md): content/units/basics/power-and-heat/inside-the-battery. One idea: a battery hides a
// resistance, so its push sags under load. A fresh battery switched across a 15 Ω, 5 W resistor with clip leads,
// the meter's probes clipped onto the battery's terminals, and an old battery on the shelf. Dropping the old battery
// onto the fresh one swaps them: the clip leads and probes move across with it. The battery sags under load.
// Loaded readings drift as the chemistry works, so the loaded tasks read the meter live rather than the notebook.
// From the simulator: fresh 9.40 V at rest, about 8.4 V loaded (0.56 A), so r is about 1.8 Ω (the model has 1.7 Ω);
// the old battery reads 8.60 V at rest and about 5.5 V loaded.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { latest, readsIn } from "./lib/meter";

/** This battery is the one in the loop (its leads go to the switch and the resistor). */
const inLoop = (lab: LabView, id: string): boolean => lab.connected(`${id}.pos`, "S1.com") && lab.connected(`${id}.neg`, "R1.b");

/** The open-circuit reading of the fresh battery: logged with the switch off, or as read when the first task was done. */
const openVolts = (lab: LabView): number => {
  const r = lab.readings("across:B1").filter((x) => x.tags.includes("open") && x.mode === "dcv").at(-1);
  return r ? r.si : lab.doneAt("open-voltage")?.meter?.value ?? 9.4;
};

/** The fix-it bench: the old battery still in the loop, switched off, so it reads a healthy-looking 8.6 V. */
const OLD_AT_REST: SolutionStep[] = [{ do: "flip", part: "S1", to: "a" }];

export default defineLab({
  id: "inside-the-battery",
  title: "The battery's hidden resistor",
  bench: {
    board: "none",
    frame: ["desk:-150,-80", "desk:175,80"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:56,40", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "Fresh 9 V battery" },
      { id: "S1", kind: "toggle-switch", at: "desk:-40,-38", params: { base: true, to: "a" }, locked: true, label: "Switch" },
      { id: "R1", kind: "resistor", at: "desk:8,26", rot: -90, params: { ohms: 15, watts: 5 }, locked: true, label: "15 Ω, 5 W resistor" },
      // An old, scuffed battery to one side.
      { id: "B2", kind: "battery", at: "desk:-118,10", rot: 270, params: { emf: 8.6, internalOhms: 8, mAh: 500, worn: true }, label: "Old 9 V battery" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.com", color: "red" },
      { id: "TL2", from: "S1.b", to: "R1.a", color: "yellow" },
      { id: "TL3", from: "R1.b", to: "B1.neg", color: "black" },
    ],
    tray: [],
    // The probes are clipped onto the battery's terminals and follow it when it is swapped.
    instruments: [{ kind: "meter", at: "desk:128,-22", mode: "off", probes: { red: "B1.pos", black: "B1.neg" } }],
  },
  notebook: {
    tags: { open: (lab) => !lab.closed("S1"), loaded: (lab) => lab.closed("S1") },
  },
  mascot: {
    start: "Batteries have secrets. Let's catch one in the act.",
    hint: "Read it once at rest, once while working. Compare.",
    success: "1.7 hidden ohms, found. Nothing hides from your meter.",
  },
  tasks: [
    {
      id: "open-voltage",
      prompt: "Turn the dial to DC volts. Read the battery.",
      goal: (lab) =>
        !lab.closed("S1") && lab.across("B1") && !!latest(lab, "across:B1", "open") && lab.meter?.mode === "dcv" && readsIn(lab, 9.3, 9.5),
      hints: ["Turn the meter's dial to V with the straight line: DC volts.", "The probes are already clipped on. Just read."],
      success: "About 9.4 V with no load: its full push.",
    },
    {
      id: "loaded-voltage",
      prompt: "Switch the 15 Ω load on. Read it straight away.",
      goal: (lab) => {
        const mem = lab.memory as { closedAt?: number };
        if (!lab.closed("S1")) {
          delete mem.closedAt;
          return false;
        }
        mem.closedAt ??= lab.t;
        const v = lab.meter?.value ?? Number.NaN;
        return lab.t - mem.closedAt <= 2 && lab.across("B1") && readsIn(lab, 8.2, 8.7) && openVolts(lab) - v >= 0.5;
      },
      hints: ["Flip the switch on its block. Look at the meter at once."],
      highlight: ["S1"],
      success: "Down almost a volt. Some push is spent inside the battery.",
    },
    {
      id: "find-r",
      prompt: "Find the hidden resistance: r = (open − loaded) ÷ I.",
      goal: (lab) => {
        const r = lab.note("r");
        return r !== null && r >= 1 && r <= 3;
      },
      note: { id: "r", label: "Internal resistance", unit: "Ω" },
      hints: ["Current first: I = loaded volts ÷ 15 Ω ≈ 0.56 A.", "(9.40 − 8.40) ÷ 0.56 ≈ 1.8 Ω."],
      success: "About 1.8 Ω, hiding inside all along.",
    },
    {
      id: "old-battery",
      prompt: "Swap in the old battery. Read it off, then on.",
      goal: (lab) => {
        const mem = lab.memory as { open?: boolean; loaded?: boolean };
        if (inLoop(lab, "B2") && lab.across("B2") && lab.meter?.mode === "dcv") {
          if (!lab.closed("S1") && readsIn(lab, 8.4, 8.8)) mem.open = true;
          if (lab.closed("S1") && readsIn(lab, 5.2, 6.2)) mem.loaded = true;
        }
        return !!mem.open && !!mem.loaded;
      },
      hints: ["Switch off. Drop the old battery onto the fresh one: they swap, clips and all.", "Read at rest, then switch on and read at once."],
      highlight: ["B2"],
      success: "8.6 V at rest, under 6 V loaded. Old batteries hide their age.",
    },
    {
      id: "watch-it-sag",
      prompt: "Fresh battery back. Load on for 20 seconds, then off.",
      goal: (lab) => {
        const mem = lab.memory as { since?: number; first?: number; low?: number; held?: boolean; done?: boolean };
        if (mem.done) return true;
        const v = lab.meter?.value ?? Number.NaN;
        const reading = inLoop(lab, "B1") && lab.across("B1") && lab.meter?.mode === "dcv" && Number.isFinite(v);
        if (lab.closed("S1") && reading) {
          if (mem.since === undefined) {
            mem.since = lab.t;
            mem.first = v;
            mem.low = v;
          }
          mem.low = Math.min(mem.low ?? v, v);
          if (lab.t - mem.since >= 20 && (mem.first ?? v) - mem.low >= 0.1) mem.held = true;
        } else if (!lab.closed("S1") && mem.held && reading && v > (mem.low ?? v) + 0.05) {
          mem.done = true;
        } else if (!mem.held) {
          delete mem.since;
        }
        return !!mem.done;
      },
      hints: ["Swap back the same way. Switch on, count to twenty, watch."],
      highlight: ["B1"],
      success: "It sinks while working, then recovers a little. Chemistry takes time.",
      bonus: true,
    },
    {
      id: "fix-old",
      prompt: "This battery reads 8.6 V, but the load starves. Fix it.",
      setup: OLD_AT_REST,
      // The old battery in the loop first (the setup), then the fresh one, working: a bench that never had the old
      // battery in it does not count.
      goal: (lab) => {
        if (inLoop(lab, "B2")) lab.memory["old"] = true;
        return lab.memory["old"] === true && inLoop(lab, "B1") && lab.closed("S1") && lab.across("B1") && lab.meter?.mode === "dcv" && readsIn(lab, 8.0, 8.8);
      },
      hints: ["Switch the load on and watch the meter.", "Switch off, then drop the fresh battery onto the old one."],
      highlight: ["S1", "B1"],
      nudges: [{ when: (lab) => inLoop(lab, "B2") && lab.closed("S1") && readsIn(lab, 4, 6.5), say: "Under load, it collapses. Swap in the fresh one." }],
      success: "Fixed. The fresh one holds its push.",
    },
  ],
  solution: [
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "open-voltage" },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "loaded-voltage" },
    { do: "note", id: "r", value: "1.7" },
    { do: "check", task: "find-r" },
    { do: "flip", part: "S1", to: "a" },
    { do: "move", part: "B2", at: "on:B1" },
    { do: "wait", seconds: 0.5 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "old-battery" },
    ...OLD_AT_REST,
    { do: "wait", seconds: 0.5 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 1 },
    { do: "flip", part: "S1", to: "a" },
    { do: "move", part: "B1", at: "on:B2" },
    { do: "wait", seconds: 0.5 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-old" },
    { do: "wait", seconds: 21 },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "watch-it-sag" },
  ],
});
