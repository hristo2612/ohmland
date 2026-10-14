// Blueprint: docs/curriculum/unit-4.md, CH19; a bench lesson (docs/LESSONS.md):
// content/units/chips/logic/flip-the-answer. One idea: a bubble on a gate flips its answer: NAND is AND turned over,
// NOR is OR turned over. New: the logic probe.
// Full board, the logic rail (5 V on the far rails). Keys A (S1) and B (S2) are slide switches throwing their middle
// pins between minus and 5 V; both chips share them. ?1 is a 74HC00 under tape at e20 (A on pin 1, B on pin 2, its
// answer on pin 3); ?2 is a 74HC02 under tape at e32 (A on pin 2, B on pin 3, its answer on pin 1: the NOR has its
// outputs first). Their spare inputs are tied to minus. At e44 an empty, pre-wired spot waits for the 74HC04 on the
// desk (the secret): supply, its spare inputs tied, A on pin 1. The probe LP1 is clipped to the 5 V rail; its tip
// starts on the desk. The fix-it bench unclips its supply leads.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { gateChip, logicRail, probe, seen, wire } from "./lib/chip-bench";

const rail = logicRail(4, 61);
const taken = ["top-:5", "top+:6", "top-:9", "top+:11", "top-:13", "top+:15", "top+:57", "top-:58"];
const u1 = gateChip({ id: "U1", model: "74HC00", col: 20, board: "full", spare: [2, 3, 4], taken, hidden: "?1", label: "Taped chip ?1" });
const u2 = gateChip({ id: "U2", model: "74HC02", col: 32, board: "full", spare: [], tie: [5, 6, 8, 9, 11, 12], taken, hidden: "?2", label: "Taped chip ?2" });
// The secret's spot: the wiring of a 74HC04 at e44 (its spare inputs 3, 5, 9, 11 and 13 tied), without the chip.
const spot = gateChip({ id: "U3", model: "74HC04", col: 44, board: "full", spare: [], tie: [3, 5, 9, 11, 13], taken });

/** The probe's lamps read `level` with its tip on `node`. */
const reads = (lab: LabView, node: string, level: "H" | "L" | "-") => lab.connected("LP1.tip", node) && probe(lab, "LP1") === level;
/** The table is full and high in exactly these rows ("a,b": A off, B on). */
function rows(lab: LabView, id: string, high: string[]): boolean {
  const t = lab.panel(id);
  const keys = Object.keys(t.cells);
  return keys.length >= 4 && keys.every((k) => t.cells[k] === high.includes(k));
}
const tipOn = (lab: LabView, node: string) => lab.connected("LP1.tip", node);

/** The fix-it bench: the probe's tip on ?1's pin 3, its red and black leads off the rails. */
const UNPLUGGED: SolutionStep[] = [{ do: "move", part: "LP1", holes: { tip: "a22", vcc: null, gnd: null } }];

export default defineLab({
  id: "flip-the-answer",
  title: "The bubble flips it",
  bench: {
    board: "full",
    frame: ["hole:j3", "hole:a62", "top+:3", "rail-:62"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...rail.parts,
      { id: "S1", kind: "slide-switch", at: "h9", params: { to: "a" }, locked: true, label: "Key A (S1)" },
      { id: "S2", kind: "slide-switch", at: "h13", params: { to: "a" }, locked: true, label: "Key B (S2)" },
      { id: "LA", kind: "tag", at: "desk:-56,-38", params: { text: "A" }, locked: true, label: "Tag A" },
      { id: "LB", kind: "tag", at: "desk:-30,-38", params: { text: "B" }, locked: true, label: "Tag B" },
      ...u1.parts,
      ...u2.parts,
      { id: "U3", kind: "chip", at: "desk:40,46", params: { model: "74HC04" }, label: "Chip U3 (74HC04)" },
      { id: "LP1", kind: "logic-probe", at: "desk:96,10", holes: { vcc: "top+:57", gnd: "top-:58" }, label: "Logic probe LP1" },
    ],
    wires: [
      ...rail.wires,
      // Keys: off to minus, on to 5 V.
      wire("W1", "j9", "top-:9", "black"),
      wire("W2", "j11", "top+:11", "red"),
      wire("W3", "j13", "top-:13", "black"),
      wire("W4", "j15", "top+:15", "red"),
      // A to ?1 pin 1, ?2 pin 2 and the spot's pin 1; B to ?1 pin 2 and ?2 pin 3.
      wire("W5", "g10", "c20", "yellow"),
      wire("W6", "g14", "b21", "blue"),
      wire("W7", "d20", "d33", "yellow"),
      wire("W8", "c21", "c34", "blue"),
      wire("W9", "b33", "b44", "yellow"),
      ...u1.wires,
      ...u2.wires,
      ...spot.wires,
    ],
    tray: [],
    instruments: [],
  },
  panels: [
    {
      kind: "truth-table",
      id: "tt1",
      show: ["nand-table"],
      title: "Chip ?1",
      inputs: [
        { part: "S1", label: "A", a: "0", b: "1" },
        { part: "S2", label: "B", a: "0", b: "1" },
      ],
      output: { node: "U1.3", label: "Pin 3" },
      mystery: true,
      name: "NAND",
    },
    { kind: "xray", id: "xr1", part: "U1", show: ["look-inside"], title: "Inside ?1" },
    {
      kind: "truth-table",
      id: "tt2",
      show: ["nor-table"],
      title: "Chip ?2",
      inputs: [
        { part: "S1", label: "A", a: "0", b: "1" },
        { part: "S2", label: "B", a: "0", b: "1" },
      ],
      output: { node: "U2.1", label: "Pin 1" },
      mystery: true,
      name: "NOR",
    },
  ],
  mascot: {
    hint: "Read the lamp after each key pair.",
    fried: "Something cooked. Probes only look, so check the wiring.",
  },
  tasks: [
    {
      id: "probe-high",
      prompt: "Touch the probe's tip to the **plus** rail.",
      goal: (lab) => reads(lab, "VR1.out", "H"),
      hints: ["Drag the probe pen onto a hole in the red rail at the back."],
      highlight: ["LP1"],
      success: "H: high.",
    },
    {
      id: "probe-low",
      prompt: "Now touch **minus**.",
      goal: (lab) => reads(lab, "VR1.gnd", "L"),
      hints: ["The blue rail next to the red one."],
      highlight: ["LP1"],
      success: "L: low.",
    },
    {
      id: "probe-float",
      prompt: "Touch a strip with nothing on it.",
      goal: (lab) => probe(lab, "LP1") === "-" && !lab.connected("LP1.tip", "VR1.out") && !lab.connected("LP1.tip", "VR1.gnd"),
      hints: ["Any hole in an empty column of the board."],
      highlight: ["LP1"],
      success: "Neither lamp.",
    },
    {
      id: "nand-table",
      prompt: "Hold the tip on **?1's pin 3** and try all four ways of setting the keys.",
      goal: (lab) => tipOn(lab, "U1.3") && rows(lab, "tt1", ["a,a", "a,b", "b,a"]),
      hints: ["Pin 3 is third from the notch, near side.", "Off-off, on-off, off-on, on-on."],
      highlight: ["U1", "S1", "S2"],
      success: "High unless both keys are on.",
    },
    {
      id: "look-inside",
      prompt: "Look inside ?1.",
      goal: (lab) => lab.view("xray:U1"),
      hints: ["Press Look inside on the x-ray card."],
      highlight: ["U1"],
      success: "AND gates, each with a little circle.",
    },
    {
      id: "nor-table",
      prompt: "Hold the tip on **?2's pin 1** and try all four ways of setting the keys.",
      goal: (lab) => tipOn(lab, "U2.1") && rows(lab, "tt2", ["a,a"]),
      hints: ["The 02 answers on pin 1, right by the notch.", "Off-off, on-off, off-on, on-on."],
      highlight: ["U2", "S1", "S2"],
      success: "High only when both keys are off.",
    },
    {
      id: "fix-it",
      prompt: "Make the probe read again.",
      setup: UNPLUGGED,
      goal: (lab) => {
        if (!seen(lab, "dark", lab.heldFor(0.5, probe(lab, "LP1") === null, "dark"))) return false;
        const p = probe(lab, "LP1");
        return seen(lab, "H", p === "H") && seen(lab, "L", p === "L");
      },
      hints: ["Where does a probe get its power?", "Red lead to the 5 V rail, black to minus. Then touch a high and a low."],
      highlight: ["LP1"],
      success: "It feeds on the circuit again.",
    },
    {
      id: "not-gate",
      prompt: "Bonus: seat the 74HC04 in the empty spot and probe its pin 2 while you flip key A.",
      goal: (lab) => {
        const inSpot = lab.connected("U3.1", "S1.com") && lab.connected("U3.14", "VR1.out") && lab.connected("U3.7", "VR1.gnd");
        if (!inSpot || !tipOn(lab, "U3.2")) return false;
        const a = lab.prop("S1")?.["to"] === "b";
        const p = probe(lab, "LP1");
        return seen(lab, "on", a && p === "L") && seen(lab, "off", !a && p === "H");
      },
      hints: ["The empty spot at the right: notch left.", "Pin 2 is the one next to pin 1."],
      highlight: ["U3"],
      success: "One in, flipped out.",
      bonus: true,
    },
  ],
  solution: [
    { do: "move", part: "LP1", holes: { tip: "top+:53" } },
    { do: "check", task: "probe-high" },
    { do: "move", part: "LP1", holes: { tip: "top-:53" } },
    { do: "check", task: "probe-low" },
    { do: "move", part: "LP1", holes: { tip: "a56" } },
    { do: "check", task: "probe-float" },
    { do: "move", part: "LP1", holes: { tip: "a22" } },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S2", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "nand-table" },
    { do: "view", name: "xray:U1", on: true },
    { do: "check", task: "look-inside" },
    { do: "view", name: "xray:U1", on: false },
    { do: "move", part: "LP1", holes: { tip: "a32" } },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S2", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S2", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "nor-table" },
    // The secret: an inverter in the spot.
    { do: "move", part: "U3", at: "e44" },
    { do: "move", part: "LP1", holes: { tip: "a45" } },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "not-gate" },
    ...UNPLUGGED,
    { do: "wait", seconds: 0.6 },
    { do: "move", part: "LP1", holes: { vcc: "top+:57", gnd: "top-:58" } },
    { do: "move", part: "LP1", holes: { tip: "top+:53" } },
    { do: "wait", seconds: 0.4 },
    { do: "move", part: "LP1", holes: { tip: "top-:53" } },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-it" },
  ],
});
