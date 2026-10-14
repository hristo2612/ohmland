// Blueprint: docs/curriculum/unit-3.md, MP9. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/wires-and-power/steady-five. One idea: a regulator turns a higher, lumpy push into a steady
// 5 V.
// A 7805 (the simulator's `regulator7805`, legs in, ground, out left to right with its print toward you) in e10 to e12
// on a half board: 0.33 µF from its input strip to the − rail, 0.1 µF from its output strip, a jumper from its ground
// strip to the − rail and one from the + rail to its input strip. The 5 V lamp: 220 Ω from the output strip to a red
// LED. A barrel jack sits in the rails at the right end, and an unregulated "9 V 300 mA" adapter's plug lies loose
// (a `supply` of 13 V behind 8 Ω with a 400 µF filter, rippling at twice the mains frequency).
// From the simulator (packages/sim README, "7805 regulator" and "Supply"): the adapter gives about 12.8 V with about
// 0.5 V of lumps at this load; the output holds 5.0 V (each part within about 1%) with well under 10 mV of ripple; the
// lamp draws about 14 mA. The output follows the input about 1.95 V below it once the input falls under about 7 V, so
// a tired 9 V battery's output holds 5 V and then sags. A 47 Ω load draws about 106 mA and turns (12 V - 5 V) x 0.1 A,
// about 0.8 W, into heat: a bare TO-220 at about 65 °C/W climbs toward 75 °C. With its ground leg open it does not
// regulate: the output rises toward the input less the dropout, about 10 V, and the lamp glares at about 37 mA.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const vin = (lab: LabView) => lab.volts("in") ?? 0;
const vout = (lab: LabView) => lab.volts("out") ?? 0;
const plugged = (lab: LabView) => lab.solder.adapter("AD4")?.into === "J1";

/** The tired battery comes into play: the adapter unplugged, a 9 V battery at 30% snapped into the rails. */
const BATTERY: SolutionStep[] = [
  { do: "param", part: "AD4", params: { into: null } as never },
  { do: "place", part: "B1", kind: "battery", at: "rails", params: { snap: true, emf: 9.4, internalOhms: 1.7, mAh: 500, charge: 0.3 } },
];
/** Back on the adapter, at normal speed. */
const ADAPTER: SolutionStep[] = [
  { do: "control", id: "lapse", value: 1 },
  { do: "remove", part: "B1" },
  { do: "param", part: "AD4", params: { into: "J1" } },
];
/** The fix-it bench: on the adapter, the big load gone, and the ground jumper missing. */
const NO_GROUND: SolutionStep[] = [{ do: "control", id: "lapse", value: 1 }, { do: "remove", part: "RL" }, { do: "unwire", wire: "W1" }];

export default defineLab({
  id: "steady-five",
  title: "Five, exactly",
  bench: {
    board: "half",
    frame: ["desk:-60,-55", "desk:75,110"],
    parts: [
      { id: "U1", kind: "regulator7805", at: "e10", locked: true, label: "7805 regulator" },
      { id: "C2", kind: "ceramic-cap", holes: { a: "a10", b: "rail-:10" }, params: { farads: 0.33e-6 }, locked: true, label: "0.33 µF" },
      { id: "C3", kind: "ceramic-cap", holes: { a: "a12", b: "rail-:13" }, params: { farads: 0.1e-6 }, locked: true, label: "0.1 µF" },
      { id: "R5", kind: "resistor", at: "b12-b16", params: { ohms: 220 }, locked: true, label: "220 Ω" },
      { id: "D5", kind: "led", at: "d16", params: { color: "red", maxmA: 30 }, locked: true, label: "5 V lamp" },
      { id: "J1", kind: "barrel-jack", holes: { tip: "rail+:28", sleeve: "rail-:28" }, locked: true, label: "Barrel jack" },
      { id: "AD4", kind: "wall-adapter", at: "desk:50,-25", params: { volts: 9, amps: 0.3, type: "unregulated", centre: "plus", emf: 13, ohms: 8, filterFarads: 400e-6 }, locked: true, label: "9 V 300 mA unregulated" },
      { id: "CK1", kind: "clock", at: "desk:-55,60", locked: true, label: "Clock" },
    ],
    wires: [
      { id: "W1", from: "c11", to: "rail-:11", color: "black" },
      { id: "W2", from: "c10", to: "rail+:9", color: "red" },
      { id: "W3", from: "a17", to: "rail-:18", color: "black" },
    ],
    tray: [{ id: "RL", kind: "resistor", params: { ohms: 47, watts: 1 }, count: 1, label: "47 Ω, 1 W" }],
    nodes: { in: "U1.in", out: "U1.out" },
    instruments: [
      { kind: "scope", traces: [{ label: "IN", volts: "in" }, { label: "OUT", volts: "out" }], window: 0.05, range: [0, 14] },
      { kind: "inspect", show: "stress", parts: ["D5"] },
      { kind: "inspect", show: "heat", parts: ["U1"] },
    ],
    controls: [{ id: "lapse", label: "Time-lapse speed", key: "speed", min: 1, max: 3600, value: 1, scale: "log", unit: "×" }],
  },
  mascot: {
    hint: "In on the left, out on the right.",
    fried: "Too much for it. Swap in a fresh one.",
  },
  tasks: [
    {
      id: "power-up",
      prompt: "Plug the adapter into the jack and look at the scope.",
      goal: (lab) => plugged(lab) && vout(lab) > 4.8,
      hints: ["Drag the adapter's plug onto the jack's socket.", "The jack sits at the right end of the board."],
      highlight: ["AD4", "J1"],
      success: "Lumps in, flat out.",
    },
    {
      id: "battery-sag",
      prompt: "A tired battery now. Speed up time and watch the lamp.",
      setup: BATTERY,
      // Seen holding 5 V on a battery still above about 7.2 V, then sagging below 4.7 V once it fell under 6.5 V.
      goal: (lab) => {
        const m = lab.memory as { held?: boolean };
        if (vin(lab) >= 7.2 && vout(lab) >= 4.9) m.held = true;
        return !!m.held && vin(lab) <= 6.5 && vout(lab) <= 4.7;
      },
      hints: ["Slide the time-lapse up and watch the clock.", "Wait for the lamp to dim."],
      highlight: ["B1"],
      success: "It held, then sagged.",
    },
    {
      id: "spare-heat",
      prompt: "Hang the big 47 Ω load from the output to the − rail.",
      setup: ADAPTER,
      goal: (lab) => plugged(lab) && lab.joins("RL", "U1.out", "rail-:1") && (lab.part("U1")?.temp ?? 0) >= 50,
      hints: ["Drop the 47 Ω resistor from the output strip to the − rail.", "Then speed up time and watch its heat."],
      success: "Spare volts turn into heat.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "The 5 V lamp sees about 10 V. Fix it.",
      setup: NO_GROUND,
      goal: (lab) => {
        if (vout(lab) > 8) lab.memory["high"] = true;
        return lab.memory["high"] === true && lab.connected("U1.gnd", "rail-:1") && vout(lab) >= 4.8 && vout(lab) <= 5.2;
      },
      hints: ["Follow the middle leg. Where does it go?", "Run a jumper from its strip to the − rail."],
      highlight: ["pin:U1.gnd"],
      success: "Five again.",
    },
  ],
  solution: [
    { do: "param", part: "AD4", params: { into: "J1" } },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "power-up" },
    ...BATTERY,
    { do: "wait", seconds: 0.5 },
    { do: "control", id: "lapse", value: 3600 },
    { do: "wait", seconds: 12 },
    { do: "check", task: "battery-sag" },
    ...ADAPTER,
    { do: "place", part: "RL", kind: "resistor", at: "c12-rail-:14", params: { ohms: 47, watts: 1 } },
    { do: "control", id: "lapse", value: 20 },
    { do: "wait", seconds: 6 },
    { do: "check", task: "spare-heat" },
    ...NO_GROUND,
    { do: "wait", seconds: 0.5 },
    { do: "wire", from: "c11", to: "rail-:11" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-it" },
  ],
});
