import { describe, expect, test } from "vitest";
import { createSimulation, type EdgeLog, type Netlist, type PartSpec, type Snapshot } from "../src";
import { SimulationImpl } from "../src/simulation";
import { astable555, resistor } from "./circuits";

const supply5: PartSpec = { id: "P5", kind: "cell", pins: { pos: "v5", neg: "gnd" }, emf: 5, internalOhms: 0.05 };
const chip = (id: string, model: string, pins: Record<string, string>): PartSpec => ({ id, kind: "logic", model, pins: { vcc: "v5", gnd: "gnd", ...pins } }) as PartSpec;

/** Every crossing of one watch over a run of snapshots, oldest first. */
const crossings = (snaps: Snapshot[], id: string): [number, 0 | 1][] => snaps.flatMap((s) => s.edges?.[id]?.log ?? []);

describe("edge watch", () => {
  test("a 555 astable's output: every edge counted between snapshots, timed to the cycle", () => {
    // 1 kHz: about 66 edges per 33 ms snapshot, far too fast for the snapshots themselves.
    const net: Netlist = { ...astable555(4.7e3, 4.7e3, 0.1e-6), watch: [{ id: "out", node: "out", of: "vcc" }] };
    const sim = createSimulation();
    sim.load(net);
    sim.step(0.01);
    sim.snapshot();
    const snaps = [sim.step(1 / 30), sim.step(1 / 30), sim.step(1 / 30)];
    const e = snaps.map((s) => s.edges!.out!);
    for (const x of e) {
      expect(x.rises).toBeGreaterThan(25);
      expect(Math.abs(x.rises - x.falls)).toBeLessThanOrEqual(1);
      expect(x.log.length).toBe(x.rises + x.falls);
      expect(x.level).toBeGreaterThan(4);
    }
    const ups = crossings(snaps, "out").filter(([, d]) => d === 1).map(([t]) => t);
    const periods = ups.slice(1).map((t, k) => t - ups[k]!);
    const mean = periods.reduce((a, b) => a + b, 0) / periods.length;
    // 0.693 x (R1 + 2 R2) x C = 0.98 ms; every period alike (edges land on the comparator crossings).
    expect(mean).toBeGreaterThan(0.9e-3);
    expect(mean).toBeLessThan(1.1e-3);
    for (const p of periods) expect(Math.abs(p - mean) / mean).toBeLessThan(0.01);
    // Rises and falls alternate.
    const dirs = crossings(snaps, "out").map(([, d]) => d);
    for (let k = 1; k < dirs.length; k++) expect(dirs[k]).not.toBe(dirs[k - 1]);
  });

  test("a bouncing button: several crossings inside one snapshot", () => {
    const net: Netlist = {
      parts: [supply5, resistor("RU", "v5", "clk", 10e3), { id: "S1", kind: "pushbutton", pins: { a: "clk", b: "gnd" }, bounce: true }],
      watch: [{ id: "clk", node: "clk", of: "v5" }],
    };
    const sim = createSimulation();
    sim.load(net);
    sim.step(0.01);
    expect(sim.snapshot().edges!.clk).toMatchObject({ rises: 0, falls: 0, high: true });
    sim.setInput("S1", "pressed", true);
    const s = sim.step(1 / 30);
    const e = s.edges!.clk!;
    // The first touch and at least three rebounds, ending low (closed); all within 5 ms of the press.
    expect(e.falls).toBeGreaterThanOrEqual(4);
    expect(e.rises).toBe(e.falls - 1);
    expect(e.high).toBe(false);
    const t0 = e.log[0]![0];
    expect(e.log[e.log.length - 1]![0] - t0).toBeLessThan(5.1e-3);
  });

  test("a 393's ripple and a mod-6 clear: nanosecond edges, in order, with the glitch state", () => {
    const net: Netlist = {
      parts: [
        supply5,
        chip("U1", "74HC393", { clk1: "clk", clr1: "clr", qa1: "a", qb1: "b", qc1: "c", qd1: "d", clk2: "gnd", clr2: "v5" }),
        chip("U2", "74HC08", { a1: "b", b1: "c", y1: "clr", a2: "gnd", b2: "gnd", a3: "gnd", b3: "gnd", a4: "gnd", b4: "gnd" }),
        { id: "CK", kind: "pushbutton", pins: { a: "v5", b: "clk" } },
        resistor("RK", "clk", "gnd", 10e3),
      ],
      watch: ["a", "b", "c", "clr"].map((n) => ({ id: n, node: n, of: "v5" })),
    };
    const sim = createSimulation();
    sim.load(net);
    sim.step(1e-3);
    const tick = () => {
      sim.setInput("CK", "pressed", true);
      sim.step(1e-3);
      sim.setInput("CK", "pressed", false);
      return sim.step(1e-3);
    };
    // Step until the count is 5, then one more falling clock edge: 101 -> 110, cleared at once to 000.
    sim.snapshot();
    for (let k = 0; k < 16 && sim.snapshot().parts.U1!.extra!.count1 !== 5; k++) tick();
    expect(sim.snapshot().parts.U1!.extra!.count1).toBe(5);
    const s = tick();
    const e = s.edges as Record<string, EdgeLog>;
    expect(s.parts.U1!.extra!.count1).toBe(0);
    // QB rose and fell again within nanoseconds (the 6 that lives a few ns), and the clear pulsed.
    expect(e.b!.log.map(([, d]) => d)).toEqual([1, 0]);
    const qbHigh = e.b!.log[1]![0] - e.b!.log[0]![0];
    expect(qbHigh).toBeGreaterThan(1e-9);
    expect(qbHigh).toBeLessThan(200e-9);
    expect(e.clr!.log.map(([, d]) => d)).toEqual([1, 0]);
    // Ripple order: QA falls before QB rises, the clear rises after QB, QB and QC fall after it.
    expect(e.a!.log[0]![0]).toBeLessThan(e.b!.log[0]![0]);
    expect(e.clr!.log[0]![0]).toBeGreaterThan(e.b!.log[0]![0]);
    expect(e.c!.log.map(([, d]) => d)).toEqual([0]);
    expect(e.c!.log[0]![0]).toBeGreaterThan(e.clr!.log[0]![0]);
  });

  test("a rebuild keeps the level (no false edge) and pending crossings; a fixed level is honoured", () => {
    const net = (extra = 0): Netlist => ({
      parts: [supply5, resistor("R1", "v5", "n", 10e3), resistor("R2", "n", "gnd", 10e3 + extra), { id: "S1", kind: "switch", pins: { a: "n", b: "gnd" }, closed: false }],
      watch: [{ id: "n", node: "n", level: 2 }],
    });
    const sim = new SimulationImpl();
    sim.load(net());
    sim.step(0.01);
    expect(sim.snapshot().edges!.n).toMatchObject({ high: true, rises: 0, falls: 0, level: 2 });
    sim.setInput("S1", "closed", true);
    sim.advanceTo(sim.time + 0.001);
    // Rebuilt before the snapshot: the fall is still delivered, and no edge is invented by the rebuild.
    sim.load(net(1));
    const s = sim.step(0.01);
    expect(s.edges!.n).toMatchObject({ falls: 1, rises: 0, high: false });
    expect(sim.step(0.01).edges!.n).toMatchObject({ falls: 0, rises: 0, high: false });
  });

  test("no watch, no edges field; an unknown node is skipped", () => {
    const sim = createSimulation();
    sim.load({ parts: [supply5, resistor("R1", "v5", "gnd", 1e3)] });
    expect(sim.step(0.01).edges).toBeUndefined();
    sim.load({ parts: [supply5, resistor("R1", "v5", "gnd", 1e3)], watch: [{ id: "x", node: "nowhere" }] });
    expect(sim.step(0.01).edges).toBeUndefined();
  });
});
