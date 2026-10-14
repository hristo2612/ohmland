// Blueprint: docs/curriculum/unit-2.md, Lesson 9; conversion: docs/curriculum/conversion-guide.md, C2 lesson 9. The lab
// of a bench lesson (docs/LESSONS.md): content/units/switching/capacitors/capacitor-fill-fade/lesson.yaml.
// One idea: through a resistor, a capacitor fills and empties gradually.
//
// Fill button S1 (rows 5 and 7) charges C1 (1,000 µF, + in row 11) through R1 (1 kΩ, on the far half from row 7 to row
// 11). R2 (1 kΩ) and the red LED drain it; the empty button S2 (rows 9 and 11) dumps it through R3 (100 Ω). C1's
// striped leg sits in row 13, which reaches the minus rail only through one black jumper (W2): the fix-it pulls that
// jumper, so the capacitor's minus plate goes nowhere.
//
// Measured in the simulator: C1 fills toward 5.4 V with a time constant near 0.5 s, the LED creeping up over about
// 1.5 s (glow 0.59 at 3.5 mA); after letting go the LED fades out in about 4 s; the empty button drops C1 below 0.5 V
// in about 0.25 s. With W2 gone, the LED follows the button: dark within 0.2 s of letting go.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const vc = (lab: LabView) => lab.volts("C1.pos", "C1.neg") ?? 0;
const glow = (lab: LabView) => lab.part("D1")?.glow ?? 0;
const grounded = (lab: LabView) => lab.connected("C1.neg", "B1.neg");

/** The fix-it bench: the jumper from C1's stripe row to the minus rail is gone. */
const LIFT_LEG: SolutionStep[] = [{ do: "unwire", wire: "W2" }];

export default defineLab({
  id: "capacitor-fill-fade",
  title: "Fill it, watch it fade",
  bench: {
    board: "full",
    frame: ["desk:-100,-30", "desk:-16,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
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
    instruments: [],
  },
  mascot: {
    hint: "Fill first, then watch. It's slower than you think.",
    fried: "Straight from a full capacitor into an LED: too much at once.",
  },
  fried: { led: "Red LED, flooded by a full capacitor" },
  tasks: [
    {
      id: "fill",
      prompt: "Hold the red button. Watch the LED.",
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
      hints: ["Keep holding. It's slower than you think.", "Hold the pointer down on it, or select it and hold Space."],
      highlight: ["S1"],
      success: "It crept up.",
    },
    {
      id: "fade",
      prompt: "Fill it once more, then let go and watch.",
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
      hints: ["Fill until the LED is bright, then let go and watch."],
      success: "It faded out.",
    },
    {
      id: "dump",
      prompt: "Fill it again, then press the black button.",
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
      hints: ["Fill it until the LED is bright, then press the black button."],
      highlight: ["S2"],
      nudges: [{ when: (lab) => lab.closed("S2") && vc(lab) < 0.5 && glow(lab) < 0.05, say: "It's empty already. Fill it first." }],
      success: "Gone in a blink.",
    },
    {
      id: "lift-a-leg",
      prompt: "My LED won't fade any more. Fix it.",
      setup: LIFT_LEG,
      // Cut off first (the setup), then grounded again and fading after a fill.
      goal: (lab) => {
        const m = lab.memory as { lifted?: boolean; let?: number };
        if (!grounded(lab)) {
          m.lifted = true;
          delete m.let;
          return false;
        }
        if (!m.lifted) return false;
        if (lab.closed("S1")) {
          m.let = glow(lab) > 0.4 && vc(lab) > 4 ? Infinity : undefined;
          return false;
        }
        if (m.let === Infinity) m.let = lab.t;
        if (m.let === undefined) return false;
        // Still glowing a moment after letting go: the capacitor is feeding it again.
        return lab.t - m.let >= 0.6 && glow(lab) > 0.15;
      },
      hints: ["Follow the capacitor's striped leg. Where does it go?", "Wire its row, 13, to the minus rail. Then fill and let go."],
      highlight: ["pin:C1.neg", "hole:a13"],
      success: "Fixed.",
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
    ...LIFT_LEG,
    { do: "press", part: "S1", seconds: 2 },
    { do: "wait", seconds: 0.4 },
    { do: "wire", id: "W4", from: "b13", to: "rail-:13", color: "black" },
    { do: "press", part: "S1", seconds: 4 },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "lift-a-leg" },
  ],
});
