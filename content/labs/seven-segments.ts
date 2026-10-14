// Blueprint: docs/curriculum/unit-4.md, CH13; a bench lesson (docs/LESSONS.md):
// content/units/chips/counters/seven-segments. One idea: seven bars (and a dot) make every digit.
// Half board, 9.4 V on the near rails. An 8-way DIP switch straddles the channel at columns 4 to 11: switch k joins
// pin k (row e, column 3 + k) to pin 17 - k (row f, the same column). The near side of every switch is fed from the
// plus rail; the far side runs to one bar of a common-cathode display on its carrier board (a 1 kΩ resistor per bar,
// about 7 mA at 9.4 V), so switch a lights bar a. The display's common goes to minus. The fix-it bench sets a 2 but
// starts the e bar's wire in switch f's strip, so bar e stays dark (its far end hides under the carrier, this one
// is in plain view).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { bars, seen, shown, wire } from "./lib/chip-bench";

/** The bar each switch feeds, switch 1 first. */
const SEG = ["a", "b", "c", "d", "e", "f", "g", "dp"] as const;
/** DIP switch settings for a set of bars ("bcfg"). */
const set = (on: string) => Object.fromEntries(SEG.map((s, i) => [`s${i + 1}`, s === "dp" ? false : on.includes(s)]));
const only = (lab: LabView, want: string) => bars(lab, "DS1") === want;

/** The fix-it bench: switches set for a 2, but the e bar's wire starts in switch f's strip, one over. */
const WRONG_STRIP: SolutionStep[] = [
  { do: "param", part: "DIP1", params: set("abdeg") },
  { do: "unwire", wire: "We" },
  { do: "wire", id: "We", from: "i9", to: "a16", color: "white" },
];

export default defineLab({
  id: "seven-segments",
  title: "Eight lights make a digit",
  bench: {
    board: "half",
    frame: ["hole:j2", "hole:a22", "rail+:2", "top+:22"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "DIP1", kind: "dip-switch", at: "e4", params: { positions: 8, tags: [...SEG] }, locked: true, label: "DIP switch DIP1" },
      { id: "DS1", kind: "sevenseg", at: "c16", params: { common: "cathode", carrier: true, segmentOhms: 1000 }, locked: true, label: "Seven-segment display DS1" },
    ],
    wires: [
      // Plus to the near side of every switch (columns 4 to 11; the rail has no hole at column 6).
      wire("P1", "a4", "rail+:3", "red"),
      wire("P2", "a5", "rail+:4", "red"),
      wire("P3", "a6", "rail+:5", "red"),
      wire("P4", "a7", "rail+:7", "red"),
      wire("P5", "a8", "rail+:8", "red"),
      wire("P6", "a9", "rail+:9", "red"),
      wire("P7", "a10", "rail+:10", "red"),
      wire("P8", "a11", "rail+:11", "red"),
      // The far side of each switch to its bar: g f com2 a b along row g (columns 16 to 20), e d com c dp along row c.
      wire("Wa", "j4", "j19", "blue"),
      wire("Wb", "i5", "i20", "blue"),
      wire("Wc", "g6", "d19", "green"),
      wire("Wd", "h7", "b17", "green"),
      wire("We", "i8", "a16", "white"),
      wire("Wf", "h9", "h17", "blue"),
      wire("Wg", "g10", "f16", "blue"),
      wire("Wdp", "j11", "e20", "green"),
      wire("Wcom", "a18", "rail-:19", "black"),
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Clockwise from the top: a to f. The middle is g.",
    fried: "One bar burned out. Every bar needs its resistor.",
  },
  fried: { sevenseg: "Seven-segment display, a bar without its resistor" },
  tasks: [
    {
      id: "light-a",
      prompt: "Flip switch **a**.",
      goal: (lab) => bars(lab, "DS1").includes("a"),
      hints: ["The DIP switch's sliders carry tags a to g. Slide a's up."],
      highlight: ["DIP1"],
      success: "The top bar.",
    },
    {
      id: "make-seven",
      prompt: "Flip **b** and **c** as well.",
      goal: (lab) => shown(lab, "DS1") === "7",
      hints: ["Switches a, b and c on, the rest off."],
      highlight: ["DIP1"],
      success: "A seven.",
    },
    {
      id: "make-eight",
      prompt: "Flip **d**, **e**, **f** and **g** too.",
      goal: (lab) => shown(lab, "DS1") === "8",
      hints: ["Every switch from a to g on."],
      highlight: ["DIP1"],
      success: "An 8.",
    },
    {
      id: "make-four",
      prompt: "Make a **4**.",
      goal: (lab) => only(lab, "bcfg"),
      hints: ["A 4 has no top and no bottom.", "Only f, g, b and c."],
      highlight: ["DIP1"],
      success: "A 4.",
    },
    {
      id: "fix-it",
      prompt: "Make the display show a proper **2**.",
      setup: WRONG_STRIP,
      // Broken first (switch e on, bar e dark for a moment), then a 2 with e's wire in e's strip.
      goal: (lab) =>
        seen(lab, "broken", lab.heldFor(0.3, lab.prop("DIP1")?.["s5"] === true && !bars(lab, "DS1").includes("e"), "dark-e")) &&
        shown(lab, "DS1") === "2" &&
        lab.connected("DIP1.12", "DS1.e"),
      hints: ["Which bar is missing from your 2?", "Follow the white wire back to the switches. Which one feeds it?"],
      highlight: ["We"],
      success: "A proper 2.",
    },
    {
      id: "hello",
      prompt: "Bonus: spell **HELLO**, one letter at a time.",
      // H, E, L (twice), O: the shapes in order, each held for a moment.
      goal: (lab) => {
        const word = ["bcefg", "adefg", "def", "abcdef"];
        const k = (lab.memory["k"] as number | undefined) ?? 0;
        if (lab.heldFor(0.4, bars(lab, "DS1") === word[k], `l${k}`)) lab.memory["k"] = k + 1;
        return ((lab.memory["k"] as number | undefined) ?? 0) >= word.length;
      },
      hints: ["H is b, c, e, f and g. E is a, d, e, f and g. L is d, e and f. O is a to f."],
      highlight: ["DIP1"],
      success: "HELLO in bars.",
      bonus: true,
    },
  ],
  solution: [
    { do: "param", part: "DIP1", params: { s1: true } },
    { do: "check", task: "light-a" },
    { do: "param", part: "DIP1", params: { s2: true, s3: true } },
    { do: "check", task: "make-seven" },
    { do: "param", part: "DIP1", params: { s4: true, s5: true, s6: true, s7: true } },
    { do: "check", task: "make-eight" },
    { do: "param", part: "DIP1", params: set("bcfg") },
    { do: "check", task: "make-four" },
    // The secret: H, E, L, O.
    { do: "param", part: "DIP1", params: set("bcefg") },
    { do: "wait", seconds: 0.6 },
    { do: "param", part: "DIP1", params: set("adefg") },
    { do: "wait", seconds: 0.6 },
    { do: "param", part: "DIP1", params: set("def") },
    { do: "wait", seconds: 0.6 },
    { do: "param", part: "DIP1", params: set("abcdef") },
    { do: "wait", seconds: 0.6 },
    { do: "check", task: "hello" },
    ...WRONG_STRIP,
    { do: "wait", seconds: 0.4 },
    { do: "unwire", wire: "We" },
    { do: "wire", id: "We", from: "i8", to: "a16", color: "white" },
    { do: "check", task: "fix-it" },
  ],
});
