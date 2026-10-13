// Resistor colour code and value formatting. Pure functions.

export type BandColor =
  | "black"
  | "brown"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "violet"
  | "grey"
  | "white"
  | "gold"
  | "silver";

export const DIGIT_COLORS: readonly BandColor[] = [
  "black",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "violet",
  "grey",
  "white",
];

const TOLERANCE_COLORS: Record<string, BandColor> = {
  "1": "brown",
  "2": "red",
  "0.5": "green",
  "0.25": "blue",
  "0.1": "violet",
  "0.05": "grey",
  "5": "gold",
  "10": "silver",
};

/** Body-paint colours tuned to read clearly under the bench lights (sRGB hex). */
export const BAND_HEX: Record<BandColor, string> = {
  black: "#141414",
  brown: "#6e3b1c",
  red: "#d0211c",
  orange: "#f2731c",
  yellow: "#f6d01c",
  green: "#1f9a45",
  blue: "#1f5fd6",
  violet: "#7c3cc0",
  grey: "#8d8d8d",
  white: "#f4f4f2",
  gold: "#c79a2e",
  silver: "#b9bcc2",
};

/**
 * Colour bands for a resistor value, read from the end nearest the first band.
 * 4 bands: two digits, multiplier, tolerance. 5 bands: three digits, multiplier, tolerance.
 * Values are rounded to the number of significant digits the band count can show.
 */
export function resistorBands(ohms: number, bands: 4 | 5 = 4, tolerance?: number): BandColor[] {
  if (!(ohms > 0) || !Number.isFinite(ohms)) throw new Error(`Bad resistor value: ${ohms}`);
  const n = bands === 5 ? 3 : 2;
  const [mant, expStr] = ohms.toExponential(n - 1).split("e");
  const digits = (mant ?? "").replace(".", "").split("").map(Number);
  let exp = Number(expStr) - (n - 1);
  if (exp < -2) {
    // Below 0.1 ohm (4-band) the code cannot show it; clamp to the smallest multiplier.
    exp = -2;
  }
  if (exp > 9) throw new Error(`Resistor value too large for the colour code: ${ohms}`);
  const mult: BandColor = exp === -1 ? "gold" : exp === -2 ? "silver" : DIGIT_COLORS[exp]!;
  const tol = tolerance ?? (bands === 5 ? 1 : 5);
  const tolColor = TOLERANCE_COLORS[String(tol)] ?? "gold";
  return [...digits.map((d) => DIGIT_COLORS[d]!), mult, tolColor];
}

/** Ohms represented by a set of bands (inverse of resistorBands, ignoring tolerance). */
export function bandsToOhms(bands: BandColor[]): number {
  const valueBands = bands.slice(0, -1);
  const multBand = valueBands.pop()!;
  const digits = valueBands.map((b) => DIGIT_COLORS.indexOf(b));
  const exp = multBand === "gold" ? -1 : multBand === "silver" ? -2 : DIGIT_COLORS.indexOf(multBand);
  const n = digits.reduce((acc, d) => acc * 10 + d, 0);
  return Number((n * 10 ** exp).toPrecision(6));
}

const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];

/** True when the value is a standard E12 (or, with series 24, E24) preferred value. */
export function isPreferredValue(ohms: number, series: 12 | 24 = 12): boolean {
  const exp = Math.floor(Math.log10(ohms)) - 1;
  const m = Math.round((ohms / 10 ** exp) * 1000) / 1000;
  return (series === 12 ? E12 : E24).some((v) => Math.abs(v - m) < 1e-6);
}

function trim(n: number): string {
  return Number(n.toPrecision(3)).toString();
}

/** "470 Ω", "4.7 kΩ", "1 MΩ". */
export function formatOhms(ohms: number): string {
  if (ohms >= 1e6) return `${trim(ohms / 1e6)} MΩ`;
  if (ohms >= 1e3) return `${trim(ohms / 1e3)} kΩ`;
  return `${trim(ohms)} Ω`;
}

/** "100 µF", "10 nF", "47 pF". */
export function formatFarads(f: number): string {
  if (f >= 1e-6) return `${trim(f * 1e6)} µF`;
  if (f >= 1e-9) return `${trim(f * 1e9)} nF`;
  return `${trim(f * 1e12)} pF`;
}

/** Three-digit ceramic capacitor code in picofarads: 100 nF is "104", 22 pF is "22". */
export function ceramicCode(farads: number): string {
  const pf = Math.round(farads * 1e12);
  if (pf < 100) return String(pf);
  const exp = Math.floor(Math.log10(pf)) - 1;
  const two = Math.round(pf / 10 ** exp);
  return `${two}${exp}`;
}
