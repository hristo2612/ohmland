/**
 * Solution steps -> bench changes and simulator inputs. Pure: the headless replay test and "Show me" both use it.
 */
import { benchOps, defaultParams, isThrowSwitch, type BenchState, type LeadColor, type PlacedPart, type WireColor } from "@ohmland/bench/core";
import { resolveAttach, resolveHole } from "./anchors";
import { addLeadBetween, placePart, type SimInput } from "./build";
import type { SolutionStep } from "./define";

export type StepEffect = {
  bench: BenchState;
  /** Inputs to send after loading the new bench. `after` delays an input by simulated seconds (button release). */
  inputs: (SimInput & { after?: number })[];
  /** Simulated seconds to let pass after this step. */
  wait: number;
  note?: { id: string; value: number | string };
  control?: { id: string; value: number };
  /** A panel answer (solution form: pin maps name wired legs). */
  panel?: { id: string; value: unknown };
  /** Switch the auto-tapper on or off. */
  tapper?: boolean;
  /** A task that must be done by now. */
  check?: string;
  /** Something did not apply (for test messages). */
  problem?: string;
};

const LEAD_COLORS: LeadColor[] = ["red", "black", "green", "yellow", "blue", "white"];

/** Default pause after a bench action, so the circuit settles before the next one (simulated seconds). */
export const SETTLE = 0.25;

export function applyStep(bench: BenchState, step: SolutionStep): StepEffect {
  const done = (b: BenchState, extra: Partial<StepEffect> = {}): StepEffect => ({ bench: b, inputs: [], wait: SETTLE, ...extra });
  const meterId = bench.meter?.id ?? "M1";
  switch (step.do) {
    case "place": {
      const part = { id: step.part, kind: step.kind, params: { ...defaultParams(step.kind), ...(step.params ?? {}) }, pos: [0, 40], rot: step.rot ?? 0 } as PlacedPart;
      const r = placePart({ ...bench, parts: bench.parts.filter((p) => p.id !== step.part) }, part, step.at, undefined, () => [0, 60]);
      return done({ ...bench, parts: [...bench.parts.filter((p) => p.id !== step.part), r.part] }, r.warning ? { problem: r.warning } : {});
    }
    case "move": {
      const cur = bench.parts.find((p) => p.id === step.part);
      if (!cur) return done(bench, { problem: `no part ${step.part}` });
      const others = { ...bench, parts: bench.parts.filter((p) => p.id !== step.part) };
      const { holes: _h, ...rest } = cur;
      const r = placePart(others, { ...rest, rot: step.rot ?? cur.rot } as PlacedPart, step.at, undefined, () => cur.pos);
      return done({ ...bench, parts: bench.parts.map((p) => (p.id === step.part ? r.part : p)) }, r.warning ? { problem: r.warning } : {});
    }
    case "rotate":
      return done(benchOps.rotatePart(bench, step.part));
    case "remove":
      return done(benchOps.removePart(bench, step.part));
    case "lead": {
      const from = resolveAttach(bench, step.from);
      const to = resolveAttach(bench, step.to);
      const problem = (step.from && !from) || (step.to && !to) ? `lead: nothing at ${!from ? step.from : step.to}` : undefined;
      const [b] = addLeadBetween(bench, from, to, step.color ?? LEAD_COLORS[bench.leads.length % LEAD_COLORS.length]!, step.id);
      return done(b, problem ? { problem } : {});
    }
    case "clip": {
      const l = bench.leads.find((x) => x.id === step.lead);
      if (!l) return done(bench, { problem: `no lead ${step.lead}` });
      const to = resolveAttach(bench, step.to);
      if (step.to && !to) return done(bench, { problem: `clip: nothing at ${step.to}` });
      const cur = step.end === "a" ? l.a : l.b;
      // An unclipped end drops onto the desk a little in front of where it was.
      const pos: [number, number] = [cur.pos[0], cur.pos[1] + 16];
      return done(benchOps.clipLead(bench, step.lead, step.end, to, to ? undefined : pos));
    }
    case "wire": {
      const a = resolveHole(bench.board, step.from);
      const b = resolveHole(bench.board, step.to);
      if (!a || !b) return done(bench, { problem: `wire: no hole ${!a ? step.from : step.to}` });
      const [next, id] = benchOps.addWire(bench, a, b, (step.color ?? "yellow") as WireColor, step.id);
      return done(next, id ? {} : { problem: `wire: ${a} or ${b} is taken` });
    }
    case "unwire":
      return done(benchOps.removeWire(bench, step.wire));
    case "probe": {
      let b = bench;
      const inputs: SimInput[] = [];
      for (const c of ["red", "black"] as const) {
        const want = step[c];
        if (want === undefined) continue;
        const to = resolveAttach(b, want);
        b = benchOps.touchProbe(b, c, to);
      }
      if (step.mode && b.meter) {
        b = benchOps.setMeterMode(b, step.mode);
        inputs.push({ id: meterId, key: "mode", value: step.mode });
      }
      if (step.range && b.meter) {
        b = { ...b, meter: { ...b.meter, range: step.range } };
        inputs.push({ id: meterId, key: "range", value: step.range });
      }
      return { bench: b, inputs, wait: SETTLE + 0.35 };
    }
    case "plug":
      return done(benchOps.plugProbe(bench, step.probe, step.socket));
    case "dial": {
      let b = benchOps.setMeterMode(bench, step.mode);
      const inputs: SimInput[] = [{ id: meterId, key: "mode", value: step.mode }];
      if (step.range && b.meter) {
        b = { ...b, meter: { ...b.meter, range: step.range } };
        inputs.push({ id: meterId, key: "range", value: step.range });
      }
      return { bench: b, inputs, wait: SETTLE };
    }
    case "flip": {
      const p = bench.parts.find((x) => x.id === step.part);
      if (!p || !isThrowSwitch(p.kind)) return done(bench, { problem: `flip: ${step.part} is not a switch` });
      const to = step.to ?? ((p.params as { to: string }).to === "a" ? "b" : "a");
      return { bench: benchOps.setPartParams(bench, p.id, { to }), inputs: [{ id: p.id, key: "to", value: to }], wait: SETTLE };
    }
    case "press": {
      const s = step.seconds ?? 0.3;
      return { bench, inputs: [{ id: step.part, key: "pressed", value: true }, { id: step.part, key: "pressed", value: false, after: s }], wait: s + SETTLE };
    }
    case "set":
      return { bench, inputs: [{ id: step.part, key: step.key, value: step.value }], wait: SETTLE };
    case "control":
      return { bench, inputs: [], wait: SETTLE, control: { id: step.id, value: step.value } };
    case "replace":
      return { bench, inputs: [{ id: step.part, key: "replace", value: true }], wait: SETTLE };
    case "replaceFuse":
      return { bench, inputs: [{ id: meterId, key: "replaceFuse", value: true }], wait: SETTLE };
    case "note":
      return { bench, inputs: [], wait: 0, note: { id: step.id, value: step.value } };
    case "panel":
      return { bench, inputs: [], wait: SETTLE, panel: { id: step.id, value: step.value } };
    case "tapper":
      return { bench, inputs: [], wait: SETTLE, tapper: step.on };
    case "wait":
      return { bench, inputs: [], wait: step.seconds };
    case "check":
      return { bench, inputs: [], wait: 0, check: step.task };
  }
}

/** Index ranges of the solution that belong to each checked task: steps after the previous check up to this one. */
export function solutionSegments(steps: readonly SolutionStep[]): Map<string, { start: number; end: number }> {
  const out = new Map<string, { start: number; end: number }>();
  let start = 0;
  steps.forEach((s, i) => {
    if (s.do === "check") {
      out.set(s.task, { start, end: i });
      start = i + 1;
    }
  });
  return out;
}
