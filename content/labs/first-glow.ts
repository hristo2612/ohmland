// Blueprint: docs/curriculum/unit-1.md, L7. A reference lab for the lab API (docs/LABS.md).
// The blueprint's bonus "match-symbols" needs the live schematic panel (N7); until it exists the bonus is burning out
// an LED on purpose, the lesson's planned fried moment.
import { defineLab, type LabView } from "@ohmland/lab";

/** Every LED on the bench that is still alive: D1, or the spare D2 after D1 is fried. */
const leds = (lab: LabView) => lab.bench.parts.filter((p) => p.kind === "led" && !lab.died(p.id)).map((p) => p.id);

export default defineLab({
  id: "first-glow",
  title: "Your first glow",
  bench: {
    board: "none",
    parts: [
      // Loose and unconnected.
      { id: "B1", kind: "battery", at: "desk:-74,6", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:0,-20", params: { ohms: 1500, watts: 0.25 }, label: "1.5 kΩ resistor" },
      // 5 mm, longer anode lead, flat spot on the cathode side of the rim.
      { id: "D1", kind: "led", at: "desk:58,12", rot: 180, params: { color: "red", maxmA: 50 }, label: "Red LED" },
    ],
    tray: [
      { kind: "lead", params: { color: "red" }, count: 1 },
      { kind: "lead", params: { color: "black" }, count: 1 },
      { kind: "lead", params: { color: "green" }, count: 1 },
      { kind: "lead", params: { color: "yellow" }, count: 1 },
      { id: "D2", kind: "led", params: { color: "red", maxmA: 50 }, count: 1, label: "Spare LED" },
    ],
    instruments: [],
  },
  mascot: {
    start: "My face is an LED. Let's learn how to light one.",
    hint: "Long leg toward plus. Flat side toward minus.",
    fried: "Oof. No resistor, no mercy. There's a spare in the tray.",
    success: "It glows! You built that loop from scratch.",
    exit: "Battery, resistor, LED. You can light anything now.",
  },
  fried: { led: "Red LED, no resistor on 9 V" },
  tasks: [
    {
      id: "build-loop",
      prompt:
        "Use clip leads to make one loop: battery plus, then the resistor, then the LED, then back to battery minus. The LED's **longer leg** faces the plus side.",
      goal: (lab) => leds(lab).some((id) => lab.isLit(id) && lab.seriesLoop(["B1", "R1", id])),
      hints: [
        "Plus, resistor, LED, minus. Drag a clip lead from the tray, then drag each of its clips onto a metal end.",
        "The resistor's ends are identical. The LED's are not: longer leg toward plus.",
        "See the flat edge on the LED's rim? That side goes toward minus.",
      ],
      highlight: ["pin:B1.pos", "pin:R1.a", "pin:R1.b", "pin:D1.anode", "pin:D1.cathode", "pin:B1.neg"],
      success: "Your loop, your light. Nicely done.",
    },
    {
      id: "flip-led",
      prompt: "Turn the LED around by swapping its two legs.",
      goal: (lab) => leds(lab).some((id) => lab.seriesLoop(["B1", "R1", id]) && (lab.part(id)?.v ?? 0) < -1 && (lab.part(id)?.glow ?? 1) < 0.01),
      hints: ["Unclip both of the LED's legs and clip each lead onto the other leg."],
      highlight: ["pin:D1.anode", "pin:D1.cathode"],
      success: "Dark, and no harm done. An LED only lets current through in one direction.",
      notice:
        "Almost the whole battery voltage now sits across the LED backwards. The resistor keeps the current tiny, so a short reverse test like this is harmless, though datasheets say to stay under about 5 V in reverse.",
    },
    {
      id: "swap-order",
      prompt: "Turn the LED back. Now move the resistor to the other side, between the LED's short leg and battery minus.",
      goal: (lab) => leds(lab).some((id) => lab.isLit(id) && lab.seriesLoop(["B1", id, "R1"])),
      hints: ["Battery plus goes straight to the LED's long leg now.", "The resistor closes the loop on the minus side."],
      success: "Same glow. In a single loop, the order of the parts doesn't matter.",
    },
    {
      id: "no-resistor",
      prompt: "Curious? Clip an LED straight across the battery, with no resistor in the loop. It is free here.",
      goal: (lab) => lab.fried("led"),
      hints: ["Battery plus to the long leg, short leg to battery minus. Nothing else."],
      success: "Flash, then nothing. Far too much current. That LED now has a spot in the Hall of Fried Parts.",
      notice: "This is why the resistor is there. The spare LED in the tray lets you carry on.",
      bonus: true,
    },
  ],
  solution: [
    { do: "lead", id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
    { do: "lead", id: "TL2", from: "R1.b", to: "D1.anode", color: "green" },
    { do: "lead", id: "TL3", from: "D1.cathode", to: "B1.neg", color: "black" },
    { do: "check", task: "build-loop" },
    { do: "clip", lead: "TL2", end: "b", to: "D1.cathode" },
    { do: "clip", lead: "TL3", end: "a", to: "D1.anode" },
    { do: "check", task: "flip-led" },
    { do: "clip", lead: "TL3", end: "a", to: "R1.b" },
    { do: "clip", lead: "TL2", end: "a", to: "R1.a" },
    { do: "clip", lead: "TL1", end: "b", to: "D1.anode" },
    { do: "check", task: "swap-order" },
    // The bonus: bridge the resistor so the LED sits straight across the battery.
    { do: "clip", lead: "TL3", end: "a", to: "D1.cathode" },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "no-resistor" },
  ],
});
