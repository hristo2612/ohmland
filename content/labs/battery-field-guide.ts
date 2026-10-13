// Blueprint: docs/curriculum/unit-1.md, L18. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Capacity divided by current. That gives you hours."
//   success "Bench built, lamp lit, lab powered. This island is officially alive."
// Props (N15): a battery shelf, a test station (two spring clips with a switchable 100 Ω test load across them) and a
//   display case behind glass with a phone lithium-ion pack and a car battery: info only, not connectable (tap one
//   for a safety card).
// Instruments: the meter on DC V 20V with its probes clipped to the test station, and a time-lapse control (N14:
//   about 3,600 times real time with battery depletion and LED dimming, plus an on-screen clock).
// Expected under 100 Ω: 9 V 9.24 V; AA alkaline 1.58 V (no visible drop); NiMH 1.32 V; coin cell about 2.78 V.
import { defineLab } from "@ohmland/lab";
import { amps, between, meterMode, reading } from "./lib/goals";

/** Resting voltage ranges per battery, as logged in the survey. */
const RESTING: [number, number][] = [
  [9.0, 9.6], // B1, 9 V alkaline
  [1.5, 1.65], // X1, AA alkaline
  [1.25, 1.4], // X2, AA NiMH
  [3.0, 3.3], // X3, coin cell
];

export default defineLab({
  id: "battery-field-guide",
  title: "A field guide to batteries",
  bench: {
    board: "none",
    parts: [
      // On the battery shelf.
      { id: "B1", kind: "battery", at: "shelf", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      { id: "X1", kind: "battery", at: "shelf", props: { emf: 1.58, internalOhms: 0.15, mAh: 2500 } },
      { id: "X2", kind: "battery", at: "shelf", props: { emf: 1.32, internalOhms: 0.03, mAh: 2000 } },
      { id: "X3", kind: "battery", at: "shelf", props: { emf: 3.2, internalOhms: 15, mAh: 225 } },
      // The test station: its load switch and 100 Ω test load in series across the two spring clips.
      { id: "S1", kind: "switch", props: { closed: false } },
      { id: "R1", kind: "resistor", props: { ohms: 100, watts: 2 } },
      { id: "L1", kind: "wire", at: "slot:TEST.pos|S1.a" },
      { id: "L2", kind: "wire", at: "S1.b|R1.a" },
      { id: "L3", kind: "wire", at: "R1.b|slot:TEST.neg" },
      { id: "M1", kind: "multimeter", props: { mode: "dcv", range: "20V", red: "vohm", black: "com" } },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "survey",
      prompt: "Drop each battery into the test station with the load off and log its resting voltage.",
      // GOAL: logged resting readings for B1 (9.0 to 9.6 V), X1 (1.50 to 1.65 V), X2 (1.25 to 1.40 V) and X3 (3.0 to
      //   3.3 V)
      // Interim: any one resting reading in range; logging all four needs the notebook.
      goal: (lab) => lab.part("S1")?.closed === false && meterMode(lab) === "dcv" && RESTING.some(([lo, hi]) => between(reading(lab), lo, hi)),
      hints: ["Drag a battery from the shelf into the spring clips, read it, then try the next."],
      success: "Four chemistries, four voltages. The rechargeable AA sits lower than the alkaline one: that's its chemistry, not a fault.",
    },
    {
      id: "load-test",
      prompt: "Now switch on the 100 Ω load and log each battery again while it works.",
      // GOAL: logged loaded readings for all four batteries
      // Interim: any loaded reading; logging all four needs the notebook.
      goal: (lab) => lab.part("S1")?.closed === true && amps(lab, "R1") > 0.005 && meterMode(lab) === "dcv",
      hints: ["Load switch on, then read. Do all four."],
      success: "The AA cells barely notice. The coin cell sags by about 0.4 V. Its high internal resistance makes it a sipper, not a gulper.",
    },
    {
      // NOTEBOOK task (N2).
      id: "run-time",
      prompt: "An LED circuit drawing 15 mA runs from the 500 mAh 9 V battery. Estimate how many hours it will last, then run the time-lapse.",
      // GOAL: note("hours") between 25 and 40, then the time-lapse is played to the end
      // Interim: needs the lab notebook and the time-lapse (N14), which LabView does not have yet.
      goal: () => false,
      hints: ["Capacity in mAh divided by current in mA gives hours."],
      success:
        "About 33 hours, close to what the time-lapse shows. Real batteries give a little more or less, depending on the load and the temperature.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
