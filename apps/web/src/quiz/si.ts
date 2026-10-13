/**
 * SI quantities as learners type them: "4.7k", "4k7", "470", "0.047", "47m", "20 mA", "4.7 kΩ", "4R7", "1e3 ohm".
 * Pure functions, no DOM. Values are always returned in base units (ohms, volts, amps ...).
 */

export type BaseUnit = "Ω" | "V" | "A" | "W" | "F" | "Hz" | "s";
export type Prefix = "p" | "n" | "µ" | "m" | "" | "k" | "M" | "G";

export const PREFIX_FACTOR: Record<Prefix, number> = { p: 1e-12, n: 1e-9, "µ": 1e-6, m: 1e-3, "": 1, k: 1e3, M: 1e6, G: 1e9 };
const PREFIX_ORDER: Prefix[] = ["p", "n", "µ", "m", "", "k", "M", "G"];

export type UnitSpec = { prefix: Prefix; base: BaseUnit };

/** Whole-word spellings of each base unit, compared case-insensitively. */
const BASE_ALIASES: Record<BaseUnit, string[]> = {
  "Ω": ["ω", "ohm", "ohms"],
  V: ["v", "volt", "volts"],
  A: ["a", "amp", "amps", "ampere", "amperes"],
  W: ["w", "watt", "watts"],
  F: ["f", "farad", "farads"],
  Hz: ["hz", "hertz"],
  s: ["s", "sec", "secs", "second", "seconds"],
};

function baseOf(word: string): BaseUnit | null {
  const w = word.toLowerCase();
  for (const [base, aliases] of Object.entries(BASE_ALIASES) as [BaseUnit, string[]][]) if (aliases.includes(w)) return base;
  return null;
}

/** A prefix letter. Case matters for m (milli) and M (mega); K is accepted as kilo, u as micro. */
function prefixOf(ch: string): Prefix | null {
  switch (ch) {
    case "p": return "p";
    case "n": return "n";
    case "u": case "µ": return "µ";
    case "m": return "m";
    case "k": case "K": return "k";
    case "M": return "M";
    case "G": return "G";
    default: return null;
  }
}

/** Normalises look-alike characters: the ohm sign, Greek mu, a typographic minus, non-breaking spaces. */
function clean(s: string): string {
  return s
    .replace(/Ω/g, "Ω")
    .replace(/μ/g, "µ")
    .replace(/−/g, "-")
    .replace(/[  ]/g, " ")
    .trim();
}

/** Splits a unit suffix such as "kΩ", "mA", "kohm", "meg", "m" into a prefix and an optional base unit. */
export function parseUnitSuffix(raw: string): { prefix: Prefix; base: BaseUnit | null } | null {
  const s = clean(raw).replace(/\s+/g, "");
  if (s === "") return { prefix: "", base: null };
  const whole = baseOf(s);
  if (whole) return { prefix: "", base: whole };
  if (/^meg(?:a)?/i.test(s)) {
    const rest = s.replace(/^meg(?:a)?/i, "");
    const base = rest === "" ? null : baseOf(rest);
    return rest === "" || base ? { prefix: "M", base } : null;
  }
  const prefix = prefixOf(s[0] ?? "");
  if (prefix === null) return null;
  const rest = s.slice(1);
  if (rest === "") return { prefix, base: null };
  const base = baseOf(rest);
  return base ? { prefix, base } : null;
}

/** Parses an item's unit as written in content ("mA", "kΩ", "V"). Throws on anything else: content must be valid. */
export function parseUnit(unit: string): UnitSpec {
  const u = parseUnitSuffix(unit);
  if (!u || !u.base) throw new Error(`Unknown unit "${unit}"`);
  return { prefix: u.prefix, base: u.base };
}

export function isValidUnit(unit: string): boolean {
  const u = parseUnitSuffix(unit);
  return !!u && !!u.base;
}

export type ParsedQuantity = {
  /** The number as typed, before any prefix ("4.7" in "4.7k"). */
  number: number;
  /** Explicit prefix, or null when the learner typed none. */
  prefix: Prefix | null;
  /** Explicit base unit, or null when the learner typed none. */
  base: BaseUnit | null;
  /** number times the prefix factor: the value in base units if a prefix or unit was typed. */
  value: number;
};

export type ParseError = { error: "empty" | "format" | "unit" };

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i;

/** Accepts a decimal comma ("4,7") and thousands commas ("4,700"). */
function normaliseCommas(s: string): string {
  if (!s.includes(",")) return s;
  if (s.includes(".")) return s.replace(/,/g, "");
  if (/^[+-]?\d{1,3}(?:,\d{3})+(?!\d)/.test(s)) return s.replace(/,/g, "");
  return s.replace(",", ".");
}

export function parseQuantity(input: string): ParsedQuantity | ParseError {
  let s = clean(input);
  if (s === "") return { error: "empty" };
  s = normaliseCommas(s);

  // Resistor-style notation: a prefix letter (or R) used as the decimal point, "4k7", "2M2", "4R7", "1n5".
  const infix = /^([+-]?)(\d+)([pnuµmkKMGR])(\d+)\s*(.*)$/.exec(s);
  if (infix) {
    const [, sign, whole, letter, frac, rest] = infix as unknown as [string, string, string, string, string, string];
    const prefix: Prefix | null = letter === "R" ? "" : prefixOf(letter);
    if (prefix === null) return { error: "format" };
    let base: BaseUnit | null = letter === "R" ? "Ω" : null;
    if (rest !== "") {
      const b = baseOf(rest.replace(/\s+/g, ""));
      if (!b) return { error: "unit" };
      if (letter === "R" && b !== "Ω") return { error: "unit" };
      base = b;
    }
    const number = Number(`${sign}${whole}.${frac}`);
    return { number, prefix: letter === "R" ? null : prefix, base, value: scale(number, prefix) };
  }

  const m = NUMBER.exec(s);
  if (!m) return { error: "format" };
  const number = Number(m[0]);
  if (!Number.isFinite(number)) return { error: "format" };
  const suffix = s.slice(m[0].length).trim();
  if (suffix === "") return { number, prefix: null, base: null, value: number };
  const unit = parseUnitSuffix(suffix);
  if (!unit) return { error: /^[\d.,]/.test(suffix) ? "format" : "unit" };
  return { number, prefix: unit.prefix === "" ? null : unit.prefix, base: unit.base, value: scale(number, unit.prefix) };
}

export function isParseError(p: ParsedQuantity | ParseError): p is ParseError {
  return "error" in p;
}

/** number times 10^k without float noise for the usual cases (4.7 * 1000 = 4700, not 4700.000000000001). */
export function scale(n: number, prefix: Prefix): number {
  const f = PREFIX_FACTOR[prefix];
  const v = n * f;
  return Number(v.toPrecision(12));
}

/** Formats a base-unit value with an engineering prefix: 0.0149 A -> "14.9 mA", 4700 Ω -> "4.7 kΩ". */
export function formatSI(value: number, base: BaseUnit, digits = 3): string {
  if (value === 0) return `0\u00a0${base}`;
  const abs = Math.abs(value);
  let chosen: Prefix = "";
  for (const p of PREFIX_ORDER) {
    const f = PREFIX_FACTOR[p];
    if (abs / f >= 1 - 1e-12 && abs / f < 1000) chosen = p;
  }
  if (abs < PREFIX_FACTOR.p) chosen = "p";
  if (abs >= 1000 * PREFIX_FACTOR.G) chosen = "G";
  const n = value / PREFIX_FACTOR[chosen];
  return `${formatNumber(n, digits)}\u00a0${chosen}${base}`;
}

/** Up to `digits` significant figures, no trailing zeros, no exponent. */
export function formatNumber(n: number, digits = 3): string {
  const rounded = Number(n.toPrecision(digits));
  return String(rounded);
}

export type NumericSpec = { answer: number; unit: string; tolerance: number };

export type NumericGrade =
  | { status: "correct"; value: number }
  | { status: "invalid"; reason: ParseError["error"] }
  | { status: "wrong-unit"; got: BaseUnit; want: BaseUnit }
  | {
      status: "prefix";
      value: number;
      /** The digits as typed ("0.015"). */
      digits: string;
      /** The unit the digits were read in ("mA" for a bare number in a mA box, or the unit the learner typed). */
      typedUnit: string;
      /** The unit in which those digits would have been right ("A"). */
      rightUnit: string;
      /** The same amount written in the box's unit ("15 mA"). */
      inBoxUnit: string;
      /** Whether the learner typed a prefix or unit themselves. */
      explicit: boolean;
      factor: number;
    }
  | { status: "wrong"; value: number; direction: "high" | "low"; factor10: boolean };

function near(a: number, b: number, tolPercent: number): boolean {
  if (b === 0) return Math.abs(a) < 1e-12;
  return Math.abs(a - b) <= (Math.abs(b) * tolPercent) / 100 + Math.abs(b) * 1e-9;
}

/**
 * Grades a typed answer. A bare number is read in the item's own unit ("15" in a mA box is 15 mA). A number with a
 * prefix but no unit ("4.7k") is read against the base unit. When the number would be right with another prefix
 * (0.015 typed in a mA box when the answer is 15 mA), the result says so, so the learner gets a useful nudge.
 */
export function gradeNumeric(input: string, spec: NumericSpec): NumericGrade {
  const want = parseUnit(spec.unit);
  const expected = scale(spec.answer, want.prefix);
  const parsed = parseQuantity(input);
  if (isParseError(parsed)) return { status: "invalid", reason: parsed.error };
  if (parsed.base && parsed.base !== want.base) return { status: "wrong-unit", got: parsed.base, want: want.base };

  const typedPrefix: Prefix = parsed.prefix ?? (parsed.base ? "" : want.prefix);
  const value = parsed.prefix !== null || parsed.base !== null ? parsed.value : scale(parsed.number, want.prefix);
  if (near(value, expected, spec.tolerance)) return { status: "correct", value };

  // Would the same digits be right under another prefix? Then it is a prefix slip, not a maths slip.
  for (const p of PREFIX_ORDER) {
    if (p === typedPrefix) continue;
    const ratio = PREFIX_FACTOR[p] / PREFIX_FACTOR[typedPrefix];
    if (ratio !== 1e3 && ratio !== 1e-3 && ratio !== 1e6 && ratio !== 1e-6) continue;
    if (near(scale(parsed.number, p), expected, spec.tolerance)) {
      const inBox = scale(parsed.number, p) / PREFIX_FACTOR[want.prefix];
      return {
        status: "prefix",
        value,
        digits: formatNumber(parsed.number, 6),
        typedUnit: `${typedPrefix}${want.base}`,
        rightUnit: `${p}${want.base}`,
        inBoxUnit: `${formatNumber(inBox, 6)}\u00a0${spec.unit}`,
        explicit: parsed.prefix !== null || parsed.base !== null,
        factor: ratio >= 1 ? ratio : 1 / ratio,
      };
    }
  }
  const ratio = expected === 0 ? 0 : value / expected;
  const factor10 = near(ratio, 10, spec.tolerance) || near(ratio, 0.1, spec.tolerance);
  return { status: "wrong", value, direction: value > expected ? "high" : "low", factor10 };
}
