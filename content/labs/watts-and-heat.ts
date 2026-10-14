// Blueprint: docs/curriculum/unit-1.md, L13, the kept half after the split (docs/curriculum/conversion-guide.md, B3 13).
// The lab of a bench lesson (docs/LESSONS.md): content/units/basics/power-and-heat/watts-and-heat.
// One idea: a part's power rating is the heat it can shed, so pick one with room to spare.
// A load holder clipped straight across the battery (0.15 Ω per clip lead), three 15 Ω resistors in the tray (1/4 W,
// 1 W and a 5 W ceramic) and a temperature readout with a touch-feel word over every resistor. From the simulator:
// 15 Ω takes about 4.2 W (the battery sags); the 1/4 W part smokes within 2 s and burns open within 4 s, the 1 W part
// smokes after about 20 s, the 5 W part warms slowly and survives. 47 Ω takes about 1.7 W: the 1/4 W part burns, the
// 1 W part survives near 130 °C, the 5 W part settles near 60 °C.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The resistor id in the holder, or null. */
const inHolder = (lab: LabView): string | null => lab.holds("H1")[0] ?? null;

const PARTS = {
  R2: { ohms: 15, watts: 0.25 },
  R4: { ohms: 15, watts: 1 },
  R5: { ohms: 15, watts: 5 },
  R6: { ohms: 47, watts: 0.25 },
  R7: { ohms: 47, watts: 1 },
  R8: { ohms: 47, watts: 5 },
} as const;

/** The fix-it bench: a 47 Ω, 1/4 W resistor in the holder (it smokes), and the same value at 1 W and 5 W beside it. */
const UNDERRATED: SolutionStep[] = [
  { do: "place", part: "R6", kind: "resistor", params: PARTS.R6, at: "in:H1" },
  // The 15 Ω parts go behind the holder, out of the frame, all three, so the tray stays shut.
  { do: "move", part: "R5", at: "desk:-70,-150" },
  { do: "move", part: "R2", at: "desk:-20,-150" },
  { do: "place", part: "R4", kind: "resistor", params: PARTS.R4, at: "desk:30,-150" },
  { do: "place", part: "R7", kind: "resistor", params: PARTS.R7, at: "desk:-55,45" },
  { do: "place", part: "R8", kind: "resistor", params: PARTS.R8, at: "desk:15,45" },
];

export default defineLab({
  id: "watts-and-heat",
  title: "Smoke and ratings",
  bench: {
    board: "none",
    frame: ["desk:-145,-70", "desk:75,62"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-100,8", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // The load holder: two clips joined to the battery's terminals by clip leads.
      { id: "H1", kind: "holder", at: "desk:-6,-36", locked: true, label: "Load holder" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "H1.a", color: "red" },
      { id: "TL2", from: "H1.b", to: "B1.neg", color: "black" },
    ],
    tray: [
      { id: "R2", kind: "resistor", params: PARTS.R2, count: 1, label: "15 Ω, 1/4 W" },
      { id: "R4", kind: "resistor", params: PARTS.R4, count: 1, label: "15 Ω, 1 W" },
      { id: "R5", kind: "resistor", params: PARTS.R5, count: 1, label: "15 Ω, 5 W" },
    ],
    instruments: [
      // Each resistor's temperature, with a touch-feel word: cool, warm, hot, ouch.
      { kind: "inspect", show: "heat", parts: ["resistor"] },
    ],
  },
  mascot: {
    hint: "Watts in, heat out. Is the part big enough?",
    fried: "Smells like learning. That one's for the Hall.",
  },
  fried: (f) =>
    f.partId === "R2" ? "15 Ω, 1/4 W resistor across 9 V" : f.partId === "R4" ? "15 Ω, 1 W resistor across 9 V" : f.partId === "R6" ? "47 Ω, 1/4 W resistor across 9 V" : undefined,
  tasks: [
    {
      id: "cook-one",
      prompt: "Clip in the 15 Ω, 1/4 W resistor. Watch closely.",
      goal: (lab) => lab.died("R2"),
      hints: ["Drop the 15 Ω, 1/4 W resistor onto the holder's clips."],
      highlight: ["H1"],
      nudges: [{ when: (lab) => inHolder(lab) === "R4" || inHolder(lab) === "R5", say: "That's a bigger one. Start with the little 1/4 W." }],
      success: "Smoke, then a break.",
    },
    {
      id: "survive-ten",
      prompt: "Swap in the 15 Ω, 5 W resistor. Give it ten seconds.",
      goal: (lab) => lab.heldFor(10, inHolder(lab) === "R5" && lab.part("R5")?.health !== "dead"),
      hints: ["Drop the big white 5 W resistor onto the holder. Then just wait."],
      highlight: ["H1"],
      success: "Alive, and warming.",
    },
    {
      id: "rate-it",
      prompt: "The 47 Ω, 1/4 W resistor keeps smoking. Fix it.",
      setup: UNDERRATED,
      // The under-rated part first (the setup), then the 5 W one, alive for a few seconds.
      goal: (lab) => {
        if (inHolder(lab) === "R6") lab.memory["smoking"] = true;
        return lab.memory["smoking"] === true && lab.heldFor(3, inHolder(lab) === "R8" && lab.part("R8")?.health !== "dead");
      },
      hints: ["About 9 V and 0.19 A: P = V × I, about 1.7 W.", "Twice 1.7 W is 3.4 W. Which rating covers that?"],
      highlight: ["R8", "H1"],
      nudges: [{ when: (lab) => inHolder(lab) === "R7", say: "It lives, but runs near its limit. More room." }],
      success: "Cool enough. Plenty of room.",
    },
    {
      id: "one-watt-too",
      prompt: "Curious? Try the 15 Ω, 1 W one.",
      goal: (lab) => lab.event("smoke", "R4"),
      hints: ["Drop the 15 Ω, 1 W resistor on. Give it a while."],
      success: "Better, but still smoking.",
      bonus: true,
    },
  ],
  solution: [
    { do: "place", part: "R2", kind: "resistor", params: PARTS.R2, at: "in:H1" },
    { do: "wait", seconds: 6 },
    { do: "check", task: "cook-one" },
    { do: "place", part: "R5", kind: "resistor", params: PARTS.R5, at: "in:H1" },
    { do: "wait", seconds: 10.5 },
    { do: "check", task: "survive-ten" },
    ...UNDERRATED,
    { do: "wait", seconds: 2 },
    { do: "move", part: "R8", at: "in:H1" },
    { do: "wait", seconds: 3.5 },
    { do: "check", task: "rate-it" },
    { do: "place", part: "R4", kind: "resistor", params: PARTS.R4, at: "in:H1" },
    { do: "wait", seconds: 25 },
    { do: "check", task: "one-watt-too" },
  ],
});
