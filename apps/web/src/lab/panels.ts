/**
 * Lab panels, the logic half (pure): continuity and truth tables that fill themselves from the bench, and answer
 * panels (pin map, tags, hole hunt, symbol) that check what the learner submits. The session keeps one PanelState
 * per panel; the UI lives in panels.tsx.
 */
import { boardGeometry, isThrowSwitch, partLegs, physicalLeg, terminalNumber, wiredAs, type BenchState, type PlacedPart } from "@ohmland/bench/core";
import type { LabView, PanelConfig, PanelState, SymbolKind } from "./define";

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

/** Every cell a panel can have (0 for answer panels). */
export function panelSize(cfg: PanelConfig, bench: BenchState): number {
  if (cfg.kind === "continuity") {
    const p = bench.parts.find((x) => x.id === cfg.part);
    return p ? legPairs(p).length * 2 : 0;
  }
  if (cfg.kind === "truth-table") return 2 ** cfg.inputs.length;
  return 0;
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
    const pos = cfg.inputs.map(({ part: id }) => {
      const p = lab.benchPart(id);
      if (!p) return "?";
      return isThrowSwitch(p.kind) ? (p.params as { to: string }).to : lab.closed(id) ? "b" : "a";
    });
    const lit = lab.isLit(cfg.output.part);
    const key = `${pos.join(",")}=${lit}`;
    if (!mem.last || mem.last.key !== key) {
      mem.last = { key, since: lab.t };
      return state;
    }
    if (lab.t - mem.last.since < STEADY + 0.05) return state;
    const cell = pos.join(",");
    if (state.cells[cell] === lit) return state;
    return { ...state, cells: { ...state.cells, [cell]: lit } };
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

