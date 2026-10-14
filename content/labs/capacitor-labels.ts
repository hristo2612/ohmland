// Blueprint: docs/curriculum/unit-2.md, Lesson 10; conversion: docs/curriculum/conversion-guide.md, C2 lesson 10. The
// lab of a bench lesson (docs/LESSONS.md): content/units/switching/capacitors/capacitor-labels/lesson.yaml.
// One idea: an electrolytic has a minus stripe and a voltage limit, and fails when you ignore them. (The ceramic and
// blocking a steady push moved to kick-it-through; the three-digit code to flasher-to-tone.)
//
// Station A: R1 (10 kΩ) from the + rail into row 6, the meter in series on the 2 mA range (red probe in row 6, black
// in row 8; a yellow jumper carries row 8 on to row 20), and an empty capacitor socket in rows 20 and 21 (row 21
// jumps to the minus rail): a 100 µF can's legs are one hole apart. Station B, the blast corner: slide switch S1 feeds
// row 32 straight from the + rail, and its socket is rows 32 and 33 (minus), with no resistor at all. Both capacitors
// lie on the desk by the board. The camera frames the sockets; the meter and its upright probes stay off to the left,
// and its reading shows on the meter panel.
//
// Measured in the simulator: the 100 µF 16 V electrolytic gulps about 0.9 mA and settles near 0.01 mA (its leakage)
// within about 6 s; backwards it keeps passing about 0.7 mA, reports `reversed`, starts to smoke after about 7 s and
// vents after about 15 s. The 6.3 V part on 9 V the right way round never settles: it leaks about 0.16 mA and runs
// hot. Backwards across 9 V with no resistor it vents within seconds.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const socketA = (lab: LabView, id: string, dir?: "forward") => lab.joins(id, "d20", "d21", dir);
const current = (lab: LabView) => lab.amps("M1");

/** The fix-it bench: the 6.3 V can sits in socket A the right way round, on 9 V, and the 16 V one is back on the desk. */
const LOW_RATING: SolutionStep[] = [
  { do: "move", part: "CB", at: "desk:-26,44" },
  { do: "move", part: "CC", at: "d20-d21" },
];

export default defineLab({
  id: "capacitor-labels",
  title: "Mind the stripe",
  bench: {
    board: "full",
    frame: ["desk:-42,-30", "desk:24,52"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "rail+:6-b6", params: { ohms: 10000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "S1", kind: "slide-switch", at: "b30", params: { to: "a" }, locked: true, label: "Blast corner switch S1" },
      // On the desk, ready to read and to push in.
      { id: "CB", kind: "electrolytic-cap", at: "desk:-26,44", params: { farads: 100e-6, volts: 16 }, label: "100 µF 16 V capacitor CB" },
      { id: "CC", kind: "electrolytic-cap", at: "desk:0,44", params: { farads: 100e-6, volts: 6.3 }, label: "100 µF 6.3 V capacitor CC" },
    ],
    wires: [
      { id: "W0", from: "c8", to: "c20", color: "yellow" },
      { id: "W1", from: "a21", to: "rail-:21", color: "black" },
      { id: "W2", from: "a31", to: "rail+:31", color: "red" },
      { id: "W3", from: "a33", to: "rail-:33", color: "black" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:-178,22", rot: 16, mode: "dca-ma", range: "2mA", red: "ma", black: "com", probes: { red: "a6", black: "a8" } }],
  },
  mascot: {
    hint: "Watch what the current settles to, not the first jump.",
    fried: "That pop goes straight to the Hall. Bravo, scientist.",
  },
  fried: { CC: "100 µF 6.3 V electrolytic, abused on 9 V", CB: "100 µF electrolytic, backwards", capacitor: "Electrolytic capacitor, backwards" },
  tasks: [
    {
      id: "electrolytic-right-way",
      prompt: "Push the 16 V can in: long leg in row 20, stripe in row 21.",
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
      hints: ["The socket is rows 20 and 21.", "Long leg in row 20, stripe in row 21."],
      highlight: ["CB", "hole:d20", "hole:d21"],
      nudges: [{ when: (lab) => socketA(lab, "CB") && !socketA(lab, "CB", "forward"), say: "Stripe toward row 21, please. That's minus." }],
      success: "A gulp, then almost nothing.",
    },
    {
      id: "electrolytic-backwards",
      prompt: "Turn it round: stripe in row 20.",
      goal: (lab) => socketA(lab, "CB") && !socketA(lab, "CB", "forward") && lab.event("reversed", "CB") && lab.heldFor(5, socketA(lab, "CB") && current(lab) > 100e-6),
      hints: ["Just watch the meter. Does it settle this time?", "Give it five seconds."],
      highlight: ["CB"],
      success: "It never settles.",
    },
    {
      id: "pull-it-out",
      prompt: "Pull it out before it pops.",
      // Backwards it heats, then smokes, and vents about 15 s after going in.
      goal: (lab) => !socketA(lab, "CB"),
      hints: ["Drag the can off the board, onto the desk."],
      highlight: ["CB"],
      success: "Phew.",
    },
    {
      id: "fix-overvolt",
      prompt: "This can keeps leaking. Fix it.",
      setup: LOW_RATING,
      // The low-rated can in the socket first (the setup), then the 16 V one, the right way round.
      goal: (lab) => {
        if (socketA(lab, "CC")) lab.memory["low"] = true;
        return lab.memory["low"] === true && lab.heldFor(2, !socketA(lab, "CC") && socketA(lab, "CB", "forward"));
      },
      hints: ["Read the can. What voltage does it say?", "Swap in the 16 V can, stripe toward row 21."],
      highlight: ["CC", "CB"],
      success: "Fixed.",
    },
    {
      id: "blast-box",
      prompt: "Optional, loud: the 6.3 V can backwards in the blast corner, then slide S1.",
      goal: (lab) => lab.died("CC") && lab.events.some((e) => e.type === "died" && e.partId === "CC" && e.data?.["cause"] === "reverse"),
      hints: ["There's no resistor in the blast corner. That's the point.", "Backwards: stripe in row 32, long leg in row 33."],
      highlight: ["S1", "hole:d32", "hole:d33"],
      success: "Heated, bulged, vented.",
      bonus: true,
    },
  ],
  solution: [
    { do: "move", part: "CB", at: "d20-d21" },
    { do: "wait", seconds: 6 },
    { do: "check", task: "electrolytic-right-way" },
    { do: "move", part: "CB", at: "d21-d20" },
    { do: "wait", seconds: 6 },
    { do: "check", task: "electrolytic-backwards" },
    { do: "move", part: "CB", at: "desk:-26,44" },
    { do: "check", task: "pull-it-out" },
    ...LOW_RATING,
    { do: "wait", seconds: 1 },
    { do: "move", part: "CC", at: "desk:0,44" },
    { do: "move", part: "CB", at: "d20-d21" },
    { do: "wait", seconds: 3 },
    { do: "check", task: "fix-overvolt" },
    // The secret.
    { do: "move", part: "CC", at: "d33-d32" },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 6 },
    { do: "check", task: "blast-box" },
  ],
});
