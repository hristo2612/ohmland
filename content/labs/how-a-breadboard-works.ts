// A reference lab of a bench lesson (docs/LESSONS.md): content/units/basics/start-here/how-a-breadboard-works.
// One idea: hidden metal strips join some holes. The hole games are the lesson's own checks; the lab holds the bench
// and the two hands-on tasks (fix an LED whose legs share a strip, slide a wire along a rail) plus the secret.
// Half-size board: 30 numbered strips a to e and f to j, rails in groups of five (columns 1-5, 7-11, 13-17 ...).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The LED comes into play standing wrong: both legs in strip 10, so the strip joins them and skips it. */
const LED_IN_ONE_STRIP: SolutionStep[] = [
  { do: "place", part: "R1", kind: "resistor", at: "rail+:10-b10", params: { ohms: 1000 } },
  { do: "place", part: "D1", kind: "led", at: "c10", rot: 90, params: { color: "red" } },
  { do: "wire", id: "W1", from: "a11", to: "rail-:11", color: "black" },
];

/** The minus-rail end of the black jumper, as a column number. */
function minusEnd(lab: LabView): number | null {
  const w = lab.bench.wires.find((x) => x.id === "W1");
  const end = [w?.a, w?.b].find((h) => h && /^bn\d+$/.test(h));
  return end ? Number(end.slice(2)) : null;
}
const onPlusRail = (lab: LabView) => {
  const w = lab.bench.wires.find((x) => x.id === "W1");
  return !!w && [w.a, w.b].some((h) => /^bp\d+$/.test(h));
};

export default defineLab({
  id: "how-a-breadboard-works",
  title: "How a breadboard works",
  bench: {
    board: "half",
    parts: [{ id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" }],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Same number, same side: joined.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "fix-led",
      prompt: "Give each of the LED's legs its own strip.",
      setup: LED_IN_ONE_STRIP,
      goal: (lab) => lab.isLit("D1") && !lab.connected("D1.anode", "D1.cathode"),
      hints: ["Drag the LED so its legs sit side by side, in strips 10 and 11.", "Long leg in strip 10, with the resistor. Short leg in strip 11."],
      highlight: ["D1", "hole:c11"],
      nudges: [{ when: (lab) => (lab.part("D1")?.v ?? 0) < -1, say: "Close. Long leg toward the resistor." }],
      success: "It glows.",
    },
    {
      id: "rail-slide",
      prompt: "Move the black wire's rail end far along the blue rail.",
      goal: (lab) => {
        const col = minusEnd(lab);
        return lab.isLit("D1") && col !== null && Math.abs(col - 11) >= 6;
      },
      hints: ["Drag the end of the black wire that sits in the rail.", "Drop it in the outer rail, by the blue stripe, far to the right."],
      highlight: ["wire:W1.b"],
      nudges: [{ when: onPlusRail, say: "That's the plus rail. Try the blue one." }],
      success: "Still glowing.",
    },
    {
      id: "short-the-rails",
      prompt: "Join plus and minus with a wire.",
      goal: (lab) => lab.event("shorted", "B1"),
      hints: ["Put a wire from the red rail straight to the blue rail."],
      success: "A short: all current, no part.",
      bonus: true,
    },
  ],
  solution: [
    ...LED_IN_ONE_STRIP,
    { do: "move", part: "D1", at: "c10", rot: 0 },
    { do: "check", task: "fix-led" },
    { do: "unwire", wire: "W1" },
    { do: "wire", id: "W1", from: "a11", to: "rail-:26", color: "black" },
    { do: "check", task: "rail-slide" },
    { do: "wire", id: "W2", from: "rail+:20", to: "rail-:21", color: "red" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "short-the-rails" },
  ],
});
