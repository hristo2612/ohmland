// Blueprint: docs/curriculum/unit-2.md, Lesson 10. Station A: R1 (10 kΩ) from the + rail into row 6, the meter in
// series on the 2 mA range (red probe in row 6, black in row 8), and an empty capacitor socket from row 8 to row 10
// (row 10 jumps to the minus rail). Station B, the blast corner: slide switch S1 feeds row 22 straight from the +
// rail, and its socket runs from row 22 to row 24 (minus), with no resistor at all.
//
// Measured in the simulator: the 104 ceramic settles below 2 µA within a second either way round; the 100 µF
// electrolytic gulps about 0.9 mA and settles near 9 µA (its leakage) within about 4 s; backwards it keeps passing
// about 0.6 mA and reports `reversed`; the 6.3 V part backwards across 9 V with no resistor vents within seconds.
import { defineLab, type LabView } from "@ohmland/lab";

const socketA = (lab: LabView, id: string, dir?: "forward") => lab.joins(id, "d8", "d10", dir);
const current = (lab: LabView) => lab.amps("M1");

export default defineLab({
  id: "capacitor-labels",
  title: "Reading the fine print",
  bench: {
    board: "full",
    frame: ["desk:-100,-30", "desk:-10,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "rail+:6-b6", params: { ohms: 10000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "S1", kind: "slide-switch", at: "b20", params: { to: "a" }, locked: true, label: "Blast corner switch S1" },
    ],
    wires: [
      { id: "W1", from: "a10", to: "rail-:10", color: "black" },
      { id: "W2", from: "a21", to: "rail+:21", color: "red" },
      { id: "W3", from: "a24", to: "rail-:24", color: "black" },
    ],
    tray: [
      { id: "CA", kind: "ceramic-cap", params: { farads: 100e-9 }, count: 1, label: "104 ceramic" },
      { id: "CB", kind: "electrolytic-cap", params: { farads: 100e-6, volts: 16 }, count: 1, label: "100 µF 16 V" },
      { id: "CC", kind: "electrolytic-cap", params: { farads: 100e-6, volts: 6.3 }, count: 1, label: "100 µF 6.3 V" },
    ],
    instruments: [{ kind: "meter", at: "desk:-178,22", rot: 16, mode: "dca-ma", range: "2mA", red: "ma", black: "com", probes: { red: "a6", black: "a8" } }],
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
      prompt: "Plug the **104** ceramic into station A's socket (rows 8 and 10). Watch the meter. Then turn it round and try again.",
      goal: (lab) => {
        const m = lab.memory as { fwd?: boolean; rev?: boolean };
        const inA = socketA(lab, "CA");
        const fwd = socketA(lab, "CA", "forward");
        if (lab.heldFor(1, inA && current(lab) < 2e-6, fwd ? "f" : "r")) m[fwd ? "fwd" : "rev"] = true;
        return !!m.fwd && !!m.rev;
      },
      hints: ["The meter may twitch at the start. Watch what it settles to.", "Rotate it (select it, then Rotate) or drag it out and back in the other way round."],
      highlight: ["hole:d8", "hole:d10"],
      success: "A blip, then nothing. Once it's charged, no steady current gets through. And ceramics don't care which way round they go.",
    },
    {
      id: "electrolytic-right-way",
      prompt: "Now plug in the **100 µF, 16 V** electrolytic the right way round: stripe toward ground (row 10).",
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
      success: "Bigger capacitor, bigger gulp, slower settle. Then it blocks too, apart from a tiny leak.",
    },
    {
      id: "electrolytic-backwards",
      prompt: "Flip the electrolytic so the stripe faces the positive side (row 8).",
      goal: (lab) => socketA(lab, "CB") && !socketA(lab, "CB", "forward") && lab.event("reversed", "CB") && lab.heldFor(8, socketA(lab, "CB") && current(lab) > 100e-6),
      hints: ["Just watch the meter. Does it settle this time?", "Give it eight seconds."],
      success: "It never settles. Backwards, the insulating layer breaks down and the capacitor leaks like a sieve.",
      notice: "Take it out soon: backwards, it is slowly cooking, and left there it fails for good.",
    },
    {
      id: "blast-box",
      prompt: "Optional, and it's loud. Put the **6.3 V** capacitor in the blast corner's socket (rows 22 and 24) backwards, and slide S1 on.",
      goal: (lab) => lab.died("CC") && lab.events.some((e) => e.type === "died" && e.partId === "CC" && e.data?.["cause"] === "reverse"),
      hints: ["There's no resistor in the blast corner. That's the point.", "Backwards: the stripe to row 22, the long leg to row 24."],
      success: "It heated, bulged and vented. That's why polarity and voltage ratings matter. It's in the Hall of Fried Parts now.",
      notice: "Real ones do this too, sometimes with a bang and a smelly puff.",
      bonus: true,
    },
  ],
  solution: [
    { do: "place", part: "CA", kind: "ceramic-cap", at: "d8-d10", params: { farads: 100e-9 } },
    { do: "wait", seconds: 1.5 },
    { do: "move", part: "CA", at: "d10-d8" },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "ceramic-blocks" },
    { do: "remove", part: "CA" },
    { do: "place", part: "CB", kind: "electrolytic-cap", at: "d8-d10", params: { farads: 100e-6, volts: 16 } },
    { do: "wait", seconds: 6 },
    { do: "check", task: "electrolytic-right-way" },
    { do: "move", part: "CB", at: "d10-d8" },
    { do: "wait", seconds: 9 },
    { do: "check", task: "electrolytic-backwards" },
    { do: "place", part: "CC", kind: "electrolytic-cap", at: "d24-d22", params: { farads: 100e-6, volts: 6.3 } },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 6 },
    { do: "check", task: "blast-box" },
  ],
});
