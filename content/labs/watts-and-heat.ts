// Blueprint: docs/curriculum/unit-1.md, L13. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Power is volts times amps. Got both numbers?"
//   fried "Smells like learning. That one's going in the Hall."
//   success "Rated for five watts, handling four and a half. Cutting it close!"
// Fried moments: required (task cook-one) Hall entry kind "resistor", label "15 Ω, 1/4 W resistor across 9 V";
//   bonus (task one-watt-too, if it burns open) kind "resistor", label "15 Ω, 1 W resistor across 9 V".
// Instruments (N8): a heat view. Each resistor shows its temperature in °C and a touch-feel label: cool below 35 °C,
//   warm to 50 °C, hot to 70 °C, "ouch" above.
// Expected: 1 kΩ: 9.4 V, 9.4 mA, about 88 mW, settles near 45 °C. 15 Ω: about 0.55 A and 4.5 W. The 1/4 W part smokes
//   within about 3 s and burns open within about 10 s. The 1 W part smokes within about 10 s. The 5 W part runs very
//   hot (well over 100 °C) and survives.
// Needs: clip leads of 0.15 Ω each (N3), battery sag (N10), and a resistor thermal model: about 250 °C/W for 1/4 W,
//   100 °C/W for 1 W, 25 °C/W for the 5 W ceramic; smoke above about 4 times the rating sustained, burn open far
//   beyond it.
import { defineLab, type LabView } from "@ohmland/lab";
import { between, happened, meterMode } from "./lib/goals";

/** Power the part is turning into heat, in watts (NaN when missing). */
const watts = (lab: LabView, id: string) => lab.part(id)?.p ?? Number.NaN;
const alive = (lab: LabView, id: string) => {
  const h = lab.part(id)?.health;
  return h !== undefined && h !== "dead";
};

export default defineLab({
  id: "watts-and-heat",
  title: "Watts and warm resistors",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      // A load holder: two clips joined to the battery terminals by clip leads.
      { id: "L1", kind: "wire", at: "B1.pos|slot:LOAD.a" },
      { id: "L2", kind: "wire", at: "slot:LOAD.b|B1.neg" },
      // Loose beside the holder (the blueprint's tray; goals refer to them by id).
      { id: "R1", kind: "resistor", props: { ohms: 1000, watts: 0.25 } },
      { id: "R2", kind: "resistor", props: { ohms: 15, watts: 0.25 } },
      { id: "R3", kind: "resistor", props: { ohms: 15, watts: 0.25 } },
      { id: "R4", kind: "resistor", props: { ohms: 15, watts: 1 } },
      // Ceramic power resistor.
      { id: "R5", kind: "resistor", props: { ohms: 15, watts: 5 } },
      { id: "M1", kind: "multimeter", props: { mode: "dcv", range: "20V", red: "vohm", black: "com" } },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      // NOTEBOOK task (N2).
      id: "cool-one",
      prompt:
        "Clip the 1 kΩ resistor into the holder and measure the voltage across it. Power is voltage times current: P = V × I, where I = V ÷ R. Type the power in milliwatts.",
      // GOAL: R1 in the holder, logged("R1"), note("mW") between 80 and 95
      // Interim: R1 is in the holder and dissipating 80 to 95 mW, measured on DC volts.
      goal: (lab) => meterMode(lab) === "dcv" && between(watts(lab, "R1"), 0.08, 0.095),
      hints: ["I = 9.4 V ÷ 1,000 Ω ≈ 0.0094 A.", "P = 9.4 × 0.0094 ≈ 0.088 W. How many mW is that?"],
      success: "About 88 mW. Barely warm. A 1/4 W resistor can handle 250 mW.",
    },
    {
      id: "cook-one",
      prompt: "Swap in a 15 Ω, 1/4 W resistor and watch it closely.",
      // GOAL: fried("resistor") with R2 or R3
      goal: (lab) => ["R2", "R3"].some((id) => lab.part(id)?.health === "dead" || happened(lab, "died", id)),
      hints: ["Either of the small 15 Ω resistors will do."],
      success: "Smoke, then a scorched break. That little resistor was taking about 18 times its rating.",
    },
    {
      // NOTEBOOK task (N2).
      id: "power-it",
      prompt: "Now clip in the big 15 Ω, **5 W** resistor. Measure the voltage across it and type its power in watts.",
      // GOAL: R5 in the holder and alive, logged("R5"), note("W") within 10% of (logged V)² ÷ 15
      // Interim: R5 is alive and dissipating about 4.5 W (3 to 5.5 W, allowing for battery sag).
      goal: (lab) => alive(lab, "R5") && between(watts(lab, "R5"), 3, 5.5),
      hints: ["P = V² ÷ R works when you know voltage and resistance.", "About 8.3 × 8.3 ÷ 15."],
      success: "Around 4.5 W, all of it turning into heat.",
    },
    {
      id: "survive-ten",
      prompt: "Leave it there for 10 seconds. Does the 5 W resistor survive?",
      // GOAL: heldFor(10, R5 in the holder && part(R5).health != "dead")
      // Interim: R5 is alive and still loaded; the 10 s hold needs heldFor.
      goal: (lab) => alive(lab, "R5") && between(watts(lab, "R5"), 3, 5.5),
      hints: ["Just wait and watch the temperature climb."],
      // NOTICE: the battery's voltage has crept down while it works hard. Module 5's last lesson explains why.
      success: "Hot enough to burn a finger, but alive. 4.5 W is within its 5 W rating, and its big body sheds the heat.",
    },
    {
      id: "one-watt-too",
      prompt: "Curious about the 1 W version? Give it a go.",
      // GOAL: event("smoke", "R4")
      goal: (lab) => happened(lab, "smoke", "R4"),
      hints: ["Swap the 1 W, 15 Ω resistor into the holder and give it a few seconds."],
      success: "Better than the 1/4 W one, but still smoking. 4.5 W is too much for a 1 W rating.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
