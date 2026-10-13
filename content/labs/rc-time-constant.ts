// Blueprint: docs/curriculum/unit-2.md, Lesson 11. Slide switch S1 (rows 4 to 6) picks plus (charge) or minus
// (discharge) for row 5; R1 (1 kΩ) runs from row 5 to row 10, and C1 (1,000 µF) bends its legs from row 10 down
// to the minus rail. The meter sits across C1; the data logger starts a new run each time S1 is thrown, and its
// cursor reads off time and voltage. The learner types each τ into the notebook; goals compare it with this circuit's
// own τ: the resistor's and the capacitor's actual values (electrolytics can be 20% off their print).
//
// Measured in the simulator: τ = 1.01 s with R1 and C1, 10.2 s with the 10 kΩ, 2.25 s with 2.2 kΩ and C1 (each
// part a little off its marking, as real ones are).
import { defineLab, type LabView } from "@ohmland/lab";

/** The timing pair: a resistor from the switch's pole to a node, and an electrolytic from that node to minus. */
function timing(lab: LabView): { r: string; c: string } | null {
  for (const r of lab.bench.parts) {
    if (r.kind !== "resistor" || !lab.connected(`${r.id}.a`, "S1.com") && !lab.connected(`${r.id}.b`, "S1.com")) continue;
    const far = lab.connected(`${r.id}.a`, "S1.com") ? `${r.id}.b` : `${r.id}.a`;
    const c = lab.bench.parts.find((p) => p.kind === "electrolytic-cap" && lab.connected(`${p.id}.pos`, far) && lab.connected(`${p.id}.neg`, "B1.neg"));
    if (c) return { r: r.id, c: c.id };
  }
  return null;
}

/** This circuit's real τ in seconds (from the parts' actual values), and its nominal one (from their markings). */
function tau(lab: LabView): { real: number; nominal: number; ohms: number } | null {
  const t = timing(lab);
  if (!t) return null;
  const r = lab.actual(t.r, "actualOhms");
  const c = lab.actual(t.c, "actualFarads");
  const rn = lab.prop(t.r)?.["ohms"];
  const cn = lab.prop(t.c)?.["farads"];
  if (r === undefined || c === undefined || typeof rn !== "number" || typeof cn !== "number") return null;
  return { real: r * c, nominal: rn * cn, ohms: rn };
}

/** The note is within `tol` of this circuit's τ (resistor of `ohms`, if given); records how close, for tau-tamer. */
function measured(lab: LabView, note: string, key: string, tol: number, ohms?: number): boolean {
  const x = lab.note(note);
  const t = tau(lab);
  if (x === null || !t || (ohms !== undefined && t.ohms !== ohms)) return false;
  const err = Math.abs(x - t.real) / t.real;
  if (err > tol) return false;
  lab.shared[key] = err;
  return true;
}

export default defineLab({
  id: "rc-time-constant",
  title: "Counting in taus",
  bench: {
    board: "full",
    frame: ["desk:-104,-30", "desk:-30,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "slide-switch", at: "c4", params: { to: "b" }, locked: true, label: "Charge or discharge switch S1" },
      { id: "R1", kind: "resistor", at: "e5-e10", params: { ohms: 1000 }, label: "1 kΩ resistor R1" },
      { id: "C1", kind: "electrolytic-cap", at: "c10-rail-:10", params: { farads: 1000e-6, volts: 16 }, label: "1,000 µF capacitor C1" },
    ],
    wires: [
      { id: "W1", from: "a4", to: "rail+:4", color: "red" },
      { id: "W2", from: "a6", to: "rail-:6", color: "black" },
    ],
    tray: [
      { id: "R2", kind: "resistor", params: { ohms: 2200 }, count: 1, label: "2.2 kΩ" },
      { id: "R3", kind: "resistor", params: { ohms: 4700 }, count: 1, label: "4.7 kΩ" },
      { id: "R4", kind: "resistor", params: { ohms: 10000 }, count: 1, label: "10 kΩ" },
      { id: "C2", kind: "electrolytic-cap", params: { farads: 470e-6, volts: 16 }, count: 1, label: "470 µF" },
    ],
    instruments: [
      { kind: "meter", at: "desk:-178,22", rot: 16, mode: "dcv", tips: { red: "desk:-52,48", black: "desk:-40,54" } },
      {
        kind: "logger",
        traces: [{ label: "C1", volts: "C1.pos" }],
        start: [
          { part: "S1", to: "a" },
          { part: "S1", to: "b" },
        ],
        seconds: 15,
        range: [0, 10],
      },
    ],
  },
  mascot: {
    start: "Tau: the only Greek letter with a stopwatch.",
    hint: "Drag the logger's cursor to where the curve crosses the voltage you want.",
    success: "Sixty-three percent. Every single tau.",
    exit: "Same curve, different stretch. Capacitors are very consistent.",
  },
  triggers: {
    // Every τ the learner typed was within 5% of the circuit's own.
    "tau-within-5-percent": (lab) => ["e1", "e2", "e3", "e4"].every((k) => typeof lab.shared[k] === "number" && (lab.shared[k] as number) <= 0.05),
  },
  tasks: [
    {
      id: "find-tau",
      prompt:
        "Start with C1 empty. Slide S1 to charge and let the logger run. Find the moment C1 reaches **5.69 V**, which is 63.2% of 9 V. How many seconds after the slide was that?",
      note: { id: "tau1", label: "Charging τ", unit: "s" },
      goal: (lab) => measured(lab, "tau1", "e1", 0.1, 1000),
      hints: ["Use the cursor on the plot to find where the curve crosses 5.69 V.", "Each slide of S1 starts a new run, so the plot's time is time since the slide."],
      highlight: ["S1"],
      success: "About one second. And 1 kΩ × 1,000 µF = 1 s. That's no coincidence.",
    },
    {
      id: "discharge-tau",
      prompt: "Let it fill completely, then slide S1 back to discharge. When does C1 fall to **3.31 V**?",
      note: { id: "tau2", label: "Discharging τ", unit: "s" },
      goal: (lab) => measured(lab, "tau2", "e2", 0.1, 1000),
      hints: ["Wait until the curve flattens out near 9 V before you slide the switch back.", "3.31 V is 36.8% of 9 V: what's left after one τ."],
      success: "The same τ going down: it drops 63% of the way to zero in one tau.",
    },
    {
      id: "ten-times-slower",
      prompt: "Swap R1 for the **10 kΩ** resistor. Predict τ, then measure it the same way.",
      note: { id: "tau3", label: "τ with 10 kΩ", unit: "s" },
      goal: (lab) => measured(lab, "tau3", "e3", 0.1, 10000),
      hints: ["Empty C1 first (slide to discharge and wait), so the run starts from 0 V.", "This one takes a while: about ten seconds to reach 5.69 V."],
      success: "Ten times the resistance, ten times the time.",
    },
    {
      id: "hit-the-target",
      prompt: "Choose a resistor and a capacitor from the tray so τ is about **2.2 s**. Prove it with the logger.",
      note: { id: "tau4", label: "Your τ", unit: "s" },
      goal: (lab) => {
        const t = tau(lab);
        const x = lab.note("tau4");
        if (!t || x === null || t.nominal < 2.1 || t.nominal > 2.3 || Math.abs(x - 2.2) > 0.44) return false;
        lab.shared["e4"] = Math.abs(x - t.real) / t.real;
        return true;
      },
      hints: ["τ = R × C. Try pairs.", "There are two good answers on this tray."],
      success: "2.2 kΩ × 1,000 µF, or 4.7 kΩ × 470 µF. Different parts, same timing.",
      notice: "Measured τ lands close to the marked R × C, not exactly on it: electrolytics can be 20% off their printed value.",
    },
  ],
  solution: [
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 1.5 },
    { do: "note", id: "tau1", value: "1.01" },
    { do: "check", task: "find-tau" },
    { do: "wait", seconds: 5 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 1.5 },
    { do: "note", id: "tau2", value: "1.01" },
    { do: "check", task: "discharge-tau" },
    { do: "wait", seconds: 5 },
    { do: "remove", part: "R1" },
    { do: "place", part: "R4", kind: "resistor", at: "e5-e10", params: { ohms: 10000 } },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 2 },
    { do: "note", id: "tau3", value: "10.2" },
    { do: "check", task: "ten-times-slower" },
    { do: "flip", part: "S1", to: "b" },
    { do: "remove", part: "R4" },
    { do: "place", part: "R2", kind: "resistor", at: "e5-e10", params: { ohms: 2200 } },
    { do: "wait", seconds: 6 },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 3 },
    { do: "note", id: "tau4", value: "2.25" },
    { do: "check", task: "hit-the-target" },
  ],
});
