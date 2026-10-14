/**
 * The chip panels' drawings, rendered from canned states: the 555 x-ray draws only the named pins' blocks and shows
 * what fires, the gate chip shows which gate is which, the timing diagram marks glitches and its playhead, and the
 * histogram flags counts outside the fair band. Plus what a screen reader hears.
 */
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chipInfo, type Live555 } from "./chips";
import { barsOf, HistogramChart, unfairBars } from "./histogram";
import { tallyOf } from "./signals";
import { formatTick, levelsAt, tickStep, TimingDiagram } from "./timing-diagram";
import { Chip555Drawing, Chip555Map, LogicChipDrawing, logicLevels, say555, sayLogic } from "./xray";

const live = (over: Partial<Live555> = {}): Live555 => ({
  powered: true,
  supply: 9.4,
  pins: { 1: 0, 2: 2.1, 3: 8, 4: 9.4, 5: 6.27, 6: 2.1, 7: 2.1, 8: 9.4 },
  upper: 6.27,
  lower: 3.13,
  trigger: true,
  threshold: false,
  reset: false,
  latch: true,
  discharge: false,
  output: "high",
  ...over,
});

const count = (html: string, s: string) => html.split(s).length - 1;

describe("the 555 x-ray and map", () => {
  it("with pins 1 and 8 named: the two rails and blank paper", () => {
    const html = renderToStaticMarkup(h(Chip555Drawing, { pins: [1, 8], live: live() }));
    expect(html).toContain(">plus<");
    expect(html).toContain(">minus<");
    expect(html).not.toContain("low watcher");
    expect(html).not.toContain(">latch");
    // Volts only on the named pins.
    expect(html).toContain("9.40 V");
    expect(html).not.toContain("2.10 V");
  });

  it("with every pin: watchers, latch, drain, reset and the ladder, firing ones marked", () => {
    const html = renderToStaticMarkup(h(Chip555Drawing, { pins: [1, 2, 3, 4, 5, 6, 7, 8], live: live() }));
    for (const s of ["low watcher", "high watcher", "latch: on", "output", "drain", "reset", "2.10 &lt; 3.13 V"]) expect(html).toContain(s);
    expect(count(html, 'class="xr-watch" data-fires="true"')).toBe(1);
    expect(html).toContain('class="xr-latch" data-on="true"');
    expect(html).toContain('class="xr-ladder"');
  });

  it("the inside switch is only called the latch once pin 4 is named; the still map has no volts", () => {
    expect(renderToStaticMarkup(h(Chip555Drawing, { pins: [1, 8, 2, 3], live: live() }))).not.toContain(">latch");
    const map = renderToStaticMarkup(h(Chip555Map, { pins: [1, 2, 3, 4, 5, 6, 7, 8] }));
    expect(map).toContain("Complete");
    expect(map).not.toContain(" V<");
    expect(renderToStaticMarkup(h(Chip555Map, { pins: [1, 8] }))).not.toContain("Complete");
  });

  it("tells a screen reader each block, and only the state changes for the live region", () => {
    const pins = [1, 2, 3, 6, 7, 8];
    expect(say555(pins, live())).toBe(
      "Plus 9.40 V, minus 0 V. Pin 2 at 2.10 V, under the 1/3 line at 3.13 V: the low watcher fires. Pin 6 at 2.10 V, under the 2/3 line at 6.27 V. Inside switch on. Output high, pin 3 at 8.00 V. Drain switch open.",
    );
    expect(say555(pins, live(), false)).toBe("The low watcher fires. Inside switch on. Output high. Drain switch open.");
    expect(say555(pins, live({ powered: false }))).toBe("No power: the chip is asleep.");
  });
});

describe("gate chips", () => {
  const and = chipInfo("74HC08")!;
  it("draws each gate with its kind, pin levels from the chip's state, and hides the kinds on a mystery chip", () => {
    const levels = logicLevels(and, { a1: "H", b1: "H", y1: "H", a2: "L", y2: "~" });
    expect(levels).toMatchObject({ 1: "H", 2: "H", 3: "H", 4: "L", 6: "X" });
    const html = renderToStaticMarkup(h(LogicChipDrawing, { info: and, levels }));
    expect(count(html, ">AND<")).toBe(4);
    expect(count(html, 'data-level="H"')).toBeGreaterThanOrEqual(3);
    const hidden = renderToStaticMarkup(h(LogicChipDrawing, { info: and, levels, hidden: true }));
    expect(hidden).not.toContain(">AND<");
    expect(count(hidden, ">?<")).toBe(4);
    expect(sayLogic(and, { 3: "H" })).toBe("Pin 14 plus, pin 7 minus. Gate 1, AND: pins 1, 2 in, pin 3 out. Gate 2, AND: pins 4, 5 in, pin 6 out. Gate 3, AND: pins 9, 10 in, pin 8 out. Gate 4, AND: pins 12, 13 in, pin 11 out. Pin 3 (1Y) high.");
  });
});

describe("timing diagram", () => {
  const channels = [
    { label: "QB", window: { start: false, edges: [[1e-9, 1], [31e-9, 0]] as [number, 0 | 1][] } },
    { label: "CLR", window: { start: false, edges: [[16e-9, 1], [46e-9, 0]] as [number, 0 | 1][] } },
  ];
  it("draws a row per channel, a glitch mark and the playhead", () => {
    const html = renderToStaticMarkup(h(TimingDiagram, { channels, t0: 0, t1: 50e-9, origin: 0, playhead: 20e-9, glitches: [{ channel: "QB", t: 1e-9, width: 30e-9, high: true }] }));
    expect(count(html, 'class="td-row"')).toBe(2);
    expect(count(html, 'class="td-glitch"')).toBe(1);
    expect(html).toContain('class="td-playhead"');
    expect(html).toContain(">20 ns<");
    expect(levelsAt(channels, 20e-9)).toBe("QB high, CLR high");
    expect(levelsAt(channels, 40e-9)).toBe("QB low, CLR high");
  });

  it("ticks: about four, labelled in the step's unit with only the decimals it needs", () => {
    expect(tickStep(3)).toBe(1);
    expect(tickStep(1.2e-3)).toBeCloseTo(2e-4, 15);
    expect([formatTick(-2, 1), formatTick(4e-4, 2e-4), formatTick(2.5e-8, 5e-9), formatTick(-0.5, 0.5)]).toEqual(["−2 s", "400 µs", "25 ns", "−500 ms"]);
  });
});

describe("dice histogram", () => {
  it("bars per face with a fair band; a loaded face drawn outside it", () => {
    const rolls = [...Array.from({ length: 300 }, (_, k) => [1 + (k % 6)]), ...Array.from({ length: 60 }, () => [6])];
    const bars = barsOf(tallyOf(rolls), 1);
    expect(bars.map((b) => b.count)).toEqual([50, 50, 50, 50, 50, 110]);
    expect(unfairBars(bars, 360, 1).map((b) => b.label)).toEqual(["6"]);
    const html = renderToStaticMarkup(h(HistogramChart, { bars }));
    expect(count(html, 'class="hg-bar" data-out="true"')).toBe(1);
    // Two dice: sums 2 to 12; too few rolls to judge flags nothing.
    expect(barsOf(tallyOf([[1, 1]]), 2)).toHaveLength(11);
    expect(unfairBars(barsOf(tallyOf([[1, 1]]), 2), 1, 2)).toEqual([]);
  });
});
