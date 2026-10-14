import { describe, expect, test } from "vitest";
import { createSimulation, SAMPLE_RATE, type Netlist, type Snapshot } from "../src";
import { counterChain, risingCrossings, siren } from "./circuits";

/** Tone frequency in each 50 ms window of an audio stream, from its rising crossings of the window mean. */
function toneWindows(samples: number[]): number[] {
  const win = Math.round(0.05 * SAMPLE_RATE);
  const out: number[] = [];
  for (let k = 0; k + win <= samples.length; k += win) {
    const seg = samples.slice(k, k + win);
    const mean = seg.reduce((a, b) => a + b, 0) / win;
    const cross: number[] = [];
    for (let j = 1; j < win; j++) if (seg[j - 1]! < mean && seg[j]! >= mean) cross.push(j);
    if (cross.length > 2) out.push(((cross.length - 1) * SAMPLE_RATE) / (cross[cross.length - 1]! - cross[0]!));
  }
  return out;
}

describe("performance", () => {
  test("the Unit 2 siren (five transistors, two audio-coupled oscillators) runs faster than real time and wails", () => {
    const sim = createSimulation();
    sim.load(siren());
    const audio: number[] = [];
    sim.onAudio((s) => audio.push(...s));
    sim.step(0.3);
    audio.length = 0;
    const iter0 = (sim as unknown as { stats: { iterations: number } }).stats.iterations;
    const c1: [number, number][] = [];
    const t0 = performance.now();
    for (let k = 0; k < 400; k++) {
      const s = sim.step(0.005);
      c1.push([s.t, s.nodes.c1!]);
    }
    const wallPerSimSecond = (performance.now() - t0) / 1000 / 2;
    const iterations = ((sim as unknown as { stats: { iterations: number } }).stats.iterations - iter0) / 2;
    // About 0.25 s per simulated second in plain Node on an M-series Mac (vitest's module runner adds overhead).
    expect(wallPerSimSecond).toBeLessThan(1);
    expect(iterations).toBeLessThan(260_000);
    // The slow oscillator keeps flipping about every 0.4 s (68 kΩ, 10 µF) while the tone glides with it.
    const rises = risingCrossings(c1, 3);
    expect(rises.length).toBeGreaterThanOrEqual(2);
    const period = (rises[rises.length - 1]! - rises[0]!) / (rises.length - 1);
    expect(period).toBeGreaterThan(0.6);
    expect(period).toBeLessThan(1);
    const tones = toneWindows(audio);
    expect(Math.min(...tones)).toBeGreaterThan(1000);
    expect(Math.max(...tones) / Math.min(...tones)).toBeGreaterThan(1.15);
  });

  /** Runs `seconds` of a netlist after a settle and returns wall seconds and Newton iterations per simulated second. */
  function measure(net: Netlist, seconds: number) {
    const sim = createSimulation();
    sim.load(net);
    sim.step(0.2);
    const stats = () => (sim as unknown as { stats: { iterations: number; failed: number } }).stats;
    const iter0 = stats().iterations;
    const before = sim.snapshot();
    const samples: Snapshot[] = [];
    const t0 = performance.now();
    for (let k = 0; k < seconds * 30; k++) samples.push(sim.step(1 / 30));
    return { wall: (performance.now() - t0) / 1000 / seconds, iterations: (stats().iterations - iter0) / seconds, failed: stats().failed, before, after: sim.snapshot(), samples };
  }
  const count = (s: { parts: Record<string, { extra?: Record<string, unknown> }> }, id: string) => Number(s.parts[id]!.extra!.count);

  test("a 555 astable with an LED clocking a 4026B into a display (the counting demo) runs far faster than real time", () => {
    // About 3 Hz: 10 kΩ, 470 kΩ, 0.47 µF. Plain Node: about 2 ms per simulated second.
    const m = measure(counterChain(10e3, 470e3, 0.47e-6, 1), 3);
    expect(m.wall).toBeLessThan(0.05);
    expect(m.iterations).toBeLessThan(2_000);
    expect(m.failed).toBe(0);
    const f = 1.44 / ((10e3 + 2 * 470e3) * 0.47e-6);
    expect((count(m.after, "U1") - count(m.before, "U1") + 10) % 10).toBe(Math.round(f * 3) % 10);
    // The display shows the count, except for a few tens of milliseconds after each change, while the old
    // segments fade (the eye's persistence: a 3 turning into a 4 briefly reads as a 9).
    const shown = m.samples.filter((s) => s.parts.DS1!.extra!.digit === String(count(s, "U1"))).length;
    expect(shown / m.samples.length).toBeGreaterThan(0.7);
  });

  test("the 1 kHz reaction-timer clock into three 4026B counters and displays runs in real time", () => {
    // 89 unknowns, 1000 edges a second, 30 carries and 3 hundreds. Plain Node: about 0.27 s per simulated second.
    const m = measure(counterChain(4.7e3, 4.7e3, 0.1e-6, 3), 1);
    expect(m.wall).toBeLessThan(1);
    expect(m.iterations).toBeLessThan(90_000);
    expect(m.failed).toBe(0);
    // About 1021 clocks in the second: the three digits (which wrap at 1000) move on by about 21, within 1%.
    const reading = (s: typeof m.after) => count(s, "U1") + 10 * count(s, "U2") + 100 * count(s, "U3");
    const counted = (reading(m.after) - reading(m.before) + 1000) % 1000;
    const expected = (1.44 / ((4.7e3 + 2 * 4.7e3) * 0.1e-6)) % 1000;
    expect(Math.abs(counted - expected)).toBeLessThanOrEqual(10);
  });
});
