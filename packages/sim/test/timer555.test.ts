import { describe, expect, test } from "vitest";
import { createSimulation, SAMPLE_RATE, simulateFor, type Netlist, type PartSpec } from "../src";
import { allEvents, astable555, battery9, cap, last, led, monostable555, resistor, risingCrossings, squareWave } from "./circuits";

/** Samples a node every `dt` for `seconds` after a settling time. */
function trace(net: Netlist, node: string, settle: number, seconds: number, dt: number): [number, number][] {
  const sim = createSimulation();
  sim.load(net);
  sim.step(settle);
  const out: [number, number][] = [];
  for (let t = 0; t < seconds; t += dt) {
    const s = sim.step(dt);
    out.push([s.t, s.nodes[node]!]);
  }
  return out;
}

describe("555 timer", () => {
  test("astable: f = 1.44 / ((R1 + 2 R2) C), high 0.693 (R1 + R2) C, low 0.693 R2 C", () => {
    // [R1, R2, C, tolerance]. With R1 = 1 kΩ about 9 mA flows into pin 7 while it discharges, and the discharge
    // transistor then sits about 0.1 V above ground (as on a real 555): the low time comes out about 3% long.
    for (const [R1, R2, C, tol] of [
      [10e3, 47e3, 1e-6, 0.005],
      [10e3, 10e3, 47e-6, 0.005],
      [1e3, 10e3, 10e-9, 0.04],
    ] as const) {
      const period = 0.693 * (R1 + 2 * R2) * C;
      const w = squareWave(trace(astable555(R1, R2, C), "out", 3 * period, 12 * period, period / 400), 4);
      expect(w.cycles).toBeGreaterThanOrEqual(10);
      expect(Math.abs(w.f / (1.44 / ((R1 + 2 * R2) * C)) - 1)).toBeLessThan(tol);
      expect(Math.abs(w.high / (0.693 * (R1 + R2) * C) - 1)).toBeLessThan(0.005);
      expect(Math.abs(w.low / (0.693 * R2 * C) - 1)).toBeLessThan(tol);
      // Duty above 50% without a steering diode: (R1 + R2) / (R1 + 2 R2).
      expect(Math.abs(w.duty - (R1 + R2) / (R1 + 2 * R2))).toBeLessThan(0.01);
    }
  });

  test("astable: the capacitor swings between one and two thirds of the supply", () => {
    const s = trace(astable555(10e3, 47e3, 1e-6), "th", 0.3, 0.3, 1e-5).map(([, v]) => v);
    const sim = createSimulation();
    sim.load(astable555(10e3, 47e3, 1e-6));
    const vcc = sim.step(0.2).nodes.vcc!;
    expect(Math.max(...s) / vcc).toBeCloseTo(2 / 3, 2);
    expect(Math.min(...s) / vcc).toBeCloseTo(1 / 3, 2);
  });

  test("timing barely depends on the supply voltage", () => {
    const f = (emf: number) => squareWave(trace(astable555(10e3, 47e3, 1e-6, { emf }), "out", 0.3, 0.8, 2e-5), emf / 2).f;
    expect(Math.abs(f(6) / f(15) - 1)).toBeLessThan(0.01);
  });

  test("a diode across R2 gives a duty cycle under 50%", () => {
    const R1 = 4.7e3;
    const R2 = 10e3;
    const C = 1e-6;
    const w = squareWave(trace(astable555(R1, R2, C, { diode: true }), "out", 0.05, 0.15, 5e-6), 4);
    expect(w.duty).toBeLessThan(0.5);
    // The low time is unchanged (discharge through R2); the high time is about 0.693 R1 C, a little longer because
    // the diode drop lowers the voltage the capacitor charges toward.
    expect(Math.abs(w.low / (0.693 * R2 * C) - 1)).toBeLessThan(0.02);
    expect(w.high / (0.693 * R1 * C)).toBeGreaterThan(1.05);
    expect(w.high / (0.693 * R1 * C)).toBeLessThan(1.3);
    expect(w.duty).toBeGreaterThan(0.3);
    expect(w.duty).toBeLessThan(0.4);
  });

  test("driving the control pin moves the thresholds to Vc and Vc / 2 and bends the frequency", () => {
    const R1 = 10e3;
    const R2 = 47e3;
    const C = 1e-6;
    const run = (vc: number) => {
      const net = astable555(R1, R2, C, { ctrl: "cv" });
      net.parts.push({ id: "VC", kind: "cell", pins: { pos: "cv", neg: "gnd" }, emf: vc, internalOhms: 1 });
      const sim = createSimulation();
      sim.load(net);
      const vcc = sim.step(0.3).nodes.vcc!;
      const out: [number, number][] = [];
      const th: number[] = [];
      for (let k = 0; k < 6000; k++) {
        const s = sim.step(1e-4);
        out.push([s.t, s.nodes.out!]);
        th.push(s.nodes.th!);
      }
      return { w: squareWave(out, 4), vcc, top: Math.max(...th), bottom: Math.min(...th) };
    };
    for (const vc of [4, 7.5]) {
      const { w, vcc, top, bottom } = run(vc);
      expect(top).toBeCloseTo(vc, 1);
      expect(bottom).toBeCloseTo(vc / 2, 1);
      const high = (R1 + R2) * C * Math.log((vcc - vc / 2) / (vcc - vc));
      expect(Math.abs(w.high / high - 1)).toBeLessThan(0.02);
      expect(Math.abs(w.low / (Math.LN2 * R2 * C) - 1)).toBeLessThan(0.02);
    }
    // A higher control voltage means a longer charge: a lower pitch.
    expect(run(7.5).w.f).toBeLessThan(run(4).w.f * 0.75);
  });

  test("monostable: one press, one pulse of 1.1 R C, however short the press", () => {
    const R = 100e3;
    const C = 10e-6;
    // At switch-on a 555's latch starts at random (this one may fire once); the press comes after that is over.
    const s = simulateFor(monostable555(R, C), 4, {
      sampleEvery: 1e-3,
      actions: [
        { t: 1.5, id: "S1", key: "pressed", value: true },
        { t: 1.52, id: "S1", key: "pressed", value: false },
      ],
    });
    const out: [number, number][] = s.map((x) => [x.t, x.nodes.out!]);
    const up = risingCrossings(out, 4).filter((t) => t > 1.4);
    const down = risingCrossings(out.map(([t, v]) => [t, -v]), -4).filter((t) => t > 1.4);
    expect(up.length).toBe(1);
    expect(down.length).toBe(1);
    expect(up[0]).toBeCloseTo(1.5, 2);
    const T = down[0]! - up[0]!;
    expect(Math.abs(T / (1.1 * R * C) - 1)).toBeLessThan(0.01);
    expect(s.find((x) => Math.abs(x.t - 2) < 1e-9)!.parts.D1!.glow).toBeGreaterThan(0.5);
    expect(last(s).parts.D1!.glow).toBeLessThan(0.01);
  });

  test("monostable: the power-up pulse is random per chip, and a capacitor on reset suppresses it", () => {
    const fired = (id: string, resetCap: boolean) => {
      const net = monostable555(100e3, 10e-6);
      net.parts = net.parts.map((p) => (p.id === "U1" ? { ...p, id } : p));
      if (resetCap) net.parts.push(cap("C9", "rs", "gnd", 1e-6));
      const s = simulateFor(net, 0.3, { sampleEvery: 0.1 });
      return s[0]!.parts[id]!.extra!.output === "high";
    };
    const ids = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8"];
    const plain = ids.map((id) => fired(id, false));
    expect(plain.some((f) => f)).toBe(true);
    expect(plain.some((f) => !f)).toBe(true);
    expect(ids.map((id) => fired(id, true)).some((f) => f)).toBe(false);
  });

  test("monostable: a trigger held low past the threshold keeps the output high until it lets go", () => {
    const s = simulateFor(monostable555(10e3, 10e-6), 1.2, {
      sampleEvery: 1e-3,
      actions: [
        { t: 0.3, id: "S1", key: "pressed", value: true },
        { t: 0.9, id: "S1", key: "pressed", value: false },
      ],
    });
    const at = (t: number) => s.find((x) => Math.abs(x.t - t) < 1e-9)!;
    // T = 1.1 x 10 kΩ x 10 µF = 0.11 s, but the trigger is held for 0.6 s.
    expect(at(0.85).parts.U1!.extra!.output).toBe("high");
    expect(at(0.85).parts.U1!.extra!.threshold).toBe(true);
    expect(at(0.95).parts.U1!.extra!.output).toBe("low");
  });

  test("reset low overrides everything, the trigger included", () => {
    const s = simulateFor(monostable555(100e3, 10e-6), 1.5, {
      sampleEvery: 1e-3,
      actions: [
        { t: 0.2, id: "S1", key: "pressed", value: true },
        { t: 0.25, id: "S1", key: "pressed", value: false },
        { t: 0.5, id: "S2", key: "pressed", value: true },
        { t: 0.7, id: "S1", key: "pressed", value: true },
        { t: 0.9, id: "S1", key: "pressed", value: false },
        { t: 1.0, id: "S2", key: "pressed", value: false },
      ],
    });
    const at = (t: number) => s.find((x) => Math.abs(x.t - t) < 1e-9)!.parts.U1!.extra!;
    expect(at(0.4).output).toBe("high");
    expect(at(0.55).output).toBe("low"); // reset cut the pulse short
    expect(at(0.8).output).toBe("low"); // trigger pressed while reset is held: nothing
    expect(at(0.8).reset).toBe(true);
    expect(at(1.3).output).toBe("low");
  });

  test("bistable: trigger sets, reset clears, and it remembers in between", () => {
    const net: Netlist = {
      parts: [
        battery9(),
        { id: "U1", kind: "timer555", pins: { gnd: "gnd", trig: "tr", out: "out", reset: "rs", thresh: "gnd", vcc: "vcc" } },
        resistor("RT", "vcc", "tr", 10e3),
        { id: "SET", kind: "pushbutton", pins: { a: "tr", b: "gnd" } },
        resistor("RR", "vcc", "rs", 10e3),
        { id: "CLR", kind: "pushbutton", pins: { a: "rs", b: "gnd" } },
        resistor("RL", "out", "l", 470),
        led("D1", "l", "gnd"),
      ],
    };
    const s = simulateFor(net, 2, {
      sampleEvery: 0.05,
      actions: [
        { t: 0.1, id: "CLR", key: "pressed", value: true },
        { t: 0.2, id: "CLR", key: "pressed", value: false },
        { t: 0.5, id: "SET", key: "pressed", value: true },
        { t: 0.55, id: "SET", key: "pressed", value: false },
        { t: 1.2, id: "CLR", key: "pressed", value: true },
        { t: 1.25, id: "CLR", key: "pressed", value: false },
      ],
    });
    const at = (t: number) => s.find((x) => Math.abs(x.t - t) < 1e-9)!;
    expect(at(0.4).parts.D1!.glow).toBeLessThan(0.02);
    expect(at(0.4).parts.D1!.i).toBeLessThan(1e-6);
    expect(at(0.6).parts.D1!.glow).toBeGreaterThan(0.6);
    expect(at(1.1).parts.D1!.glow).toBeGreaterThan(0.6);
    expect(at(1.5).parts.D1!.glow).toBeLessThan(0.05);
  });

  test("output levels: bipolar high is about 1.5 V under the supply driving an LED, CMOS swings rail to rail", () => {
    const net = (cmos: boolean): Netlist => ({
      parts: [
        battery9(),
        { id: "U1", kind: "timer555", cmos, pins: { gnd: "gnd", trig: "gnd", out: "out", reset: "vcc", thresh: "gnd", vcc: "vcc" } },
        resistor("RL", "out", "l", 470),
        led("D1", "l", "gnd"),
      ],
    });
    const bip = last(simulateFor(net(false), 0.1));
    const drop = bip.nodes.vcc! - bip.nodes.out!;
    expect(drop).toBeGreaterThan(1.3);
    expect(drop).toBeLessThan(1.7);
    expect(bip.parts.D1!.i).toBeGreaterThan(0.01);
    expect(Number(bip.parts.U1!.extra!.supplyAmps)).toBeGreaterThan(0.015);
    const cm = last(simulateFor(net(true), 0.1));
    expect(cm.nodes.vcc! - cm.nodes.out!).toBeLessThan(0.6);
    // A CMOS 555 idles on microamps; a bipolar one on milliamps.
    const idle = (cmos: boolean) => {
      const n = net(cmos);
      n.parts = n.parts.filter((p) => p.id !== "RL");
      return Number(last(simulateFor(n, 0.05)).parts.U1!.extra!.supplyAmps);
    };
    expect(idle(false)).toBeGreaterThan(3e-3);
    expect(idle(true)).toBeLessThan(2e-4);
  });

  test("an LED on the output blinks with the astable", () => {
    const s = simulateFor(astable555(10e3, 470e3, 1e-6), 3, { sampleEvery: 0.01 });
    const glow = s.filter((x) => x.t > 0.5).map((x) => x.parts.D1!.glow!);
    expect(Math.max(...glow)).toBeGreaterThan(0.8);
    expect(Math.min(...glow)).toBeLessThan(0.05);
  });

  test("a speaker through 100 Ω and a coupling capacitor sings at the astable's frequency", () => {
    const R1 = 10e3;
    const R2 = 10e3;
    const C = 47e-9;
    const net = astable555(R1, R2, C);
    net.parts = net.parts.filter((p) => p.id !== "RL" && p.id !== "D1");
    net.parts.push(resistor("R3", "out", "a", 100), cap("C3", "a", "spk", 100e-6, true), { id: "SP", kind: "speaker", pins: { a: "spk", b: "gnd" }, ohms: 8 } as PartSpec);
    const sim = createSimulation();
    sim.load(net);
    const audio: number[] = [];
    sim.onAudio((s) => audio.push(...s));
    sim.step(0.2);
    audio.length = 0;
    const s = sim.step(0.2);
    // Rising crossings (with hysteresis) give the tone.
    const peak = Math.max(...audio.map(Math.abs));
    const cross: number[] = [];
    let low = false;
    for (let k = 0; k < audio.length; k++) {
      if (audio[k]! < -0.2 * peak) low = true;
      else if (low && audio[k]! > 0.2 * peak) {
        low = false;
        cross.push(k);
      }
    }
    const f = ((cross.length - 1) * SAMPLE_RATE) / (cross[cross.length - 1]! - cross[0]!);
    const theory = 1.44 / ((R1 + 2 * R2) * C);
    expect(Math.abs(f / theory - 1)).toBeLessThan(0.02);
    expect(Math.max(...audio)).toBeGreaterThan(0.3);
    expect(s.parts.U1!.health).toBe("ok");
    expect(s.parts.SP!.health).toBe("ok");
  });

  test("pin 7 tied straight to + destroys the chip the first time it discharges", () => {
    const net = astable555(0.001, 10e3, 1e-6);
    net.parts = net.parts.filter((p) => p.id !== "R1");
    net.parts.push({ id: "W1", kind: "wire", pins: { a: "vcc", b: "dis" } });
    const s = simulateFor(net, 0.5, { sampleEvery: 0.05 });
    const died = allEvents(s).find((e) => e.type === "died" && e.partId === "U1");
    expect(died).toBeDefined();
    expect(died!.data!.cause).toBe("overcurrent");
    expect(died!.message).toMatch(/pin 7/i);
    expect(last(s).parts.U1!.health).toBe("dead");
  });

  test("an output shorted to ground overheats and dies; 20 V on the supply kills it at once", () => {
    const shorted: Netlist = {
      parts: [
        battery9(),
        { id: "U1", kind: "timer555", pins: { gnd: "gnd", trig: "gnd", out: "out", reset: "vcc", thresh: "gnd", vcc: "vcc" } },
        { id: "W1", kind: "wire", pins: { a: "out", b: "gnd" } },
      ],
    };
    const s1 = simulateFor(shorted, 3, { sampleEvery: 0.1 });
    expect(allEvents(s1).some((e) => e.type === "died" && e.data!.cause === "overcurrent")).toBe(true);
    const over: Netlist = {
      parts: [
        { id: "B1", kind: "battery", pins: { pos: "vcc", neg: "gnd" }, emf: 20, internalOhms: 0.5 },
        { id: "U1", kind: "timer555", pins: { gnd: "gnd", trig: "gnd", out: "out", reset: "vcc", thresh: "gnd", vcc: "vcc" } },
      ],
    };
    const s2 = simulateFor(over, 1, { sampleEvery: 0.1 });
    const died = allEvents(s2).find((e) => e.type === "died");
    expect(died?.data!.cause).toBe("overvoltage");
    expect(died!.t).toBeLessThan(0.6);
  });

  test("a floating trigger fires at random; touching it to + through skin holds it", () => {
    const net = (touch: boolean): Netlist => ({
      parts: [
        battery9(),
        { id: "U1", kind: "timer555", pins: { gnd: "gnd", trig: "tr", out: "out", reset: "vcc", ctrl: "cv", thresh: "th", dis: "th", vcc: "vcc" } },
        resistor("R1", "vcc", "th", 10e3),
        cap("C1", "th", "gnd", 1e-6),
        cap("C2", "cv", "gnd", 10e-9),
        ...(touch ? [{ id: "SKIN", kind: "probe-resistance", pins: { a: "vcc", b: "tr" }, ohms: 500e3 } as PartSpec] : []),
      ],
    });
    const pulses = (touch: boolean) => {
      const s = simulateFor(net(touch), 4, { sampleEvery: 1e-3 });
      return risingCrossings(
        s.filter((x) => x.t > 0.1).map((x) => [x.t, x.nodes.out!]),
        4,
      ).length;
    };
    expect(pulses(false)).toBeGreaterThan(1);
    expect(pulses(true)).toBe(0);
  });
});
