// The station engine on a bench: the iron, a joint on a perfboard pad from heat to verdict, quick mode, tugs, the
// desk, and heat running up a lead into an LED in the simulator (with and without a heat-sink clip).

import { describe, expect, it } from "vitest";
import { createSimulation } from "@ohmland/sim";
import { benchToNetlist, connectivity } from "../src/netlist";
import { emptyBench } from "../src/ops";
import { createStation, feedAt, placeIron, quickPress, readJoint, stepStation, tug, type StationState } from "../src/solder/station";
import { stationSpots } from "../src/solder/spots";
import type { BenchState, PlacedPart } from "../src/types";

const DT = 1 / 30;

function solderBench(opts: { on?: boolean; alloy?: "leaded" | "lead-free" } = {}): BenchState {
  const b = emptyBench(null);
  b.parts = [
    { id: "ST1", kind: "solder-station", params: { on: opts.on ?? true, setC: opts.alloy === "lead-free" ? 370 : 330, iron: "stand" }, pos: [-140, 0], rot: 0 },
    { id: "SD1", kind: "solder-spool", params: { alloy: opts.alloy ?? "leaded" }, pos: [-60, 60], rot: 0 },
    { id: "PB1", kind: "perfboard", params: { cols: 10, rows: 6, flipped: true }, pos: [0, 0], rot: 0 },
    { id: "D1", kind: "led", params: { color: "red" }, pos: [0, 0], rot: 0, holes: { anode: "PB1:C4", cathode: "PB1:C5" } },
  ] as PlacedPart[];
  return b;
}

/** Bench and station stepped together; `inputs` collects what the simulator would be told. */
class Run {
  inputs: { id: string; key: string; value: number }[] = [];
  constructor(
    public bench: BenchState,
    public st: StationState = createStation(bench),
  ) {}
  step(seconds: number) {
    for (let t = 0; t < seconds - 1e-9; t += DT) {
      const r = stepStation(this.bench, this.st, DT);
      this.bench = r.bench;
      this.st = r.station;
      this.inputs.push(...r.inputs);
    }
    return this;
  }
  do(f: (b: BenchState, s: StationState) => { bench: BenchState; station: StationState }) {
    const r = f(this.bench, this.st);
    this.bench = r.bench;
    this.st = r.station;
    return this;
  }
  set(f: (s: StationState) => StationState) {
    this.st = f(this.st);
    return this;
  }
  joint(spot: string) {
    return readJoint(this.bench, this.st, spot);
  }
}

describe("the station", () => {
  it("switched on, the tip reaches 330 °C in about 20 s", () => {
    const r = new Run(solderBench(), createStation(solderBench({ on: false })));
    r.step(10);
    expect(r.st.iron.tipC).toBeGreaterThan(150);
    expect(r.st.iron.tipC).toBeLessThan(320);
    r.step(15);
    expect(r.st.iron.tipC).toBeGreaterThan(320);
  });

  it("offers the copper side's pads, the stand, the wool and the sponge as spots", () => {
    const ids = stationSpots(solderBench()).map((s) => s.id);
    expect(ids).toContain("PB1.C4");
    expect(ids).toContain("ST1.stand");
    expect(ids).toContain("ST1.wool");
    const top = solderBench();
    top.parts = top.parts.map((p) => (p.id === "PB1" ? ({ ...p, params: { ...p.params, flipped: false } } as PlacedPart) : p));
    expect(stationSpots(top).some((s) => s.id === "PB1.C4")).toBe(false);
  });

  it("rest the iron on a pad, feed the hot work, lift: a good joint goes into the bench and joins the leg", () => {
    const r = new Run(solderBench());
    r.do((b, s) => placeIron(b, s, "PB1.C4"));
    expect(r.bench.parts.find((p) => p.id === "ST1")!.params).toMatchObject({ iron: "PB1.C4" });
    r.step(1.6);
    expect(r.joint("PB1.C4")!.tempC).toBeGreaterThan(183);
    r.set((s) => feedAt(s, "PB1.C4")).step(1).set((s) => feedAt(s, null)).step(0.4);
    expect(r.joint("PB1.C4")!.phase).toBe("molten");
    r.do((b, s) => placeIron(b, s, "stand")).step(4);
    const rec = (r.bench.parts.find((p) => p.id === "PB1") as PlacedPart & { kind: "perfboard" }).params.joints?.C4;
    expect(rec?.verdict).toBe("good");
    expect(connectivity(r.bench).same("pin:PB1.C4", "pin:D1.anode")).toBe(true);
    // Once it has cooled it leaves the live set; the bench keeps it.
    r.step(16);
    expect(r.st.joints["PB1.C4"]).toBeUndefined();
    expect(r.joint("PB1.C4")!.verdict).toBe("good");
  });

  it("quick mode: hold a joint for a few seconds and it solders itself; held far too long it bridges", () => {
    const quick = new Run(solderBench());
    quick.do((b, s) => quickPress(b, s, "PB1.C4")).step(2.8).do((b, s) => quickPress(b, s, null)).step(4);
    expect(quick.joint("PB1.C4")!.verdict).toBe("good");
    expect(quick.bench.parts.find((p) => p.id === "ST1")!.params).toMatchObject({ iron: "stand" });
    const long = new Run(solderBench());
    long.do((b, s) => quickPress(b, s, "PB1.C4")).step(7).do((b, s) => quickPress(b, s, null)).step(4);
    const j = long.joint("PB1.C4")!;
    expect(j.verdict).toBe("bridge");
    expect(j.bridgeTo).toBe("C5");
    expect(connectivity(long.bench).same("pin:D1.anode", "pin:D1.cathode")).toBe(true);
  });

  it("a tug while the joint sets disturbs it, and the tug's answer is kept", () => {
    const r = new Run(solderBench());
    r.do((b, s) => placeIron(b, s, "PB1.C4")).step(1.6).set((s) => feedAt(s, "PB1.C4")).step(1).set((s) => feedAt(s, null)).step(0.3);
    r.do((b, s) => placeIron(b, s, "stand"));
    for (let k = 0; k < 200 && !(r.st.joints["PB1.C4"]?.setting ?? 0); k++) r.step(DT);
    r.set((s) => tug(r.bench, s, "PB1.C4").station).step(4);
    expect(r.joint("PB1.C4")!.verdict).toBe("disturbed");
    const t = tug(r.bench, r.st, "PB1.C4");
    expect(t.result).toBe("loose");
    expect(t.station.tugs["PB1.C4"]).toBe("loose");
  });

  it("the iron dropped on the desk scorches the paper, then slides home", () => {
    const r = new Run(solderBench());
    r.do((b, s) => placeIron(b, s, "desk", [-80, 70])).step(3);
    expect(r.st.scorch.length).toBe(1);
    expect(r.st.scorch[0]!.amount).toBeGreaterThan(0.3);
    r.step(2);
    expect(r.bench.parts.find((p) => p.id === "ST1")!.params).toMatchObject({ iron: "stand" });
  });

  it("solder held on the tip melts once it is hot enough (the spool's melt is noted) and rides to the work", () => {
    const r = new Run(solderBench({ on: true }));
    r.set((s) => feedAt(s, "tip")).step(0.5).set((s) => feedAt(s, null));
    expect(r.st.melted.SD1).toBeGreaterThan(300);
    expect(r.st.iron.bead).toBeGreaterThan(0.5);
    r.step(3);
    r.do((b, s) => placeIron(b, s, "PB1.C4")).step(0.2).do((b, s) => placeIron(b, s, "stand")).step(5);
    const j = r.joint("PB1.C4")!;
    expect(j.fedAt).toBe("tip");
    expect(j.verdict).toBe("cold");
  });
});

describe("heat up a lead into an LED (MP5), through the simulator", () => {
  /** A 3 mm red LED lying on the desk at about 16 mA, an iron at 330 °C resting 12 mm down its anode. */
  function lamp(clip?: "copper" | "steel", tip = 330): BenchState {
    const b = emptyBench(null);
    b.parts = [
      { id: "ST1", kind: "solder-station", params: { on: true, setC: tip, iron: "stand" }, pos: [-150, 0], rot: 0 },
      { id: "B1", kind: "battery", params: { emf: 9.4, internalOhms: 1.7 }, pos: [-60, 60], rot: 0 },
      { id: "R1", kind: "resistor", params: { ohms: 470, tolerance: 0 }, pos: [0, 60], rot: 0 },
      { id: "D1", kind: "led", params: { color: "red", size: 3 }, pos: [0, 0], rot: 0 },
      ...(clip ? [{ id: "HS1", kind: "heat-sink-clip", params: { metal: clip, on: "D1.anode", mm: 6 }, pos: [0, 0], rot: 0 } as PlacedPart] : []),
    ] as PlacedPart[];
    b.leads = [
      { id: "TL1", color: "red", a: { to: "pin:B1.pos", pos: [0, 0] }, b: { to: "pin:R1.a", pos: [0, 0] } },
      { id: "TL2", color: "yellow", a: { to: "pin:R1.b", pos: [0, 0] }, b: { to: "pin:D1.anode", pos: [0, 0] } },
      { id: "TL3", color: "black", a: { to: "pin:D1.cathode", pos: [0, 0] }, b: { to: "pin:B1.neg", pos: [0, 0] } },
    ];
    return b;
  }

  function cook(bench: BenchState, seconds: number) {
    const sim = createSimulation();
    sim.load(benchToNetlist(bench).netlist);
    const g0 = sim.step(0.5).parts.D1!.glow!;
    const st0 = createStation(bench);
    let { bench: b, station: st } = placeIron(bench, { ...st0, iron: { ...st0.iron, tipC: bench.parts[0]!.params.setC as number } }, "D1.anode");
    let dim: number | null = null;
    let died: number | null = null;
    let last = g0;
    for (let t = 0; t < seconds; t += 0.1) {
      const r = stepStation(b, st, 0.1);
      b = r.bench;
      st = r.station;
      for (const i of r.inputs) sim.setInput(i.id, i.key, i.value);
      const s = sim.step(0.1);
      last = s.parts.D1!.glow ?? 0;
      if (dim === null && last <= (2 / 3) * g0) dim = t;
      if (died === null && s.events.some((e) => e.type === "died" && e.partId === "D1")) {
        died = t;
        expect(s.events.find((e) => e.type === "died")!.data!.cause).toBe("overheat");
      }
    }
    return { dim, died, glow: last / g0 };
  }

  it("bare, the glow is down by a third at 12 to 18 s and the LED dies at 25 to 35 s", () => {
    const r = cook(lamp(), 40);
    expect(r.dim).toBeGreaterThan(12);
    expect(r.dim).toBeLessThan(18);
    expect(r.died).toBeGreaterThan(25);
    expect(r.died).toBeLessThan(35);
  });

  it("a copper clip between the iron and the body keeps it above 0.8 of its glow at 120 s", () => {
    const r = cook(lamp("copper"), 120);
    expect(r.died).toBeNull();
    expect(r.glow).toBeGreaterThan(0.8);
  });

  it("a steel clip only delays it: dead at 50 to 80 s", () => {
    const r = cook(lamp("steel"), 90);
    expect(r.died).toBeGreaterThan(50);
    expect(r.died).toBeLessThan(80);
  });

  it("at 370 °C it all happens about 20% sooner", () => {
    const hot = cook(lamp(undefined, 370), 40);
    const base = cook(lamp(), 40);
    expect(hot.died! / base.died!).toBeGreaterThan(0.75);
    expect(hot.died! / base.died!).toBeLessThan(0.9);
  });
});
