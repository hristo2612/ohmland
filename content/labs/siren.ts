// Blueprint: docs/curriculum/unit-2.md, Lesson 19, the unit's landmark build; docs/curriculum/conversion-guide.md, 19.
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/blink-and-beep/siren.
// One idea: a slow oscillator nudging a fast one moves the pitch; a capacitor turns the steps into a wail.
//
// The siren button S1 (rows 2 and 4) powers the near + rail, bridged to the far rails. The slow oscillator (lesson
// 17's flasher: 1 kΩ, 68 kΩ, 10 µF) sits in rows 10 to 13, Q1 near and Q2 far; Q1's collector (row 12) is also brought
// out to row 16 by a jumper. The fast oscillator (1 kΩ, 68 kΩ, 10 nF ceramics) sits in rows 20 to 22, Q3 near and Q4
// far. Q5 (far rows 26 to 28) drives the speaker from Q4's collector through R11 (4.7 kΩ), with R12 (220 Ω, 0.5 W)
// from the far + rail.
//
// The learner bridges the fast bases (near row 21 and far row 21) to Q1's collector (row 16) with two 100 kΩ, then
// moves their joined end to row 17 and adds R10 (10 kΩ, row 17 to row 16) and C5 (22 µF, row 17 to minus): a low-pass
// filter that turns the two-tone into a glide.
//
// Measured in the simulator: alone, the fast oscillator holds a steady 1,196 Hz while Q1 blinks every 0.83 s. Bridged,
// the pitch swaps between about 1,360 and 1,850 Hz; with the filter it glides between about 1.40 and 1.65 kHz. A
// plain wire in place of one 100 kΩ makes the pitch jump about between 1.0 and 2.4 kHz, and the fast side stalls now
// and then.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

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

/** Resistors of this marked value (whatever ids the tray gave them). */
const resistors = (lab: LabView, ohms: number) => lab.bench.parts.filter((p) => p.kind === "resistor" && Number(lab.prop(p.id)?.["ohms"]) === ohms).map((p) => p.id);

/** Two different 100 kΩ resistors run from the fast bases to `to`. */
function bridged(lab: LabView, to: string): boolean {
  const rs = resistors(lab, 100_000);
  const a = rs.filter((r) => lab.joins(r, "Q3.b", to));
  const b = rs.filter((r) => lab.joins(r, "Q4.b", to));
  return a.some((x) => b.some((y) => y !== x));
}

/** The far end of a 10 kΩ resistor whose other end is on Q1's collector: the filter's middle, or null. */
function filterNode(lab: LabView): string | null {
  for (const r of resistors(lab, 10_000)) {
    if (lab.connected(`${r}.a`, "Q1.c") && !lab.connected(`${r}.b`, "Q1.c")) return `${r}.b`;
    if (lab.connected(`${r}.b`, "Q1.c") && !lab.connected(`${r}.a`, "Q1.c")) return `${r}.a`;
  }
  return null;
}

/** The filter is built: 10 kΩ from Q1's collector, 22 µF from its far end to minus, the bridge on that far end. */
function filtered(lab: LabView): boolean {
  const n = filterNode(lab);
  if (!n || !bridged(lab, n)) return false;
  return lab.bench.parts.some((p) => p.kind === "electrolytic-cap" && Math.abs(Number(lab.prop(p.id)?.["farads"]) - 22e-6) < 1e-7 && lab.joins(p.id, n, "B1.neg", "forward"));
}

/** The pitch glides: a real swing, and no jumps (each reading within 5% of the one before). */
function gliding(lab: LabView): boolean {
  if (range(lab, 3) < 1.15) return false;
  const h = lab.toneHistory(3).filter(([, f]) => f > 0);
  if (h.length < 40) return false;
  for (let k = 1; k < h.length; k++) if (Math.abs(h[k]![1] - h[k - 1]![1]) > 0.05 * h[k - 1]![1]) return false;
  return true;
}

/** A plain wire from a fast base straight onto the filter's middle (where a 100 kΩ should be). */
const wired = (lab: LabView) => {
  const n = filterNode(lab);
  return !!n && (lab.connected("Q3.b", n) || lab.connected("Q4.b", n));
};

const held = (lab: LabView) => lab.closed("S1");

/** The slow oscillator's two capacitors are this value: one from each collector to the other base. */
function slowCrossedWith(lab: LabView, farads: number): boolean {
  const caps = lab.bench.parts.filter((p) => (p.kind === "ceramic-cap" || p.kind === "electrolytic-cap") && Math.abs(Number(lab.prop(p.id)?.["farads"]) - farads) < farads * 0.01);
  const joins = (c: string, b: string) => caps.some((p) => lab.joins(p.id, c, b));
  return joins("Q1.c", "Q2.b") && joins("Q2.c", "Q1.b");
}

/** The fix-it bench: the far 100 kΩ swapped for a plain jumper wire. */
const PLAIN_WIRE: SolutionStep[] = [
  { do: "remove", part: "R9" },
  { do: "wire", id: "W10", from: "h21", to: "d17", color: "yellow" },
];

export default defineLab({
  id: "siren",
  title: "The siren button",
  bench: {
    board: "full",
    // Both oscillators and the driver (columns 1 to 30) and the speaker behind the board.
    frame: ["top+:1", "rail-:33", "desk:-14,-72"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
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
      { id: "C6", kind: "ceramic-cap", params: { farads: 1e-6 }, count: 2, label: "Ceramic 105" },
    ],
    instruments: [{ kind: "scope", traces: [{ label: "Slow Q1 collector", volts: "Q1.c" }], window: 3, range: [-1, 10], pitch: "SP1" }],
  },
  mascot: {
    start: "Two heartbeats, one voice. Let's introduce them.",
    hint: "Gentle resistors make good neighbours.",
    fried: "Oof. That one's for the Hall.",
  },
  fried: { npn: "2N3904 in the siren" },
  tasks: [
    {
      id: "two-voices",
      prompt: "Hold the siren button. A blink, and a steady tone.",
      goal: (lab) => {
        if (!held(lab) || resistors(lab, 100_000).length > 0 || lab.blinkPeriod("D1") === null) return false;
        const f = tones(lab, 2);
        if (f.length < 40) return false;
        const mean = f.reduce((a, b) => a + b, 0) / f.length;
        return f.every((x) => Math.abs(x - mean) <= mean * 0.05);
      },
      hints: ["Keep holding: the slow side takes most of a second per blink."],
      highlight: ["S1"],
      success: "Two oscillators, ignoring each other.",
    },
    {
      id: "bridge",
      prompt: "Bridge them: a 100 kΩ from each fast base to Q1's collector.",
      goal: (lab) => {
        if (!held(lab) || !bridged(lab, "Q1.c")) return false;
        const r = range(lab, 3);
        const s = swing(lab, 3);
        return r >= 1.15 && r <= 1.8 && s !== null && s >= 0.6 && s <= 1.4;
      },
      hints: ["Both fast bases are in row 21, near and far. Q1's collector strip is row 16.", "Then hold the siren button."],
      highlight: ["hole:c21", "hole:h21", "hole:c16"],
      success: "Nee-naw!",
      notice: "The slow LED glows faintly when off: the bridge borrows current.",
    },
    {
      id: "wail",
      prompt: "Make it glide: put R10 and C5 between Q1 and the bridge.",
      goal: (lab) => held(lab) && filtered(lab) && gliding(lab),
      hints: ["Move both 100 kΩ ends from row 16 to row 17.", "10 kΩ from row 17 to row 16; 22 µF from row 17 to minus."],
      highlight: ["hole:c17", "hole:d17"],
      success: "Now it swoops.",
    },
    {
      id: "fix-muddy",
      prompt: "The siren sounds muddy. Fix it.",
      setup: PLAIN_WIRE,
      // The plain wire first (the setup), then two 100 kΩ again and a smooth glide.
      goal: (lab) => {
        if (wired(lab)) lab.memory["wired"] = true;
        return lab.memory["wired"] === true && !wired(lab) && held(lab) && filtered(lab) && gliding(lab);
      },
      hints: ["Compare the two links from the fast bases. One isn't a resistor.", "Swap the plain wire for a 100 kΩ."],
      highlight: ["wire:W10.a"],
      success: "Smooth again.",
    },
    {
      id: "trill",
      prompt: "Bonus: swap C1 and C2 for 1 µF ceramics. Take C5 out.",
      goal: (lab) => {
        if (!held(lab) || !slowCrossedWith(lab, 1e-6)) return false;
        const s = swing(lab, 2);
        return s !== null && 1 / s >= 6 && 1 / s <= 16 && range(lab, 2) > 1.08;
      },
      hints: ["Same places: each from a collector (row 12) to the other base.", "C5 smooths fast swings away too. Without it, the steps pass."],
      success: "A frantic trill.",
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
    ...PLAIN_WIRE,
    { do: "press", part: "S1", seconds: 2 },
    { do: "unwire", wire: "W10" },
    { do: "place", part: "R9", kind: "resistor", at: "h21-d17", params: { ohms: 100_000 } },
    { do: "press", part: "S1", seconds: 5 },
    { do: "check", task: "fix-muddy" },
    // The secret: 1 µF ceramics for the slow capacitors, and the filter capacitor out.
    { do: "remove", part: "C1" },
    { do: "remove", part: "C2" },
    { do: "place", part: "C6", kind: "ceramic-cap", at: "e12-f11", params: { farads: 1e-6 } },
    { do: "place", part: "C7", kind: "ceramic-cap", at: "f12-e11", params: { farads: 1e-6 } },
    { do: "remove", part: "C5" },
    { do: "press", part: "S1", seconds: 3 },
    { do: "check", task: "trill" },
  ],
});
