// Blueprint: docs/curriculum/unit-2.md, Lesson 10. Station A: R1 (10 kΩ) from the + rail into row 12, the meter in
// series on the 2 mA range (red probe in row 12, black in row 14; a yellow jumper carries row 14 on to row 20), and an
// empty capacitor socket from row 20 to row 22 (row 22 jumps to the minus rail). Station B, the blast corner: slide switch S1 feeds row 32 straight from the +
// rail, and its socket runs from row 32 to row 34 (minus), with no resistor at all.
//
// Measured in the simulator: the 104 ceramic settles below 2 µA within a second either way round; the 100 µF
// electrolytic gulps about 0.9 mA and settles near 9 µA (its leakage) within about 4 s; backwards it keeps passing
// about 0.6 mA and reports `reversed`; the 6.3 V part backwards across 9 V with no resistor vents within seconds.
import { defineLab, type LabView } from "@ohmland/lab";

const socketA = (lab: LabView, id: string, dir?: "forward") => lab.joins(id, "d20", "d22", dir);
const current = (lab: LabView) => lab.amps("M1");

export default defineLab({
  id: "capacitor-labels",
  title: "Reading the fine print",
  bench: {
    board: "full",
    frame: ["desk:-92,-30", "desk:10,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "rail+:12-b12", params: { ohms: 10000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "S1", kind: "slide-switch", at: "b30", params: { to: "a" }, locked: true, label: "Blast corner switch S1" },
    ],
    wires: [
      { id: "W0", from: "c14", to: "c20", color: "yellow" },
      { id: "W1", from: "a22", to: "rail-:21", color: "black" },
      { id: "W2", from: "a31", to: "rail+:31", color: "red" },
      { id: "W3", from: "a34", to: "rail-:34", color: "black" },
    ],
    tray: [
      { id: "CA", kind: "ceramic-cap", params: { farads: 100e-9 }, count: 1, label: "104 ceramic" },
      { id: "CB", kind: "electrolytic-cap", params: { farads: 100e-6, volts: 16 }, count: 1, label: "100 µF 16 V" },
      { id: "CC", kind: "electrolytic-cap", params: { farads: 100e-6, volts: 6.3 }, count: 1, label: "100 µF 6.3 V" },
    ],
    instruments: [{ kind: "meter", at: "desk:-178,22", rot: 16, mode: "dca-ma", range: "2mA", red: "ma", black: "com", probes: { red: "a12", black: "a14" } }],
  },
  mascot: {
    start: "104 is a code, not a price.",
    hint: "Watch what the current settles to, not the first jump.",
    success: "Blocked. Once it's charged, a capacitor stops the steady current.",
    fried: "That pop goes straight to the Hall of Fried Parts. Bravo, scientist.",
    exit: "Value, tolerance, polarity, voltage. You can read the fine print now.",
  },
  fried: { CC: "100 µF 6.3 V electrolytic, backwards on 9 V", CB: "100 µF electrolytic, backwards", capacitor: "Electrolytic capacitor, backwards" },
  tasks: [
    {
      id: "ceramic-blocks",
      prompt: "Plug the **104** ceramic into socket A. Then turn it round.",
      goal: (lab) => {
        const m = lab.memory as { fwd?: boolean; rev?: boolean };
        const inA = socketA(lab, "CA");
        const fwd = socketA(lab, "CA", "forward");
        if (lab.heldFor(1, inA && current(lab) < 2e-6, fwd ? "f" : "r")) m[fwd ? "fwd" : "rev"] = true;
        return !!m.fwd && !!m.rev;
      },
      hints: ["The meter may twitch at the start. Watch what it settles to.", "Socket A is rows 20 and 22. Rotate it, or replug it."],
      highlight: ["hole:d20", "hole:d22"],
      success: "A blip, then nothing: charged, it blocks. Ceramics fit either way.",
    },
    {
      id: "electrolytic-right-way",
      prompt: "Now the **100 µF** electrolytic, stripe toward ground (row 22).",
      goal: (lab) => {
        const m = lab.memory as { at?: number; peak?: number };
        if (!socketA(lab, "CB", "forward")) {
          delete m.at;
          delete m.peak;
          return false;
        }
        m.at ??= lab.t;
        m.peak = Math.max(m.peak ?? 0, current(lab));
        return m.peak > 0.5e-3 && current(lab) < 20e-6 && lab.t - m.at <= 10;
      },
      hints: ["The stripe of minus signs marks the leg that goes toward ground.", "Take the ceramic out first."],
      success: "Bigger gulp, slower settle. Then it blocks, apart from a tiny leak.",
    },
    {
      id: "electrolytic-backwards",
      prompt: "Flip the electrolytic so the stripe faces the positive side (row 20).",
      goal: (lab) => socketA(lab, "CB") && !socketA(lab, "CB", "forward") && lab.event("reversed", "CB") && lab.heldFor(8, socketA(lab, "CB") && current(lab) > 100e-6),
      hints: ["Just watch the meter. Does it settle this time?", "Give it eight seconds."],
      success: "It never settles. Backwards, its insulating layer breaks down.",
      notice: "Take it out soon: backwards, it slowly cooks.",
    },
    {
      id: "blast-box",
      prompt: "Optional, loud: plug the **6.3 V** cap in backwards, then slide S1.",
      goal: (lab) => lab.died("CC") && lab.events.some((e) => e.type === "died" && e.partId === "CC" && e.data?.["cause"] === "reverse"),
      hints: ["There's no resistor in the blast corner. That's the point.", "Backwards: the stripe to row 32, the long leg to row 34."],
      success: "Heated, bulged, vented. Polarity and voltage ratings matter.",
      notice: "Real ones do this too, with a bang and a smell.",
      bonus: true,
    },
  ],
  solution: [
    { do: "place", part: "CA", kind: "ceramic-cap", at: "d20-d22", params: { farads: 100e-9 } },
    { do: "wait", seconds: 1.5 },
    { do: "move", part: "CA", at: "d22-d20" },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "ceramic-blocks" },
    { do: "remove", part: "CA" },
    { do: "place", part: "CB", kind: "electrolytic-cap", at: "d20-d22", params: { farads: 100e-6, volts: 16 } },
    { do: "wait", seconds: 6 },
    { do: "check", task: "electrolytic-right-way" },
    { do: "move", part: "CB", at: "d22-d20" },
    { do: "wait", seconds: 9 },
    { do: "check", task: "electrolytic-backwards" },
    { do: "place", part: "CC", kind: "electrolytic-cap", at: "d34-d32", params: { farads: 100e-6, volts: 6.3 } },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 6 },
    { do: "check", task: "blast-box" },
  ],
});
