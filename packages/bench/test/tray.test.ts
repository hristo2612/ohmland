import { describe, expect, it } from "vitest";
import { emptyBench } from "../src/core";
import { trayLeft } from "../src/tray";
import { createBenchStore } from "../src/store";
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

describe("tray ids", () => {
  it("gives a tray item's parts the id it names, then the next ones counting on from it", () => {
    // The siren's tray: R8, two of them; R5 is free but the lab names the second one R9.
    const store = createBenchStore({ ...emptyBench(null), parts: [] } as BenchState);
    const add = () => store.getState().addPart("resistor", { ohms: 100_000 }, { pos: [0, 0] }, "R8");
    expect([add(), add()]).toEqual(["R8", "R9"]);
    expect(store.getState().addLead("red", [0, 0], "TL4")).toBe("TL4");
    expect(store.getState().addLead("red", [0, 0], "TL4")).toBe("TL5");
  });
});
