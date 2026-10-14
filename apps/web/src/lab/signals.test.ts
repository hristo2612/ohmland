/** Signals over time: duty cycles, the edge log, bursts and glitches, the timing diagram's shapes, presses and dice. */
import { describe, expect, it } from "vitest";
import type { EdgeLog } from "@ohmland/sim";
import { distinctRun, dutyOf, edgesOf, EdgeTrack, fairBand, faceOf, formatSpan, lastBurst, pressesOf, slowFactor, tallyOf, TRACK_MAX, traceShape, widthsOf, type Edge, type Sample } from "./signals";

/** A square wave sampled every `dt`: high for `high` of every `period`, from 0 to `until`. */
const square = (period: number, high: number, until: number, dt = 0.01, lo = 0, hi = 9): Sample[] => {
  const out: Sample[] = [];
  for (let t = 0; t <= until + 1e-9; t += dt) out.push([t, (t % period) < high - 1e-9 ? hi : lo]);
  return out;
};

const log = (edges: Edge[], high: boolean): EdgeLog => ({ rises: edges.filter(([, d]) => d === 1).length, falls: edges.filter(([, d]) => d === 0).length, high, log: edges, level: 2.5 });

describe("duty cycles", () => {
  it("high stretches and the duty of a sampled square wave, crossings interpolated", () => {
    const pts = square(1, 0.3, 5.05);
    const edges = edgesOf(pts, 4.5);
    const widths = widthsOf(edges);
    expect(widths.length).toBeGreaterThanOrEqual(4);
    for (const w of widths) expect(w).toBeCloseTo(0.3, 1);
    const d = dutyOf(edges)!;
    expect(d.period).toBeCloseTo(1, 2);
    expect(d.duty).toBeCloseTo(0.3, 1);
    expect(d.high + d.low).toBeCloseTo(d.period, 9);
  });

  it("exact from edges, and null until two rises and a fall", () => {
    const e: Edge[] = [
      [1.0, 1],
      [1.54, 0],
      [2.01, 1],
      [2.55, 0],
      [3.02, 1],
    ];
    expect(dutyOf(e)).toMatchObject({ cycles: 2 });
    expect(dutyOf(e)!.high).toBeCloseTo(0.54, 9);
    expect(dutyOf(e)!.period).toBeCloseTo(1.01, 9);
    expect(dutyOf(e.slice(0, 2))).toBeNull();
    // A stretch still going is not a width.
    expect(widthsOf([[0, 1], [0.5, 0], [1, 1]])).toEqual([0.5]);
  });

  it("the values a counter went through, repeats removed", () => {
    expect(distinctRun([[0, 3], [1, 3], [2, 4], [3, 4], [4, 0], [5, 0]])).toEqual([3, 4, 0]);
  });
});

describe("the edge log", () => {
  it("keeps edges in order, knows the level at any time, and the totals", () => {
    const tr = new EdgeTrack(0, false);
    tr.push(log([[0.1, 1], [0.2, 0]], false));
    tr.push(log([[0.35, 1]], true));
    expect(tr.edges).toHaveLength(3);
    expect([tr.rises, tr.falls, tr.high]).toEqual([2, 1, true]);
    expect([tr.levelAt(0.05), tr.levelAt(0.15), tr.levelAt(0.25), tr.levelAt(0.4)]).toEqual([false, true, false, true]);
    expect(tr.after(0.2)).toEqual([[0.2, 0], [0.35, 1]]);
    expect(tr.between(0.15, 0.3)).toEqual([[0.2, 0]]);
  });

  it("drops the oldest edges past its size and still knows the level before the oldest kept one", () => {
    const tr = new EdgeTrack(0, false);
    const edges: Edge[] = [];
    for (let k = 0; k < TRACK_MAX + 11; k++) edges.push([k * 1e-3, (k % 2 === 0 ? 1 : 0) as 0 | 1]);
    tr.push(log(edges, false));
    expect(tr.edges).toHaveLength(TRACK_MAX);
    const first = tr.edges[0]!;
    expect(tr.levelAt(first[0] - 1e-6)).toBe(first[1] === 0);
  });
});

describe("bursts and glitches", () => {
  const track = (edges: Edge[], high = false) => {
    const tr = new EdgeTrack(0, high);
    tr.push(log(edges, edges.length ? edges[edges.length - 1]![1] === 1 : high));
    return tr;
  };

  it("finds the latest finished run of edges across channels, its states and the glitches under 1 µs in it", () => {
    // A press's bounce at 1 s (three edges in 2 ms), then a counter's ripple at 2 s: QB high for only 30 ns.
    const clk = track([[1.0, 0], [1.001, 1], [1.002, 0], [2.0, 1], [2.3, 0]], true);
    const qb = track([[2.0000005, 1], [2.000000530, 0]]);
    const clr = track([[2.000000515, 1], [2.000000545, 0]]);
    const b = lastBurst({ CLK: clk, QB: qb, CLR: clr }, 3)!;
    // The lone fall at 2.3 s is not a burst; the ripple at 2 s is the latest one.
    expect(b.start).toBe(2.0);
    expect(b.end).toBeCloseTo(2.000000545, 12);
    expect(b.channels["CLK"]!.start).toBe(false);
    expect(b.glitches.map((g) => g.channel).sort()).toEqual(["CLR", "QB"]);
    expect(b.glitches.find((g) => g.channel === "QB")!.width).toBeCloseTo(30e-9, 12);
    expect(b.states.map((s) => `${s.levels["CLK"]}${s.levels["QB"]}${s.levels["CLR"]}`)).toEqual(["100", "110", "111", "101", "100"]);
  });

  it("waits while a run is still going (and gives the one before it)", () => {
    const clk = track([[1.0, 1], [1.001, 0], [2.0, 1], [2.001, 0]]);
    expect(lastBurst({ CLK: clk }, 2.005)!.start).toBe(1.0);
    expect(lastBurst({ CLK: track([[2.0, 1], [2.001, 0]]) }, 2.005)).toBeNull();
    expect(lastBurst({}, 1)).toBeNull();
  });

  it("formats spans and slow-motion factors for people", () => {
    expect([formatSpan(1.234), formatSpan(0.0042), formatSpan(31.7e-9), formatSpan(2.5e-6)]).toEqual(["1.23 s", "4.20 ms", "31.7 ns", "2.50 µs"]);
    expect(slowFactor(1e-3, 4)).toBe(4000);
    expect(slowFactor(638e-9, 4)).toBe(6000000);
  });
});

describe("timing diagram shapes", () => {
  it("draws runs and edges in fractions of the window, and a fast clock as a busy band", () => {
    const s = traceShape({ start: false, edges: [[0.25, 1], [0.75, 0]] }, 0, 1);
    expect(s.runs).toEqual([
      { x0: 0, x1: 0.25, high: false },
      { x0: 0.25, x1: 0.75, high: true },
      { x0: 0.75, x1: 1, high: false },
    ]);
    expect(s.edges).toEqual([0.25, 0.75]);
    const clock: Edge[] = [];
    for (let k = 0; k < 40; k++) clock.push([0.4 + k * 0.0005, (k % 2 === 0 ? 1 : 0) as 0 | 1]);
    const busy = traceShape({ start: false, edges: clock }, 0, 1, 0.004);
    expect(busy.busy).toHaveLength(1);
    expect(busy.busy[0]![0]).toBeCloseTo(0.4, 6);
    expect(busy.edges).toHaveLength(0);
  });
});

describe("presses and dice", () => {
  it("closed spells from a 0/1 history, the last one still on", () => {
    const pts: Sample[] = [[0, 0], [0.1, 1], [0.2, 1], [0.3, 0], [0.4, 0], [0.5, 1]];
    expect(pressesOf(pts)).toEqual([
      { start: 0.1, end: 0.3 },
      { start: 0.5, end: null },
    ]);
  });

  it("faces from pips, tallies of one die and of two, and the fair band", () => {
    expect(faceOf([true, false, true, true])).toBe(3);
    const one = tallyOf([[1], [6], [6], [0]]);
    expect(one).toMatchObject({ rolls: 4, faces: { "1": 1, "6": 2, "0": 1 } });
    const two = tallyOf([[3, 5], [3, 5], [6, 6]]);
    expect(two.pairs).toEqual({ "3-5": 2, "6-6": 1 });
    expect(two.sums).toEqual({ "8": 2, "12": 1 });
    const band = fairBand(600, 1 / 6);
    expect(band.expected).toBeCloseTo(100, 9);
    expect(band.lo).toBeCloseTo(100 - 2 * Math.sqrt(600 * (1 / 6) * (5 / 6)), 9);
  });
});
