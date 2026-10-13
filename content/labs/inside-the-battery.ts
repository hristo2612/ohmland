// Blueprint: docs/curriculum/unit-1.md, L15. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Read it once at rest, once while working. Compare."
//   success "1.7 hidden ohms, found. Nothing hides from your meter."
// Expected: B1 open 9.40 V; loaded about 8.45 V (0.55 A); r about 1.7 Ω. B2 open 8.60 V; loaded about 5.7 V; r about
//   8 Ω.
// Needs: clip leads of 0.15 Ω each (N3), battery sag (N10), and swapping a battery keeps the existing clip and
//   grabber connections (N11).
import { defineLab } from "@ohmland/lab";
import { amps, meterMode, readsBetween } from "./lib/goals";

export default defineLab({
  id: "inside-the-battery",
  title: "The battery's hidden resistor",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      { id: "S1", kind: "switch", props: { closed: false } },
      { id: "R1", kind: "resistor", props: { ohms: 15, watts: 5 } },
      { id: "L1", kind: "wire", at: "B1.pos|S1.a" },
      { id: "L2", kind: "wire", at: "S1.b|R1.a" },
      { id: "L3", kind: "wire", at: "R1.b|B1.neg" },
      // An old, scuffed battery on a shelf. Swapping it in moves the same clip leads.
      { id: "B2", kind: "battery", at: "shelf", props: { emf: 8.6, internalOhms: 8, mAh: 500 } },
      // Probes clipped to the battery terminals with hook grabbers; they follow the battery when it's swapped.
      { id: "M1", kind: "multimeter", props: { mode: "dcv", range: "20V", red: "vohm", black: "com" } },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "open-voltage",
      prompt: "With the switch off, read the battery voltage.",
      // GOAL: part(S1).closed == false && across(B1) && logged("open") && meter.value >= 9.3 && meter.value <= 9.5
      goal: (lab) => lab.part("S1")?.closed === false && meterMode(lab) === "dcv" && readsBetween(lab, 9.3, 9.5),
      hints: ["The probes are already clipped on. Just read the screen."],
      success: "About 9.4 V with nothing to power. That's the battery's full push.",
    },
    {
      id: "loaded-voltage",
      prompt: "Switch on the 15 Ω load and read the battery again straight away.",
      // GOAL: part(S1).closed && logged("loaded") within 2 s of closing, reading 8.2 to 8.7 V and at least 0.5 V below
      //   the open reading
      goal: (lab) => lab.part("S1")?.closed === true && meterMode(lab) === "dcv" && readsBetween(lab, 8.2, 8.7),
      hints: ["Flip the switch, then look at the meter right away."],
      success: "Down by almost a volt, just from doing work. Some of the push is being spent inside the battery.",
    },
    {
      // NOTEBOOK task (N2).
      id: "find-r",
      prompt:
        "Work out the internal resistance. Current first: I = loaded voltage ÷ 15 Ω. Then r = (open voltage − loaded voltage) ÷ I.",
      // GOAL: note("r") between 1.0 and 3.0 Ω
      // Interim: needs the lab notebook, which LabView does not have yet.
      goal: () => false,
      hints: ["8.45 ÷ 15 ≈ 0.56 A.", "(9.40 − 8.45) ÷ 0.56 ≈ 1.7 Ω."],
      success: "About 1.7 Ω, hiding inside the battery the whole time.",
    },
    {
      id: "old-battery",
      prompt: "Swap in the old battery from the shelf. Take both readings again: switch off, then on.",
      // GOAL: B2 in the loop, a logged open reading of 8.4 to 8.8 V and a logged loaded reading of 5.2 to 6.2 V
      // Interim: B2 drives the load and the meter shows its loaded voltage.
      goal: (lab) => lab.part("S1")?.closed === true && amps(lab, "B2") > 0.2 && readsBetween(lab, 5.2, 6.2),
      hints: ["Drag the old battery onto the fresh one. The clips and probes move across."],
      success: "8.6 V at rest looks fine. Under load it slumps below 6 V. Old batteries hide their age until you make them work.",
    },
    {
      id: "watch-it-sag",
      prompt: "Fresh battery back in. Leave the load on for 20 seconds and watch the reading, then switch off.",
      // GOAL: heldFor(20, part(S1).closed) with B1, the reading falls at least 0.1 V further during that time, then
      //   rises after switching off
      // Interim: needs heldFor and a reading history, which LabView does not keep yet.
      goal: () => false,
      hints: ["Switch on, count to twenty while you watch the screen, then switch off."],
      success: "It keeps sinking while it works, then recovers a little at rest. The chemistry can only react so fast.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
