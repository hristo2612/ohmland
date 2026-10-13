/**
 * The resistor colour code, as pure functions. Four-band resistors carry two digits, a multiplier and a tolerance band;
 * five-band resistors carry three digits. Gold and silver multipliers (x0.1, x0.01) cover values under 10 Ω.
 */

export const DIGIT_COLORS = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "grey", "white"] as const;
export type DigitColor = (typeof DIGIT_COLORS)[number];
export type BandColor = DigitColor | "gold" | "silver";
export const ALL_BAND_COLORS: readonly BandColor[] = [...DIGIT_COLORS, "gold", "silver"];

/** Multiplier band: the power of ten. */
export const MULTIPLIER_EXP: Record<BandColor, number> = {
  black: 0, brown: 1, red: 2, orange: 3, yellow: 4, green: 5, blue: 6, violet: 7, grey: 8, white: 9, gold: -1, silver: -2,
};

/** Tolerance band, in percent. */
export const TOLERANCE_PERCENT: Partial<Record<BandColor, number>> = {
  brown: 1, red: 2, green: 0.5, blue: 0.25, violet: 0.1, grey: 0.05, gold: 5, silver: 10,
};

export const MULTIPLIER_COLORS: readonly BandColor[] = ALL_BAND_COLORS;
export const TOLERANCE_COLORS: readonly BandColor[] = ["gold", "silver", "brown", "red", "green", "blue", "violet", "grey"];

export type BandCount = 4 | 5;

export function digitOf(color: BandColor): number | null {
  const i = (DIGIT_COLORS as readonly string[]).indexOf(color);
  return i === -1 ? null : i;
}

/** n * 10^exp, exact for the small integers the colour code produces (47 * 10^-1 is 4.7, not 4.700000000000001). */
function times10(n: number, exp: number): number {
  return exp >= 0 ? n * 10 ** exp : n / 10 ** -exp;
}

/**
 * The bands for a value, digits then multiplier then tolerance, or null when the value cannot be written with that
 * many digits (for example 4.75 kΩ on a four-band resistor, or anything under 0.1 Ω).
 */
export function bandsForOhms(ohms: number, bands: BandCount = 4, tolerance: BandColor = "gold"): BandColor[] | null {
  if (!(ohms > 0) || !Number.isFinite(ohms)) return null;
  const digits = bands === 4 ? 2 : 3;
  for (let exp = -2; exp <= 9; exp++) {
    const mantissa = Math.round(times10(ohms, -exp) * 1e6) / 1e6;
    if (!Number.isInteger(mantissa)) continue;
    if (mantissa < 10 ** (digits - 1) || mantissa >= 10 ** digits) continue;
    const ds = String(mantissa).split("").map((d) => DIGIT_COLORS[Number(d)] as BandColor);
    const mult = (Object.keys(MULTIPLIER_EXP) as BandColor[]).find((c) => MULTIPLIER_EXP[c] === exp);
    if (!mult) return null;
    return [...ds, mult, tolerance];
  }
  return null;
}

/** The value of a set of bands (digits, multiplier, then an optional tolerance band), or null when they make no value. */
export function ohmsForBands(colors: readonly BandColor[], bands: BandCount = 4): number | null {
  const digits = bands === 4 ? 2 : 3;
  if (colors.length !== digits + 1 && colors.length !== digits + 2) return null;
  let n = 0;
  for (let i = 0; i < digits; i++) {
    const d = digitOf(colors[i] as BandColor);
    if (d === null) return null;
    n = n * 10 + d;
  }
  const mult = colors[digits] as BandColor;
  const value = times10(n, MULTIPLIER_EXP[mult]);
  return Number(value.toPrecision(12));
}

export function canWriteWithBands(ohms: number, bands: BandCount): boolean {
  return bandsForOhms(ohms, bands) !== null;
}

/** Whether two values are the same resistance (guards against float noise only). */
export function sameOhms(a: number | null, b: number): boolean {
  return a !== null && Math.abs(a - b) <= Math.abs(b) * 1e-9;
}
