// Blueprint: docs/curriculum/unit-2.md, Lesson 19, the unit's landmark build. The siren button S1 (rows 2 and 4)
// powers the near + rail, bridged to the far rails. The slow oscillator (lesson 17's flasher: 1 kΩ, 68 kΩ, 10 µF)
// sits in rows 10 to 13, Q1 near and Q2 far; Q1's collector (row 12) is also brought out to row 16 by a jumper. The
// fast oscillator (1 kΩ, 68 kΩ, 10 nF ceramics) sits in rows 20 to 22, Q3 near and Q4 far. Q5 (far rows 26 to 28) drives
// the speaker from Q4's collector through R11 (4.7 kΩ), with R12 (220 Ω, 0.5 W) from the far + rail.
//
// The learner bridges the fast bases (near row 21 and far row 21) to Q1's collector (row 16) with R8 and R9
// (100 kΩ), then moves their joined end to row 17 and adds R10 (10 kΩ, row 17 to row 16) and C5 (22 µF, row 17 to
// minus): a low-pass filter that turns the two-tone into a glide.
import { defineLab, type LabView } from "@ohmland/lab";

/** Pitch samples over the last `seconds`, voiced ones only. */
const tones = (lab: LabView, seconds: number) => lab.toneHistory(seconds).map(([, f]) => f).filter((f) => f > 0);

function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))] ?? 0;
}

/** Highest over lowest pitch (90th over 10th percentile) in the last `seconds`. */
function range(lab: LabView, seconds: number): number {
  const f = tones(lab, seconds);
  if (f.length < 20) return 1;
  return quantile(f, 0.9) / Math.max(1, quantile(f, 0.1));
}

/** Seconds between pitch swings: crossings of the middle pitch, upward ones, averaged. */
function swing(lab: LabView, seconds: number): number | null {
  const h = lab.toneHistory(seconds).filter(([, f]) => f > 0);
  const f = h.map(([, x]) => x);
  if (f.length < 20) return null;
  const mid = Math.sqrt(quantile(f, 0.9) * quantile(f, 0.1));
  const ups: number[] = [];
  for (let i = 1; i < h.length; i++) if (h[i - 1]![1] < mid && h[i]![1] >= mid) ups.push(h[i]![0]);
  if (ups.length < 2) return null;
  return (ups[ups.length - 1]! - ups[0]!) / (ups.length - 1);
}

/** The bridge resistors run from both fast bases to `to`. */
const bridged = (lab: LabView, to: string) => lab.joins("R8", "Q3.b", to) && lab.joins("R9", "Q4.b", to);

const held = (lab: LabView) => lab.closed("S1");

export default defineLab({
  id: "siren",
  title: "The siren button",
  bench: {
    board: "full",
    frame: ["desk:-130,-80", "desk:6,32"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-114,10", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "pushbutton", at: "e2", params: { cap: "red" }, locked: true, label: "Siren button S1" },
      // The slow oscillator.
      { id: "Q1", kind: "npn", at: "d10", locked: true, label: "Slow Q1" },
      { id: "D1", kind: "led", at: "c13", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D1" },
      { id: "R1", kind: "resistor", at: "rail+:13-b13", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      { id: "R3", kind: "resistor", at: "rail+:11-b11", params: { ohms: 68000 }, locked: true, label: "68 kΩ resistor R3" },
      { id: "Q2", kind: "npn", at: "g10", locked: true, label: "Slow Q2" },
      { id: "D2", kind: "led", at: "h13", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D2" },
      { id: "R2", kind: "resistor", at: "top+:13-i13", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R2" },
      { id: "R4", kind: "resistor", at: "top+:11-i11", params: { ohms: 68000 }, locked: true, label: "68 kΩ resistor R4" },
      { id: "C1", kind: "electrolytic-cap", at: "e12-f11", params: { farads: 10e-6, volts: 16 }, label: "10 µF capacitor C1" },
      { id: "C2", kind: "electrolytic-cap", at: "f12-e11", params: { farads: 10e-6, volts: 16 }, label: "10 µF capacitor C2" },
      // The fast oscillator.
      { id: "Q3", kind: "npn", at: "d20", locked: true, label: "Fast Q3" },
      { id: "RC3", kind: "resistor", at: "rail+:22-b22", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor" },
      { id: "RB3", kind: "resistor", at: "rail+:21-b21", params: { ohms: 68000 }, locked: true, label: "68 kΩ resistor" },
      { id: "Q4", kind: "npn", at: "g20", locked: true, label: "Fast Q4" },
      { id: "RC4", kind: "resistor", at: "top+:22-i22", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor" },
      { id: "RB4", kind: "resistor", at: "top+:21-i21", params: { ohms: 68000 }, locked: true, label: "68 kΩ resistor" },
      { id: "C3", kind: "ceramic-cap", at: "e22-f21", params: { farads: 10e-9 }, locked: true, label: "10 nF capacitor" },
      { id: "C4", kind: "ceramic-cap", at: "f22-e21", params: { farads: 10e-9 }, locked: true, label: "10 nF capacitor" },
      // The speaker driver.
      { id: "Q5", kind: "npn", at: "g26", locked: true, label: "Driver Q5" },
      { id: "R11", kind: "resistor", at: "j22-j27", params: { ohms: 4700 }, locked: true, label: "4.7 kΩ resistor R11" },
      { id: "R12", kind: "resistor", at: "top+:30-i30", params: { ohms: 220, watts: 0.5 }, locked: true, label: "220 Ω resistor R12, 0.5 W" },
      { id: "SP1", kind: "speaker", at: "desk:-14,-58", holes: { a: "h30", b: "h28" }, params: { ohms: 8 }, locked: true, label: "8 Ω speaker" },
    ],
    wires: [
      { id: "W1", from: "a4", to: "rail+:4", color: "red" },
      { id: "W2", from: "rail+:6", to: "top+:6", color: "red" },
      { id: "W3", from: "rail-:7", to: "top-:7", color: "black" },
      { id: "W4", from: "a10", to: "rail-:10", color: "black" },
      { id: "W5", from: "j10", to: "top-:10", color: "black" },
      { id: "W6", from: "a20", to: "rail-:19", color: "black" },
      { id: "W7", from: "j20", to: "top-:19", color: "black" },
      { id: "W8", from: "i26", to: "top-:25", color: "black" },
      // Q1's collector, brought out to row 16.
      { id: "W9", from: "a12", to: "a16", color: "yellow" },
    ],
    tray: [
      { id: "R8", kind: "resistor", params: { ohms: 100_000 }, count: 2, label: "100 kΩ" },
      { id: "R10", kind: "resistor", params: { ohms: 10_000 }, count: 1, label: "10 kΩ" },
      { id: "C5", kind: "electrolytic-cap", params: { farads: 22e-6, volts: 16 }, count: 1, label: "22 µF" },
      { id: "C6", kind: "ceramic-cap", params: { farads: 1e-6 }, count: 2, label: "1 µF (105)" },
    ],
    instruments: [{ kind: "scope", traces: [{ label: "Slow Q1 collector", volts: "Q1.c" }], window: 3, range: [-1, 10], pitch: "SP1" }],
  },
  mascot: {
    start: "Two heartbeats, one voice. Let's introduce them.",
    hint: "Gentle resistors make good neighbours.",
    success: "Nee-naw! The island has a voice.",
    exit: "Wail, trill, swoop. You're a sound designer now.",
  },
  fried: { npn: "2N3904 in the siren" },
  tasks: [
    {
      id: "two-voices",
      prompt: "Hold the siren button. You should see a blink and hear a steady tone.",
      goal: (lab) => {
        if (!held(lab) || lab.benchPart("R8") || lab.blinkPeriod("D1") === null) return false;
        const f = tones(lab, 2);
        if (f.length < 40) return false;
        const mean = f.reduce((a, b) => a + b, 0) / f.length;
        return f.every((x) => Math.abs(x - mean) <= mean * 0.05);
      },
      hints: ["Keep holding: the slow side takes most of a second per blink."],
      highlight: ["S1"],
      success: "Two separate oscillators, ignoring each other. Let's introduce them.",
    },
    {
      id: "bridge",
      prompt: "Connect **R8** from Q3's base (row 21, near half) to Q1's collector, and **R9** from Q4's base (row 21, far half) to Q1's collector. Q1's collector comes out at row 16.",
      goal: (lab) => {
        if (!held(lab) || !bridged(lab, "Q1.c")) return false;
        const r = range(lab, 3);
        const s = swing(lab, 3);
        return r >= 1.15 && r <= 1.8 && s !== null && s >= 0.6 && s <= 1.4;
      },
      hints: ["Both resistors meet at Q1's collector strip, row 16.", "Bend R9 across the channel from far row 21 to near row 16."],
      highlight: ["hole:c21", "hole:h21", "hole:c16"],
      success: "Nee-naw! When Q1 is off, its high collector pushes extra current into the fast bases: higher pitch. When Q1 is on, it pulls them down: lower pitch.",
      notice: "The slow LED now glows faintly in its off half: a little current flows into the bridge. Small side effects like this are normal when circuits are joined.",
    },
    {
      id: "wail",
      prompt:
        "Make it glide: move the joined end of R8 and R9 to the empty row 17, connect row 17 to Q1's collector (row 16) through **R10**, and put **C5** from row 17 to the minus rail, stripe to minus.",
      goal: (lab) => {
        if (!held(lab) || !bridged(lab, "R10.a") && !bridged(lab, "R10.b")) return false;
        const j = lab.joins("R10", "Q1.c", "R8.a") || lab.joins("R10", "Q1.c", "R8.b");
        const cap = lab.bench.parts.some((p) => p.kind === "electrolytic-cap" && p.params.farads === 22e-6 && (lab.joins(p.id, "R10.a", "B1.neg", "forward") || lab.joins(p.id, "R10.b", "B1.neg", "forward")) && !lab.connected(`${p.id}.pos`, "Q1.c"));
        if (!j || !cap || range(lab, 3) < 1.15) return false;
        const h = lab.toneHistory(3).filter(([, f]) => f > 0);
        if (h.length < 40) return false;
        // No jumps: each pitch reading (over the last 60 ms, one per frame) is within 5% of the one before.
        for (let k = 1; k < h.length; k++) if (Math.abs(h[k]![1] - h[k - 1]![1]) > 0.05 * h[k - 1]![1]) return false;
        return true;
      },
      hints: ["R10 and C5 make an RC filter, like the smoothing in the capacitor module.", "R8 and R9 keep their base ends; only their other ends move to row 17."],
      highlight: ["hole:c17", "hole:d17"],
      success: "Now it swoops up and down. The capacitor turns sudden steps into slopes.",
      trigger: "siren-wail",
    },
    {
      id: "trill",
      prompt: "Bonus: swap the slow oscillator's 10 µF capacitors (C1 and C2) for the **1 µF** ceramics, and take C5 out so the fast steps get through.",
      goal: (lab) => {
        if (!held(lab)) return false;
        const s = swing(lab, 2);
        return s !== null && 1 / s >= 6 && 1 / s <= 16 && range(lab, 2) > 1.08;
      },
      hints: [
        "Same places as C1 and C2: each from a collector (row 12) across the channel to the other base (row 11).",
        "A filter that smooths a slow swing also smooths away a fast one. Without C5, R10 just passes the steps on.",
      ],
      success: "A frantic trill. Every knob you've learned in this unit is now a sound design tool.",
      bonus: true,
    },
  ],
  solution: [
    { do: "press", part: "S1", seconds: 3.5 },
    { do: "check", task: "two-voices" },
    { do: "place", part: "R8", kind: "resistor", at: "c21-c16", params: { ohms: 100_000 } },
    { do: "place", part: "R9", kind: "resistor", at: "h21-d16", params: { ohms: 100_000 } },
    { do: "press", part: "S1", seconds: 4 },
    { do: "check", task: "bridge" },
    { do: "move", part: "R8", at: "c21-c17" },
    { do: "move", part: "R9", at: "h21-d17" },
    { do: "place", part: "R10", kind: "resistor", at: "a17-d16", params: { ohms: 10_000 } },
    { do: "place", part: "C5", kind: "electrolytic-cap", at: "b17-rail-:18", params: { farads: 22e-6, volts: 16 } },
    { do: "press", part: "S1", seconds: 5 },
    { do: "check", task: "wail" },
    { do: "remove", part: "C1" },
    { do: "remove", part: "C2" },
    { do: "place", part: "C6", kind: "ceramic-cap", at: "e12-f11", params: { farads: 1e-6 } },
    { do: "place", part: "C7", kind: "ceramic-cap", at: "f12-e11", params: { farads: 1e-6 } },
    { do: "remove", part: "C5" },
    { do: "press", part: "S1", seconds: 3 },
    { do: "check", task: "trill" },
  ],
});
