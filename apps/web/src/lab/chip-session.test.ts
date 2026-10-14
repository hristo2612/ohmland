/**
 * The chip panels in a LabSession, fed canned snapshots: the dice histogram's auto-roller, a timing diagram's burst
 * and replays, the x-ray's sightings, the extended truth table, and stopwatch triggers on a lamp and a watched node.
 */
import { describe, expect, it } from "vitest";
import type { EdgeLog, PartState, Snapshot } from "@ohmland/sim";
import { buildBench } from "./build";
import { defineLab, type LabDefinition, type PanelConfig, type StopwatchConfig } from "./define";
import { truthComplete } from "./panels";
import { LabSession } from "./session";

const part = (p: Partial<PartState>): PartState => ({ i: 0, v: 0, p: 0, temp: 25, health: "ok", ...p });

const labWith = (panels: PanelConfig[], extra: Partial<LabDefinition["bench"]> = {}): LabDefinition =>
  defineLab({
    id: "chip-session",
    title: "Chip session",
    bench: { board: "none", parts: [], tray: [], instruments: [], ...extra },
    tasks: [{ id: "t", prompt: "", goal: () => false, hints: [], success: "" }],
    solution: [],
    panels,
  });

const session = (lab: LabDefinition) => new LabSession(lab, buildBench(lab.bench));

describe("dice histogram", () => {
  const PIPS = ["P1", "P2", "P3", "P4", "P5", "P6"];

  /** A die that spins while S1 is held and stops where it is when let go; the session presses S1 itself. */
  function run(s: LabSession, seconds: number, manual: [number, boolean][] = []) {
    let pressed = false;
    let face = 1;
    const presses: [number, boolean][] = [];
    for (let k = 1; k <= seconds * 30; k++) {
      const t = k / 30;
      for (const [at, on] of manual) if (Math.abs(at - t) < 1e-6) pressed = on;
      if (pressed) face = (face % 6) + 1;
      const parts: Record<string, PartState> = { S1: part({ closed: pressed, extra: { pressed } }) };
      PIPS.forEach((id, i) => (parts[id] = part({ glow: i < face ? 0.8 : 0 })));
      const u = s.ingest({ t, nodes: {}, parts, events: [] });
      for (const inp of u.inputs) {
        if (inp.id === "S1" && inp.key === "pressed") {
          pressed = inp.value === true;
          presses.push([t, pressed]);
        }
      }
    }
    return presses;
  }

  it("tallies every roll by hand, and the auto-roller's, with human-like holds", () => {
    const lab = labWith([{ kind: "histogram", id: "hg", button: "S1", dice: [PIPS], rolls: 5 }]);
    const s = session(lab);
    run(s, 2, [
      [0.5, true],
      [0.9, false],
    ]);
    expect(s.view().rolls("hg").list).toHaveLength(1);
    s.startRolls("hg");
    const presses = run(s, 8);
    const view = s.view().rolls("hg");
    expect(view.list).toHaveLength(6);
    expect(view.rolling).toBe(false);
    for (const [f] of view.list) expect(f).toBeGreaterThanOrEqual(1);
    expect(view.tally.rolls).toBe(6);
    // Each hold lasts 0.15 to 0.6 s (to within a frame).
    for (let k = 0; k + 1 < presses.length; k += 2) {
      const held = presses[k + 1]![0] - presses[k]![0];
      expect(held).toBeGreaterThan(0.15 - 0.04);
      expect(held).toBeLessThan(0.6 + 0.04);
    }
    s.clearRolls("hg");
    expect(s.view().rolls("hg").list).toHaveLength(0);
  });

  it("panel answers start the roller (solutions) and fast rolls are counted as sampled", () => {
    const s = session(labWith([{ kind: "histogram", id: "hg", button: "S1", dice: [PIPS, PIPS] }]));
    s.answer("hg", { roll: 3 });
    expect(s.view().rolls("hg").rolling).toBe(true);
    s.addRolls("hg", [[1, 2], [6, 6]], true);
    expect(s.view().rolls("hg")).toMatchObject({ sampled: 2, tally: { pairs: { "1-2": 1, "6-6": 1 }, sums: { "3": 1, "12": 1 } } });
  });
});

describe("timing diagram", () => {
  const lab = labWith([
    {
      kind: "timing",
      id: "td",
      channels: [
        { label: "CLK", node: "U4.1", burst: false },
        { label: "QA", node: "U4.3" },
        { label: "QB", node: "U4.4" },
      ],
    },
  ]);
  const edges = (log: [number, 0 | 1][], high: boolean): EdgeLog => ({ rises: log.filter((e) => e[1]).length, falls: log.filter((e) => !e[1]).length, high, log, level: 2.5 });

  it("keeps the latest burst of the channels that take part, and counts replays", () => {
    const s = session(lab);
    const feed = (t: number, e: Snapshot["edges"]) => s.ingest({ t, nodes: {}, parts: {}, events: [], ...(e ? { edges: e } : {}) });
    feed(0.5, { "U4.1": edges([], false), "U4.3": edges([], false), "U4.4": edges([], false) });
    // QA rises alone at 0.90 (no burst); at 0.97 the ripple: QA falls, QB rises 7 ns later. The clock is left out.
    feed(1.0, { "U4.1": edges([[0.9, 1]], true), "U4.3": edges([[0.9, 1], [0.97, 0]], false), "U4.4": edges([[0.97 + 7e-9, 1]], true) });
    feed(1.1, {});
    const tv = s.view().timing("td");
    expect(tv.burst).not.toBeNull();
    expect(tv.burst!.start).toBe(0.97);
    expect(tv.burst!.end - tv.burst!.start).toBeCloseTo(7e-9, 15);
    expect(Object.keys(tv.burst!.channels).sort()).toEqual(["QA", "QB"]);
    expect(tv.burst!.states.map((x) => x.levels)).toEqual([
      { QA: 0, QB: 0 },
      { QA: 0, QB: 1 },
    ]);
    expect(tv.replays).toBe(0);
    s.answer("td", "replay");
    expect(s.view().timing("td")).toMatchObject({ replays: 1, replayed: 0.97 });
    expect(s.view().edges("U4.3")).toMatchObject({ rises: 1, falls: 1, exact: true });
  });
});

describe("chip x-ray", () => {
  it("notes what the 555 did only while its x-ray is open, and opens from a solution step", () => {
    const s = session(labWith([{ kind: "xray", id: "xr", part: "U1", pins: [1, 8, 2, 3] }]));
    const at = (t: number, extra: Record<string, unknown>) => s.ingest({ t, nodes: {}, parts: { U1: part({ extra: { powered: true, ...extra } as PartState["extra"] }) }, events: [] });
    at(0.1, { trigger: true, latch: true, output: "high" });
    expect(s.view().panel("xr").cells).toEqual({});
    s.answer("xr", "open");
    expect(s.view().view("xray:U1")).toBe(true);
    at(0.2, { trigger: true, latch: true, output: "high" });
    at(0.3, { threshold: true, latch: false, output: "low", discharge: true });
    expect(s.view().panel("xr").cells).toEqual({ trigger: true, latch: true, high: true, threshold: true, low: true, discharge: true });
    s.answer("xr", "close");
    expect(s.view().view("xray:U1")).toBe(false);
  });
});

describe("truth table, extended", () => {
  it("buttons in, a node's level out: every combination logged once steady, complete at four rows", () => {
    const cfg: PanelConfig = {
      kind: "truth-table",
      id: "tt",
      inputs: [
        { part: "SA", label: "A" },
        { part: "SB", label: "B" },
      ],
      outputs: [{ node: "y", label: "Y" }, { part: "D1" }],
      mystery: true,
      name: "AND",
    };
    const s = session(labWith([cfg]));
    let t = 0;
    for (const [a, b] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const y = a && b ? 5 : 0;
      for (let k = 0; k < 15; k++) {
        t += 1 / 30;
        s.ingest({ t, nodes: { y, v: 5 }, parts: { SA: part({ closed: !!a }), SB: part({ closed: !!b }), D1: part({ glow: a && b ? 0.8 : 0 }) }, events: [] });
      }
    }
    const st = s.view().panel("tt");
    expect(st.cells).toEqual({ "0,0": false, "1,0": false, "0,1": false, "1,1": true, "0,0#1": false, "1,0#1": false, "0,1#1": false, "1,1#1": true });
    expect(st.size).toBe(8);
    expect(truthComplete(cfg as Extract<PanelConfig, { kind: "truth-table" }>, st)).toBe(true);
  });
});

describe("stopwatch triggers", () => {
  it("stops when a lamp goes dark (halfway between snapshots) or exactly when a watched node falls", () => {
    const lit: StopwatchConfig = { kind: "stopwatch", start: { part: "S1", pressed: true }, stop: { part: "D1", lit: false } };
    const node: StopwatchConfig = { kind: "stopwatch", start: { part: "S1", pressed: true }, stop: { node: "out", below: 4 } };
    for (const sw of [lit, node]) {
      const s = session(labWith([], { instruments: [sw] }));
      for (let k = 1; k <= 150; k++) {
        const t = k / 30;
        const pressed = t >= 1 && t < 1.2;
        const on = t >= 1 && t < 4.01;
        const fell: [number, 0 | 1][] = Math.abs(t - 121 / 30) < 1e-9 ? [[4.0123, 0]] : [];
        s.ingest({
          t,
          nodes: { out: on ? 7.6 : 0 },
          parts: { S1: part({ extra: { pressed } }), D1: part({ i: on ? 0.006 : 0, glow: on ? 0.7 : 0 }) },
          events: [],
          edges: { "out@4": { rises: 0, falls: fell.length, high: on, log: fell, level: 4 } },
        });
      }
      const [run] = s.view().runs();
      expect(run).toBeDefined();
      const stop = sw === lit ? (120 / 30 + 121 / 30) / 2 : 4.0123;
      expect(run!.stop).toBeCloseTo(stop, 9);
    }
  });
});
