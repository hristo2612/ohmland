// SAMPLE LAB. A placeholder that shows the lab format; the bench runtime that plays it comes later.
import { defineLab } from "@ohmland/lab";

export default defineLab({
  id: "sample-light-an-led",
  title: "Light an LED",
  bench: {
    board: "breadboard",
    parts: [
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      { id: "D1", kind: "led", at: "e12", props: { color: "red" } },
    ],
    tray: [
      { kind: "resistor", props: { ohms: 470 }, count: 2 },
      { kind: "led", props: { color: "red" }, count: 3 },
      { kind: "wire", count: 6 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "light-it",
      prompt: "Plug the **470 Ω** resistor in so it connects the plus rail to the LED's long leg. Make the LED glow.",
      goal: (lab) => lab.isLit("D1"),
      hints: [
        "Current has to make a full loop: plus rail, resistor, LED, minus rail.",
        "The LED's long leg (anode) points toward plus. Its short leg goes to the minus rail.",
      ],
      success: "It glows. About 15 mA is flowing, well inside the LED's rating.",
    },
    {
      id: "measure-resistor",
      prompt: "Set the meter to DC volts and measure the voltage **across the resistor**.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.meterReads(7, { tol: 0.1 }),
      hints: ["Touch one probe to each leg of the resistor.", "The dial position marked V with a straight line is DC volts."],
      success: "About 7 V. The LED takes the other 2 V of the battery's 9 V.",
    },
    {
      id: "fry-it",
      prompt: "Now take the resistor out and connect the LED straight to the rails. Go on, it is free here.",
      goal: (lab) => lab.fried("led"),
      hints: ["Pull the resistor and bridge its gap with a wire."],
      success: "That flash was too much current. Your LED now has a spot in the Hall of Fried Parts.",
      optional: true,
    },
  ],
  solution: [
    { do: "place", part: "R1", kind: "resistor", at: "rail+:12-a12", props: { ohms: 470 } },
    { do: "wire", from: "e13", to: "rail-:13" },
    { do: "probe", red: "R1.a", black: "R1.b", mode: "dcv" },
    { do: "remove", part: "R1" },
    { do: "wire", from: "rail+:12", to: "a12" },
    { do: "wait", seconds: 0.5 },
  ],
});
