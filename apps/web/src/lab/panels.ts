/**
 * Lab panels, the logic half (pure): continuity and truth tables that fill themselves from the bench, the chip
 * x-ray's sightings, the dice reader, and answer panels (pin map, tags, hole hunt, symbol) that check what the learner
 * submits. The session keeps one PanelState per panel; the UI lives in panels-ui.tsx and the chip panels' files.
 */
import { boardGeometry, isThrowSwitch, partLegs, physicalLeg, terminalNumber, wiredAs, type BenchState, type PlacedPart } from "@ohmland/bench/core";
import type { PartState } from "@ohmland/sim";
import type { LabView, PanelConfig, PanelState, SymbolKind, TruthInput, TruthOutput } from "./define";
import { faceOf } from "./signals";

type TruthTable = Extract<PanelConfig, { kind: "truth-table" }>;

export const emptyPanel = (size = 0): PanelState => ({ cells: {}, size, answer: null, submissions: 0, wrong: 0, correct: false });

/** Unordered pairs of a part's legs, in leg order. */
export function legPairs(part: PlacedPart): [string, string][] {
  const legs = partLegs(part);
  const out: [string, string][] = [];
  for (let i = 0; i < legs.length; i++) for (let j = i + 1; j < legs.length; j++) out.push([legs[i]!, legs[j]!]);
  return out;
}

/** The two states a continuity table compares: switch positions, or released and held. */
export function partStates(part: PlacedPart): [string, string] {
  return isThrowSwitch(part.kind) ? ["a", "b"] : ["up", "down"];
}

/** Which state a part is in now. */
export function stateOf(part: PlacedPart, lab: LabView): string {
  if (isThrowSwitch(part.kind)) return (part.params as { to: string }).to;
  const s = lab.part(part.id);
  return s?.extra?.["pressed"] === true ? "down" : "up";
}

export const cellKey = (a: string, b: string, state: string) => `${a}|${b}@${state}`;

/**
 * A continuity table drawn on its part (a lesson draws one arc per pair of legs): every pair tested so far, the states
 * it beeped in and the states it was tested in, in table order, and whether it was tested in the state the part is
 * in now (`current`, from stateOf).
 */
export type ContinuityArc = { a: string; b: string; beeps: string[]; tested: string[]; now: boolean };

export function continuityArcs(part: PlacedPart, cells: Readonly<Record<string, unknown>>, current: string | null): ContinuityArc[] {
  const states = partStates(part);
  return legPairs(part).flatMap(([a, b]) => {
    const tested = states.filter((st) => typeof cells[cellKey(a, b, st)] === "boolean");
    if (!tested.length) return [];
    const beeps = tested.filter((st) => cells[cellKey(a, b, st)] === true);
    return [{ a, b, beeps, tested, now: current !== null && tested.includes(current) }];
  });
}

/** Every cell a panel can have (0 for answer panels). */
export function panelSize(cfg: PanelConfig, bench: BenchState): number {
  if (cfg.kind === "continuity") {
    const p = bench.parts.find((x) => x.id === cfg.part);
    return p ? legPairs(p).length * 2 : 0;
  }
  if (cfg.kind === "truth-table") return 2 ** cfg.inputs.length * Math.max(1, truthOutputs(cfg).length);
  if (cfg.kind === "xray") return XRAY_SEEN.length;
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Truth tables

/** A table's outputs: `outputs`, or the single `output`. */
export function truthOutputs(cfg: TruthTable): TruthOutput[] {
  return cfg.outputs ?? (cfg.output ? [cfg.output] : []);
}

/** An input named by its two throws (a and b), as the first truth tables were. */
export const isThrowInput = (inp: TruthInput): inp is Extract<TruthInput, { a: string }> => "a" in inp && "b" in inp;

/** The two values an input takes, in table order. */
export const inputValues = (inp: TruthInput): [string, string] => (isThrowInput(inp) ? ["a", "b"] : ["0", "1"]);

/** Every row of a table (input values joined by commas), first input changing slowest. */
export function truthRows(cfg: TruthTable): string[] {
  let rows: string[][] = [[]];
  for (const inp of cfg.inputs) rows = rows.flatMap((r) => inputValues(inp).map((v) => [...r, v]));
  return rows.map((r) => r.join(","));
}

/** The cell key of output k in a row. */
export const truthCell = (row: string, k: number): string => (k === 0 ? row : `${row}#${k}`);

/** An input's value now: its throw, closed (1) or open (0), or its logic level; null while undefined or floating. */
export function truthInput(inp: TruthInput, lab: LabView): string | null {
  if ("node" in inp) {
    const l = lab.logic(inp.node);
    return l === "H" ? "1" : l === "L" ? "0" : null;
  }
  if (isThrowInput(inp)) {
    const p = lab.benchPart(inp.part);
    if (!p) return "?";
    return isThrowSwitch(p.kind) ? (p.params as { to: string }).to : lab.closed(inp.part) ? "b" : "a";
  }
  return lab.closed(inp.part) ? "1" : "0";
}

/** An output's value now: an LED lit, a node high; null while a node is undefined or floating. */
export function truthOutput(out: TruthOutput, lab: LabView): boolean | null {
  if ("node" in out) {
    const l = lab.logic(out.node);
    return l === "H" ? true : l === "L" ? false : null;
  }
  return lab.isLit(out.part);
}

/** Every row has every output. */
export function truthComplete(cfg: TruthTable, state: PanelState): boolean {
  const outs = Math.max(1, truthOutputs(cfg).length);
  return truthRows(cfg).every((r) => Array.from({ length: outs }, (_, k) => state.cells[truthCell(r, k)]).every((v) => v !== undefined));
}

// ---------------------------------------------------------------------------------------------------------------
// The chip x-ray and the dice

/** What the x-ray of a 555 notes it has shown while open (cells): each watcher firing, the latch set, each output level. */
export const XRAY_SEEN = ["trigger", "threshold", "reset", "discharge", "latch", "high", "low"] as const;

/** Notes what the chip is doing into an open x-ray's cells (only new sightings change the state). */
export function updateXrayPanel(state: PanelState, part: PartState | undefined): PanelState {
  const x = part?.extra;
  if (!x || x["powered"] === false) return state;
  const seen: Record<string, boolean> = {
    trigger: x["trigger"] === true,
    threshold: x["threshold"] === true,
    reset: x["reset"] === true,
    discharge: x["discharge"] === true,
    latch: x["latch"] === true,
    high: x["output"] === "high",
    low: x["output"] === "low",
  };
  const fresh = Object.entries(seen).filter(([k, v]) => v && !state.cells[k]);
  if (!fresh.length) return state;
  return { ...state, cells: { ...state.cells, ...Object.fromEntries(fresh.map(([k]) => [k, true])) } };
}

/** The faces the dice show now (pips lit, one number per die), or null when none of their pips is on the bench. */
export function readFaces(cfg: Extract<PanelConfig, { kind: "histogram" }>, lab: LabView): number[] | null {
  if (cfg.read) return cfg.read(lab);
  if (!cfg.dice.some((pips) => pips.some((id) => lab.part(id)))) return null;
  return cfg.dice.map((pips) => faceOf(pips.map((id) => lab.isLit(id, 0.3))));
}

/** A label for a leg in panels: its terminal number on a mystery part, else its name. */
export function legName(part: PlacedPart, leg: string, names: Record<string, string> = {}): string {
  const n = terminalNumber(part, leg);
  return n !== null ? String(n) : names[leg] ?? leg;
}

/** What wiring the bench has, ignoring switch positions: a truth table restarts when this changes. */
export function wiringKey(bench: BenchState): string {
  const parts = bench.parts.map((p) => `${p.id}:${p.kind}:${JSON.stringify(p.holes ?? {})}`).join(";");
  const leads = bench.leads.map((l) => `${l.a.to}-${l.b.to}`).join(";");
  const wires = bench.wires.map((w) => `${w.a}-${w.b}`).join(";");
  return `${parts}#${leads}#${wires}`;
}

/** Scratch state for auto panels: the candidate reading and since when it has held. */
export type AutoMemory = { key: string; since: number } | null;

const STEADY = 0.25;

/**
 * Updates an auto panel from the current view. Continuity: the meter on continuity with the probes on two legs of the
 * part logs beep or open for that pair in the part's current state. Truth table: the switch positions and the LED,
 * once steady.
 */
export function updateAutoPanel(cfg: PanelConfig, state: PanelState, lab: LabView, mem: { last: AutoMemory }): PanelState {
  if (cfg.kind === "continuity") {
    const part = lab.benchPart(cfg.part);
    const m = lab.meter;
    if (!part || !m || m.mode !== "continuity" || m.display === null || !m.redAt || !m.blackAt) {
      mem.last = null;
      return state;
    }
    const legs = partLegs(part);
    const legAt = (probe: "red" | "black") => legs.filter((l) => lab.connected(`probe:${probe}`, `pin:${part.id}.${l}`));
    const r = legAt("red");
    const b = legAt("black");
    if (r.length !== 1 || b.length !== 1 || r[0] === b[0]) {
      mem.last = null;
      return state;
    }
    const [x, y] = legs.indexOf(r[0]!) < legs.indexOf(b[0]!) ? [r[0]!, b[0]!] : [b[0]!, r[0]!];
    const beep = m.beep || (m.value !== null && Number.isFinite(m.value) && (m.si ?? Infinity) < 30);
    const key = `${cellKey(x, y, stateOf(part, lab))}=${beep}`;
    if (!mem.last || mem.last.key !== key) {
      mem.last = { key, since: lab.t };
      return state;
    }
    if (lab.t - mem.last.since < STEADY) return state;
    const cell = cellKey(x, y, stateOf(part, lab));
    if (state.cells[cell] === beep) return state;
    return { ...state, cells: { ...state.cells, [cell]: beep } };
  }
  if (cfg.kind === "truth-table") {
    const pos = cfg.inputs.map((inp) => truthInput(inp, lab));
    const outs = truthOutputs(cfg).map((o) => truthOutput(o, lab));
    if (pos.some((v) => v === null)) {
      mem.last = null;
      return state;
    }
    const row = pos.join(",");
    const key = `${row}=${outs.join(",")}`;
    if (!mem.last || mem.last.key !== key) {
      mem.last = { key, since: lab.t };
      return state;
    }
    if (lab.t - mem.last.since < STEADY + 0.05) return state;
    const add: Record<string, boolean> = {};
    outs.forEach((v, k) => {
      if (v !== null && state.cells[truthCell(row, k)] !== v) add[truthCell(row, k)] = v;
    });
    if (!Object.keys(add).length) return state;
    return { ...state, cells: { ...state.cells, ...add } };
  }
  return state;
}

/** The answer a solution step gives, in the panel's own terms (pin maps name wired legs; the bench knows which terminal that is). */
export function solutionAnswer(cfg: PanelConfig, value: unknown, bench: BenchState): unknown {
  if (cfg.kind !== "pin-map" || !value || typeof value !== "object") return value;
  const part = bench.parts.find((p) => p.id === cfg.part);
  if (!part) return value;
  const out: Record<string, string> = {};
  for (const [fn, role] of Object.entries(value as Record<string, string>)) out[physicalLeg(part, fn)] = role;
  return out;
}

/** Whether a pin map answer (terminal leg -> role) is right, allowing the swap groups to trade places. */
export function pinMapRight(cfg: Extract<PanelConfig, { kind: "pin-map" }>, part: PlacedPart, answer: Record<string, string>): boolean {
  const legs = partLegs(part);
  const rolesOf = new Map(cfg.roles.map((r) => [r.id, r]));
  const check = (rename: (role: string) => string) =>
    legs.every((leg) => {
      const given = answer[leg];
      if (!given) return false;
      const role = rolesOf.get(rename(given));
      return !!role && role.legs.includes(wiredAs(part, leg));
    });
  if (check((r) => r)) return true;
  if (!cfg.swap) return false;
  const [a, b] = cfg.swap;
  const swapMap = new Map<string, string>();
  a.forEach((x, i) => {
    const y = b[i];
    if (y) {
      swapMap.set(x, y);
      swapMap.set(y, x);
    }
  });
  return check((r) => swapMap.get(r) ?? r);
}

/** The holes joined to `start` by the board's metal: its strip (or rail). */
export function holeNet(bench: BenchState, start: string): string[] {
  if (!bench.board) return [];
  const g = boardGeometry(bench.board);
  const h = g.holes.get(start);
  return h ? [...(g.strips.get(h.strip)?.holes ?? [])] : [];
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Checks a submitted answer and counts it. */
export function submitPanel(cfg: PanelConfig, state: PanelState, value: unknown, bench: BenchState): PanelState {
  let correct = false;
  switch (cfg.kind) {
    case "pin-map": {
      const part = bench.parts.find((p) => p.id === cfg.part);
      correct = !!part && !!value && typeof value === "object" && pinMapRight(cfg, part, value as Record<string, string>);
      break;
    }
    case "tags": {
      const v = (value ?? {}) as Record<string, string>;
      correct = Object.entries(cfg.answer).every(([k, o]) => v[k] === o);
      break;
    }
    case "hole-hunt": {
      const picked = Array.isArray(value) ? (value as string[]) : [];
      correct = sameSet(picked, holeNet(bench, cfg.start));
      break;
    }
    case "symbol": {
      const v = value as { slots?: SymbolKind[]; linked?: boolean } | null;
      const want = cfg.answer;
      const got = v?.slots ?? [];
      correct = !!v && v.linked === want.linked && sameSet([...got].sort(), [...want.slots].sort());
      break;
    }
    default:
      return state;
  }
  return { ...state, answer: value, submissions: state.submissions + 1, wrong: state.wrong + (correct ? 0 : 1), correct };
}

