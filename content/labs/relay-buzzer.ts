// Blueprint: docs/curriculum/unit-2.md, Lesson 8. The changeover from lesson 7, rebuilt with a power switch: the
// battery snap feeds slide switch S2 at the left end, whose output (row 3) feeds the near + rail. Relay K1 straddles
// the channel at row 11 (coil 11, COM 14, NC 16, NO 18); its far coil pin goes to the far minus rail, and a 1N4001
// across the coil (band on the near coil strip) catches the kickback. NC feeds the yellow LED, NO the green one.
// Button S1 (rows 7 and 9) feeds the coil for now; the learner swaps it for a jumper from NC: the relay buzzes.
//
// Measured in the simulator: about 83 buzzes a second (166 clicks), both LEDs near 0.7; contacts wear out after about
// 18 s of buzzing. 1,000 µF across the coil ticks every 0.9 s; with 100 Ω in the feed about 0.9 s; 470 µF about 0.45 s.
import { defineLab, type LabView } from "@ohmland/lab";

/** An electrolytic of this many farads sits across the coil, + on the fed coil pin. */
const capAcross = (lab: LabView, farads: number) =>
  lab.bench.parts.some((p) => p.kind === "electrolytic-cap" && Math.abs(p.params.farads - farads) < farads * 0.01 && lab.joins(p.id, "K1.coil1", "K1.coil2", "forward"));

/** The relay's last `n` full cycles all lasted between `lo` and `hi` seconds. */
function ticking(lab: LabView, n: number, lo: number, hi: number): boolean {
  const p = lab.relayPeriods("K1", 8).slice(-n);
  return p.length >= n && p.every((x) => x >= lo && x <= hi);
}

const powered = (lab: LabView) => lab.closed("S2");

export default defineLab({
  id: "relay-buzzer",
  title: "A relay that switches itself",
  bench: {
    board: "full",
    frame: ["desk:-104,-30", "desk:-6,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S2", kind: "slide-switch", at: "b1", params: { to: "a" }, locked: true, label: "Power switch S2" },
      { id: "K1", kind: "relay", at: "e11", params: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true, label: "Relay K1" },
      { id: "D1", kind: "diode", at: "h11-d11", params: { model: "1N4001" }, locked: true, label: "1N4001 diode D1" },
      { id: "R2", kind: "resistor", at: "c16-c20", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R2" },
      { id: "D2", kind: "led", at: "d20", params: { color: "yellow" }, locked: true, label: "Yellow LED D2" },
      { id: "R3", kind: "resistor", at: "b18-b24", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R3" },
      { id: "D3", kind: "led", at: "d24", params: { color: "green" }, locked: true, label: "Green LED D3" },
      { id: "S1", kind: "pushbutton", at: "e7", params: { cap: "black" }, label: "Button S1" },
    ],
    wires: [
      { id: "W1", from: "a3", to: "rail+:3", color: "red" },
      { id: "W2", from: "rail-:6", to: "top-:6", color: "black" },
      { id: "W3", from: "j11", to: "top-:11", color: "black" },
      { id: "W4", from: "a14", to: "rail+:13", color: "red" },
      { id: "W5", from: "a21", to: "rail-:21", color: "black" },
      { id: "W6", from: "a25", to: "rail-:25", color: "black" },
      { id: "W7", from: "a7", to: "rail+:7", color: "red" },
      { id: "W8", from: "c9", to: "c11", color: "yellow" },
    ],
    tray: [
      { id: "C1", kind: "electrolytic-cap", params: { farads: 1000e-6, volts: 16 }, count: 1, label: "1,000 µF" },
      { id: "C2", kind: "electrolytic-cap", params: { farads: 470e-6, volts: 16 }, count: 1, label: "470 µF" },
      { id: "R4", kind: "resistor", params: { ohms: 100 }, count: 1, label: "100 Ω" },
    ],
    instruments: [{ kind: "scope", traces: [{ label: "Coil", volts: "K1.coil1" }], window: 4, range: [-1, 10] }],
  },
  mascot: {
    start: "One wire move turns a polite switch into something alive.",
    hint: "The coil can take its power from the relay's own NC contact.",
    success: "A capacitor is a little tank that keeps the coil fed.",
    fried: "It buzzed itself to bits. Real relays do that too. New one on the bench.",
    exit: "From buzz to tick. You tamed it with a capacitor.",
  },
  fried: { relay: "Relay: contacts worn out by buzzing", "electrolytic-cap": "Electrolytic capacitor, connected backwards", capacitor: "Electrolytic capacitor, connected backwards" },
  tasks: [
    {
      id: "move-one-wire",
      prompt: "Remove button **S1** and feed the coil from the relay's **NC** contact instead (row 16 to row 11). Then slide the power switch on.",
      goal: (lab) => {
        if (!powered(lab) || !lab.connected("K1.nc1", "K1.coil1") || lab.count("clicked", "K1", 1) < 40) return false;
        const y = lab.stats("glow:D2", 0.5);
        const g = lab.stats("glow:D3", 0.5);
        return !!y && !!g && y.mean > 0.15 && y.mean < 0.85 && g.mean > 0.15 && g.mean < 0.85;
      },
      hints: ["One jumper from the NC strip (row 16) to the coil's strip (row 11) does it.", "If nothing happens, check the coil's other pin still reaches the minus rail."],
      highlight: ["S1", "pin:K1.nc1", "pin:K1.coil1"],
      success: "It buzzes! Each time it pulls in, it cuts its own power. Each time it lets go, the power returns.",
      notice: "Both LEDs look half lit: they swap too fast to see. Turn S2 off soon: the contacts are sparking and wearing.",
      mascot: { success: "It's alive! And slightly annoying." },
    },
    {
      id: "tame-it",
      prompt: "Add the **1,000 µF** capacitor across the coil: + leg on the coil's strip (row 11), striped leg to the minus rail. Turn on S2.",
      goal: (lab) => powered(lab) && capAcross(lab, 1000e-6) && ticking(lab, 3, 0.5, 1.4),
      hints: ["The stripe on the capacitor's sleeve marks its negative leg.", "The longer leg is positive. Bend the legs to reach from row 11 to the minus rail."],
      highlight: ["pin:K1.coil1"],
      success: "Tick, tock. The capacitor keeps the coil powered after the contact opens, so the relay stays in for most of a second.",
    },
    {
      id: "soften-the-surge",
      prompt: "Every time NC closes, the empty capacitor gulps a big surge through the contacts. Put the **100 Ω** resistor between NC and the coil to soften it.",
      goal: (lab) =>
        powered(lab) &&
        capAcross(lab, 1000e-6) &&
        lab.joins("R4", "K1.nc1", "K1.coil1") &&
        !lab.connected("K1.nc1", "K1.coil1") &&
        ticking(lab, 3, 0.4, 1.3) &&
        lab.periods("glow:D2", 0.3, 4).length >= 2 &&
        lab.timeAbove("glow:D2", 0.3, 3) >= 0.1,
      hints: ["NC to R4, R4 to the coil's strip. Then remove the direct jumper."],
      highlight: ["pin:K1.nc1", "pin:K1.coil1"],
      success: "Gentler on the contacts, and now the yellow LED gets a real blink while the capacitor refills.",
    },
    {
      id: "faster-ticks",
      prompt: "Swap in the **470 µF** capacitor. Predict first: faster or slower?",
      goal: (lab) => powered(lab) && capAcross(lab, 470e-6) && !capAcross(lab, 1000e-6) && ticking(lab, 3, 0.2, 0.7),
      hints: ["Same spot, same way round: stripe to the minus rail."],
      success: "About half the capacitance, about half the hold time.",
    },
  ],
  solution: [
    { do: "remove", part: "S1" },
    { do: "unwire", wire: "W8" },
    { do: "wire", id: "W9", from: "a16", to: "a11", color: "green" },
    { do: "flip", part: "S2", to: "b" },
    { do: "wait", seconds: 1.2 },
    { do: "check", task: "move-one-wire" },
    { do: "flip", part: "S2", to: "a" },
    { do: "place", part: "C1", kind: "electrolytic-cap", at: "b11-rail-:10", params: { farads: 1000e-6, volts: 16 } },
    { do: "flip", part: "S2", to: "b" },
    { do: "wait", seconds: 4 },
    { do: "check", task: "tame-it" },
    { do: "unwire", wire: "W9" },
    { do: "place", part: "R4", kind: "resistor", at: "a16-a11", params: { ohms: 100 } },
    { do: "wait", seconds: 4.5 },
    { do: "check", task: "soften-the-surge" },
    { do: "remove", part: "C1" },
    { do: "place", part: "C2", kind: "electrolytic-cap", at: "b11-rail-:10", params: { farads: 470e-6, volts: 16 } },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "faster-ticks" },
  ],
});
