import { describe, expect, it } from "vitest";
import { benchOps, bendLeg, createStation, emptyBench, feedAt, placeIron, stepStation, stripEnd, type BenchState, type PlacedPart } from "@ohmland/bench/core";
import { solderLab } from "./solder";

/** MP10's lamp: the plan card, the board copper side up, legs bent to meet in tack mode. */
function mirrorBoard(tack = true): BenchState {
  const b = emptyBench(null);
  b.parts = [
    { id: "ST1", kind: "solder-station", params: { on: true, setC: 330, iron: "stand" }, pos: [-150, 0], rot: 0 },
    { id: "SD1", kind: "solder-spool", params: { alloy: "leaded" }, pos: [-150, 70], rot: 0 },
    { id: "PB1", kind: "perfboard", params: { cols: 10, rows: 6, flipped: true, tack, plan: "PC1" }, pos: [0, 0], rot: 0 },
    { id: "BS1", kind: "battery", params: { snap: true, emf: 9.4 }, pos: [-40, 60], rot: 0, holes: { pos: "PB1:A1", neg: "PB1:F8" } },
    { id: "R1", kind: "resistor", params: { ohms: 1000 }, pos: [0, 0], rot: 0, holes: { a: "PB1:A1", b: "PB1:A5" } },
    { id: "D1", kind: "led", params: { color: "red" }, pos: [0, 0], rot: 0, holes: { anode: "PB1:C7", cathode: "PB1:C8" } },
    {
      id: "PC1",
      kind: "plan-card",
      params: {
        cols: 10,
        rows: 6,
        ghosts: [
          { id: "R1", kind: "resistor", legs: { a: "A1", b: "A5" } },
          { id: "D1", kind: "led", legs: { anode: "C7", cathode: "C8" } },
        ],
        lines: [
          ["A5", "C7"],
          ["C8", "F8"],
        ],
      },
      pos: [100, 0],
      rot: 0,
    },
  ] as PlacedPart[];
  return b;
}

describe("lab.solder", () => {
  it("a plan is matched once the parts sit on their ghosts and the bent legs meet its lines", () => {
    let b = mirrorBoard();
    expect(solderLab(b, null).board("PB1")!.matchesPlan("PC1")).toBe(false);
    b = bendLeg(b, "R1", "b", "C7");
    expect(solderLab(b, null).plan("PC1")!.joined).toEqual([1]);
    b = bendLeg(b, "D1", "cathode", "F8");
    const lab = solderLab(b, null);
    expect(lab.board("PB1")!.matchesPlan("PC1")).toBe(true);
    expect(lab.board("PB1")!.legs.find((l) => l.part === "R1" && l.leg === "b")?.bentTo).toBe("C7");
    // Without tack mode nothing meets until it is soldered.
    expect(solderLab(bendLeg(bendLeg(mirrorBoard(false), "R1", "b", "C7"), "D1", "cathode", "F8"), null).board("PB1")!.matchesPlan("PC1")).toBe(false);
  });

  it("reads the iron, the spool and a joint as it is made and once it has set", () => {
    let bench = mirrorBoard(false);
    let st = createStation(bench);
    ({ bench, station: st } = placeIron(bench, st, "PB1.C7"));
    for (let k = 0; k < 60; k++) ({ bench, station: st } = stepStation(bench, st, 1 / 30));
    let lab = solderLab(bench, st);
    expect(lab.iron).toMatchObject({ on: true, at: "PB1.C7", inStand: false });
    expect(lab.solderKind).toBe("leaded");
    expect(lab.meltC).toBe(183);
    expect(lab.temp("joint:PB1.C7")).toBeGreaterThan(183);
    st = feedAt(st, "PB1.C7");
    for (let k = 0; k < 30; k++) ({ bench, station: st } = stepStation(bench, st, 1 / 30));
    st = feedAt(st, null);
    expect(solderLab(bench, st).joint("PB1.C7")!.state).toBe("molten");
    ({ bench, station: st } = placeIron(bench, st, "stand"));
    for (let k = 0; k < 200; k++) ({ bench, station: st } = stepStation(bench, st, 1 / 30));
    lab = solderLab(bench, st);
    expect(lab.joint("PB1.C7")).toMatchObject({ state: "set", verdict: "good", fedAt: "work" });
    // A headless replay without the station still reads what the bench keeps.
    expect(solderLab(bench, null).joint("PB1.C7")!.verdict).toBe("good");
    expect(lab.board("PB1")!.joints.C7).toBe("good");
  });

  it("reads strips, clips, tubes and adapters", () => {
    let b = emptyBench(null);
    b.parts = [
      { id: "HW1", kind: "hookup-wire", params: { color: "red", awg: 22, len: 80 }, pos: [0, 0], rot: 0, ends: { a: [-40, 0], b: [40, 0] } },
      { id: "HS1", kind: "heat-sink-clip", params: { metal: "steel" }, pos: [0, 40], rot: 0 },
      { id: "T1", kind: "heat-shrink", params: { size: 3.2 }, pos: [0, 30], rot: 0 },
      { id: "AD1", kind: "wall-adapter", params: { volts: 9, amps: 1, type: "unregulated", centre: "minus", into: null }, pos: [0, 80], rot: 0 },
    ] as PlacedPart[];
    b = stripEnd(b, "HW1", "a", 26, "solid");
    b = stripEnd(b, "HW1", "a", 22, "solid");
    const lab = solderLab(b, null);
    expect(lab.strip("HW1")).toMatchObject({ end: "a", notch: 22, clean: true, mm: 10 });
    expect(lab.strip("HW1")!.tries.some((t) => t.notch === 26 && t.nicked)).toBe(true);
    expect(lab.clip("HS1")).toEqual({ on: null, mm: null, metal: "steel" });
    // Slid onto the wire from its free end.
    const onWire = benchOps.movePart(b, "T1", [10, 1]);
    expect(solderLab(onWire, null).tube("T1")).toMatchObject({ on: "HW1", shrink: 0, split: false });
    expect(lab.adapter("AD1")).toEqual({ into: null, type: "unregulated", centre: "minus", volts: 9 });
  });
});
