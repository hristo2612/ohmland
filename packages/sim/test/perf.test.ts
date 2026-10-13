import { describe, expect, test } from "vitest";
import { createSimulation, SAMPLE_RATE } from "../src";
import { risingCrossings, siren } from "./circuits";

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
});
