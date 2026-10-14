import { describe, expect, it } from "vitest";
import { emptyBench } from "../src/core";
import { trayLeft } from "../src/tray";
import type { BenchState } from "../src/types";

const lead = (id: string, color: "red" | "green" | "black") => ({
  id,
  color,
  a: { to: null, pos: [0, 0] as [number, number] },
  b: { to: null, pos: [10, 0] as [number, number] },
});

describe("trayLeft", () => {
  it("counts test leads per colour when the item names one", () => {
    const bench: BenchState = { ...emptyBench(), leads: [lead("L1", "red")] } as BenchState;
    expect(trayLeft({ kind: "lead", params: { color: "red" }, count: 1 }, bench)).toBe(0);
    expect(trayLeft({ kind: "lead", params: { color: "green" }, count: 1 }, bench)).toBe(1);
    expect(trayLeft({ kind: "lead", count: 3 }, bench)).toBe(2);
  });

  it("counts parts by kind and the params the item sets", () => {
    const bench = { ...emptyBench(), parts: [{ id: "R1", kind: "resistor", params: { ohms: 470 }, pos: [0, 0], rot: 0 }] } as unknown as BenchState;
    expect(trayLeft({ kind: "resistor", params: { ohms: 470 }, count: 1 }, bench)).toBe(0);
    expect(trayLeft({ kind: "resistor", params: { ohms: 1000 }, count: 1 }, bench)).toBe(1);
    expect(trayLeft({ kind: "resistor", count: 2 }, bench)).toBe(1);
    expect(trayLeft({ kind: "resistor" }, bench)).toBeUndefined();
  });
});
