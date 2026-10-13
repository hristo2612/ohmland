// Blueprint: docs/curriculum/unit-1.md, L10. The lit loop from measure-the-flow, with the meter left in a trap: red
// lead in mA and the dial on DC mA, as if from last time. Probing anything like that blows the meter's fuse.
import { defineLab } from "@ohmland/lab";
import { latest, rangeIs, readsIn, si } from "./lib/meter";

export default defineLab({
  id: "volts-across",
  title: "Across, not in",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-84,6", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-6,-40", params: { ohms: 470, watts: 0.25 }, locked: true, label: "470 Ω resistor" },
      { id: "D1", kind: "led", at: "desk:48,30", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
    ],
    leads: [
      { id: "L1", from: "B1.pos", to: "R1.a", color: "red" },
      { id: "L2", from: "R1.b", to: "D1.anode", color: "yellow" },
      { id: "L3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [{ kind: "fuse", props: { amps: 0.2, forMeter: true }, count: 1 }],
    instruments: [{ kind: "meter", at: "desk:142,22", mode: "dca-ma", range: "200mA", red: "ma", black: "com" }],
  },
  mascot: {
    start: "Current goes through. Voltage sits across. Let's measure the push.",
    hint: "Red lead still in mA? Move it before you touch anything.",
    fried: "The leftover-lead trap. Happens to everyone. Spare fuse in the tray.",
    success: "7.4 plus 2.0 makes 9.4. The loop balances its books.",
  },
  fried: { "meter-fuse": "Meter fuse, 200 mA (red lead left in mA)" },
  tasks: [
    {
      id: "reset-meter",
      prompt: "Set up for volts: red lead into **VΩ**, DC V, **20V**.",
      goal: (lab) => lab.meter?.red === "vohm" && lab.meter.mode === "dcv" && rangeIs(lab, "20V"),
      hints: ["Where is the red lead plugged in now?", "VΩ socket first, then the V with a straight line."],
      highlight: ["socket:ma", "socket:vohm"],
      success: "Good habit. Leftover amps settings blow fuses.",
    },
    {
      id: "battery-volts",
      prompt: "LED lit. Measure across the battery.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("B1") && readsIn(lab, 9.0, 9.6),
      hints: ["Red on plus, black on minus. Nothing gets unclipped."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "About 9.4 V, while the battery works.",
    },
    {
      id: "resistor-volts",
      prompt: "Across the resistor: red on the end nearer plus.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("R1") && readsIn(lab, 6.9, 7.9),
      hints: ["The end with the red clip lead is nearer plus."],
      highlight: ["pin:R1.a", "pin:R1.b"],
      success: "About 7.4 V. The resistor takes most of the push.",
    },
    {
      id: "led-volts",
      prompt: "Across the LED: red on the long leg. Try 2V.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("D1") && readsIn(lab, 1.8, 2.1),
      hints: ["The long leg (anode) has the yellow lead on it."],
      highlight: ["pin:D1.anode", "pin:D1.cathode"],
      success: "About 1.97 V. That's the LED's forward voltage.",
    },
    {
      id: "add-them-up",
      prompt: "Add the resistor and LED readings. Type the total.",
      goal: (lab) => {
        const sum = lab.note("sum");
        const r = si(latest(lab, "across:R1"));
        const d = si(latest(lab, "across:D1"));
        const b = si(latest(lab, "across:B1"));
        return sum !== null && Math.abs(sum - (r + d)) <= 0.05 && Math.abs(sum - b) <= 0.15;
      },
      note: { id: "sum", label: "Resistor + LED", unit: "V" },
      hints: ["Your readings are in the notebook.", "About 7.4 plus about 1.9."],
      success: "The drops add up to the battery. The push is shared around the loop.",
    },
  ],
  solution: [
    { do: "plug", probe: "red", socket: "vohm" },
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "check", task: "reset-meter" },
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "battery-volts" },
    { do: "probe", red: "R1.a", black: "R1.b" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "resistor-volts" },
    { do: "probe", red: "D1.anode", black: "D1.cathode", range: "2V" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "led-volts" },
    { do: "note", id: "sum", value: "9.36" },
    { do: "check", task: "add-them-up" },
  ],
});
