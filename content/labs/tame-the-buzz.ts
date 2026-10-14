// Blueprint: docs/curriculum/unit-2.md, Lesson 8 (its second half); conversion: docs/curriculum/conversion-guide.md,
// C2 lesson 8b. The lab of a bench lesson (docs/LESSONS.md): content/units/switching/breadboard/tame-the-buzz.
// One idea: a capacitor across the coil keeps it fed, so a bigger capacitor ticks slower. New part: the electrolytic
// capacitor.
//
// The buzzer from relay-buzzer: relay K1 at row 11, its coil fed from NC (a wire from row 16 to row 11), power switch
// S2 off. A black jumper grounds row 13 next to the coil, so an electrolytic dropped in with its long leg in row 11 and
// its stripe in row 13 sits across the coil. Both capacitors and the 100 Ω resistor lie on the desk by the board.
//
// Measured in the simulator: 1,000 µF across the coil ticks every 0.61 s (0.65 s with 100 Ω in the feed), 470 µF every
// 0.29 s (0.31 s with 100 Ω). While it ticks the coil's push saws from about 8.6 V down to the 1.8 V drop-out and the
// yellow LED (also fed by the capacitor through NC's strip) fades with it. Backwards across the coil on 9 V, the
// 470 µF vents within a second of power.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const powered = (lab: LabView) => lab.closed("S2");

/** An electrolytic sits across the coil, + on the fed coil strip (of this many farads, if given). */
const capAcross = (lab: LabView, farads?: number) =>
  lab.bench.parts.some(
    (p) => p.kind === "electrolytic-cap" && (farads === undefined || Math.abs(p.params.farads - farads) < farads * 0.01) && lab.joins(p.id, "K1.coil1", "K1.coil2", "forward") && !lab.died(p.id),
  );
/** An electrolytic sits across the coil the wrong way round: stripe on the fed strip. */
const capBackwards = (lab: LabView) =>
  lab.bench.parts.some((p) => p.kind === "electrolytic-cap" && lab.joins(p.id, "K1.coil1", "K1.coil2") && !lab.joins(p.id, "K1.coil1", "K1.coil2", "forward"));

/** The relay's last `n` full cycles all lasted between `lo` and `hi` seconds. */
function ticking(lab: LabView, n: number, lo: number, hi: number): boolean {
  const p = lab.relayPeriods("K1", 8).slice(-n);
  return p.length >= n && p.every((x) => x >= lo && x <= hi);
}

/** The fix-it bench: power off, and the 470 µF turned round, stripe on the coil's fed strip. */
const BACKWARDS: SolutionStep[] = [
  { do: "flip", part: "S2", to: "a" },
  { do: "move", part: "C2", at: "b13-b11" },
];

export default defineLab({
  id: "tame-the-buzz",
  title: "Slow the buzz",
  bench: {
    board: "full",
    frame: ["desk:-104,-30", "desk:-6,46"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S2", kind: "slide-switch", at: "b1", params: { to: "a" }, locked: true, label: "Power switch S2" },
      { id: "K1", kind: "relay", at: "e11", params: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true, label: "Relay K1" },
      { id: "D1", kind: "diode", at: "h11-d11", params: { model: "1N4001" }, locked: true, label: "1N4001 diode D1" },
      { id: "R2", kind: "resistor", at: "c16-c20", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R2" },
      { id: "D2", kind: "led", at: "d20", params: { color: "yellow" }, locked: true, label: "Yellow LED D2" },
      { id: "R3", kind: "resistor", at: "b18-b24", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R3" },
      { id: "D3", kind: "led", at: "d24", params: { color: "green" }, locked: true, label: "Green LED D3" },
      // On the desk by the board, ready to meet and to push in.
      { id: "C1", kind: "electrolytic-cap", at: "desk:-78,40", params: { farads: 1000e-6, volts: 16 }, label: "1,000 µF capacitor C1" },
      { id: "C2", kind: "electrolytic-cap", at: "desk:-54,40", params: { farads: 470e-6, volts: 16 }, label: "470 µF capacitor C2" },
      { id: "R4", kind: "resistor", at: "desk:-30,40", params: { ohms: 100 }, label: "100 Ω resistor R4" },
    ],
    wires: [
      { id: "W1", from: "a3", to: "rail+:3", color: "red" },
      { id: "W2", from: "rail-:6", to: "top-:6", color: "black" },
      { id: "W3", from: "j11", to: "top-:11", color: "black" },
      { id: "W4", from: "a14", to: "rail+:13", color: "red" },
      { id: "W5", from: "a21", to: "rail-:21", color: "black" },
      { id: "W6", from: "a25", to: "rail-:25", color: "black" },
      { id: "W9", from: "a16", to: "a11", color: "green" },
      // Row 13 to minus: where a capacitor's stripe lands.
      { id: "W10", from: "a13", to: "rail-:12", color: "black" },
    ],
    tray: [],
    instruments: [{ kind: "scope", traces: [{ label: "Coil", volts: "K1.coil1" }], window: 4, range: [-1, 10] }],
  },
  mascot: {
    hint: "Long leg on the coil's strip, stripe on the minus strip.",
    fried: "Oof. That one is done for. Check how it was wired.",
  },
  fried: { relay: "Relay: contacts worn out by buzzing", "electrolytic-cap": "Electrolytic capacitor, connected backwards" },
  tasks: [
    {
      id: "tame-it",
      prompt: "Push the 1,000 µF in: long leg in strip 11, stripe in strip 13. Power on.",
      goal: (lab) => powered(lab) && capAcross(lab, 1000e-6) && ticking(lab, 3, 0.5, 1.4),
      hints: ["The stripe of minus signs marks the short leg.", "Long leg strip 11, stripe strip 13, then S2 on."],
      highlight: ["C1", "hole:b11", "hole:b13"],
      nudges: [{ when: (lab) => capBackwards(lab), say: "Stripe in strip 13, please. That's the minus strip." }],
      success: "Tick, tock.",
    },
    {
      id: "faster-ticks",
      prompt: "Swap the 1,000 µF for the 470 µF.",
      goal: (lab) => powered(lab) && capAcross(lab, 470e-6) && !capAcross(lab, 1000e-6) && ticking(lab, 3, 0.2, 0.45),
      hints: ["Pull the big one out first.", "Same spot, same way round: stripe in strip 13."],
      highlight: ["C2", "hole:b11", "hole:b13"],
      nudges: [{ when: (lab) => capBackwards(lab), say: "Stripe in strip 13, please. That's the minus strip." }],
      success: "Faster.",
    },
    {
      id: "fix-backwards",
      prompt: "Check my capacitor, then power on.",
      setup: BACKWARDS,
      // Backwards first (the setup), then the right way round and ticking.
      goal: (lab) => {
        if (capBackwards(lab)) lab.memory["backwards"] = true;
        return lab.memory["backwards"] === true && powered(lab) && capAcross(lab) && ticking(lab, 3, 0.2, 1.4);
      },
      hints: ["Find the stripe. Which strip is it in?", "Turn it round: long leg strip 11, stripe strip 13."],
      highlight: ["C2"],
      success: "Fixed.",
    },
    {
      id: "soften-the-surge",
      prompt: "Put the 100 Ω between NC and the coil, in place of the green wire.",
      goal: (lab) => powered(lab) && capAcross(lab) && lab.joins("R4", "K1.nc1", "K1.coil1") && !lab.connected("K1.nc1", "K1.coil1") && ticking(lab, 3, 0.2, 1.4),
      hints: ["Swap the green wire for the resistor: strip 16 to strip 11."],
      highlight: ["wire:W9", "R4"],
      success: "Gentler on the contacts.",
      bonus: true,
    },
  ],
  solution: [
    { do: "move", part: "C1", at: "b11-b13" },
    { do: "flip", part: "S2", to: "b" },
    { do: "wait", seconds: 3.5 },
    { do: "check", task: "tame-it" },
    { do: "move", part: "C1", at: "desk:-78,40" },
    { do: "move", part: "C2", at: "b11-b13" },
    { do: "wait", seconds: 2 },
    { do: "check", task: "faster-ticks" },
    ...BACKWARDS,
    { do: "move", part: "C2", at: "b11-b13" },
    { do: "flip", part: "S2", to: "b" },
    { do: "wait", seconds: 2 },
    { do: "check", task: "fix-backwards" },
    // The secret.
    { do: "unwire", wire: "W9" },
    { do: "move", part: "R4", at: "a16-a11" },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "soften-the-surge" },
  ],
});
