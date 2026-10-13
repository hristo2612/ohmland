// Blueprint: docs/curriculum/unit-2.md, Lesson 9. Fill button S1 (rows 5 and 7) charges C1 (1,000 µF, + in row 11)
// through R1 (1 kΩ, on the far half from row 7 to row 11). R2 (1 kΩ) and the red LED drain it; the empty button S2
// (rows 9 and 11) dumps it through R3 (100 Ω). C1's striped leg sits in row 13, which reaches the minus rail only
// through one black jumper: pulling that jumper out lifts the capacitor's minus plate off the circuit.
//
// Measured in the simulator: C1 fills toward 5.4 V with a time constant near 0.5 s, the LED creeping up over about
// 1.5 s (glow 0.59 at 3.5 mA); after letting go the LED fades out in about 4 s; the empty button drops C1 below 0.5 V
// in about 0.25 s.
import { defineLab, type LabView } from "@ohmland/lab";

const vc = (lab: LabView) => lab.volts("C1.pos", "C1.neg") ?? 0;
const glow = (lab: LabView) => lab.part("D1")?.glow ?? 0;
const grounded = (lab: LabView) => lab.connected("C1.neg", "B1.neg");

export default defineLab({
  id: "capacitor-fill-fade",
  title: "Fill it, watch it fade",
  bench: {
    board: "full",
    frame: ["desk:-120,-30", "desk:-12,32"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "pushbutton", at: "e5", params: { cap: "red" }, locked: true, label: "Fill button S1" },
      { id: "S2", kind: "pushbutton", at: "e9", params: { cap: "black" }, locked: true, label: "Empty button S2" },
      { id: "R1", kind: "resistor", at: "h7-h11", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      { id: "C1", kind: "electrolytic-cap", at: "c11-c13", params: { farads: 1000e-6, volts: 16 }, locked: true, label: "1,000 µF capacitor C1" },
      { id: "R3", kind: "resistor", at: "b9-rail-:9", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R3" },
      { id: "R2", kind: "resistor", at: "b11-b16", params: { ohms: 1000 }, label: "1 kΩ resistor R2" },
      { id: "D1", kind: "led", at: "d16", params: { color: "red" }, locked: true, label: "Red LED D1" },
    ],
    wires: [
      { id: "W1", from: "a5", to: "rail+:5", color: "red" },
      { id: "W2", from: "a13", to: "rail-:13", color: "black" },
      { id: "W3", from: "a17", to: "rail-:17", color: "black" },
    ],
    tray: [],
    instruments: [
      { kind: "meter", at: "desk:16,62", rot: -8, mode: "dcv", probes: { red: "C1.pos", black: "C1.neg" } },
      { kind: "logger", traces: [{ label: "C1", volts: "C1.pos" }], start: { part: "S1", pressed: true }, seconds: 10, range: [0, 7] },
    ],
  },
  mascot: {
    start: "The capacitor that tamed your buzzer deserves a closer look.",
    hint: "Fill first, then watch. It's slower than you think.",
    success: "Watch it fade. Slowly. Like a sunset in a box.",
    fried: "Straight from a full capacitor into an LED: too much at once. There's a spare in the bench reset.",
    exit: "A capacitor gives back exactly what you put in. Fair, really.",
  },
  fried: { led: "Red LED, flooded by a full capacitor" },
  tasks: [
    {
      id: "fill",
      prompt: "Hold the **fill** button (red) for five seconds. Watch the LED, the meter and the logger.",
      goal: (lab) => {
        // From dark, held down until settled: the glow took over half a second to climb from 10% to 90% of its final
        // value, and C1 settled between 5.0 and 5.8 V.
        const m = lab.memory as { from?: number };
        if (!lab.closed("S1")) {
          m.from = glow(lab) < 0.05 ? lab.t : undefined;
          return false;
        }
        const v = lab.stats("volts:C1.pos", 0.5);
        if (m.from === undefined || !v || v.min < 5.0 || v.max > 5.8 || v.span > 0.05 || glow(lab) < 0.5) return false;
        const h = lab.history("glow:D1", lab.t - m.from + 0.05);
        const end = glow(lab);
        const t10 = h.find(([, g]) => g >= 0.1 * end)?.[0];
        const t90 = h.find(([, g]) => g >= 0.9 * end)?.[0];
        return t10 !== undefined && t90 !== undefined && t90 - t10 > 0.5;
      },
      hints: ["Keep holding. It's slower than you think.", "Press and keep the pointer down on the red button, or select it and hold Space."],
      highlight: ["S1"],
      success: "The light crept up as the capacitor filled. Notice the meter: fast at first, then slower and slower.",
    },
    {
      id: "fade",
      prompt: "Let go and watch.",
      goal: (lab) => {
        const m = lab.memory as { let?: number };
        if (lab.closed("S1")) {
          delete m.let;
          return false;
        }
        if (m.let === undefined) {
          if (glow(lab) > 0.4 && vc(lab) > 4) m.let = lab.t;
          return false;
        }
        const dt = lab.t - m.let;
        return glow(lab) < 0.1 && dt >= 1 && dt <= 8;
      },
      hints: ["Fill it until the LED is bright, then let go and keep watching."],
      success: "The capacitor is powering the LED by itself, and running out gently.",
    },
    {
      id: "dump",
      prompt: "Fill it again, then press the **empty** button (black).",
      goal: (lab) => {
        const m = lab.memory as { at?: number; dark?: number };
        if (!lab.closed("S2")) {
          if (m.at !== undefined && m.dark === undefined) delete m.at;
          return false;
        }
        if (m.at === undefined) {
          if (vc(lab) > 3) m.at = lab.t;
          return false;
        }
        if (m.dark === undefined && glow(lab) < 0.05) m.dark = lab.t;
        return m.dark !== undefined && m.dark - m.at <= 0.3 && vc(lab) < 0.5;
      },
      hints: ["Fill it until the LED is bright, then press the second button."],
      highlight: ["S2"],
      success: "Through just 100 Ω the charge rushes out almost at once.",
    },
    {
      id: "lift-a-leg",
      prompt:
        "Pull out the black jumper that joins the capacitor's striped leg (row 13) to the minus rail: that lifts its minus plate off the circuit. Fill and let go again.",
      goal: (lab) => {
        const m = lab.memory as { let?: number };
        if (grounded(lab)) return false;
        if (lab.closed("S1")) {
          if (glow(lab) > 0.3) m.let = Infinity;
          return false;
        }
        if (m.let === Infinity) m.let = lab.t;
        if (m.let === undefined) return false;
        return glow(lab) < 0.1 && lab.t - m.let <= 0.2;
      },
      hints: ["Delete the jumper from row 13 to the minus rail (select it, then Delete).", "Then hold the fill button and let go."],
      highlight: ["W2"],
      success: "No fade at all. A capacitor with one plate disconnected can't hold anything.",
      notice: "The charge on one plate needs a matching opposite charge on the other, and that needs a path.",
      mascot: { success: "No plate, no party." },
    },
  ],
  solution: [
    { do: "press", part: "S1", seconds: 5 },
    { do: "check", task: "fill" },
    { do: "wait", seconds: 5 },
    { do: "check", task: "fade" },
    { do: "press", part: "S1", seconds: 4 },
    { do: "press", part: "S2", seconds: 0.8 },
    { do: "check", task: "dump" },
    { do: "unwire", wire: "W2" },
    { do: "press", part: "S1", seconds: 2 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "lift-a-leg" },
  ],
});
