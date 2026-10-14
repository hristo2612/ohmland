import { describe, expect, it } from "vitest";
import { createSimulation, type PartSpec } from "@ohmland/sim";
import { benchToNetlist } from "../src/netlist";
import { actionParams, defaultMeter, emptyBench, movePart, penStroke, seatPart, swapParts } from "../src/ops";
import { skinOhms } from "../src/parts";
import { holderOf } from "../src/seats";
import type { BenchState, PlacedPart } from "../src/types";

const part = (id: string, kind: PlacedPart["kind"], params: Record<string, unknown>, pos: [number, number] = [0, 0]): PlacedPart =>
  ({ id, kind, params, pos, rot: 0 }) as PlacedPart;

const lead = (id: string, a: string | null, b: string | null) => ({ id, color: "red" as const, a: { to: a, pos: [0, 0] as [number, number] }, b: { to: b, pos: [0, 0] as [number, number] } });

/** What the meter shows after a moment, with the probes on two points. */
function ohmsBetween(bench: BenchState, red: string, black: string, range: string): string {
  const meter = defaultMeter([200, 0]);
  meter.mode = "ohm";
  meter.range = range;
  meter.probes.red.tip.to = red;
  meter.probes.black.tip.to = black;
  const sim = createSimulation();
  sim.load(benchToNetlist({ ...bench, meter }).netlist);
  return (sim.step(0.5).parts["M1"]?.display ?? "").trim();
}

describe("holders", () => {
  it("seats a resistor dropped on the clips, joins its leads to the terminals, and pushes the old one out", () => {
    let b: BenchState = { ...emptyBench(null), parts: [part("H1", "holder", {}, [0, 0]), part("R1", "resistor", { ohms: 1500 }, [0, 60]), part("R2", "resistor", { ohms: 470 }, [60, 60])] };
    b = seatPart(b, "R1", "H1");
    expect(holderOf(b, "R1")?.holder.id).toBe("H1");
    const { nodeOf } = benchToNetlist(b, { leadOhms: 0 });
    expect(nodeOf("pin:R1.a")).toBe(nodeOf("pin:H1.a"));
    expect(nodeOf("pin:R1.b")).toBe(nodeOf("pin:H1.b"));
    // Dragging R2 onto the holder swaps it in.
    b = movePart(b, "R2", [0, 2]);
    expect(holderOf(b, "R2")?.holder.id).toBe("H1");
    expect(holderOf(b, "R1")).toBeNull();
    expect(Math.hypot(b.parts.find((p) => p.id === "R1")!.pos[1], 0)).toBeGreaterThan(20);
  });

  it("swaps two batteries with their clips and probe tips", () => {
    let b: BenchState = {
      ...emptyBench(null),
      parts: [part("B1", "battery", { emf: 9.4 }, [0, 0]), part("B2", "battery", { emf: 8.6 }, [100, -60])],
      leads: [lead("TL1", "pin:B1.pos", null)],
      meter: defaultMeter(),
    };
    b.meter!.probes.black.tip.to = "pin:B1.neg";
    b = swapParts(b, "B2", "B1");
    expect(b.parts.find((p) => p.id === "B2")!.pos).toEqual([0, 0]);
    expect(b.parts.find((p) => p.id === "B1")!.pos).toEqual([100, -60]);
    expect(b.leads[0]!.a.to).toBe("pin:B2.pos");
    expect(b.meter!.probes.black.tip.to).toBe("pin:B2.neg");
  });
});

describe("material props", () => {
  it("reads skin as two contacts plus the skin between the marks", () => {
    const b: BenchState = { ...emptyBench(null), parts: [part("P1", "skin", { moisture: "wet", pressure: "light" })] };
    // Wet, light pressure: 18 kΩ per contact and 5 kΩ per cm.
    expect(skinOhms("wet", "light", 2)).toBe(46_000);
    expect(Number(ohmsBetween(b, "pin:P1.m0", "pin:P1.m2", "200k"))).toBeCloseTo(46.0, 0);
    expect(Number(ohmsBetween(b, "pin:P1.m0", "pin:P1.m4", "200k"))).toBeCloseTo(56.0, 0);
  });

  it("makes a pencil line whose resistance grows with length and falls with layers", () => {
    const card = (length: number, layers: number) => ({ ...emptyBench(null), parts: [part("P1", "card", { length, layers, wide: false })] });
    expect(Number(ohmsBetween(card(5, 1), "pin:P1.p0", "pin:P1.p10", "200k"))).toBeCloseTo(102, 0);
    expect(Number(ohmsBetween(card(5, 1), "pin:P1.p0", "pin:P1.p5", "200k"))).toBeCloseTo(52, 0);
    expect(Number(ohmsBetween(card(5, 2), "pin:P1.p0", "pin:P1.p10", "200k"))).toBeCloseTo(52, 0);
    // Past the end of the line the probe touches bare card.
    expect(ohmsBetween(card(5, 1), "pin:P1.p0", "pin:P1.p14", "2M")).toBe("OL");
  });

  it("lowers a cup's resistance with each pinch of salt", () => {
    const cup = (salt: number) => ({ ...emptyBench(null), parts: [part("WC1", "cup", { water: "tap", ohms: 40_000, salt })] });
    expect(Number(ohmsBetween(cup(0), "pin:WC1.a", "pin:WC1.b", "200k"))).toBeCloseTo(40.0, 0);
    // A pinch is a parallel 7.5 kΩ: 40 kΩ with one is about 6.3 kΩ, with two about 3.4 kΩ.
    expect(Number(ohmsBetween(cup(1), "pin:WC1.a", "pin:WC1.b", "20k"))).toBeCloseTo(6.32, 1);
    expect(Number(ohmsBetween(cup(2), "pin:WC1.a", "pin:WC1.b", "20k"))).toBeCloseTo(3.43, 1);
    expect(actionParams({ ...cup(9) }, "WC1", "salt")).toEqual({ salt: 10 });
    expect(actionParams({ ...cup(10) }, "WC1", "salt")).toEqual({ salt: 10 });
  });

  it("draws, shades and extends a pencil line stroke by stroke", () => {
    expect(penStroke({ length: 0, layers: 0 }, 5)).toEqual({ length: 5, layers: 1 });
    expect(penStroke({ length: 5, layers: 1 }, 5)).toEqual({ length: 5, layers: 2 });
    expect(penStroke({ length: 5, layers: 2 }, 3)).toEqual({ length: 5, layers: 2 });
    expect(penStroke({ length: 5, layers: 4 }, 7)).toEqual({ length: 7, layers: 4 });
  });

  it("makes a fruit cell from copper and zinc, nothing from one metal, and a short when they touch", () => {
    const fruit = (left: string, right: string, touching = false): PartSpec | undefined => {
      let b: BenchState = {
        ...emptyBench(null),
        parts: [part("FC1", "fruit", { touching }), part("E1", "electrode", { metal: left }, [-60, 50]), part("E2", "electrode", { metal: right }, [60, 50])],
      };
      b = seatPart(seatPart(b, "E1", "FC1", "left"), "E2", "FC1", "right");
      const { netlist, nodeOf } = benchToNetlist(b);
      const s = netlist.parts.find((p) => p.id === "FC1");
      if (s?.kind === "cell") expect(s.pins.pos).toBe(nodeOf(left === "copper" ? "pin:E1.tip" : "pin:E2.tip"));
      return s;
    };
    const cell = fruit("zinc", "copper");
    expect(cell?.kind === "cell" && cell.emf).toBeGreaterThan(0.88);
    expect(cell?.kind === "cell" && cell.emf).toBeLessThan(0.96);
    const same = fruit("copper", "copper");
    expect(same?.kind === "cell" && Math.abs(same.emf)).toBeLessThan(0.01);
    const shorted = fruit("copper", "zinc", true);
    expect(shorted?.kind === "cell" && shorted.internalOhms).toBe(1);
  });
});
