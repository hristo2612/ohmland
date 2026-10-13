// Blueprint: docs/curriculum/unit-1.md, L3. A 9 V battery, an AA cell in its cradle and a loose 470 Ω resistor
// (really 466 Ω), with the meter's leads already in COM and VΩ.
import { defineLab } from "@ohmland/lab";
import { rangeIs, readsIn, showsOL } from "./lib/meter";

export default defineLab({
  id: "tiny-and-huge-numbers",
  title: "Tiny numbers, huge numbers",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-74,4", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // An AA cell lying in a small cradle, end caps showing.
      { id: "X1", kind: "battery", at: "desk:-14,34", params: { size: "aa", chem: "alkaline", emf: 1.58, internalOhms: 0.15, mAh: 2500 }, locked: true, label: "AA cell" },
      // Lying loose with both leads exposed.
      { id: "R1", kind: "resistor", at: "desk:-10,-36", params: { ohms: 470, watts: 0.25, actualOhms: 466 }, locked: true, label: "470 Ω resistor" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:76,2", mode: "off" }],
  },
  mascot: {
    start: "Big numbers, tiny numbers. Let's tame them both.",
    hint: "OL? Nothing's broken. Turn the dial up one step.",
    success: "Kilo, mega, milli, micro. You speak fluent meter now.",
  },
  tasks: [
    {
      id: "over-the-limit",
      prompt: "Set DC volts to the **2 V** range and measure the 9 V battery.",
      goal: (lab) => lab.meter?.mode === "dcv" && rangeIs(lab, "2V") && lab.across("B1") && showsOL(lab),
      hints: ["Red on the round terminal, black on the six-sided one.", "Pick DC volts on the dial, then 2 V in the range list."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "OL means over limit. 9 V is too big for a 2 V range. The meter is fine.",
    },
    {
      id: "climb-a-range",
      prompt: "Turn up one range at a time. Stop at the first range that shows a real number.",
      goal: (lab) => lab.meter?.mode === "dcv" && rangeIs(lab, "20V") && lab.across("B1") && readsIn(lab, 9.0, 9.6),
      hints: ["The next range up from 2 V is 20 V."],
      success: "20 V is the smallest range above 9 V, so it gives you the most useful digits.",
      notice: "On 200 V the same battery shows only one decimal place.",
    },
    {
      id: "aa-cell",
      prompt: "Now measure the AA cell. Find the range that shows the most digits without OL.",
      goal: (lab) => lab.meter?.mode === "dcv" && rangeIs(lab, "2V") && lab.across("X1") && readsIn(lab, 1.4, 1.65),
      hints: ["An AA cell is about 1.5 V.", "The smallest range bigger than 1.5 V wins."],
      highlight: ["pin:X1.pos", "pin:X1.neg"],
      success: "About 1.58 V. That's also 1,580 millivolts, if you like big numbers.",
    },
    {
      id: "kilo-ohms",
      prompt:
        "Turn the dial to **Ω, 2k range** and touch the probes to the resistor's two wire ends. The screen is in kilohms. Type the value in plain ohms into your notebook.",
      goal: (lab) => {
        const n = lab.note("ohms");
        return lab.meter?.mode === "ohm" && rangeIs(lab, "2k") && lab.across("R1", "either") && n !== null && n >= 455 && n <= 480;
      },
      note: { id: "ohms", label: "The resistor, in ohms", unit: "Ω" },
      hints: ["k means a thousand.", "0.466 thousand ohms is 466 ohms."],
      highlight: ["pin:R1.a", "pin:R1.b"],
      success: "466 Ω. Same resistor, two ways to write it: 0.466 kΩ or 466 Ω.",
      notice: "Resistors don't care which probe is which, so either way round works.",
    },
  ],
  solution: [
    { do: "dial", mode: "dcv", range: "2V" },
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "check", task: "over-the-limit" },
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "check", task: "climb-a-range" },
    { do: "dial", mode: "dcv", range: "2V" },
    { do: "probe", red: "X1.pos", black: "X1.neg" },
    { do: "check", task: "aa-cell" },
    { do: "dial", mode: "ohm", range: "2k" },
    { do: "probe", red: "R1.a", black: "R1.b" },
    { do: "note", id: "ohms", value: "466" },
    { do: "check", task: "kilo-ohms" },
  ],
});
