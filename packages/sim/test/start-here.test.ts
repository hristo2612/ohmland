// Golden checks for the Start here unit (docs/curriculum/start-here.md, 6.3 and the accuracy checklist in 7).
// Netlists are built the way the bench builds them (packages/bench/src/netlist.ts): the standard bench battery
// (9.4 V, 1.7 Ω, 500 mAh), a red LED with maxmA 50, clip leads as 0.15 Ω wires, the toggle switch as an spdt thrown
// to b when on, and each plugged-in meter probe as a 0.1 Ω wire from its socket to whatever its tip touches.

import { describe, expect, test } from "vitest";
import { createSimulation, simulateFor, type PartSpec, type SimEvent, type Snapshot } from "../src";
import { allEvents, last, resistor } from "./circuits";

type Battery = Extract<PartSpec, { kind: "battery" }>;
type Meter = Extract<PartSpec, { kind: "multimeter" }>;

/** A battery on the bench snaps: + is node "bat+", − is the reference. */
const battery = (id: string, emf = 9.4, internalOhms = 1.7): Battery => ({ id, kind: "battery", pins: { pos: "bat+", neg: "gnd" }, emf, internalOhms, mAh: 500 });
const lead = (id: string, a: string, b: string): PartSpec => ({ id, kind: "wire", pins: { a, b }, ohms: 0.15 });

type LoopOptions = {
  battery?: Battery;
  on?: boolean; // S1 thrown to b (default) or to a
  swapped?: boolean; // TL1 and TL4 swapped on the battery snaps (SH1 secret)
  unclipped?: boolean; // TL4's far clip off the battery, touching nothing
  extra?: PartSpec[];
};

/** The standard lamp loop (2.3): battery, TL1, S1, TL2, R1 1 kΩ, TL3, D1 red, TL4 back to the battery. */
function lampLoop({ battery: b = battery("B1"), on = true, swapped = false, unclipped = false, extra = [] }: LoopOptions = {}): PartSpec[] {
  const [first, back] = swapped ? ["gnd", "bat+"] : ["bat+", "gnd"];
  return [
    b,
    lead("TL1", first, "S1.com"),
    { id: "S1", kind: "spdt", pins: { com: "S1.com", a: "S1.a", b: "S1.b" }, to: on ? "b" : "a" },
    lead("TL2", "S1.b", "R1.a"),
    resistor("R1", "R1.a", "R1.b", 1000),
    lead("TL3", "R1.b", "D1.anode"),
    { id: "D1", kind: "led", pins: { anode: "D1.anode", cathode: "D1.cathode" }, color: "red", maxmA: 50 },
    lead("TL4", "D1.cathode", unclipped ? "TL4.b" : back),
    ...extra,
  ];
}

const LEADS = ["TL1", "TL2", "TL3", "TL4"];
const soc = (s: Snapshot, id: string) => Number(s.parts[id]!.extra!.soc);

describe("Start here: the lamp loop and the gates (SH4)", () => {
  test("the lamp draws about 7.5 mA with a clear glow, and every lead carries the same current", () => {
    const s = last(simulateFor({ parts: lampLoop() }, 1));
    const d1 = s.parts.D1!;
    expect(d1.i).toBeGreaterThan(7.3e-3);
    expect(d1.i).toBeLessThan(7.7e-3);
    expect(d1.v).toBeGreaterThan(1.85); // checklist: Vf about 1.9 V at 7.5 mA
    expect(d1.v).toBeLessThan(1.95);
    expect(d1.glow!).toBeGreaterThan(0.6);
    // A gate reads the current through the lead it clips onto: the same into the lamp (TL3) and out of it (TL4).
    for (const id of LEADS) expect(Math.abs(s.parts[id]!.i - d1.i)).toBeLessThan(1e-5);
  });

  test("switching off stops the flow in every lead at once", () => {
    const s = simulateFor({ parts: lampLoop() }, 1.5, { sampleEvery: 0.1, actions: [{ t: 1, id: "S1", key: "to", value: "a" }] });
    const off = s.find((x) => Math.abs(x.t - 1.1) < 1e-9)!;
    for (const id of LEADS) expect(Math.abs(off.parts[id]!.i)).toBeLessThan(1e-6);
    expect(last(s).parts.D1!.glow!).toBeLessThan(0.01);
  });

  test("fix-it: a clip lead across the lamp steals the flow; the lamp goes dark and R1 alone sets about 9.4 mA", () => {
    const s = last(simulateFor({ parts: lampLoop({ extra: [lead("TLX", "D1.anode", "D1.cathode")] }) }, 1));
    expect(s.parts.D1!.glow!).toBeLessThan(0.01);
    expect(s.parts.TL1!.i).toBeGreaterThan(9.2e-3);
    expect(s.parts.TL1!.i).toBeLessThan(9.5e-3);
    expect(s.parts.TLX!.i).toBeCloseTo(s.parts.TL1!.i, 6);
  });
});

describe("Start here: push (SH5) and squeeze (SH6)", () => {
  test("one AA cell (1.58 V, 0.15 Ω) leaves the red lamp dark; the 9 V battery lights it", () => {
    const aa = simulateFor({ parts: lampLoop({ battery: battery("X1", 1.58, 0.15) }) }, 1, { sampleEvery: 0.1 });
    // box-a-dark: glow below 0.05, held (sampled over the whole second, after the eye's 30 ms average).
    for (const x of aa.slice(1)) expect(x.parts.D1!.glow!).toBeLessThan(0.05);
    expect(last(aa).parts.D1!.i).toBeLessThan(1e-4);
    expect(last(simulateFor({ parts: lampLoop() }, 1)).parts.D1!.glow!).toBeGreaterThan(0.3);
  });

  test("the knob box (470 Ω plus a 10 kΩ trimmer) runs from about 16 mA to about 0.7 mA, the same on both sides", () => {
    const sim = createSimulation();
    sim.load({
      parts: [
        battery("B1"),
        lead("TL1", "bat+", "KB.in"),
        { id: "KT", kind: "pot", pins: { a: "KB.in", wiper: "KT.wiper", b: "KT.b" }, ohms: 10e3, position: 0 },
        resistor("KR", "KT.wiper", "KB.out", 470),
        lead("TL2", "KB.out", "D1.anode"),
        { id: "D1", kind: "led", pins: { anode: "D1.anode", cathode: "D1.cathode" }, color: "red", maxmA: 50 },
        lead("TL3", "D1.cathode", "gnd"),
      ],
    });
    const at = (position: number) => {
      sim.setInput("KT", "position", position);
      return sim.step(0.5);
    };
    const [low, mid, high] = [at(0), at(0.5), at(1)];
    expect(low.parts.D1!.i).toBeGreaterThan(15e-3);
    expect(low.parts.D1!.i).toBeLessThan(16.5e-3); // far below the LED's 50 mA
    expect(low.parts.D1!.glow!).toBeGreaterThan(0.4);
    expect(high.parts.D1!.i).toBeGreaterThan(0.65e-3);
    expect(high.parts.D1!.i).toBeLessThan(0.8e-3);
    expect(high.parts.D1!.glow!).toBeGreaterThan(0.02); // dim, but still lit at the top of the knob
    expect(high.parts.D1!.glow!).toBeLessThan(low.parts.D1!.glow! - 0.3);
    // both-gates: gates either side of the box agree within 1% wherever the knob is.
    for (const s of [low, mid, high]) expect(Math.abs(s.parts.TL1!.i / s.parts.TL2!.i - 1)).toBeLessThan(0.01);
  });
});

describe("Start here: the tired battery (SH7)", () => {
  test("a battery at 8% fades the lamp out over hours of time-lapse", () => {
    // The bench's start charge (B1 in the blueprint) is the simulator's state of charge. A netlist cannot set it
    // directly today, so drain the battery through a load and rebuild: the charge carries over to the lamp loop.
    const sim = createSimulation();
    sim.load({ parts: [battery("B1"), resistor("RL", "bat+", "gnd", 20, 5)] });
    let charge = 1;
    while (charge > 0.08) charge = soc(sim.step(charge > 0.1 ? 60 : 2, { speed: 3600 }), "B1");
    sim.load({ parts: lampLoop() });
    let s = sim.step(120); // let the drain's polarisation settle
    expect(soc(s, "B1")).toBeGreaterThan(0.079);
    let prev = s.parts.D1!.glow!;
    expect(prev).toBeGreaterThan(0.5); // dimmer than with a fresh battery (0.73), still plainly lit

    let flatAt = Infinity;
    let darkAt = Infinity;
    for (let h = 0.5; h <= 20; h += 0.5) {
      s = sim.step(1800, { speed: 3600 });
      const glow = s.parts.D1!.glow!;
      expect(glow).toBeLessThan(prev); // it only ever fades
      prev = glow;
      if (soc(s, "B1") < 0.02) flatAt = Math.min(flatAt, h);
      if (glow < 0.05) darkAt = Math.min(darkAt, h);
    }
    // From 8% of 500 mAh at about 5 mA: under 2% after about 7.5 hours, the lamp dark (glow below 0.05) after
    // about 17 hours. That is 17 s of real time at the fastest time-lapse (3600 x). The blueprint (6.3) guessed
    // about 6 hours; at 6 hours the glow is still about 0.57.
    expect(flatAt).toBeGreaterThanOrEqual(6.5);
    expect(flatAt).toBeLessThanOrEqual(8.5);
    expect(darkAt).toBeGreaterThanOrEqual(15);
    expect(darkAt).toBeLessThanOrEqual(18.5);
  });

  test("no flow, no drain: an open loop keeps its charge for 10 hours, a lit lamp uses about 15% of it", () => {
    const drop = (parts: PartSpec[]) => {
      const sim = createSimulation();
      sim.load({ parts });
      return 1 - soc(sim.step(10 * 3600, { speed: 3600 }), "B2");
    };
    const b2 = battery("B2");
    expect(drop(lampLoop({ battery: b2, unclipped: true }))).toBeLessThan(0.01);
    expect(drop(lampLoop({ battery: b2, on: false }))).toBeLessThan(0.01);
    const lit = drop(lampLoop({ battery: b2 })); // 7.5 mA for 10 h is 75 mAh
    expect(lit).toBeGreaterThan(0.13);
    expect(lit).toBeLessThan(0.16);
  });
});

describe("Start here: the meter on the wrong dial (SH8 fix-it)", () => {
  /** Meter M1 across the battery, black in COM on −, red plugged into `red` with its tip on +. */
  const meterOn = (red: "vohm" | "ma", range?: string): PartSpec[] => {
    const m: Meter = {
      id: "M1",
      kind: "multimeter",
      pins: { com: "socket-com", vohm: "socket-vohm", ma: "socket-ma", a10: "socket-a10" },
      mode: "dca-ma",
    };
    if (range !== undefined) m.range = range;
    return [
      battery("B1"),
      m,
      { id: "M1:red", kind: "wire", pins: { a: `socket-${red}`, b: "bat+" }, ohms: 0.1 },
      { id: "M1:black", kind: "wire", pins: { a: "socket-com", b: "gnd" }, ohms: 0.1 },
    ];
  };

  test("on mA with red in VΩ it reads 0 and keeps its fuse; turning the dial to 20 V reads the battery", () => {
    const sim = createSimulation();
    sim.load({ parts: meterOn("vohm") });
    const events: SimEvent[] = [];
    for (let k = 0; k < 10; k++) {
      const s = sim.step(0.1);
      events.push(...s.events);
      expect(Number(s.parts.M1!.display)).toBe(0); // the VΩ socket is not in the current path
      expect(s.parts.M1!.extra!.fuse).toBe("ok");
      expect(Number(s.parts.B1!.extra!.out)).toBeLessThan(1e-6);
    }
    expect(events.filter((e) => e.type === "meter-fuse")).toHaveLength(0);

    sim.setInput("M1", "mode", "dcv");
    sim.setInput("M1", "range", "20V");
    const v = sim.step(0.5).parts.M1!;
    expect(v.unit).toBe("V");
    expect(Number(v.display)).toBeGreaterThanOrEqual(9.3);
    expect(Number(v.display)).toBeLessThanOrEqual(9.5);
  });

  test("on the 20 mA range it shows 0.00; only red in the mA socket blows the fuse", () => {
    const m = last(simulateFor({ parts: meterOn("vohm", "20mA") }, 0.5)).parts.M1!;
    expect([m.display, m.unit]).toEqual(["0.00", "mA"]);
    const wrong = simulateFor({ parts: meterOn("ma") }, 0.5, { sampleEvery: 0.1 });
    expect(allEvents(wrong).some((e) => e.type === "meter-fuse")).toBe(true);
    expect(last(wrong).parts.M1!.extra!.fuse).toBe("blown");
  });
});

describe("Start here: the lamp backwards (SH1 secret)", () => {
  test("a red LED reversed behind 1 kΩ on 9.4 V stays dark and takes no harm", () => {
    const s = simulateFor({ parts: lampLoop({ swapped: true }) }, 60, { sampleEvery: 1 });
    for (const x of s) {
      expect(x.parts.D1!.health).toBe("ok");
      expect(x.parts.D1!.glow!).toBeLessThan(0.01);
    }
    const d1 = last(s).parts.D1!;
    expect(d1.v).toBeLessThan(-9); // nearly the whole battery the wrong way round (the secret's goal needs v < -1)
    expect(Math.abs(d1.i)).toBeLessThan(1e-4); // the soft breakdown above 5 V leaks only tens of µA
    expect(d1.extra!.damage).toBe(0);
    // It warns (`reversed`) but is never damaged and never dies.
    expect(allEvents(s).filter((e) => e.partId === "D1").map((e) => e.type)).toEqual(["reversed"]);
  });
});
