// Blueprint: docs/curriculum/unit-1.md, L15. A fresh battery switched across a 15 Ω, 5 W resistor with clip leads,
// the meter's probes clipped onto the battery's terminals, and an old battery on the shelf. Dropping the old battery
// onto the fresh one swaps them: the clip leads and probes move across with it. The battery sags under load.
// Loaded readings drift as the chemistry works, so the loaded tasks read the meter live rather than the notebook.
import { defineLab, type LabView } from "@ohmland/lab";
import { latest, readsIn } from "./lib/meter";

/** This battery is the one in the loop (its leads go to the switch and the resistor). */
const inLoop = (lab: LabView, id: string): boolean => lab.connected(`${id}.pos`, "S1.com") && lab.connected(`${id}.neg`, "R1.b");

/** The open-circuit reading of the fresh battery: logged with the switch off, or as read when the first task was done. */
const openVolts = (lab: LabView): number => {
  const r = lab.readings("across:B1").filter((x) => x.tags.includes("open") && x.mode === "dcv").at(-1);
  return r ? r.si : lab.doneAt("open-voltage")?.meter?.value ?? 9.4;
};

export default defineLab({
  id: "inside-the-battery",
  title: "The battery's hidden resistor",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-84,12", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "Fresh 9 V battery" },
      { id: "S1", kind: "toggle-switch", at: "desk:-8,-44", params: { base: true, to: "a" }, locked: true, label: "Switch" },
      { id: "R1", kind: "resistor", at: "desk:58,6", rot: -90, params: { ohms: 15, watts: 5 }, locked: true, label: "15 Ω, 5 W resistor" },
      // An old, scuffed battery on the shelf at the back.
      { id: "B2", kind: "battery", at: "desk:-128,-62", rot: 270, params: { emf: 8.6, internalOhms: 8, mAh: 500, worn: true }, label: "Old 9 V battery" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.com", color: "red" },
      { id: "TL2", from: "S1.b", to: "R1.a", color: "yellow" },
      { id: "TL3", from: "R1.b", to: "B1.neg", color: "black" },
    ],
    tray: [],
    // The probes are clipped onto the battery's terminals and follow it when it is swapped.
    instruments: [{ kind: "meter", at: "desk:146,26", mode: "dcv", range: "20V", probes: { red: "B1.pos", black: "B1.neg" } }],
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
      prompt: "With the switch off, read the battery voltage.",
      goal: (lab) =>
        !lab.closed("S1") && lab.across("B1") && !!latest(lab, "across:B1", "open") && lab.meter?.mode === "dcv" && readsIn(lab, 9.3, 9.5),
      hints: ["The probes are already clipped on. Read the meter, and hold still a moment so the notebook logs it."],
      success: "About 9.4 V with nothing to power. That's the battery's full push.",
    },
    {
      id: "loaded-voltage",
      prompt: "Switch on the 15 Ω load and read the battery again straight away.",
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
      hints: ["Flip the switch on its wooden block, then look at the meter at once."],
      highlight: ["S1"],
      success: "Down by almost a volt, just from doing work. Some of the push is being spent inside the battery.",
    },
    {
      id: "find-r",
      prompt: "Work out the internal resistance. Current first: I = loaded voltage ÷ 15 Ω. Then r = (open voltage − loaded voltage) ÷ I.",
      goal: (lab) => {
        const r = lab.note("r");
        return r !== null && r >= 1 && r <= 3;
      },
      note: { id: "r", label: "Internal resistance", unit: "Ω" },
      hints: ["8.4 ÷ 15 ≈ 0.56 A.", "(9.40 − 8.40) ÷ 0.56 ≈ 1.8 Ω."],
      success: "About 1.7 Ω, hiding inside the battery the whole time.",
    },
    {
      id: "old-battery",
      prompt: "Swap in the old battery from the shelf. Take both readings again: switch off, then on.",
      goal: (lab) => {
        const mem = lab.memory as { open?: boolean; loaded?: boolean };
        if (inLoop(lab, "B2") && lab.across("B2") && lab.meter?.mode === "dcv") {
          if (!lab.closed("S1") && readsIn(lab, 8.4, 8.8)) mem.open = true;
          if (lab.closed("S1") && readsIn(lab, 5.2, 6.2)) mem.loaded = true;
        }
        return !!mem.open && !!mem.loaded;
      },
      hints: ["Switch off first. Then drag the old battery right onto the fresh one: they swap places, clips and all.", "Read it at rest, then switch on and read it again straight away."],
      highlight: ["B2"],
      success: "8.6 V at rest looks fine. Under load it slumps below 6 V. Old batteries hide their age until you make them work.",
    },
    {
      id: "watch-it-sag",
      prompt: "Fresh battery back in. Leave the load on for 20 seconds and watch the reading, then switch off.",
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
      hints: ["Swap the fresh battery back the same way. Then switch on and wait: count to twenty while you watch the meter."],
      highlight: ["B1"],
      success: "It keeps sinking while it works, then recovers a little at rest. The chemistry can only react so fast.",
      bonus: true,
    },
  ],
  solution: [
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
    { do: "flip", part: "S1", to: "a" },
    { do: "move", part: "B1", at: "on:B2" },
    { do: "wait", seconds: 0.5 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 21 },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "watch-it-sag" },
  ],
});
