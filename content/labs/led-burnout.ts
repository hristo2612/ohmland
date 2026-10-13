// Blueprint: docs/curriculum/unit-1.md, L8. A battery, a resistor holder (the R slot) and a red LED, clipped into a
// loop. Dropping a resistor from the tray onto the holder swaps it in (the old one pops out); dropping a fresh LED
// onto the dead one takes its place and its clips. A stress bar over each LED shows its current as a share of its
// 50 mA maximum.
import { defineLab, type LabView } from "@ohmland/lab";

/** Nominal ohms of the resistor in the holder, or null. */
const slotOhms = (lab: LabView): number | null => {
  const id = lab.holds("H1")[0];
  const p = id ? (lab.prop(id) as { ohms?: number } | undefined) : undefined;
  return p?.ohms ?? null;
};

const leds = (lab: LabView) => lab.bench.parts.filter((p) => p.kind === "led").map((p) => p.id);
const glow = (lab: LabView, id: string) => lab.part(id)?.glow ?? 0;

export default defineLab({
  id: "led-burnout",
  title: "One LED, too much current",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-92,10", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "H1", kind: "holder", at: "desk:2,-42", locked: true, label: "Resistor holder" },
      { id: "R1", kind: "resistor", at: "in:H1", params: { ohms: 1500, watts: 0.25 }, label: "1.5 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:62,28", rot: 180, params: { color: "red", maxmA: 50 }, label: "Red LED" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "H1.a", color: "red" },
      { id: "TL2", from: "H1.b", to: "D1.anode", color: "yellow" },
      { id: "TL3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [
      { id: "R2", kind: "resistor", params: { ohms: 470, watts: 0.25 }, count: 1 },
      { id: "R3", kind: "resistor", params: { ohms: 150, watts: 0.25 }, count: 1 },
      { id: "R4", kind: "resistor", params: { ohms: 15, watts: 0.25 }, count: 1 },
      { id: "D2", kind: "led", params: { color: "red", maxmA: 50 }, count: 3, label: "Spare LED" },
    ],
    // A stress bar over every LED: its current as a share of its maximum.
    instruments: [{ kind: "inspect", show: "stress", parts: ["led"] }],
  },
  mascot: {
    start: "Brighter is always better, right? Let's test that.",
    hint: "Less resistance, more current. Keep an eye on that stress bar.",
    fried: "Poor little LED. It gave everything it had. To the Hall.",
    success: "Fresh LED, sensible resistor. Bright and built to last.",
  },
  fried: (f) => (f.kind === "led" ? (slotOhms(f.lab) === 15 ? "Red LED, 15 Ω on 9 V" : "Red LED, too much current") : undefined),
  tasks: [
    {
      id: "brighter",
      prompt: "Swap the 1.5 kΩ resistor for the **470 Ω** one.",
      goal: (lab) => slotOhms(lab) === 470 && lab.isLit("D1") && glow(lab, "D1") > 0.5,
      hints: ["Drag a resistor onto the clips. The old one pops out."],
      highlight: ["H1"],
      success: "Brighter. Less resistance, more current.",
    },
    {
      id: "brighter-still",
      prompt: "Now **150 Ω**. Watch the stress bar.",
      goal: (lab) => slotOhms(lab) === 150 && glow(lab, "D1") > 0.8 && lab.part("D1")?.health !== "dead",
      hints: ["Drop the 150 Ω resistor onto the clips."],
      highlight: ["H1"],
      success: "Dazzling, and nearly at its limit. Still alive.",
    },
    {
      id: "too-far",
      prompt: "Go on. Try **15 Ω**.",
      goal: (lab) => lab.fried("led"),
      hints: ["Drop the 15 Ω resistor onto the clips. Watch closely."],
      highlight: ["H1"],
      success: "Flash, then nothing. Far too much current. To the Hall of Fried Parts.",
    },
    {
      id: "no-comeback",
      prompt: "Put 1.5 kΩ back. Does the LED recover? Then fit a fresh one.",
      goal: (lab) => {
        const safe = slotOhms(lab) === 1500;
        const mem = lab.memory as { dark?: boolean };
        // The dead LED, still clipped in, stays dark behind a safe resistor.
        if (safe && lab.part("D1")?.health === "dead" && lab.connected("D1.anode", "H1.b")) mem.dark = true;
        return !!mem.dark && safe && leds(lab).some((id) => lab.isLit(id) && lab.connected(`${id}.anode`, "H1.b"));
      },
      hints: ["Drag the 1.5 kΩ resistor back onto the clips. Look at the LED.", "Drop a spare LED right onto the dead one. It takes its clips."],
      highlight: ["H1", "D1"],
      success: "Dead LEDs stay dead. The fresh one is happy.",
    },
  ],
  solution: [
    { do: "place", part: "R2", kind: "resistor", params: { ohms: 470, watts: 0.25 }, at: "in:H1" },
    { do: "check", task: "brighter" },
    { do: "place", part: "R3", kind: "resistor", params: { ohms: 150, watts: 0.25 }, at: "in:H1" },
    { do: "check", task: "brighter-still" },
    { do: "place", part: "R4", kind: "resistor", params: { ohms: 15, watts: 0.25 }, at: "in:H1" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "too-far" },
    { do: "move", part: "R1", at: "in:H1" },
    { do: "wait", seconds: 1.2 },
    { do: "place", part: "D2", kind: "led", params: { color: "red", maxmA: 50 }, at: "on:D1" },
    { do: "check", task: "no-comeback" },
  ],
});
