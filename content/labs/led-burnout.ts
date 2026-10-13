// Blueprint: docs/curriculum/unit-1.md, L8. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Less resistance, more current. Keep an eye on that stress bar."
//   fried "Poor little LED. It gave everything it had. To the Hall."
//   success "Fresh LED, sensible resistor. Bright and built to last."
// Fried moment (required, task too-far): Hall entry kind "led", label "Red LED, 15 Ω on 9 V".
// Instruments (N8): an LED stress bar above D1 showing its current as a share of its 50 mA maximum: green below 50%,
//   amber to 90%, red above. No numbers yet.
// Expected: 1.5 kΩ about 5 mA (glow about 0.35); 470 Ω about 16 mA (about 0.6); 150 Ω about 47 mA (about 0.9, bar
//   amber-red, health "hot"); 15 Ω several hundred mA, the LED dies within about 0.5 s with a bright flash.
// Needs: a dead part stays dead when it is moved or re-clipped (the bench keeps its id, N11).
import { defineLab } from "@ohmland/lab";
import { amps, between, glow } from "./lib/goals";

export default defineLab({
  id: "led-burnout",
  title: "One LED, too much current",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      // A pair of resistor clips (the R slot), holding the 1.5 kΩ resistor. Dropping a resistor on it swaps it in.
      { id: "R1", kind: "resistor", at: "slot:R", props: { ohms: 1500, watts: 0.25 } },
      { id: "D1", kind: "led", props: { color: "red", maxmA: 50 } },
      { id: "L1", kind: "wire", at: "B1.pos|slot:R.a" },
      { id: "L2", kind: "wire", at: "slot:R.b|D1.anode" },
      { id: "L3", kind: "wire", at: "D1.cathode|B1.neg" },
    ],
    tray: [
      { kind: "resistor", props: { ohms: 470, watts: 0.25 }, count: 1 },
      { kind: "resistor", props: { ohms: 150, watts: 0.25 }, count: 1 },
      { kind: "resistor", props: { ohms: 15, watts: 0.25 }, count: 1 },
      { kind: "led", props: { color: "red", maxmA: 50 }, count: 3 },
    ],
    instruments: [],
  },
  tasks: [
    {
      id: "brighter",
      prompt: "Swap the 1.5 kΩ resistor for the **470 Ω** one.",
      // GOAL: R slot holds 470 Ω && isLit(D1) && part(D1).glow > 0.5
      // Interim: the LED current that 470 Ω gives (about 16 mA) stands in for "the slot holds 470 Ω".
      goal: (lab) => lab.isLit("D1") && glow(lab, "D1") > 0.5 && between(amps(lab, "D1"), 0.012, 0.02),
      hints: ["Drag a resistor from the tray onto the two clips. The old one pops out."],
      success: "Brighter. Less resistance lets more current through.",
    },
    {
      id: "brighter-still",
      prompt: "Now try **150 Ω**. Watch the LED's stress bar.",
      // GOAL: R slot holds 150 Ω && part(D1).glow > 0.8 && part(D1).health != "dead"
      // Interim: the LED current that 150 Ω gives (about 47 mA) stands in for "the slot holds 150 Ω".
      goal: (lab) => glow(lab, "D1") > 0.8 && lab.part("D1")?.health !== "dead" && between(amps(lab, "D1"), 0.035, 0.055),
      hints: ["Drop the 150 Ω resistor onto the clips."],
      success: "Dazzling, and the stress bar is nearly full. It's alive, but close to its limit.",
    },
    {
      id: "too-far",
      prompt: "Go on. Try the **15 Ω** resistor.",
      // GOAL: fried("led")
      goal: (lab) => lab.fried("led"),
      hints: ["Drop the 15 Ω resistor onto the clips and watch closely."],
      success: "Flash, then nothing. Far too much current, and the LED died. It goes to the Hall of Fried Parts.",
    },
    {
      id: "no-comeback",
      prompt: "Put the 1.5 kΩ resistor back. Does the dead LED recover? Then swap in a fresh LED.",
      // GOAL: the dead D1 observed in place with 1.5 kΩ (glow 0 for at least 1 s), then a fresh LED in the loop with isLit
      // Interim: an LED has died, and some live LED now glows at the 1.5 kΩ current (about 5 mA).
      goal: (lab) =>
        lab.fried("led") &&
        Object.values(lab.snapshot?.parts ?? {}).some((p) => p.health !== "dead" && (p.glow ?? 0) >= 0.1 && between(Math.abs(p.i), 0.003, 0.007)),
      hints: ["Drop the 1.5 kΩ resistor back onto the clips first.", "Then swap the dead LED for a fresh one from the tray."],
      success: "Dead LEDs stay dead. The fresh one is happy at a safe current.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
