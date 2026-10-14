// Shared pieces for the Unit 4 counter, logic and arcade labs (docs/curriculum/unit-4.md, sections 5 to 7): rail
// wiring, a 4026B counter with its display, a 74HC chip's supply, and the readings goals need (digits, counts, lit
// bars, a logic probe's lamps). Benches put the battery's 9.4 V on the near rails; chips take their supply from the
// far rails, which are either joined to the near ones (9.4 V benches) or fed 5 V by a 7805 (logic benches).
import type { BenchPart, LabView, WireSpec } from "@ohmland/lab";

/** Rail columns of a half board (bb400) and a full board (bb830): groups of five with a gap between groups. */
export function railCols(board: "half" | "full"): number[] {
  const out: number[] = [];
  const first = board === "full" ? 3 : 1;
  for (let g = 0; g < (board === "full" ? 10 : 5); g++) for (let i = 0; i < 5; i++) out.push(first + g * 6 + i);
  return out;
}

/** A wire spec. */
export const wire = (id: string, from: string, to: string, color: Extract<WireSpec, object>["color"] = "yellow"): WireSpec => ({ id, from, to, color });

/**
 * A 4026B decade counter with pin 1 at e`col` and its display (on a carrier, a resistor per bar) at columns `dcol` to
 * `dcol + 4` (default `col + 10`, to its right), wired bar to bar. Pin 16 and pin 3 (display enable) take the far plus rail; pin 8 and the display's
 * common go to the near minus rail. Pin 2 (inhibit) and pin 15 (reset) go to minus unless the lab wires them itself
 * (`inh: false`, `rst: false`). Clock (pin 1) and carry out (pin 5) are left for the lab.
 */
export function digit(o: { chip: string; display: string; col: number; dcol?: number; ohms: number; board: "half" | "full"; inh?: boolean; rst?: boolean; label?: string }): { parts: BenchPart[]; wires: WireSpec[] } {
  const c = o.col;
  const d = o.dcol ?? c + 10;
  const rails = railCols(o.board);
  const near = (col: number) => rails.reduce((a, b) => (Math.abs(b - col) < Math.abs(a - col) ? b : a));
  const w = (k: string, from: string, to: string, color: Extract<WireSpec, object>["color"]) => wire(`${o.chip}-${k}`, from, to, color);
  const parts: BenchPart[] = [
    { id: o.chip, kind: "chip", at: `e${c}`, params: { model: "4026B" }, locked: true, label: o.label ?? `Counter ${o.chip} (4026B)` },
    { id: o.display, kind: "sevenseg", at: `c${d}`, params: { common: "cathode", carrier: true, segmentOhms: o.ohms }, locked: true, label: `Display ${o.display}` },
  ];
  const wires: WireSpec[] = [
    // Supply: pin 16 to the far plus rail, pin 8 to minus; display enable (pin 3) joined to pin 16's strip.
    w("vdd", `j${c}`, `top+:${near(c)}`, "red"),
    w("vss", `a${c + 7}`, `rail-:${near(c + 7)}`, "black"),
    w("dei", `d${c + 2}`, `h${c}`, "red"),
    // Bars a to g, chip pin to display pin (pins 6 f, 7 g, 9 d, 10 a, 11 e, 12 b, 13 c).
    w("f", `d${c + 5}`, `h${d + 1}`, "green"),
    w("g", `c${c + 6}`, `i${d}`, "green"),
    w("e", `g${c + 5}`, `b${d}`, "blue"),
    w("a", `h${c + 6}`, `j${d + 3}`, "blue"),
    w("d", `i${c + 7}`, `a${d + 1}`, "blue"),
    w("b", `j${c + 4}`, `f${d + 4}`, "blue"),
    w("c", `g${c + 3}`, `d${d + 3}`, "blue"),
    w("com", `a${d + 2}`, `rail-:${near(d + 2)}`, "black"),
  ];
  if (o.inh !== false) wires.push(w("inh", `a${c + 1}`, `rail-:${near(c + 1)}`, "black"));
  if (o.rst !== false) wires.push(w("rst", `j${c + 1}`, `top-:${near(c + 1) === near(c) ? near(c) + 1 : near(c + 1)}`, "black"));
  return { parts, wires };
}

/**
 * The logic rail: a 7805 (VR1) standing in the far half at columns `col` to `col + 2` (in, ground, out), fed from the
 * battery's near plus rail, with 0.33 µF on its input and 0.1 µF on its output. Its 5 V goes onto the far plus rail;
 * the far minus rail is joined to the near one at the board's right end (`last`, a rail column).
 */
export function logicRail(col: number, last: number): { parts: BenchPart[]; wires: WireSpec[] } {
  const c = col;
  return {
    parts: [
      { id: "VR1", kind: "regulator7805", at: `h${c}`, locked: true, label: "5 V regulator VR1 (7805)" },
      { id: "C8", kind: "ceramic-cap", at: `i${c}-i${c + 1}`, params: { farads: 0.33e-6 }, locked: true, label: "0.33 µF capacitor C8" },
      { id: "C9", kind: "ceramic-cap", at: `f${c + 1}-f${c + 2}`, params: { farads: 0.1e-6 }, locked: true, label: "0.1 µF capacitor C9" },
    ],
    wires: [
      wire("V1", `g${c}`, `rail+:${c}`, "red"),
      wire("V2", `j${c + 1}`, `top-:${c + 1}`, "black"),
      wire("V3", `j${c + 2}`, `top+:${c + 2}`, "orange"),
      wire("V4", `top-:${last}`, `rail-:${last}`, "black"),
    ],
  };
}

/** Columns of a 14-pin chip's pins with pin 1 at column `c`: pins 1 to 7 along row e, 8 to 14 back along row f. */
export const pinCol = (c: number, n: number): number => (n <= 7 ? c + n - 1 : c + 14 - n);

/**
 * A 74HC chip with pin 1 at e`col`: pin 14 to the far plus rail, pin 7 to the near minus rail, and the inputs of the
 * gates listed in `spare` tied to minus (quad layout: gate 1 is pins 1 and 2, gate 2 pins 4 and 5, gate 3 pins 9 and
 * 10, gate 4 pins 12 and 13), near ones down to the near rail, far ones up to the far rail. `taken` lists rail holes
 * the lab already uses ("rail-:15").
 */
export function gateChip(o: {
  id: string;
  model: string;
  col: number;
  board: "half" | "full";
  spare: number[];
  /** Input pins to tie to minus, instead of `spare`'s gates (a 74HC02, 04 or 27 has its own layout). */
  tie?: number[];
  taken?: string[];
  label?: string;
  hidden?: string;
  locked?: boolean;
}): { parts: BenchPart[]; wires: WireSpec[] } {
  const c = o.col;
  const rails = railCols(o.board);
  const used = new Set<string>(o.taken ?? []);
  const rail = (side: "rail-" | "top-" | "top+", col: number) => {
    const sorted = [...rails].sort((a, b) => Math.abs(a - col) - Math.abs(b - col) || a - b);
    const pick = sorted.find((r) => !used.has(`${side}:${r}`))!;
    used.add(`${side}:${pick}`);
    return `${side}:${pick}`;
  };
  const w = (k: string, from: string, to: string, color: Extract<WireSpec, object>["color"]) => wire(`${o.id}-${k}`, from, to, color);
  const wires: WireSpec[] = [w("vcc", `j${c}`, rail("top+", c), "red"), w("gnd", `a${c + 6}`, rail("rail-", c + 6), "black")];
  const ins: Record<number, number[]> = { 1: [1, 2], 2: [4, 5], 3: [9, 10], 4: [12, 13] };
  for (const n of o.tie ?? o.spare.flatMap((g) => ins[g] ?? [])) {
    const col = pinCol(c, n);
    wires.push(n <= 7 ? w(`t${n}`, `a${col}`, rail("rail-", col), "black") : w(`t${n}`, `j${col}`, rail("top-", col), "black"));
  }
  const params: Record<string, unknown> = { model: o.model };
  if (o.hidden) Object.assign(params, { hidden: true, label: o.hidden });
  return { parts: [{ id: o.id, kind: "chip", at: `e${c}`, params, locked: o.locked ?? true, label: o.label ?? `${o.model} ${o.id}` } as BenchPart], wires };
}

// ---------------------------------------------------------------------------------------------------------------
// Readings for goals.

/** The bars a display shows lit, a to g in order ("bcfg" is a 4); the dot is left out. */
export function bars(lab: LabView, ds: string): string {
  const s = lab.part(ds)?.extra?.["lit"];
  return typeof s === "string" ? s.replace("dp", "") : "";
}

/** The digit a display shows ("7"), " " when dark, "" for a shape that is no digit. */
export function shown(lab: LabView, ds: string): string {
  const s = lab.part(ds)?.extra?.["digit"];
  return typeof s === "string" ? s : "";
}

/** The digits several displays show, most significant first ("19"); null while any of them shows no digit. */
export function reading(lab: LabView, displays: string[]): string | null {
  const ds = displays.map((d) => shown(lab, d));
  return ds.every((x) => /^\d$/.test(x)) ? ds.join("") : null;
}

/** A counter's state: a 4026B's count, a 74HC393's first counter. */
export function count(lab: LabView, chip: string): number | null {
  const x = lab.part(chip)?.extra;
  const n = x?.["count"] ?? x?.["count1"];
  return typeof n === "number" ? n : null;
}

/**
 * What a logic probe's lamps show: "H" above 70% and "L" below 30% of the supply its clips give it, "-" for neither
 * (between, or a tip on nothing), null while it has no power (under 3 V across its clips).
 */
export function probe(lab: LabView, id: string): "H" | "L" | "-" | null {
  const vcc = lab.volts(`${id}.vcc`);
  const gnd = lab.volts(`${id}.gnd`);
  if (vcc === undefined || gnd === undefined || vcc - gnd < 3) return null;
  const tip = lab.volts(`${id}.tip`);
  if (tip === undefined) return "-";
  const f = (tip - gnd) / (vcc - gnd);
  return f > 0.7 ? "H" : f < 0.3 ? "L" : "-";
}

/** Remembers that `cond` has been seen (under `key` in the task's memory) and says whether it has. */
export function seen(lab: LabView, key: string, cond: boolean): boolean {
  if (cond) lab.memory[key] = true;
  return lab.memory[key] === true;
}

/** How many single steps up a counter took over the last `seconds` (a 9 to 0 rollover counts as one). */
export function stepsUp(lab: LabView, chip: string, seconds = 20, mod = 10): number {
  const v = lab.values(`count:${chip}`, seconds);
  let n = 0;
  for (let k = 1; k < v.length; k++) if (v[k] === (v[k - 1]! + 1) % mod) n++;
  return n;
}

/** A counter went from `a` straight to `b` within the last `seconds`. */
export function went(lab: LabView, chip: string, a: number, b: number, seconds = 30): boolean {
  const v = lab.values(`count:${chip}`, seconds);
  for (let k = 1; k < v.length; k++) if (v[k - 1] === a && v[k] === b) return true;
  return false;
}

/** A counter's value at time `t` from its history (the last sample at or before it), or null. */
export function countAt(lab: LabView, chip: string, t: number, seconds = 30): number | null {
  let out: number | null = null;
  for (const [ts, v] of lab.history(`count:${chip}`, seconds)) if (ts <= t + 1e-9) out = v;
  return out;
}
