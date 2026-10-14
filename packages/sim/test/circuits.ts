// Small netlist builders shared by the golden tests.

import type { LedColor, Netlist, PartSpec, Snapshot } from "../src";

export const battery9 = (id = "B1", pos = "vcc", neg = "gnd", emf = 9): PartSpec => ({
  id,
  kind: "battery",
  pins: { pos, neg },
  emf,
  internalOhms: 1.7,
});

/** An exact resistor (tolerance 0), so golden tests see the nominal value. */
export const resistor = (id: string, a: string, b: string, ohms: number, watts?: number): PartSpec =>
  watts === undefined
    ? { id, kind: "resistor", pins: { a, b }, ohms, tolerance: 0 }
    : { id, kind: "resistor", pins: { a, b }, ohms, watts, tolerance: 0 };

export const led = (id: string, anode: string, cathode: string, color: LedColor = "red"): PartSpec => ({
  id,
  kind: "led",
  pins: { anode, cathode },
  color,
});

export const meter = (id: string, pins: { com: string; vohm?: string; ma?: string; a10?: string }, mode: Extract<PartSpec, { kind: "multimeter" }>["mode"]): PartSpec => ({
  id,
  kind: "multimeter",
  pins: { com: pins.com, vohm: pins.vohm ?? `${id}.vohm`, ma: pins.ma ?? `${id}.ma`, a10: pins.a10 ?? `${id}.a10` },
  mode,
});

/** Classic two-transistor astable with LED collector loads: each half period is about 0.69 R C. */
export function ledAstable(R = 47e3, C = 10e-6): Netlist {
  return {
    parts: [
      battery9(),
      resistor("RL1", "vcc", "l1", 470),
      led("D1", "l1", "c1"),
      resistor("RL2", "vcc", "l2", 470),
      led("D2", "l2", "c2"),
      resistor("RB1", "vcc", "b1", R),
      resistor("RB2", "vcc", "b2", R),
      { id: "C1", kind: "capacitor", pins: { pos: "c1", neg: "b2" }, farads: C, polarized: true, volts: 16 },
      { id: "C2", kind: "capacitor", pins: { pos: "c2", neg: "b1" }, farads: C, polarized: true, volts: 16 },
      { id: "Q1", kind: "npn", pins: { c: "c1", b: "b1", e: "gnd" } },
      { id: "Q2", kind: "npn", pins: { c: "c2", b: "b2", e: "gnd" } },
    ],
  };
}

/** Relay whose coil is fed through its own NC contact: it buzzes. An optional capacitor across the coil slows it. */
export function relayBuzzer(capFarads = 0): Netlist {
  const parts: PartSpec[] = [
    battery9(),
    { id: "S1", kind: "pushbutton", pins: { a: "vcc", b: "com" }, pressed: true },
    {
      id: "K1",
      kind: "relay",
      pins: { coilA: "nc", coilB: "gnd", com: "com", no: "no", nc: "nc" },
      coilOhms: 540,
      pullIn: 6.75,
      dropOut: 2.7,
    },
  ];
  if (capFarads > 0) parts.push({ id: "C1", kind: "capacitor", pins: { pos: "nc", neg: "gnd" }, farads: capFarads, polarized: true, volts: 16 });
  return { parts };
}

/** Audio-rate astable driving a speaker through an emitter follower and a 100 Ω resistor. */
export function audioAstable(): Netlist {
  return {
    parts: [
      battery9(),
      resistor("RL1", "vcc", "c1", 4700),
      resistor("RL2", "vcc", "c2", 4700),
      resistor("RB1", "vcc", "b1", 47000),
      resistor("RB2", "vcc", "b2", 47000),
      { id: "C1", kind: "capacitor", pins: { pos: "c1", neg: "b2" }, farads: 10e-9 },
      { id: "C2", kind: "capacitor", pins: { pos: "c2", neg: "b1" }, farads: 10e-9 },
      { id: "Q1", kind: "npn", pins: { c: "c1", b: "b1", e: "gnd" } },
      { id: "Q2", kind: "npn", pins: { c: "c2", b: "b2", e: "gnd" } },
      resistor("R3", "c2", "b3", 10000),
      { id: "Q3", kind: "npn", pins: { c: "vcc", b: "b3", e: "e3" } },
      resistor("R4", "e3", "sp", 100),
      { id: "SP", kind: "speaker", pins: { a: "sp", b: "gnd" }, ohms: 8 },
    ],
  };
}

/**
 * The Unit 2 "siren" (lesson `siren`, wail version): a slow LED astable steers a fast audio astable through an RC
 * glide, and a third transistor drives a speaker. Five transistors, 24 unknowns.
 */
export function siren(): Netlist {
  return {
    parts: [
      { id: "B1", kind: "battery", pins: { pos: "vcc", neg: "gnd" }, emf: 9, internalOhms: 1.5 },
      { id: "S1", kind: "pushbutton", pins: { a: "vcc", b: "vp" }, pressed: true },
      // slow oscillator
      resistor("R1", "vp", "l1", 1000),
      led("D1", "l1", "c1"),
      resistor("R2", "vp", "l2", 1000),
      led("D2", "l2", "c2"),
      resistor("R3", "vp", "b1", 68e3),
      resistor("R4", "vp", "b2", 68e3),
      { id: "C1", kind: "capacitor", pins: { pos: "c1", neg: "b2" }, farads: 10e-6, polarized: true, volts: 16 },
      { id: "C2", kind: "capacitor", pins: { pos: "c2", neg: "b1" }, farads: 10e-6, polarized: true, volts: 16 },
      { id: "Q1", kind: "npn", pins: { c: "c1", b: "b1", e: "gnd" } },
      { id: "Q2", kind: "npn", pins: { c: "c2", b: "b2", e: "gnd" } },
      // fast oscillator
      resistor("R5", "vp", "c3", 1000),
      resistor("R6", "vp", "c4", 1000),
      resistor("R7", "vp", "b3", 68e3),
      resistor("R13", "vp", "b4", 68e3),
      { id: "C3", kind: "capacitor", pins: { pos: "c3", neg: "b4" }, farads: 10e-9 },
      { id: "C4", kind: "capacitor", pins: { pos: "c4", neg: "b3" }, farads: 10e-9 },
      { id: "Q3", kind: "npn", pins: { c: "c3", b: "b3", e: "gnd" } },
      { id: "Q4", kind: "npn", pins: { c: "c4", b: "b4", e: "gnd" } },
      // glide: R8 and R9 from the fast bases to a strip fed from Q1's collector through R10, smoothed by C5
      resistor("R8", "b3", "m", 100e3),
      resistor("R9", "b4", "m", 100e3),
      resistor("R10", "m", "c1", 10e3),
      { id: "C5", kind: "capacitor", pins: { pos: "m", neg: "gnd" }, farads: 22e-6, polarized: true, volts: 16 },
      // driver
      resistor("R11", "c4", "q5b", 4700),
      { id: "Q5", kind: "npn", pins: { c: "spb", b: "q5b", e: "gnd" } },
      resistor("R12", "vp", "spa", 220, 0.5),
      { id: "SP1", kind: "speaker", pins: { a: "spa", b: "spb" }, ohms: 8 },
    ],
  };
}

/** An exact capacitor (tolerance 0). */
export const cap = (id: string, pos: string, neg: string, farads: number, polarized = false): PartSpec =>
  polarized ? { id, kind: "capacitor", pins: { pos, neg }, farads, tolerance: 0, polarized, volts: 25, leakOhms: 1e9 } : { id, kind: "capacitor", pins: { pos, neg }, farads, tolerance: 0 };

/**
 * 555 astable: R1 from vcc to discharge, R2 from discharge to the joined trigger and threshold, C from there to
 * ground, 10 nF on the control pin and an LED on the output. With `diode`, a 1N4148 across R2 (anode at pin 7)
 * lets the capacitor charge through R1 alone.
 */
export function astable555(R1: number, R2: number, C: number, opts: { diode?: boolean; cmos?: boolean; emf?: number; ctrl?: string } = {}): Netlist {
  const parts: PartSpec[] = [
    battery9("B1", "vcc", "gnd", opts.emf ?? 9),
    { id: "U1", kind: "timer555", cmos: opts.cmos === true, pins: { gnd: "gnd", trig: "th", out: "out", reset: "vcc", ctrl: opts.ctrl ?? "cv", thresh: "th", dis: "dis", vcc: "vcc" } },
    resistor("R1", "vcc", "dis", R1),
    resistor("R2", "dis", "th", R2),
    cap("C1", "th", "gnd", C),
    resistor("RL", "out", "l", 470),
    led("D1", "l", "gnd"),
  ];
  if (!opts.ctrl) parts.push(cap("C2", "cv", "gnd", 10e-9));
  if (opts.diode) parts.push({ id: "D2", kind: "diode", pins: { anode: "dis", cathode: "th" }, model: "1N4148" });
  return { parts };
}

/** 555 monostable: trigger pulled up by 10 kΩ with button S1 to ground, reset pulled up with button S2. */
export function monostable555(R: number, C: number): Netlist {
  return {
    parts: [
      battery9(),
      { id: "U1", kind: "timer555", pins: { gnd: "gnd", trig: "tr", out: "out", reset: "rs", ctrl: "cv", thresh: "th", dis: "th", vcc: "vcc" } },
      resistor("RT", "vcc", "tr", 10e3),
      { id: "S1", kind: "pushbutton", pins: { a: "tr", b: "gnd" } },
      resistor("RR", "vcc", "rs", 10e3),
      { id: "S2", kind: "pushbutton", pins: { a: "rs", b: "gnd" } },
      resistor("R1", "vcc", "th", R),
      cap("C1", "th", "gnd", C, true),
      cap("C2", "cv", "gnd", 10e-9),
      resistor("RL", "out", "l", 470),
      led("D1", "l", "gnd"),
    ],
  };
}

/**
 * A 555 astable (with an LED on its output) clocking a chain of 4026B decade counters, each into a common-cathode
 * display through 1 kΩ per segment, carry out to the next clock: the counter and display chain of the reaction
 * timer. Runs from a 9 V battery with 100 µF across it.
 */
export function counterChain(R1: number, R2: number, C: number, digits = 3): Netlist {
  const segs = ["a", "b", "c", "d", "e", "f", "g"];
  const parts: PartSpec[] = [
    battery9(),
    cap("CB", "vcc", "gnd", 100e-6, true),
    { id: "U0", kind: "timer555", pins: { gnd: "gnd", trig: "th", out: "clk1", reset: "vcc", ctrl: "cv", thresh: "th", dis: "dis", vcc: "vcc" } },
    resistor("RA", "vcc", "dis", R1),
    resistor("RB", "dis", "th", R2),
    cap("CT", "th", "gnd", C),
    cap("CV", "cv", "gnd", 10e-9),
    resistor("RL", "clk1", "l", 1000),
    led("D1", "l", "gnd"),
  ];
  for (let k = 1; k <= digits; k++) {
    parts.push({ id: `U${k}`, kind: "logic", model: "4026B", pins: { vdd: "vcc", vss: "gnd", clk: `clk${k}`, inh: "gnd", dei: "vcc", rst: "gnd", co: `clk${k + 1}`, ...Object.fromEntries(segs.map((s) => [s, `d${k}${s}`])) } } as PartSpec);
    for (const s of segs) parts.push(resistor(`R${k}${s}`, `d${k}${s}`, `d${k}${s}x`, 1000));
    parts.push({ id: `DS${k}`, kind: "sevenseg", common: "cathode", pins: { com: "gnd", ...Object.fromEntries(segs.map((s) => [s, `d${k}${s}x`])) } } as PartSpec);
  }
  return { parts };
}

/** Times at which a sampled value crosses a level going down. */
export function fallingCrossings(samples: [number, number][], level: number): number[] {
  return risingCrossings(
    samples.map(([t, v]) => [t, -v]),
    -level,
  );
}

/** High time, low time and frequency of a square wave from its crossings of a level (whole cycles only). */
export function squareWave(samples: [number, number][], level: number): { f: number; high: number; low: number; duty: number; cycles: number } {
  const up = risingCrossings(samples, level);
  const down = fallingCrossings(samples, level);
  const period = (up[up.length - 1]! - up[0]!) / (up.length - 1);
  let high = 0;
  let n = 0;
  for (const u of up) {
    const d = down.find((t) => t > u);
    if (d === undefined) break;
    high += d - u;
    n++;
  }
  high /= n;
  return { f: 1 / period, high, low: period - high, duty: high / period, cycles: up.length - 1 };
}

export const last = (s: Snapshot[]): Snapshot => s[s.length - 1]!;

export const allEvents = (s: Snapshot[]) => s.flatMap((x) => x.events);

/** Times at which a sampled value crosses a level going up. */
export function risingCrossings(samples: [number, number][], level: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < samples.length; k++) {
    const [t0, v0] = samples[k - 1]!;
    const [t1, v1] = samples[k]!;
    if (v0 < level && v1 >= level) out.push(t0 + ((level - v0) / (v1 - v0)) * (t1 - t0));
  }
  return out;
}
