/**
 * The Unit 4 LabView helpers on canned snapshots: chip pins by number and name, logic levels, widths and duty (exact
 * from the edge log, or from the snapshots), button and count history, edges, views and refused parts.
 */
import { describe, expect, it } from "vitest";
import { emptyBench, type BenchNetlist, type BenchState, type PlacedPart } from "@ohmland/bench/core";
import type { Netlist, PartState, Snapshot } from "@ohmland/sim";
import { EdgeTrack, type Edge } from "./signals";
import { createLabView, type LabViewInput } from "./view";
import { watchSpecs } from "./watch";

const chip = (id: string, model: string, holes: Record<string, string>): PlacedPart => ({ id, kind: "chip", params: { model }, pos: [0, 0], rot: 0, holes }) as unknown as PlacedPart;
const across = (c: number, n = 8): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let k = 1; k <= n / 2; k++) out[String(k)] = `e${c + k - 1}`;
  for (let k = n / 2 + 1; k <= n; k++) out[String(k)] = `f${c + n - k}`;
  return out;
};

const NET: Netlist = {
  parts: [
    { id: "U1", kind: "timer555", pins: { gnd: "gnd", trig: "tr", out: "out", reset: "vcc", ctrl: "cv", thresh: "th", dis: "th", vcc: "vcc" } },
    { id: "U3", kind: "logic", model: "74HC08", pins: { vcc: "v5", gnd: "gnd", a1: "ka", b1: "kb", y1: "y" } },
    { id: "U4", kind: "logic", model: "74HC393", pins: { vcc: "v5", gnd: "gnd", clk1: "y" } },
  ],
};
const net: BenchNetlist = { netlist: NET, nodeOf: (a) => `float:${a}`, warnings: [] };

const part = (p: Partial<PartState>): PartState => ({ i: 0, v: 0, p: 0, temp: 25, health: "ok", ...p });

const snap = (t: number, over: { nodes?: Record<string, number>; parts?: Record<string, PartState> } = {}): Snapshot => ({
  t,
  nodes: { vcc: 9, tr: 9, th: 4.2, out: 7.6, cv: 6, v5: 5, ka: 5, kb: 0.1, y: 0, n1: 4, ...over.nodes },
  parts: {
    U1: part({ extra: { supply: 9, powered: true, output: "high", latch: true } }),
    U3: part({ extra: { a1: "H", b1: "L", y1: "L", powered: true } }),
    ...over.parts,
  },
  events: [],
});

const bench = (): BenchState => ({ ...emptyBench({ kind: "bb400" }), parts: [chip("U1", "555", across(12))] });

const view = (input: Partial<LabViewInput> = {}) => createLabView({ bench: bench(), net, simNet: net, snapshot: snap(1), events: [], ...input });

describe("chip pins", () => {
  it("volts and levels by number, simulator name or the lesson's word", () => {
    const lab = view();
    expect(lab.volts("U1.6")).toBe(4.2);
    expect(lab.volts("U1.threshold")).toBe(4.2);
    expect(lab.volts("U1.thresh", "U1.minus")).toBe(4.2);
    expect(lab.pin("U1", "trigger")).toEqual({ n: 2, name: "trig", node: "tr", volts: 9, level: "H" });
    expect(lab.pin("U3", "1Y")).toMatchObject({ n: 3, level: "L" });
    expect(lab.pin("U1", 12)).toBeNull();
    expect(lab.pin("R9", 1)).toBeNull();
  });

  it("logic levels: a logic chip's own reading, a 555 pin against its supply, a node by its chip's supply or the bench's", () => {
    const lab = view();
    expect([lab.logic("U3.1"), lab.logic("U3.2"), lab.logic("U3.3")]).toEqual(["H", "L", "L"]);
    // 7.6 V of 9 V is high; 4.2 V is in between.
    expect([lab.logic("U1.3"), lab.logic("U1.6")]).toEqual(["H", "X"]);
    // "ka" feeds U3 (5 V): high. "n1" touches no chip: 4 V of the bench's 9 V is undefined.
    expect([lab.logic("ka"), lab.logic("n1")]).toEqual(["H", "X"]);
    const off = view({ snapshot: snap(1, { parts: { U3: part({ extra: { a1: "Z", y1: "Z", powered: false } }) } }) });
    expect(off.logic("U3.3")).toBe("Z");
  });

  it("joins pins through the netlist: pins 6 and 7 tied, pins 2 and 6 not", () => {
    const lab = view();
    expect(lab.connected("U1.6", "U1.discharge")).toBe(true);
    expect(lab.connected("U1.2", "U1.6")).toBe(false);
  });

  it("reads how the chip sits", () => {
    expect(view().chipSeat("U1")).toMatchObject({ straddles: true, pin1: "left", turned: false });
  });
});

describe("history: presses, counts, widths and duty", () => {
  // Ten seconds: S1 held from 2.0 to 2.5 s; a counter stepping 3, 4, 5, 0; pin 3 high 0.54 s of every 1.01 s.
  const history: Snapshot[] = [];
  for (let k = 0; k <= 300; k++) {
    const t = k / 30;
    const high = t % 1.01 < 0.54;
    history.push(
      snap(t, {
        nodes: { out: high ? 7.6 : 0.1 },
        parts: {
          S1: part({ closed: t >= 2 - 1e-9 && t < 2.5 }),
          U4: part({ extra: { count1: t < 3 ? 3 : t < 5 ? 4 : t < 7 ? 5 : 0 } }),
        },
      }),
    );
  }
  const last = history[history.length - 1]!;

  it("presses, the values a counter went through, logic as 1 and 0", () => {
    const lab = view({ history, snapshot: last });
    expect(lab.presses("S1")).toHaveLength(1);
    expect(lab.presses("S1")[0]!.start).toBeCloseTo(2, 6);
    expect(lab.presses("S1")[0]!.end).toBeCloseTo(2.5, 1);
    expect(lab.values("count:U4")).toEqual([3, 4, 5, 0]);
    expect(lab.history("logic:U1.3", 0.2).every(([, v]) => v === 0 || v === 1)).toBe(true);
    expect(lab.history("closed:S1").some(([, v]) => v === 1)).toBe(true);
  });

  it("widths and duty from the snapshots, within a frame", () => {
    const lab = view({ history, snapshot: last });
    for (const w of lab.widths("volts:U1.3")) expect(w).toBeGreaterThan(0.5);
    const d = lab.duty("volts:U1.3")!;
    expect(d.period).toBeCloseTo(1.01, 1);
    expect(d.duty).toBeCloseTo(0.535, 1);
    expect(lab.edges("U1.3").exact).toBe(false);
  });

  it("exact from the edge log when the pin is watched", () => {
    const edges: Edge[] = [];
    for (let k = 0; k < 9; k++) edges.push([k * 1.0123, 1], [k * 1.0123 + 0.5412, 0]);
    const tr = new EdgeTrack(0, false);
    tr.push({ rises: 9, falls: 9, high: false, log: edges, level: 4.5 });
    const lab = view({ history, snapshot: last, tracks: new Map([["U1.3", tr]]) });
    expect(lab.widths("volts:U1.output")[0]).toBeCloseTo(0.5412, 12);
    expect(lab.duty("volts:U1.3")).toMatchObject({ cycles: 8 });
    expect(lab.duty("volts:U1.3")!.period).toBeCloseTo(1.0123, 12);
    expect(lab.edges("U1.3")).toMatchObject({ rises: 9, falls: 9, exact: true, high: false });
    expect(lab.edges("U1.out", 2).times.length).toBeLessThan(18);
  });
});

describe("views, refused parts and watch specs", () => {
  it("a view is on while the session says so; refused parts from the runtime and the bench", () => {
    // U8: a surface mount chip lying on the board (its legs are too close together for the holes).
    const soic = { id: "U8", kind: "chip", params: { model: "555", package: "soic" }, pos: [0, 0], rot: 0 } as unknown as PlacedPart;
    const lab = view({ panelViews: new Set(["xray:U1"]), rejected: ["U9"], bench: { ...bench(), parts: [...bench().parts, soic] } });
    expect(lab.view("xray:U1")).toBe(true);
    expect(lab.view("xray:U2")).toBe(false);
    expect([...lab.bench.rejected].sort()).toEqual(["U8", "U9"]);
    expect(view().bench.rejected).toEqual([]);
  });

  it("watches chip pins on their netlist node at half their chip's supply, or at a fixed level; one watch per key", () => {
    const specs = watchSpecs(bench(), net, { ck: "U4.1" }, [{ node: "U1.trig" }, { node: "U1.2" }, { node: "U1.3", level: 4 }, { node: "ck" }, { node: "nowhere.x" }]);
    expect(specs).toEqual([
      { id: "U1.2", node: "tr", of: "vcc" },
      { id: "U1.3@4", node: "out", level: 4 },
      { id: "U4.1", node: "y", of: "v5" },
    ]);
  });
});
