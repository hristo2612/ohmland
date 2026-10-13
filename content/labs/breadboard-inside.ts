// Blueprint: docs/curriculum/unit-2.md, Lesson 7. An 830-point board whose power rails are split in the middle
// (between rows 31 and 33); the battery feeds the left half. Station A (row 5) is a working LED for reference.
// Station B (row 13): the LED stands with both legs in one strip, so it is shorted and dark. Station C (row 57) is
// dark because the right half of the rails is not fed. A hole hunt panel asks which holes are joined to 12a. Then
// the learner rebuilds the relay changeover from lesson 5 on the right half: relay K1 straddling the channel.
import { defineLab, type LabView } from "@ohmland/lab";

/** Every leg of the part sits in a hole, and no two legs share a strip. */
function straddles(lab: LabView, id: string): boolean {
  const p = lab.benchPart(id);
  if (!p) return false;
  const legs = lab.legs(id);
  if (!legs.every((l) => p.holes?.[l])) return false;
  for (let i = 0; i < legs.length; i++) for (let j = i + 1; j < legs.length; j++) if (lab.connected(`${id}.${legs[i]}`, `${id}.${legs[j]}`)) return false;
  return true;
}

export default defineLab({
  id: "breadboard-inside",
  title: "X-ray the breadboard",
  bench: {
    board: "full",
    splitRails: true,
    frame: ["desk:-110,-30", "desk:88,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      // Station A: a working reference.
      { id: "R1", kind: "resistor", at: "rail+:5-b5", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R1" },
      { id: "D1", kind: "led", at: "c5", params: { color: "red" }, locked: true, label: "Red LED D1" },
      // Station B: both of the LED's legs in strip 13.
      { id: "R2", kind: "resistor", at: "rail+:13-b13", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R2" },
      { id: "D2", kind: "led", at: "c13", rot: 90, params: { color: "red" }, label: "Red LED D2" },
      // Station C: on the unfed right half.
      { id: "R3", kind: "resistor", at: "rail+:57-b57", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R3" },
      { id: "D3", kind: "led", at: "c57", params: { color: "red" }, locked: true, label: "Red LED D3" },
    ],
    wires: [
      { id: "W1", from: "a6", to: "rail-:6", color: "black" },
      { id: "W2", from: "a14", to: "rail-:14", color: "black" },
      { id: "W3", from: "a58", to: "rail-:58", color: "black" },
    ],
    tray: [
      { id: "K1", kind: "relay", params: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, count: 1, label: "Relay" },
      { id: "S1", kind: "pushbutton", params: { cap: "red" }, count: 1, label: "Button" },
      { id: "D4", kind: "diode", params: { model: "1N4001" }, count: 1, label: "1N4001" },
      { id: "R4", kind: "resistor", params: { ohms: 470 }, count: 2, label: "470 Ω" },
      { id: "D5", kind: "led", params: { color: "yellow" }, count: 1, label: "Yellow LED" },
      { id: "D6", kind: "led", params: { color: "green" }, count: 1, label: "Green LED" },
    ],
    instruments: [{ kind: "meter", at: "desk:150,-6", rot: -18, mode: "dcv" }],
  },
  panels: [{ kind: "hole-hunt", id: "hunt", start: "a12", cols: [9, 15], show: ["xray-hunt"] }],
  mascot: {
    start: "X-ray on. Now the breadboard has no secrets.",
    hint: "Hover a hole: everything joined to it lights up.",
    success: "Same strip, same node. The board is starting to make sense.",
    fried: "Something got a straight path from plus to minus. Look at which strips it bridged.",
    exit: "Your first proper breadboard build. Neat, solid and ready to change.",
  },
  fried: { led: "LED on the breadboard", relay: "Relay laid along a strip" },
  tasks: [
    {
      id: "xray-hunt",
      prompt: "Turn on **X-ray**. Hole hunt: tap every hole joined to 12a.",
      goal: (lab) => lab.panel("hunt").correct,
      hints: ["Look at the metal clip under row 12, on this side.", "The channel down the middle is a wall: nothing crosses it."],
      success: "Five holes per clip, and the clip stops at the channel.",
    },
    {
      id: "fix-dark-led",
      prompt: "Station B's LED (row 13) is dark. Move it so it lights.",
      goal: (lab) => lab.isLit("D2") && !lab.connected("D2.anode", "D2.cathode"),
      hints: ["Both of D2's legs are in row 13. What does that do?", "Turn it: long leg in row 13, short leg in row 14."],
      highlight: ["D2"],
      success: "Both legs in one strip: the strip shorts the LED.",
      mascot: { success: "Same strip, same node. The LED never stood a chance." },
    },
    {
      id: "bus-gap",
      prompt: "Station C (row 57) is dark too. Find why, then fix it.",
      goal: (lab) => lab.isLit("D3") && lab.connected("rail+:10", "rail+:50") && lab.connected("rail-:10", "rail-:50"),
      hints: [
        "Measure across the rails at row 10, then at row 50.",
        "The rails split halfway. Bridge each gap with a jumper.",
      ],
      success: "Split rails: a classic trap. One bridge per rail fixes it.",
      mascot: { success: "Bridge the gap and the lower half wakes up." },
    },
    {
      id: "relay-on-board",
      prompt:
        "Rebuild the relay changeover on the right half, with this battery.",
      goal: (lab) => {
        if (!straddles(lab, "K1") || !lab.joins("D4", "K1.coil1", "K1.coil2")) return false;
        if (!lab.closed("S1") && lab.isLit("D5") && !lab.isLit("D6")) lab.memory["rest"] = true;
        if (lab.closed("S1") && lab.isLit("D6") && !lab.isLit("D5") && (lab.part("D4")?.v ?? 0) < -1) lab.memory["held"] = true;
        return lab.memory["rest"] === true && lab.memory["held"] === true;
      },
      hints: [
        "Each relay pin gets its own strip. The coil is at one end.",
        "COM to plus. NC feeds yellow, NO feeds green, each via 470 Ω.", "The button feeds the coil. The diode sits across the coil.",
        "The diode's band goes to the coil end the button feeds.",
      ],
      success: "Your first proper breadboard build. Neat, solid and ready to be modified.",
      notice: "Path length through strips doesn't matter: they barely resist.",
    },
  ],
  solution: [
    { do: "panel", id: "hunt", value: ["a12", "b12", "c12", "d12", "e12"] },
    { do: "check", task: "xray-hunt" },
    { do: "move", part: "D2", at: "c13", rot: 0 },
    { do: "check", task: "fix-dark-led" },
    { do: "probe", red: "rail+:10", black: "rail-:10" },
    { do: "probe", red: "rail+:50", black: "rail-:50" },
    { do: "wire", id: "W4", from: "rail+:31", to: "rail+:33", color: "red" },
    { do: "wire", id: "W5", from: "rail-:31", to: "rail-:33", color: "black" },
    { do: "check", task: "bus-gap" },
    // The relay straddles the channel at row 38: coil 38 (near grounded, far fed), COM 41, NC 43, NO 45.
    { do: "place", part: "K1", kind: "relay", at: "e38", params: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 } },
    { do: "wire", id: "W6", from: "a38", to: "rail-:37", color: "black" },
    { do: "wire", id: "W7", from: "a41", to: "rail+:41", color: "red" },
    { do: "place", part: "S1", kind: "pushbutton", at: "e34", params: { cap: "red" } },
    { do: "wire", id: "W8", from: "a34", to: "rail+:34", color: "red" },
    { do: "wire", id: "W9", from: "g36", to: "g38", color: "yellow" },
    { do: "place", part: "D4", kind: "diode", at: "d38-h38", params: { model: "1N4001" } },
    { do: "place", part: "R4", kind: "resistor", at: "c43-c48", params: { ohms: 470 } },
    { do: "place", part: "D5", kind: "led", at: "d48", params: { color: "yellow" } },
    { do: "wire", id: "W10", from: "a49", to: "rail-:49", color: "black" },
    { do: "place", part: "R5", kind: "resistor", at: "b45-b51", params: { ohms: 470 } },
    { do: "place", part: "D6", kind: "led", at: "d51", params: { color: "green" } },
    { do: "wire", id: "W11", from: "a52", to: "rail-:52", color: "black" },
    { do: "wait", seconds: 0.3 },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "relay-on-board" },
  ],
});
