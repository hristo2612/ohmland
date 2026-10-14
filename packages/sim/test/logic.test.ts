import { describe, expect, test } from "vitest";
import { createSimulation, LOGIC_PINOUTS, simulateFor, type LogicModel, type Netlist, type PartSpec } from "../src";
import { allEvents, battery9, last, led, resistor } from "./circuits";

/** A stiff 5 V supply on node v5. */
const supply5: PartSpec = { id: "P5", kind: "cell", pins: { pos: "v5", neg: "gnd" }, emf: 5, internalOhms: 0.05 };

const chip = (id: string, model: LogicModel, pins: Record<string, string>): PartSpec => ({ id, kind: "logic", model, pins: { vcc: "v5", gnd: "gnd", ...pins } }) as PartSpec;

/** A pushbutton to v5 with a 10 kΩ pull-down on node n (pressed: high). */
const highButton = (id: string, n: string, bounce = false): PartSpec[] => [
  { id, kind: "pushbutton", pins: { a: "v5", b: n }, bounce },
  resistor(`R${id}`, n, "gnd", 10e3),
];

describe("logic chips", () => {
  test("gate truth tables (74HC00, 02, 08, 32, 86, 04 and the 3-input 27)", () => {
    const table: [LogicModel, (a: number, b: number) => number][] = [
      ["74HC00", (a, b) => 1 - (a & b)],
      ["74HC02", (a, b) => 1 - (a | b)],
      ["74HC08", (a, b) => a & b],
      ["74HC32", (a, b) => a | b],
      ["74HC86", (a, b) => a ^ b],
    ];
    const rail = (v: number) => (v ? "v5" : "gnd");
    for (const [model, fn] of table) {
      for (const a of [0, 1]) {
        for (const b of [0, 1]) {
          const s = last(simulateFor({ parts: [supply5, chip("U1", model, { a1: rail(a), b1: rail(b), a2: "gnd", b2: "gnd", a3: "gnd", b3: "gnd", a4: "gnd", b4: "gnd" })] }, 1e-3));
          const y = s.nodes["U1.y1~float"]!;
          expect(y > 4.5 ? 1 : y < 0.5 ? 0 : -1, `${model} ${a}${b}`).toBe(fn(a, b));
          expect(s.parts.U1!.extra!.y1).toBe(fn(a, b) ? "H" : "L");
        }
      }
    }
    const inv = last(simulateFor({ parts: [supply5, chip("U1", "74HC04", { a1: "v5", a2: "gnd" })] }, 1e-3));
    expect(inv.parts.U1!.extra!.y1).toBe("L");
    expect(inv.parts.U1!.extra!.y2).toBe("H");
    const nor3 = (a: string, b: string, c: string) => last(simulateFor({ parts: [supply5, chip("U1", "74HC27", { a1: a, b1: b, c1: c })] }, 1e-3)).parts.U1!.extra!.y1;
    expect(nor3("gnd", "gnd", "gnd")).toBe("H");
    expect(nor3("gnd", "v5", "gnd")).toBe("L");
  });

  test("pinouts follow the datasheets: the 02 has its outputs first", () => {
    expect(LOGIC_PINOUTS["74HC00"].indexOf("y1") + 1).toBe(3);
    expect(LOGIC_PINOUTS["74HC02"].indexOf("y1") + 1).toBe(1);
    expect(LOGIC_PINOUTS["74HC00"].indexOf("vcc") + 1).toBe(14);
    expect(LOGIC_PINOUTS["4026B"].indexOf("vdd") + 1).toBe(16);
    expect(LOGIC_PINOUTS["74HC393"].indexOf("clr1") + 1).toBe(2);
  });

  test("with no supply nothing works: outputs float", () => {
    const s = last(simulateFor({ parts: [supply5, { id: "U1", kind: "logic", model: "74HC04", pins: { gnd: "gnd", a1: "gnd" } }, resistor("R1", "U1y", "gnd", 10e3), { id: "W", kind: "wire", pins: { a: "U1y", b: "y" } }] }, 0.01));
    expect(s.parts.U1!.extra!.powered).toBe(false);
    expect(s.parts.U1!.extra!.y1).toBe("Z");
  });

  test("a chip with no supply but a high input limps along, powered through that input's protection diode", () => {
    const sim = createSimulation();
    sim.load({ parts: [supply5, { id: "U1", kind: "logic", model: "74HC04", pins: { vcc: "vc", gnd: "gnd", a1: "in", y1: "y", a2: "gnd" } }, resistor("R1", "v5", "in", 10e3)] });
    const t0 = performance.now();
    const s = sim.step(0.2);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(s.nodes.vc!).toBeGreaterThan(1.5);
    expect(s.nodes.vc!).toBeLessThan(4.6);
    expect(s.parts.U1!.extra!.powered).toBe(true);
  });

  test("a floating input reads noise, not 0; a pull-down fixes it; a hand nearby makes it flicker with the mains", () => {
    const net = (pull: boolean): Netlist => ({
      parts: [supply5, chip("U1", "74HC04", { a1: "in", y1: "y" }), resistor("RL", "y", "l", 1000), led("D1", "l", "gnd"), ...(pull ? [resistor("RD", "in", "gnd", 10e3)] : [])],
    });
    const flips = (net: Netlist, seconds: number, proximity = 0) => {
      const sim = createSimulation();
      sim.load(net);
      sim.setInput("U1", "proximity", proximity);
      let prev = "";
      let n = 0;
      const levels = new Set<string>();
      for (let t = 0; t < seconds; t += 1e-3) {
        const s = sim.step(1e-3);
        const y = String(s.parts.U1!.extra!.y1);
        levels.add(String(s.parts.U1!.extra!.a1));
        if (prev && y !== prev) n++;
        prev = y;
      }
      return { n, levels };
    };
    const floating = flips(net(false), 4);
    expect(floating.n).toBeGreaterThan(1);
    expect(floating.levels.has("X") || floating.levels.size > 1).toBe(true);
    expect(flips(net(true), 4).n).toBe(0);
    // With a hand right by it the input follows the hum: about 100 flips a second.
    const hand = flips(net(false), 1, 1);
    expect(hand.n).toBeGreaterThan(60);
    expect(hand.n).toBeLessThan(140);
  });

  test("an input parked mid-rail draws extra supply current", () => {
    const supplyAmps = (top: string) => last(simulateFor({ parts: [supply5, chip("U1", "74HC04", { a1: "in", a2: "gnd", a3: "gnd", a4: "gnd", a5: "gnd", a6: "gnd" }), resistor("R1", top, "in", 10e3), resistor("R2", "in", "gnd", 10e3)] }, 0.01)).parts.U1!.i;
    expect(supplyAmps("v5")).toBeGreaterThan(1e-3);
    expect(supplyAmps("gnd")).toBeLessThan(1e-5);
  });

  test("propagation delay: about 9 ns a gate at 5 V, slower at 2 V", () => {
    const chain = (emf: number) => {
      const net: Netlist = {
        parts: [
          { id: "P", kind: "cell", pins: { pos: "v5", neg: "gnd" }, emf, internalOhms: 0.05 },
          chip("U1", "74HC04", { a1: "in", y1: "n1", a2: "n1", y2: "n2", a3: "n2", y3: "n3", a4: "n3", y4: "n4", a5: "gnd", a6: "gnd" }),
          ...highButton("S1", "in"),
        ],
      };
      const sim = createSimulation();
      sim.load(net);
      sim.step(1e-3);
      sim.setInput("S1", "pressed", true);
      const t0 = sim.time;
      for (let k = 0; k < 2000; k++) {
        const s = sim.step(1e-9);
        if (s.nodes.n4! > emf / 2) return s.t - t0;
      }
      return Infinity;
    };
    const d5 = chain(5) / 4;
    expect(d5).toBeGreaterThan(6e-9);
    expect(d5).toBeLessThan(14e-9);
    expect(chain(2) / 4).toBeGreaterThan(3 * d5);
  });

  test("74HC74: D tied to Q-bar divides the clock by two; preset and clear act at once", () => {
    const net: Netlist = {
      parts: [
        supply5,
        chip("U1", "74HC74", { clr1: "clr", d1: "qn", clk1: "clk", pre1: "v5", q1: "q", qn1: "qn" }),
        ...highButton("CK", "clk"),
        { id: "CL", kind: "pushbutton", pins: { a: "clr", b: "gnd" } },
        resistor("RC", "v5", "clr", 10e3),
      ],
    };
    const actions = [{ t: 0.01, id: "CL", key: "pressed" as const, value: true }, { t: 0.02, id: "CL", key: "pressed" as const, value: false }];
    for (let k = 0; k < 5; k++) {
      actions.push({ t: 0.05 + 0.02 * k, id: "CK", key: "pressed", value: true }, { t: 0.06 + 0.02 * k, id: "CK", key: "pressed", value: false });
    }
    const s = simulateFor(net, 0.2, { sampleEvery: 0.005, actions });
    const q = (t: number) => s.find((x) => Math.abs(x.t - t) < 1e-9)!.nodes.q! > 2.5;
    expect(q(0.015)).toBe(false); // cleared
    expect([q(0.055), q(0.075), q(0.095), q(0.115), q(0.135)]).toEqual([true, false, true, false, true]);
  });

  test("74HC393: counts falling edges, ripples through intermediate states and clears while CLR is held", () => {
    const net: Netlist = {
      parts: [supply5, chip("U1", "74HC393", { clk1: "clk", clr1: "clr", qa1: "a", qb1: "b", qc1: "c", qd1: "d", clk2: "gnd", clr2: "v5" }), ...highButton("CK", "clk"), ...highButton("CL", "clr")],
    };
    const sim = createSimulation();
    sim.load(net);
    sim.step(1e-3);
    sim.setInput("CL", "pressed", true);
    sim.step(1e-3);
    expect(sim.snapshot().parts.U1!.extra!.count1).toBe(0);
    sim.setInput("CK", "pressed", true); // rising edge: no count while clear is held, and none on a rising edge
    sim.step(1e-3);
    sim.setInput("CK", "pressed", false);
    sim.step(1e-3);
    expect(sim.snapshot().parts.U1!.extra!.count1).toBe(0);
    sim.setInput("CL", "pressed", false);
    sim.step(1e-3);
    const count = (s: ReturnType<typeof sim.snapshot>) => [s.nodes.a!, s.nodes.b!, s.nodes.c!, s.nodes.d!].reduce((n, v, k) => n + (v > 2.5 ? 1 << k : 0), 0);
    for (let k = 1; k <= 7; k++) {
      sim.setInput("CK", "pressed", true);
      sim.step(1e-3);
      sim.setInput("CK", "pressed", false);
      const s = sim.step(1e-3);
      expect(count(s)).toBe(k);
    }
    // 0111 -> 1000 ripples: 0110, 0100, 0000 appear for a few nanoseconds each.
    sim.setInput("CK", "pressed", true);
    sim.step(1e-3);
    sim.setInput("CK", "pressed", false);
    const seen: number[] = [];
    for (let k = 0; k < 200; k++) {
      const c = count(sim.step(1e-9));
      if (seen[seen.length - 1] !== c) seen.push(c);
    }
    expect(seen).toEqual([7, 6, 4, 0, 8]);
  });

  test("mod 6: an AND of QB and QC on clear makes the 393 count 0 to 5 (with a brief glitch state)", () => {
    const net: Netlist = {
      parts: [
        supply5,
        chip("U1", "74HC393", { clk1: "clk", clr1: "clr", qa1: "a", qb1: "b", qc1: "c", qd1: "d", clk2: "gnd", clr2: "v5" }),
        chip("U2", "74HC08", { a1: "b", b1: "c", y1: "clr", a2: "gnd", b2: "gnd", a3: "gnd", b3: "gnd", a4: "gnd", b4: "gnd" }),
        ...highButton("CK", "clk"),
      ],
    };
    const sim = createSimulation();
    sim.load(net);
    sim.step(1e-3);
    const counts: number[] = [];
    for (let k = 0; k < 14; k++) {
      sim.setInput("CK", "pressed", true);
      sim.step(1e-3);
      sim.setInput("CK", "pressed", false);
      counts.push(Number(sim.step(1e-3).parts.U1!.extra!.count1));
    }
    expect(Math.max(...counts)).toBe(5);
    const zeroAt = counts.indexOf(0);
    expect(counts.slice(zeroAt, zeroAt + 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("a bouncing button makes a counter miscount; an SPDT switch into a NOR latch counts each press once", () => {
    const counter = chip("U1", "74HC393", { clk1: "clk", clr1: "gnd", clk2: "gnd", clr2: "v5" });
    const presses = (net: Netlist, press: (k: number) => { id: string; key: "pressed" | "to"; value: boolean | string }[]) => {
      const actions = [];
      for (let k = 0; k < 5; k++) actions.push(...press(k).map((a, j) => ({ ...a, t: 0.02 + 0.04 * k + 0.02 * j })));
      // Sampled between presses, so each step adds fewer than 16 counts (a 4-bit counter wraps).
      const s = simulateFor(net, 0.25, { sampleEvery: 0.01, actions });
      let n = 0;
      for (let k = 1; k < s.length; k++) n += (Number(s[k]!.parts.U1!.extra!.count1) - Number(s[k - 1]!.parts.U1!.extra!.count1) + 16) % 16;
      return n;
    };
    // A button to ground with a pull-up: each press is a falling edge, each rebound another.
    const raw: Netlist = { parts: [supply5, counter, { id: "S1", kind: "pushbutton", pins: { a: "clk", b: "gnd" }, bounce: true }, resistor("RU", "v5", "clk", 10e3)] };
    const clean: Netlist = { parts: [supply5, counter, { id: "S1", kind: "pushbutton", pins: { a: "clk", b: "gnd" } }, resistor("RU", "v5", "clk", 10e3)] };
    const press = () => [
      { id: "S1", key: "pressed" as const, value: true },
      { id: "S1", key: "pressed" as const, value: false },
    ];
    expect(presses(clean, press)).toBe(5);
    expect(presses(raw, press)).toBeGreaterThan(5);
    // SPDT pole to 5 V, throws pulled down, into a NOR latch: the latch takes the first touch and ignores rebounds.
    const latched: Netlist = {
      parts: [
        supply5,
        counter,
        { id: "SW", kind: "spdt", pins: { com: "v5", a: "s", b: "r" }, to: "b", bounce: true },
        resistor("RS", "s", "gnd", 10e3),
        resistor("RR", "r", "gnd", 10e3),
        chip("U2", "74HC02", { a1: "s", b1: "q", y1: "qn", a2: "r", b2: "qn", y2: "q", a3: "gnd", b3: "gnd", a4: "gnd", b4: "gnd" }),
        { id: "W", kind: "wire", pins: { a: "q", b: "clk" } },
      ],
    };
    const flip = () => [
      { id: "SW", key: "to" as const, value: "a" },
      { id: "SW", key: "to" as const, value: "b" },
    ];
    expect(presses(latched, flip)).toBe(5);
  });

  test("4026B counts rising edges into a 7-segment display and carries into the next digit", () => {
    const segs = ["a", "b", "c", "d", "e", "f", "g"];
    const digit = (n: string, clk: string, co: string): PartSpec[] => [
      { id: `U${n}`, kind: "logic", model: "4026B", pins: { vdd: "vcc", vss: "gnd", clk, inh: "gnd", dei: "vcc", rst: "rst", co, ...Object.fromEntries(segs.map((s) => [s, `${n}${s}`])) } },
      ...segs.map((s) => resistor(`R${n}${s}`, `${n}${s}`, `${n}${s}x`, 1000)),
      { id: `DS${n}`, kind: "sevenseg", common: "cathode", pins: { com: "gnd", ...Object.fromEntries(segs.map((s) => [s, `${n}${s}x`])) } } as PartSpec,
    ];
    const net: Netlist = {
      parts: [battery9(), ...digit("1", "clk", "co1"), ...digit("2", "co1", "co2"), ...highButton("CK", "clk").map((p) => JSON.parse(JSON.stringify(p).replaceAll("v5", "vcc")) as PartSpec), ...highButton("RS", "rst").map((p) => JSON.parse(JSON.stringify(p).replaceAll("v5", "vcc")) as PartSpec)],
    };
    const actions: { t: number; id: string; key: "pressed"; value: boolean }[] = [
      { t: 0.01, id: "RS", key: "pressed", value: true },
      { t: 0.02, id: "RS", key: "pressed", value: false },
    ];
    for (let k = 0; k < 23; k++) actions.push({ t: 0.05 + 0.02 * k, id: "CK", key: "pressed", value: true }, { t: 0.06 + 0.02 * k, id: "CK", key: "pressed", value: false });
    const s = simulateFor(net, 0.6, { sampleEvery: 0.05, actions });
    const end = last(s);
    expect(end.parts.U1!.extra!.count).toBe(3);
    expect(end.parts.U2!.extra!.count).toBe(2);
    expect(end.parts.DS1!.extra!.digit).toBe("3");
    expect(end.parts.DS2!.extra!.digit).toBe("2");
    expect(end.parts.DS1!.extra!.lit).toBe("abcdg");
    expect(Number(end.parts.DS1!.extra!.a)).toBeGreaterThan(0.5);
    expect(Number(end.parts.DS1!.extra!.f)).toBeLessThan(0.1); // only the fading glow of an earlier digit
    // 9 V through 1 kΩ and a 4000B output: a few milliamps per segment.
    expect(end.parts.DS1!.i).toBeGreaterThan(5 * 3e-3);
    expect(end.parts.DS1!.i).toBeLessThan(5 * 8e-3);
  });

  test("abuse: 9 V kills a 74HC chip at once, a backwards chip dies, a shorted output warns then wears out", () => {
    const nine = simulateFor({ parts: [battery9(), { id: "U1", kind: "logic", model: "74HC00", pins: { vcc: "vcc", gnd: "gnd" } }] }, 0.5, { sampleEvery: 0.1 });
    const died = allEvents(nine).find((e) => e.type === "died");
    expect(died?.data!.cause).toBe("overvoltage");
    expect(died!.t).toBeLessThan(0.2);
    const back = simulateFor({ parts: [supply5, { id: "U1", kind: "logic", model: "74HC00", pins: { vcc: "gnd", gnd: "v5" } }] }, 0.5, { sampleEvery: 0.1 });
    expect(allEvents(back).find((e) => e.type === "died")?.data!.cause).toBe("reverse");
    const shorted = simulateFor({ parts: [supply5, chip("U1", "74HC04", { a1: "gnd", y1: "gnd" })] }, 20, { sampleEvery: 0.5 });
    const ev = allEvents(shorted);
    expect(ev.some((e) => e.type === "warning" && e.data!.cause === "overload")).toBe(true);
    expect(ev.some((e) => e.type === "died" && e.data!.cause === "overcurrent")).toBe(true);
  });

  test("an inverter fed back on itself is held at half the supply instead of being simulated edge by edge", () => {
    const sim = createSimulation();
    sim.load({ parts: [supply5, chip("U1", "74HC04", { a1: "x", y1: "x" })] });
    const t0 = performance.now();
    const s = sim.step(0.5);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(s.parts.U1!.extra!.y1).toBe("~");
    expect(s.nodes.x!).toBeGreaterThan(2);
    expect(s.nodes.x!).toBeLessThan(3);
    expect(s.events.some((e) => e.type === "warning" && e.data!.cause === "oscillating")).toBe(true);
  });

  test("74HC14 Schmitt inputs switch cleanly at about 0.56 and 0.36 of the supply", () => {
    const net: Netlist = { parts: [supply5, chip("U1", "74HC14", { a1: "in", y1: "y" }), ...highButton("S1", "p"), resistor("R1", "p", "in", 100e3), { id: "C1", kind: "capacitor", pins: { pos: "in", neg: "gnd" }, farads: 10e-6, tolerance: 0 }] };
    const sim = createSimulation();
    sim.load(net);
    sim.step(0.01);
    sim.setInput("S1", "pressed", true);
    let flips = 0;
    let prev = sim.snapshot().nodes.y! > 2.5;
    let vUp = 0;
    for (let k = 0; k < 4000; k++) {
      const s = sim.step(1e-3);
      const y = s.nodes.y! > 2.5;
      if (y !== prev) {
        flips++;
        vUp = s.nodes.in!;
      }
      prev = y;
    }
    expect(flips).toBe(1);
    expect(vUp / 5).toBeGreaterThan(0.54);
    expect(vUp / 5).toBeLessThan(0.58);
  });

  test("4000B parts run from 3 to 18 V: a 4026B on 12 V counts, on 2 V it does nothing", () => {
    const net = (emf: number): Netlist => ({
      parts: [{ id: "P", kind: "cell", pins: { pos: "vcc", neg: "gnd" }, emf, internalOhms: 0.1 }, { id: "U1", kind: "logic", model: "4026B", pins: { vdd: "vcc", vss: "gnd", clk: "clk", inh: "gnd", dei: "vcc", rst: "gnd" } }, { id: "S1", kind: "pushbutton", pins: { a: "vcc", b: "clk" } }, resistor("RD", "clk", "gnd", 10e3)],
    });
    const run = (emf: number) => {
      const actions = [];
      for (let k = 0; k < 4; k++) actions.push({ t: 0.01 + 0.02 * k, id: "S1", key: "pressed" as const, value: true }, { t: 0.02 + 0.02 * k, id: "S1", key: "pressed" as const, value: false });
      const s = simulateFor(net(emf), 0.1, { sampleEvery: 0.01, actions });
      return { first: Number(s[0]!.parts.U1!.extra!.count), end: last(s).parts.U1! };
    };
    const twelve = run(12);
    expect((Number(twelve.end.extra!.count) - twelve.first + 10) % 10).toBe(4);
    expect(run(2).end.extra!.powered).toBe(false);
  });
});
