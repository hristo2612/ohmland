// Blueprint: docs/curriculum/unit-2.md, Lesson 14. Lesson 13's circuit with Q1 in place (rows 20 to 22, LED in rows 22
// and 23, button S1 in rows 14 and 16, base socket from row 16 to row 21). The learner tries 470 kΩ, 10 kΩ and 4.7 kΩ
// in the socket while measuring Q1's collector-emitter voltage, then swaps the button and base resistor for the touch
// pads (rows 14 and 16) and R5 (10 kΩ, row 16 to row 21). The fingertip slider sets the pads' resistance, from a
// light dry touch (2 MΩ) to a firm damp one (100 kΩ). Last, Q2 on the far half (rows 17 to 19) makes a Darlington
// pair: its emitter jumps to Q1's base, its collector to Q1's collector, and R5 feeds its base.
//
// Measured in the simulator: Vce about 5 V with 470 kΩ, 0.09 V with 10 kΩ (15 mA, glow 0.86); 4.7 kΩ gives the same
// current; the pads at 2 MΩ light one transistor dimly (about 0.8 mA), the Darlington nearly fully (13.5 mA).
import { defineLab, type LabView } from "@ohmland/lab";

/** The marked value of the resistor from the button's strip (row 16) to Q1's base, or null. */
function baseOhms(lab: LabView): number | null {
  for (const p of lab.bench.parts) if (p.kind === "resistor" && lab.joins(p.id, "c16", "Q1.b")) return Number(lab.prop(p.id)?.["ohms"]);
  return null;
}

const vce = (lab: LabView) => lab.part("Q1")?.v ?? 9;
const glow = (lab: LabView) => lab.part("D1")?.glow ?? 0;
const meterOnCE = (lab: LabView) =>
  lab.meter?.mode === "dcv" && lab.connected("probe:red", "Q1.c") && lab.connected("probe:black", "Q1.e");

/** The touch pads and R5 in a row from the + rail to `to` (pads first or R5 first). */
function padsFeed(lab: LabView, to: string): boolean {
  const pads = lab.bench.parts.find((p) => p.kind === "touch-pads");
  if (!pads || !lab.benchPart("R5")) return false;
  const viaPads = (mid: string) => lab.joins(pads.id, "B1.pos", mid) && lab.joins("R5", mid, to);
  const viaR5 = (mid: string) => lab.joins("R5", "B1.pos", mid) && lab.joins(pads.id, mid, to);
  return [`${pads.id}.a`, `${pads.id}.b`].some(viaPads) || ["R5.a", "R5.b"].some(viaR5);
}

const finger = (lab: LabView) => lab.control("finger") ?? 2e6;

export default defineLab({
  id: "touch-switch",
  title: "All the way on",
  bench: {
    board: "full",
    frame: ["desk:-90,-30", "desk:-4,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "rail+:23-b23", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R1" },
      { id: "D1", kind: "led", at: "d23", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D1" },
      { id: "Q1", kind: "npn", at: "c20", locked: true, label: "Q1 (2N3904)" },
      { id: "S1", kind: "pushbutton", at: "e14", params: { cap: "red" }, label: "Button S1" },
    ],
    wires: [
      { id: "W1", from: "a14", to: "rail+:15", color: "red" },
      { id: "W2", from: "a20", to: "rail-:21", color: "black" },
    ],
    tray: [
      { id: "R2", kind: "resistor", params: { ohms: 470_000 }, count: 1, label: "470 kΩ" },
      { id: "R3", kind: "resistor", params: { ohms: 10_000 }, count: 1, label: "10 kΩ" },
      { id: "R4", kind: "resistor", params: { ohms: 4700 }, count: 1, label: "4.7 kΩ" },
      { id: "R5", kind: "resistor", params: { ohms: 10_000 }, count: 1, label: "10 kΩ (R5, pads)" },
      { id: "T1", kind: "touch-pads", count: 1, label: "Touch pads" },
      { id: "Q2", kind: "npn", count: 1, label: "2N3904 (Q2)" },
    ],
    instruments: [{ kind: "meter", at: "desk:-178,22", rot: 16, mode: "dcv", tips: { red: "desk:-52,48", black: "desk:-40,54" } }],
    controls: [{ id: "finger", label: "Fingertip on the pads", part: "*", key: "ohms", min: 100_000, max: 2_000_000, value: 2_000_000, scale: "log", unit: "Ω" }],
  },
  mascot: {
    start: "All the way on, or all the way off. No dithering.",
    hint: "Black probe on the emitter, red on the collector.",
    success: "Your fingertip just flipped a switch. With physics.",
    fried: "That's what R5 is for. Fingers are never zero ohms, but wires are.",
    exit: "Forty thousand times gain. I feel dizzy.",
  },
  fried: { npn: "2N3904, base fed with no resistor" },
  tasks: [
    {
      id: "active-vs-saturated",
      prompt:
        "Put **470 kΩ** in the base socket (row 16 to row 21), hold S1, and measure the voltage from collector to emitter. Then swap to **10 kΩ** and measure again.",
      goal: (lab) => {
        const m = lab.memory as { a?: boolean; b?: boolean };
        if (lab.closed("S1") && meterOnCE(lab)) {
          if (baseOhms(lab) === 470_000 && vce(lab) > 2) m.a = true;
          if (baseOhms(lab) === 10_000 && vce(lab) < 0.3) {
            m.b = true;
            lab.shared["ic10k"] = lab.amps("Q1");
            lab.shared["glowSat"] = glow(lab);
          }
        }
        return !!m.a && !!m.b;
      },
      hints: ["Black probe on the emitter (row 20), red on the collector (row 22). Then hold S1.", "Bend the resistor's legs from row 16 to row 21."],
      highlight: ["pin:Q1.c", "pin:Q1.e"],
      success: "With plenty of base current, Q1 is fully on, with only about 0.1 V across it. That's saturation.",
    },
    {
      id: "no-brighter",
      prompt: "Swap to **4.7 kΩ**: double the base current again. Does the LED get brighter?",
      goal: (lab) => {
        const was = lab.shared["ic10k"];
        return baseOhms(lab) === 4700 && lab.closed("S1") && typeof was === "number" && Math.abs(lab.amps("Q1") - was) <= was * 0.05;
      },
      hints: ["Hold S1 and compare the LED with how it looked on 10 kΩ."],
      success: "No change. In saturation the LED and its resistor set the current, not the transistor.",
    },
    {
      id: "touch-it",
      prompt:
        "Replace the base resistor and the button with the **touch pads** (rows 14 and 16) and **R5** (row 16 to row 21). Then use the fingertip slider: touch lightly, then firmly.",
      goal: (lab) => {
        const m = lab.memory as { light?: number; firm?: number };
        if (!padsFeed(lab, "Q1.b") || lab.benchPart("Q2") && lab.connected("Q2.e", "Q1.b")) return false;
        if (lab.heldFor(0.4, finger(lab) >= 1.9e6, "light")) m.light = glow(lab);
        if (lab.heldFor(0.4, finger(lab) <= 1.1e5, "firm")) m.firm = glow(lab);
        return m.light !== undefined && m.firm !== undefined && m.light < 0.5 * m.firm;
      },
      hints: ["The pads go where the button was; R5 bends from row 16 to the base, row 21.", "The fingertip slider sets how firm and damp your touch is."],
      highlight: ["hole:c14", "hole:c16"],
      success: "It works, but only with a firm touch. A single transistor's gain isn't quite enough for a light one.",
    },
    {
      id: "darlington",
      prompt:
        "Add **Q2** on the far half (rows 17 to 19, flat face toward you): its emitter jumps to Q1's base, its collector to Q1's collector, and R5 now feeds Q2's base. Touch lightly.",
      goal: (lab) => {
        const sat = lab.shared["glowSat"];
        return (
          lab.connected("Q2.e", "Q1.b") &&
          lab.connected("Q2.c", "Q1.c") &&
          padsFeed(lab, "Q2.b") &&
          finger(lab) >= 1.9e6 &&
          typeof sat === "number" &&
          lab.heldFor(0.3, glow(lab) >= 0.85 * sat)
        );
      },
      hints: ["Q2's emitter goes into the strip with Q1's base: a short jumper across the channel.", "R5 stays in series with the pads; move its far end to Q2's base."],
      success: "Feather touch, full light. Q2's gain multiplies Q1's: roughly 200 × 200 = 40,000.",
    },
  ],
  solution: [
    { do: "place", part: "R2", kind: "resistor", at: "b16-b21", params: { ohms: 470_000 } },
    { do: "probe", red: "Q1.c", black: "Q1.e" },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "remove", part: "R2" },
    { do: "place", part: "R3", kind: "resistor", at: "b16-b21", params: { ohms: 10_000 } },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "active-vs-saturated" },
    { do: "remove", part: "R3" },
    { do: "place", part: "R4", kind: "resistor", at: "b16-b21", params: { ohms: 4700 } },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "no-brighter" },
    { do: "remove", part: "R4" },
    { do: "remove", part: "S1" },
    { do: "place", part: "T1", kind: "touch-pads", at: "c14" },
    { do: "place", part: "R5", kind: "resistor", at: "b16-b21", params: { ohms: 10_000 } },
    { do: "control", id: "finger", value: 2_000_000 },
    { do: "wait", seconds: 0.6 },
    { do: "control", id: "finger", value: 100_000 },
    { do: "wait", seconds: 0.6 },
    { do: "check", task: "touch-it" },
    { do: "place", part: "Q2", kind: "npn", at: "h17" },
    { do: "wire", id: "W3", from: "f17", to: "e21", color: "yellow" },
    { do: "wire", id: "W4", from: "f19", to: "e22", color: "green" },
    { do: "move", part: "R5", at: "d16-g18" },
    { do: "control", id: "finger", value: 2_000_000 },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "darlington" },
  ],
});
