// Blueprint: docs/curriculum/unit-2.md, Lesson 12. Station A (rows 5 to 17): button S1, worked by the auto-tapper four
// times a second, feeds R1 (100 Ω) into row 11, then R2 (1 kΩ) and the red LED D1. The learner adds the 470 µF from
// row 11 to the minus rail. Station B (rows 30 to 44): button S2 puts plus on C2's + leg (row 32); C2's other leg
// (row 38) feeds R3 (1 kΩ) and D2. Reset button S3 (rows 33 and 35, joined to row 32 on the far half) empties C2
// through R4 (100 Ω, row 35 to row 38). The scope watches both of C2's legs.
//
// Measured in the simulator: tapping makes D1 swing between dark and about 0.7; with 470 µF the swing drops under
// 0.1; S2 gives one flash of about a quarter of a second, and none on the next press until S3 empties C2.
import { defineLab, type LabView } from "@ohmland/lab";

/** An electrolytic of this value sits from row 11 (station A's supply) to minus, + on row 11. */
const smoothing = (lab: LabView, farads?: number) =>
  lab.bench.parts.some((p) => p.kind === "electrolytic-cap" && (farads === undefined || Math.abs(p.params.farads - farads) < farads * 0.01) && lab.joins(p.id, "R1.b", "B1.neg", "forward"));

export default defineLab({
  id: "smoothing-and-coupling",
  title: "Smooth it, kick it through",
  bench: {
    board: "full",
    frame: ["desk:-96,-30", "desk:40,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      // Station A: smoothing.
      { id: "S1", kind: "pushbutton", at: "e5", params: { cap: "yellow" }, locked: true, label: "Tapped button S1" },
      { id: "R1", kind: "resistor", at: "c7-c11", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R1" },
      { id: "R2", kind: "resistor", at: "b11-b16", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R2" },
      { id: "D1", kind: "led", at: "d16", params: { color: "red" }, locked: true, label: "Red LED D1" },
      // Station B: coupling.
      { id: "S2", kind: "pushbutton", at: "e30", params: { cap: "black" }, locked: true, label: "Button S2" },
      { id: "C2", kind: "electrolytic-cap", at: "c32-c38", params: { farads: 100e-6, volts: 16 }, locked: true, label: "100 µF capacitor C2" },
      { id: "R3", kind: "resistor", at: "b38-b43", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D2", kind: "led", at: "d43", params: { color: "red" }, locked: true, label: "Red LED D2" },
      { id: "S3", kind: "pushbutton", at: "e33", params: { cap: "white" }, locked: true, label: "Reset button S3" },
      { id: "R4", kind: "resistor", at: "d35-d38", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R4" },
    ],
    wires: [
      { id: "W1", from: "a5", to: "rail+:5", color: "red" },
      { id: "W2", from: "a17", to: "rail-:17", color: "black" },
      { id: "W3", from: "a30", to: "rail+:30", color: "red" },
      { id: "W4", from: "g32", to: "g33", color: "yellow" },
      { id: "W5", from: "a44", to: "rail-:44", color: "black" },
    ],
    tray: [
      { id: "C1", kind: "electrolytic-cap", params: { farads: 470e-6, volts: 16 }, count: 1, label: "470 µF" },
      { id: "C3", kind: "electrolytic-cap", params: { farads: 47e-6, volts: 16 }, count: 1, label: "47 µF" },
    ],
    instruments: [
      { kind: "tapper", part: "S1", hz: 4 },
      { kind: "scope", traces: [{ label: "C2 + leg", volts: "C2.pos" }, { label: "C2 striped leg", volts: "C2.neg" }], window: 4, range: [-1, 10] },
    ],
  },
  mascot: {
    start: "Across: shock absorber. In line: change detector.",
    hint: "Watch what the capacitor does at the moment something changes.",
    success: "One flash per change. Capacitors are strict about that.",
    exit: "You're thinking in time now. That's a big step.",
  },
  tasks: [
    {
      id: "flicker",
      prompt: "Turn on the **auto-tapper** for S1. Watch D1.",
      goal: (lab) => lab.tapping("S1") && !smoothing(lab) && (lab.stats("glow:D1", 1)?.span ?? 0) > 0.6,
      hints: ["The tapper is in the instruments: it presses S1 four times a second for you."],
      success: "On, off, on, off. That's what a choppy supply looks like.",
    },
    {
      id: "smooth-it",
      prompt: "Add the **470 µF** capacitor from R1's output (row 11) to the minus rail, stripe to minus. Keep the tapper going.",
      goal: (lab) => {
        const s = lab.stats("glow:D1", 2);
        return lab.tapping("S1") && smoothing(lab, 470e-6) && !!s && s.span < 0.25 && s.mean > 0.2;
      },
      hints: ["The capacitor goes across the supply, not in line with it.", "+ leg in row 11, striped leg bent down to the minus rail."],
      highlight: ["pin:R1.b"],
      success: "Steady light from a stuttering source. The capacitor fills during each tap and feeds the LED in between.",
      notice: "Try the 47 µF too: a small tank empties fast, so the flicker comes back.",
    },
    {
      id: "one-flash",
      prompt: "Station B: press and hold **S2** for three seconds.",
      goal: (lab) => {
        const m = lab.memory as { from?: number };
        if (!lab.closed("S2")) {
          m.from = (lab.part("C2")?.v ?? 9) < 1 ? lab.t : undefined;
          return false;
        }
        if (m.from === undefined || lab.t - m.from < 2) return false;
        const held = lab.t - m.from;
        return lab.history("glow:D2", held).some(([, g]) => g > 0.3) && lab.timeAbove("glow:D2", 0.3, held) < 0.6;
      },
      hints: ["Keep holding, and keep watching D2."],
      highlight: ["S2"],
      success: "A flash, then darkness, even though you're still pressing.",
      notice: "On the scope, both of C2's legs jump up together at the press, then the striped leg sags back to zero.",
    },
    {
      id: "no-encore",
      prompt: "Let go and press S2 again. Then press **reset** (S3) and try once more.",
      goal: (lab) => {
        const m = lab.memory as { phase?: number; at?: number; peak?: number };
        const press = lab.closed("S2");
        if (press) {
          if (m.at === undefined) {
            m.at = lab.t;
            m.peak = 0;
            if (m.phase === undefined) m.phase = (lab.part("C2")?.v ?? 0) > 5 ? 0 : -1;
          }
          m.peak = Math.max(m.peak ?? 0, lab.part("D2")?.glow ?? 0);
          return m.phase === 2 && (m.peak ?? 0) > 0.3;
        }
        if (m.at !== undefined) {
          // A press just ended.
          if (m.phase === 0 && (m.peak ?? 1) < 0.15) m.phase = 1;
          else if (m.phase === -1) delete m.phase;
          delete m.at;
        }
        if (m.phase === 1 && lab.closed("S3")) m.phase = 2;
        return false;
      },
      hints: ["What's left in C2 after the first press?", "The reset button empties C2 through R4."],
      highlight: ["S3"],
      success: "The capacitor only passes a change. Already charged, there's no change left to pass, until you empty it.",
    },
  ],
  solution: [
    { do: "tapper", on: true },
    { do: "wait", seconds: 2 },
    { do: "check", task: "flicker" },
    { do: "place", part: "C1", kind: "electrolytic-cap", at: "d11-rail-:11", params: { farads: 470e-6, volts: 16 } },
    { do: "wait", seconds: 3 },
    { do: "check", task: "smooth-it" },
    { do: "tapper", on: false },
    { do: "press", part: "S2", seconds: 3 },
    { do: "check", task: "one-flash" },
    { do: "wait", seconds: 0.5 },
    { do: "press", part: "S2", seconds: 1 },
    { do: "press", part: "S3", seconds: 0.6 },
    { do: "press", part: "S2", seconds: 1 },
    { do: "check", task: "no-encore" },
  ],
});
