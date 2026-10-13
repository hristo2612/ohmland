import { describe, expect, it } from "vitest";
import { holeWorld } from "../src/board";
import * as ops from "../src/ops";
import type { BenchState } from "../src/types";

const board = { kind: "bb830" as const };
const at = (hole: string): [number, number] => holeWorld(board, hole)!;
const mid = (a: string, b: string): [number, number] => {
  const p = at(a);
  const q = at(b);
  return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
};

describe("placing parts on the board", () => {
  it("snaps a resistor's leads into holes four apart", () => {
    const [b, id] = ops.addPart(ops.emptyBench(board), "resistor", { ohms: 1000 }, { pos: [0, 0] });
    const placed = ops.movePart(b, id, mid("e10", "e14"));
    expect(placed.parts[0]!.holes).toEqual({ a: "e10", b: "e14" });
  });

  it("straddles the centre channel with a pushbutton", () => {
    const [b, id] = ops.addPart(ops.emptyBench(board), "pushbutton", {}, { pos: [0, 0] });
    const placed = ops.movePart(b, id, mid("e20", "f22"));
    expect(placed.parts[0]!.holes).toEqual({ a1: "e20", b1: "e22", a2: "f20", b2: "f22" });
  });

  it("refuses occupied holes and lies on the desk when nothing fits", () => {
    let b = ops.emptyBench(board);
    [b] = ops.addWire(b, "e30", "bp31", "red");
    const [b2, id] = ops.addPart(b, "led", {}, { pos: [0, 0] });
    const placed = ops.movePart(b2, id, mid("e30", "e31"));
    const holes = placed.parts[0]!.holes!;
    expect(holes.anode).not.toBe("e30");
    expect(holes.cathode).not.toBe("e30");
    const offBoard = ops.movePart(b2, id, [0, 200]);
    expect(offBoard.parts[0]!.holes).toBeUndefined();
    expect(offBoard.parts[0]!.pos).toEqual([0, 200]);
  });

  it("rotates a seated part about its centre and keeps it seated", () => {
    let [b, id] = ops.addPart(ops.emptyBench(board), "npn", {}, { pos: [0, 0] });
    b = ops.movePart(b, id, at("c41"));
    expect(b.parts[0]!.holes).toEqual({ e: "c40", b: "c41", c: "c42" });
    b = ops.rotatePart(b, id);
    expect(Object.values(b.parts[0]!.holes!).sort()).toEqual(["b41", "c41", "d41"]);
  });

  it("stretches a resistor between three and eight holes only", () => {
    let [b, id] = ops.addPart(ops.emptyBench(board), "resistor", {}, { pos: [0, 0] });
    b = ops.movePart(b, id, mid("a10", "a14"));
    const longer = ops.moveSpanLeg(b, id, "b", at("a17"));
    expect(longer.parts[0]!.holes).toEqual({ a: "a10", b: "a17" });
    const tooFar = ops.moveSpanLeg(b, id, "b", at("a25"));
    expect(tooFar.parts[0]!.holes!.b).toBe("a18");
    const tooShort = ops.moveSpanLeg(b, id, "b", at("a11"));
    expect(tooShort.parts[0]!.holes!.b).toBe("a13");
  });
});

describe("wires, clips and removal", () => {
  it("does not wire a hole twice", () => {
    let b = ops.emptyBench(board);
    let id: string | null;
    [b, id] = ops.addWire(b, "a5", "a9", "blue");
    expect(id).toBe("W1");
    [b, id] = ops.addWire(b, "a5", "j5", "blue");
    expect(id).toBeNull();
    expect(b.wires).toHaveLength(1);
  });

  it("drops clips and probes that were on a removed part", () => {
    let b: BenchState = ops.emptyBench(board);
    let rid: string;
    [b, rid] = ops.addPart(b, "resistor", {}, { pos: [0, 0] });
    b = ops.movePart(b, rid, mid("a10", "a14"));
    let lid: string;
    [b, lid] = ops.addLead(b, "red", [0, 80]);
    b = ops.clipLead(b, lid, "a", `pin:${rid}.a`);
    b = { ...b, meter: ops.defaultMeter() };
    b = ops.touchProbe(b, "red", `pin:${rid}.b`);
    b = ops.removePart(b, rid);
    expect(b.parts).toHaveLength(0);
    expect(b.leads[0]!.a.to).toBeNull();
    expect(b.meter!.probes.red.tip.to).toBeNull();
  });

  it("keeps one banana plug per socket", () => {
    let b: BenchState = { ...ops.emptyBench(board), meter: ops.defaultMeter() };
    b = ops.plugProbe(b, "red", "com");
    expect(b.meter!.probes.red.socket).toBe("com");
    expect(b.meter!.probes.black.socket).toBeNull();
  });
});
