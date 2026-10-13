// Blueprint: docs/curriculum/unit-2.md, Lesson 3. Two SPDT toggles on blocks: battery plus, R1 and the LED run to
// switch A's pole; switch B's pole runs back to battery minus. The learner joins the four throws with clip leads,
// and a truth table logs every combination of the two switches with the lamp, starting again after each rewire.
import { defineLab, type LabView } from "@ohmland/lab";

/** The truth table is full and lit in exactly these rows ("a,a" = both thrown to their first throw). */
function litRows(lab: LabView, rows: string[]): boolean {
  const t = lab.panel("truth");
  const keys = Object.keys(t.cells);
  if (keys.length < 4) return false;
  return keys.every((k) => t.cells[k] === rows.includes(k));
}

export default defineLab({
  id: "stairway-light",
  title: "Either switch, any time",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-118,6", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-52,-44", params: { ohms: 470 }, locked: true, label: "470 Ω resistor" },
      { id: "D1", kind: "led", at: "desk:14,-50", rot: 180, params: { color: "red" }, locked: true, label: "Red LED (the lamp)" },
      { id: "SA", kind: "toggle-switch", at: "desk:-36,32", params: { base: true, to: "a" }, locked: true, label: "Downstairs switch A" },
      { id: "SB", kind: "toggle-switch", at: "desk:58,32", params: { base: true, to: "a" }, locked: true, label: "Upstairs switch B" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "R1.a", color: "red", locked: true },
      { id: "TL2", from: "R1.b", to: "D1.anode", color: "yellow", locked: true },
      { id: "TL3", from: "D1.cathode", to: "SA.com", color: "green", locked: true },
      { id: "TL4", from: "SB.com", to: "B1.neg", color: "black", locked: true },
    ],
    tray: [
      { kind: "lead", params: { color: "blue" }, count: 2 },
      { kind: "lead", params: { color: "white" }, count: 2 },
    ],
    instruments: [],
  },
  panels: [
    {
      kind: "truth-table",
      id: "truth",
      inputs: [
        { part: "SA", label: "Switch A", a: "A1", b: "A2" },
        { part: "SB", label: "Switch B", a: "B1", b: "B2" },
      ],
      output: { part: "D1" },
    },
  ],
  mascot: {
    start: "Upstairs, downstairs, any switch, any time. Let's find out how.",
    hint: "Flip one switch at a time and watch which row of the table fills in.",
    success: "Four rows, one truth. Tables never get tired.",
    fried: "That LED had no resistor in its path. Check where your clips go.",
    exit: "You just built a logic gate. With your hands. I'm impressed.",
  },
  fried: { led: "Red LED, bypassed resistor in the stairway light" },
  tasks: [
    {
      id: "series-pair",
      prompt:
        "Clip one lead from throw **A1** (switch A's left screw) to throw **B1** (switch B's left screw). Try all four switch combinations and watch the table fill.",
      goal: (lab) => {
        const t = lab.panel("truth");
        return Object.keys(t.cells).length >= 4 && Object.values(t.cells).filter(Boolean).length === 1;
      },
      hints: ["Only one path exists, and both switches must line up on it.", "Flip one switch at a time, and wait for each row to fill."],
      highlight: ["pin:SA.a", "pin:SB.a"],
      success: "Exactly one combination lights the lamp. That's two switches in series: both must agree on one path.",
    },
    {
      id: "two-travelers",
      prompt: "Add a second lead from **A2** to **B2** (the right screws). Now try all four combinations again.",
      goal: (lab) => litRows(lab, ["a,a", "b,b"]),
      hints: [
        "Each pair of throws gets its own lead. Those two leads are called travelers.",
        "Watch the current's path: it travels along whichever traveler both poles touch.",
      ],
      highlight: ["pin:SA.b", "pin:SB.b"],
      success: "Any single flip changes the lamp. That's the stairway trick.",
      notice: "The lamp is on when both switches point the same way.",
    },
    {
      id: "cross-the-travelers",
      prompt: "Swap the travelers at switch B, so **A1** goes to **B2** and **A2** goes to **B1**. What changes?",
      goal: (lab) => litRows(lab, ["a,b", "b,a"]),
      hints: ["Move only the two clips on switch B. Predict first, then flip."],
      success: "Still a perfect stairway, but now different means on. Both versions toggle on every flip.",
      notice: "The stairway computes same or different: the first logic function of the course.",
    },
  ],
  solution: [
    { do: "lead", id: "TL5", from: "SA.a", to: "SB.a", color: "blue" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "series-pair" },
    { do: "lead", id: "TL6", from: "SA.b", to: "SB.b", color: "white" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "two-travelers" },
    { do: "clip", lead: "TL5", end: "b", to: "SB.b" },
    { do: "clip", lead: "TL6", end: "b", to: "SB.a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "cross-the-travelers" },
  ],
});
