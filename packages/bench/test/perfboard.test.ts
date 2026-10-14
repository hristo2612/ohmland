// Perfboard: pads, the mirror, parts through holes, and the netlist that comes from joints, bends, links and bridges.

import { describe, expect, it } from "vitest";
import { createSimulation } from "@ohmland/sim";
import { benchToNetlist, connectivity } from "../src/netlist";
import * as ops from "../src/ops";
import { partPose } from "../src/layout";
import { emptyBench } from "../src/ops";
import { ghostsFilled, padLocal, padName, parsePad, padWorld, type JointRecord } from "../src/solder/perfboard";
import { addLink, bendLeg, stripEnd } from "../src/solder/ops";
import type { BenchState, PlacedPart } from "../src/types";

const GOOD: JointRecord = { kind: "pad", alloy: "leaded", volume: 1.5, wetted: 0.95, peakC: 260, moved: false, fedAt: "work", bridgeTo: null, lifted: false, coldTouch: false, flux: 0.4, verdict: "good" };
const COLD: JointRecord = { ...GOOD, wetted: 0.35, peakC: 190, verdict: "cold" };

/** The MP10 lamp on a 10 x 6 board: snap leads in A1 and F8, R1 A3 to A7, D1 C7 and C8, linked and bent underneath. */
function lampBoard(joints: Partial<Record<string, JointRecord>> = {}, opts: { tack?: boolean; flexed?: boolean } = {}): BenchState {
  const b = emptyBench(null);
  b.parts = [
    { id: "PB1", kind: "perfboard", params: { cols: 10, rows: 6, flipped: true, joints, ...opts }, pos: [0, 0], rot: 0 },
    { id: "BS1", kind: "battery", params: { snap: true, emf: 9.4, internalOhms: 1.7 }, pos: [-60, 0], rot: 0, holes: { pos: "PB1:A1", neg: "PB1:F8" } },
    { id: "R1", kind: "resistor", params: { ohms: 1000, tolerance: 0 }, pos: [0, 0], rot: 0, holes: { a: "PB1:A3", b: "PB1:A7" } },
    { id: "D1", kind: "led", params: { color: "red" }, pos: [0, 0], rot: 0, holes: { anode: "PB1:C7", cathode: "PB1:C8" } },
  ] as PlacedPart[];
  let next = addLink(b, "PB1", "A1", "A3")[0];
  next = bendLeg(next, "R1", "b", "C7");
  next = bendLeg(next, "D1", "cathode", "F8");
  return next;
}

const ALL = { A1: GOOD, A3: GOOD, C7: GOOD, F8: GOOD };

function glow(bench: BenchState): number {
  const sim = createSimulation();
  sim.load(benchToNetlist(bench).netlist);
  return sim.step(0.5).parts.D1?.glow ?? 0;
}

describe("perfboard pads", () => {
  it("names pads by row letter and column, and mirrors left to right when flipped", () => {
    expect(padName(3, 2)).toBe("B3");
    expect(parsePad("F10")).toEqual({ row: 6, col: 10 });
    const p = { cols: 10, rows: 6 };
    const a1 = padLocal(p, "A1", false)!;
    const a10 = padLocal(p, "A10", false)!;
    expect(padLocal(p, "A1", true)).toEqual([a10[0], a1[1]]);
    expect(padLocal(p, "F1", true)![1]).toBe(padLocal(p, "F1", false)![1]);
  });

  it("parts go in from the top through free holes; a flipped board takes none", () => {
    const b = emptyBench(null);
    b.parts = [
      { id: "PB1", kind: "perfboard", params: { cols: 10, rows: 6 }, pos: [0, 0], rot: 0 },
      { id: "D1", kind: "led", params: { color: "red" }, pos: [80, 0], rot: 0 },
    ] as PlacedPart[];
    const board = b.parts[0]!;
    const target = padWorld(board, "C4")!;
    const placed = ops.movePart(b, "D1", [target[0] + 1.27, target[2]]);
    const d1 = placed.parts.find((p) => p.id === "D1")!;
    expect(d1.holes).toEqual({ anode: "PB1:C4", cathode: "PB1:C5" });
    const pose = partPose(placed, d1);
    expect(pose.mount).toBe("board");
    expect(pose.perf).toBe("PB1");
    expect(pose.legs.anode![0]).toBeCloseTo(target[0]);
    // Flipped over, the LED is underneath: only its legs show, mirrored.
    const flipped = ops.setPartParams(placed, "PB1", { flipped: true });
    const under = partPose(flipped, flipped.parts.find((p) => p.id === "D1")!);
    expect(under.under).toBe(true);
    expect(under.legs.anode![0]).toBeCloseTo(-target[0]);
    const again = ops.movePart(flipped, "D1", [target[0], target[2] + 10]);
    expect(again.parts.find((p) => p.id === "D1")!.holes).toBeUndefined();
  });
});

describe("perfboard netlist", () => {
  it("nothing is joined until it is soldered", () => {
    expect(glow(lampBoard())).toBe(0);
    const conn = connectivity(lampBoard());
    expect(conn.same("pin:R1.b", "pin:D1.anode")).toBe(false);
  });

  it("tacked legs conduct, and sound joints make the lamp glow", () => {
    expect(glow(lampBoard({}, { tack: true }))).toBeGreaterThan(0.6);
    const b = lampBoard(ALL);
    expect(glow(b)).toBeGreaterThan(0.6);
    const conn = connectivity(b);
    expect(conn.same("pin:R1.b", "pin:D1.anode")).toBe(true);
    expect(conn.same("pin:BS1.pos", "pin:R1.a")).toBe(true);
    expect(conn.same("pin:PB1.C7", "pin:D1.anode")).toBe(true);
  });

  it("a cold joint conducts at rest and opens while the board is pressed", () => {
    const cold = lampBoard({ ...ALL, C7: COLD });
    expect(glow(cold)).toBeGreaterThan(0.6);
    expect(benchToNetlist(cold).netlist.parts.some((p) => p.id.startsWith("PB1:JC7") && p.kind === "wire")).toBe(true);
    expect(glow(lampBoard({ ...ALL, C7: COLD }, { flexed: true }))).toBe(0);
    // Sound joints do not mind.
    expect(glow(lampBoard(ALL, { flexed: true }))).toBeGreaterThan(0.6);
  });

  it("a bridge joins two neighbouring pads: here it shorts the LED", () => {
    const b = lampBoard({ ...ALL, C7: { ...GOOD, volume: 5, bridgeTo: "C8", verdict: "bridge" }, C8: GOOD });
    expect(connectivity(b).same("pin:D1.anode", "pin:D1.cathode")).toBe(true);
    expect(glow(b)).toBe(0);
  });

  it("a burnt joint with a lifted pad is open", () => {
    expect(glow(lampBoard({ ...ALL, C7: { ...GOOD, peakC: 440, lifted: true, verdict: "burnt" } }))).toBe(0);
  });

  it("bare legs crossing underneath touch", () => {
    // A bare link from C6 to C9 lies across D1's cathode leg, bent down from C8 to F8.
    const b = addLink(lampBoard(ALL), "PB1", "B6", "D9")[0];
    const conn = connectivity(b);
    expect(conn.same("pin:D1.cathode", "perf:PB1/L2")).toBe(true);
    const insulated = addLink(lampBoard(ALL), "PB1", "B6", "D9", true)[0];
    expect(connectivity(insulated).same("pin:D1.cathode", "perf:PB1/L2")).toBe(false);
  });

  it("the plan's ghosts are filled when every part sits in its holes", () => {
    const b = lampBoard(ALL);
    const board = b.parts[0] as PlacedPart & { kind: "perfboard" };
    expect(ghostsFilled(b, board, [{ id: "D1", kind: "led", legs: { anode: "C7", cathode: "C8" } }])).toBe(true);
    expect(ghostsFilled(b, board, [{ id: "D1", kind: "led", legs: { anode: "C8", cathode: "C7" } }])).toBe(false);
  });
});

describe("wall adapter, barrel jack and splices", () => {
  const jackBench = (centre: "plus" | "minus"): BenchState => {
    const b = emptyBench({ kind: "bb400" });
    b.parts = [
      { id: "J1", kind: "barrel-jack", params: {}, pos: [0, 0], rot: 0, holes: { tip: "bp4", sleeve: "bn4" } },
      { id: "AD1", kind: "wall-adapter", params: { volts: 9, amps: 1, type: "regulated", centre, into: "J1" }, pos: [-80, 60], rot: 0 },
      { id: "R1", kind: "resistor", params: { ohms: 1000, tolerance: 0 }, pos: [0, 0], rot: 0, holes: { a: "bp10", b: "c10" } },
      { id: "D1", kind: "led", params: { color: "red" }, pos: [0, 0], rot: 0, holes: { anode: "d10", cathode: "d11" } },
    ] as PlacedPart[];
    b.wires = [{ id: "W1", a: "a11", b: "bn11", color: "black" }];
    return b;
  };

  it("a centre-plus adapter lights the lamp; a centre-minus one puts minus on the plus rail", () => {
    const sim = createSimulation();
    const net = benchToNetlist(jackBench("plus"));
    expect(net.netlist.parts.find((p) => p.id === "AD1")).toMatchObject({ kind: "supply", regulated: true, emf: 9 });
    sim.load(net.netlist);
    const s = sim.step(0.5);
    expect(s.parts.D1!.glow).toBeGreaterThan(0.6);
    const rev = benchToNetlist(jackBench("minus"));
    sim.load(rev.netlist);
    const r = sim.step(0.5);
    expect(r.parts.D1!.glow ?? 0).toBeLessThan(0.02);
    expect(r.nodes[rev.nodeOf("hole:bp4")]! - r.nodes[rev.nodeOf("hole:bn4")]!).toBeLessThan(-8.5);
  });

  it("plugging and unplugging follows the plug's drag", () => {
    const b = jackBench("plus");
    const out = ops.moveFlyingLeg(b, "AD1", "plug", [-150, 150]);
    expect(out.parts.find((p) => p.id === "AD1")!.params).toMatchObject({ into: null });
    expect(benchToNetlist(out).netlist.parts.some((p) => p.kind === "supply")).toBe(false);
  });

  it("a soldered splice joins two wires; a stripped end in its jaws comes out clean at the right notch", () => {
    const b = emptyBench(null);
    b.parts = [
      { id: "HW1", kind: "hookup-wire", params: { color: "red", awg: 22, len: 80 }, pos: [-45, 0], rot: 0, ends: { a: [-85, 0], b: [-3, 0] } },
      { id: "HW2", kind: "hookup-wire", params: { color: "red", awg: 22, len: 80 }, pos: [45, 0], rot: 0, ends: { a: [2, 1], b: [85, 0] } },
    ] as PlacedPart[];
    let s = stripEnd(b, "HW1", "b", 22, "solid");
    s = stripEnd(s, "HW2", "a", 26, "solid");
    const hw2 = s.parts.find((p) => p.id === "HW2") as PlacedPart & { kind: "hookup-wire" };
    expect(hw2.params.ends?.a).toMatchObject({ nicked: true, clean: false });
    s = stripEnd(s, "HW2", "a", 22, "solid");
    expect(connectivity(s).same("pin:HW1.a", "pin:HW2.b")).toBe(false);
    const hw1 = s.parts.find((p) => p.id === "HW1") as PlacedPart & { kind: "hookup-wire" };
    const joined: BenchState = {
      ...s,
      parts: s.parts.map((p) => (p.id === "HW1" ? ({ ...hw1, params: { ...hw1.params, joints: { b: { ...GOOD, kind: "splice", volume: 4, with: "HW2.a" } } } } as PlacedPart) : p)),
    };
    expect(connectivity(joined).same("pin:HW1.a", "pin:HW2.b")).toBe(true);
  });
});
