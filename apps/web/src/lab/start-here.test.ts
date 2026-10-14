/**
 * The lab API the Start here unit needs (docs/LABS.md): gates, sealed boxes, overlays, the tracer, tags, the torn
 * drawing and a battery's starting charge. Small labs, replayed headlessly with the real simulator like every
 * lab's solution, so each helper is proven against a running circuit and the solution steps that drive it.
 */
import { describe, expect, it } from "vitest";
import { buildBench } from "./build";
import { defineLab, type LabDefinition } from "./define";
import { replayLab } from "./replay";

const lamp = (first = "B1.pos") => ({
  board: "none" as const,
  parts: [
    { id: "B1", kind: "battery" as const, at: "desk:-80,0", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
    { id: "S1", kind: "toggle-switch" as const, at: "desk:-10,-50", params: { base: true, to: "b" as const } },
    { id: "R1", kind: "resistor" as const, at: "desk:60,-40", params: { ohms: 1000 } },
    { id: "D1", kind: "led" as const, at: "desk:60,30", rot: 180, params: { color: "red" as const, maxmA: 50 } },
  ],
  leads: [{ id: "TL1", from: first, to: "S1.com" }, "S1.b -> R1.a", { id: "TL3", from: "R1.b", to: "D1.anode" }, { id: "TL4", from: "D1.cathode", to: "B1.neg" }],
  tray: [],
  instruments: [],
});

function run(lab: LabDefinition) {
  const r = replayLab(lab);
  expect(r.problems, "steps that did not apply").toEqual([]);
  expect(r.failedChecks, "checkpoints not done in time").toEqual([]);
  expect(r.missing, "required tasks never done").toEqual([]);
  return r;
}

describe("Start here lab API", () => {
  it("the dark lamp: a clip on the wrapper, the tracer stopping there, then the loop closed", () => {
    const lab = defineLab({
      id: "t-dark-lamp",
      title: "t",
      bench: { ...lamp("wrap:B1"), overlays: { offer: ["flow"] } },
      tasks: [
        { id: "gap", prompt: "", hints: [], success: "", goal: (l) => l.view("trace") && l.trace("B1.neg").gap === "pin:B1.wrap" && !l.isLit("D1") },
        { id: "fix", prompt: "", hints: [], success: "", goal: (l) => l.isLit("D1") && l.trace("B1.neg").closed },
      ],
      solution: [{ do: "trace", from: "B1.neg" }, { do: "check", task: "gap" }, { do: "clip", lead: "TL1", end: "a", to: "B1.pos" }, { do: "check", task: "fix" }],
    });
    const built = buildBench(lab.bench);
    expect(built.warnings).toEqual([]);
    expect(built.bench.leads.find((l) => l.id === "TL1")!.a.to).toBe("pin:B1.wrap");
    run(lab);
  });

  it("the counting gates: clipped on from the tray, same flow either side of the lamp, ticking, flow dots on", () => {
    const lab = defineLab({
      id: "t-gates",
      title: "t",
      bench: { ...lamp(), tray: [{ id: "G1", kind: "gate" }, { id: "G2", kind: "gate" }], overlays: { flow: "current" } },
      tasks: [
        { id: "first-gate", prompt: "", hints: [], success: "", goal: (l) => l.gate("G1") > 0.001 && l.view("flow") },
        {
          id: "same",
          prompt: "",
          hints: [],
          success: "",
          goal: (l) => l.gate("G2") > 0.001 && Math.abs(l.gate("G1") - l.gate("G2")) < 1e-5 && (l.stats("gate:G2", 0.5)?.min ?? 0) > 0.001,
        },
        { id: "ticks", prompt: "", hints: [], success: "", goal: (l) => l.gateTicks("G1") > 3 },
        { id: "electrons", prompt: "", hints: [], success: "", goal: (l) => l.view("electrons") },
        { id: "unit", prompt: "", hints: [], success: "", goal: (l) => l.gateUnit("G1") === "mA" },
      ],
      solution: [
        { do: "place", part: "G1", kind: "gate", at: "lead:TL3" },
        { do: "check", task: "first-gate" },
        { do: "place", part: "G2", kind: "gate", at: "lead:TL4@0.4" },
        { do: "wait", seconds: 0.6 },
        { do: "check", task: "same" },
        { do: "wait", seconds: 1 },
        { do: "check", task: "ticks" },
        { do: "view", name: "electrons", on: true },
        { do: "check", task: "electrons" },
        { do: "param", part: "G1", params: { mode: "number", unit: "mA" } },
        { do: "check", task: "unit" },
      ],
    });
    run(lab);
  });

  it("two boxes, one lamp: dark on the AA, lit on the 9 V, push view, lids open", () => {
    const lab = defineLab({
      id: "t-boxes",
      title: "t",
      bench: {
        board: "none",
        parts: [
          { id: "BOXA", kind: "box", at: "desk:-110,0", params: { label: "A", wiring: { "s1.pos": "t1", "s1.neg": "t2" } } },
          { id: "X1", kind: "battery", at: "in:BOXA.s1", params: { size: "aa", emf: 1.58, internalOhms: 0.15 } },
          { id: "BOXB", kind: "box", at: "desk:10,0", params: { label: "B", wiring: { "s1.pos": "t1", "s1.neg": "t2" } } },
          { id: "B1", kind: "battery", at: "in:BOXB.s1", params: { emf: 9.4, internalOhms: 1.7 } },
          { id: "R1", kind: "resistor", at: "desk:-40,80", params: { ohms: 1000 } },
          { id: "D1", kind: "led", at: "desk:30,80", params: { color: "red", maxmA: 50 } },
        ],
        leads: [{ id: "TL1", from: "BOXA.t1", to: "R1.a", color: "red" }, "R1.b -> D1.anode", { id: "TL3", from: "D1.cathode", to: "BOXA.t2", color: "black" }],
        tray: [],
        instruments: [],
        overlays: { offer: ["push"] },
      },
      tasks: [
        { id: "box-a-dark", prompt: "", hints: [], success: "", goal: (l) => l.connected("TL1.a", "BOXA.t1") && l.heldFor(0.5, (l.part("D1")?.glow ?? 0) < 0.05) },
        { id: "box-b-lit", prompt: "", hints: [], success: "", goal: (l) => l.isLit("D1") },
        { id: "push-view", prompt: "", hints: [], success: "", goal: (l) => l.view("push") },
        { id: "open-boxes", prompt: "", hints: [], success: "", goal: (l) => l.lidOpen("BOXA") && l.lidOpen("BOXB") },
      ],
      solution: [
        { do: "wait", seconds: 0.6 },
        { do: "check", task: "box-a-dark" },
        { do: "clip", lead: "TL1", end: "a", to: "BOXB.t1" },
        { do: "clip", lead: "TL3", end: "b", to: "BOXB.t2" },
        { do: "check", task: "box-b-lit" },
        { do: "view", name: "push", on: true },
        { do: "check", task: "push-view" },
        { do: "param", part: "BOXA", params: { lid: true } },
        { do: "param", part: "BOXB", params: { lid: true } },
        { do: "check", task: "open-boxes" },
      ],
    });
    expect(buildBench(lab.bench).warnings).toEqual([]);
    run(lab);
  });

  it("the tired battery: a starting charge runs down in a time-lapse; the AA cut open", () => {
    const lab = defineLab({
      id: "t-tired",
      title: "t",
      bench: {
        ...lamp(),
        parts: [...lamp().parts.map((p) => (p.id === "B1" ? { ...p, params: { ...p.params, charge: 0.08 } } : p)), { id: "XA", kind: "battery", at: "desk:-150,60", params: { size: "aa", emf: 1.58, internalOhms: 0.15 } }],
        controls: [{ id: "speed", label: "Speed", key: "speed", min: 1, max: 3600, value: 1 }],
      },
      tasks: [
        { id: "start", prompt: "", hints: [], success: "", goal: (l) => (l.charge("B1") ?? 1) < 0.081 && l.isLit("D1") },
        { id: "peek", prompt: "", hints: [], success: "", goal: (l) => l.view("xray:XA") },
      ],
      solution: [{ do: "check", task: "start" }, { do: "param", part: "XA", params: { xray: true } }, { do: "check", task: "peek" }],
    });
    run(lab);
  });

  it("the clingy balloon: rubbed, it lifts paper bits and sticks to the wall; a metal spoon rubbed does nothing", () => {
    const lab = defineLab({
      id: "t-static",
      title: "t",
      bench: {
        board: "none",
        parts: [
          { id: "WL1", kind: "wall", at: "desk:0,-100" },
          { id: "BL1", kind: "balloon", at: "desk:-80,20" },
          { id: "SF1", kind: "scarf", at: "desk:-60,90" },
          { id: "PB1", kind: "paper", at: "desk:60,60" },
          { id: "MS1", kind: "sample", at: "desk:140,40", params: { material: "metal-spoon" } },
        ],
        tray: [],
        instruments: [],
      },
      tasks: [
        { id: "rub-it", prompt: "", hints: [], success: "", goal: (l) => l.static("BL1") < -3 && l.static("SF1") > 3 },
        { id: "paper-hop", prompt: "", hints: [], success: "", goal: (l) => l.lifted("PB1") === "BL1" },
        { id: "stick-it", prompt: "", hints: [], success: "", goal: (l) => l.heldFor(1, l.stuck("BL1")) },
        { id: "spoon", prompt: "", hints: [], success: "", goal: (l) => l.static("MS1") === 0 && l.task("stick-it") === "done" },
      ],
      solution: [
        { do: "rub", part: "BL1", on: "SF1" },
        { do: "check", task: "rub-it" },
        { do: "move", part: "BL1", at: "desk:60,40" },
        { do: "check", task: "paper-hop" },
        { do: "move", part: "BL1", at: "desk:0,-74" },
        { do: "wait", seconds: 1.2 },
        { do: "check", task: "stick-it" },
        { do: "rub", part: "MS1", on: "SF1" },
        { do: "check", task: "spoon" },
      ],
    });
    run(lab);
  });

  it("prefix tags tap open, the knob box's tag too, and the torn drawing mends the right way round", () => {
    const lab = defineLab({
      id: "t-tags",
      title: "t",
      bench: {
        board: "none",
        parts: [
          { id: "KB", kind: "box", at: "desk:-80,0", params: { knob: true, tag: "10 kΩ" } },
          { id: "L1", kind: "tag", at: "desk:40,-60", params: { text: "20 mA" } },
          { id: "CARD", kind: "schematic", at: "desk:0,80", params: { symbols: [{ kind: "battery", part: "B1" }, { kind: "resistor", part: "R1" }, { kind: "led", part: "D1" }], torn: 2 } },
          { id: "PC", kind: "piece", at: "desk:120,80", params: { symbol: "led" } },
          { id: "B1", kind: "battery", at: "desk:-150,0" },
        ],
        tray: [],
        instruments: [],
      },
      tasks: [
        { id: "kilo", prompt: "", hints: [], success: "", goal: (l) => l.tagShown("KB") === "10,000 Ω" && l.tagShown("L1") === "0.02 A" },
        { id: "wrong-way", prompt: "", hints: [], success: "", goal: (l) => l.drawing("CARD")!.pieces[0]!.seated && !l.drawing("CARD")!.complete },
        { id: "mended", prompt: "", hints: [], success: "", goal: (l) => l.drawing("CARD")!.complete },
      ],
      solution: [
        { do: "param", part: "KB", params: { tagAlt: true } },
        { do: "param", part: "L1", params: { alt: true } },
        { do: "check", task: "kilo" },
        { do: "move", part: "PC", at: "in:CARD" },
        { do: "check", task: "wrong-way" },
        { do: "param", part: "PC", params: { turn: 90 } },
        { do: "check", task: "mended" },
      ],
    });
    run(lab);
  });
});
