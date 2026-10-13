// Blueprint: docs/curriculum/unit-1.md, L9. A lit loop of battery, 470 Ω and red LED on three clip leads (L1 red, L2
// yellow, L3 black), the meter beside it, two spare meter fuses and a spare clip lead.
import { defineLab } from "@ohmland/lab";
import { rangeIs, readsIn } from "./lib/meter";

export default defineLab({
  id: "measure-the-flow",
  title: "Measuring the flow",
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
    tray: [
      { kind: "fuse", props: { amps: 0.2, forMeter: true }, count: 2 },
      { kind: "lead", params: { color: "green" }, count: 1 },
    ],
    instruments: [{ kind: "meter", at: "desk:142,22", mode: "off" }],
  },
  mascot: {
    start: "Brightness is a guess. Let's count the current.",
    hint: "Break the loop first. The meter fills the gap.",
    fried: "Pop. Every meter owner does that once. Spare fuse in the tray.",
    success: "Same reading on both sides. Current isn't used up.",
  },
  fried: { "meter-fuse": "Meter fuse, 200 mA (amps across a battery)" },
  tasks: [
    {
      id: "set-up-amps",
      prompt: "Set the meter up for current: red lead into **mA**, dial to DC mA, **200mA** range.",
      goal: (lab) => lab.meter?.red === "ma" && lab.meter.mode === "dca-ma" && rangeIs(lab, "200mA"),
      hints: ["The mA socket is for small currents.", "Not sure how big a current is? Start on the biggest mA range."],
      highlight: ["socket:ma"],
      success: "Ready to count milliamps.",
    },
    {
      id: "break-and-bridge",
      prompt:
        "Unclip lead L1 (the red one) from the battery's plus terminal. Then close the gap with the meter: red probe on battery plus, black probe on the lead's free clip.",
      goal: (lab) => lab.inSeries("M1", "D1") && lab.isLit("D1") && readsIn(lab, 14, 17.5),
      hints: ["The current has to go through the meter, so the meter fills the gap.", "Red toward the battery's plus, black toward the resistor."],
      highlight: ["L1", "pin:B1.pos"],
      success: "About 15.8 mA, flowing right through your meter.",
    },
    {
      id: "other-side",
      prompt: "Restore L1, then measure again on the far side of the LED: between its short leg and battery minus.",
      goal: (lab) => {
        const before = lab.doneAt("break-and-bridge")?.meter?.value ?? 15.7;
        const v = lab.meter?.value;
        return lab.inSeries("M1", "D1") && lab.probed("D1.cathode", "B1.neg", "either") && v !== null && v !== undefined && Math.abs(v - before) <= 0.3;
      },
      hints: [
        "Clip L1 back onto battery plus first.",
        "Unclip L3 (the black lead) from battery minus. Red probe on its free clip, black probe on battery minus.",
      ],
      highlight: ["L3", "pin:B1.neg"],
      success: "Same number. The LED doesn't use up current: everything that goes in comes out.",
    },
    {
      id: "the-classic",
      prompt: "Now the mistake every beginner makes once. Restore the loop. Keep the meter on mA and touch the probes straight across the battery.",
      goal: (lab) => lab.event("meter-fuse", "M1"),
      hints: ["Clip L3 back onto battery minus. Then red probe on battery plus, black on battery minus."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "Pop. Nothing limited the current, it shot past 3 A, and the meter's 200 mA fuse blew to save the meter.",
    },
    {
      id: "fresh-fuse",
      prompt: "Open the meter's back, fit a fresh fuse from the tray, and measure the LED current again, the right way.",
      goal: (lab) => lab.meter?.fuse === "ok" && lab.inSeries("M1", "D1") && readsIn(lab, 14, 17.5),
      hints: ["Lift the probes off the battery first, then press Replace meter fuse.", "In series again: break the loop and let the meter fill the gap."],
      success: "Back in business. Current meters go in series, never across.",
    },
  ],
  solution: [
    { do: "plug", probe: "red", socket: "ma" },
    { do: "dial", mode: "dca-ma", range: "200mA" },
    { do: "check", task: "set-up-amps" },
    { do: "clip", lead: "L1", end: "a", to: null },
    { do: "probe", red: "B1.pos", black: "L1.a" },
    { do: "check", task: "break-and-bridge" },
    { do: "clip", lead: "L1", end: "a", to: "B1.pos" },
    { do: "clip", lead: "L3", end: "b", to: null },
    { do: "probe", red: "L3.b", black: "B1.neg" },
    { do: "check", task: "other-side" },
    { do: "clip", lead: "L3", end: "b", to: "B1.neg" },
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "the-classic" },
    { do: "probe", red: null, black: null },
    { do: "replaceFuse" },
    { do: "clip", lead: "L1", end: "a", to: null },
    { do: "probe", red: "B1.pos", black: "L1.a" },
    { do: "check", task: "fresh-fuse" },
  ],
});
