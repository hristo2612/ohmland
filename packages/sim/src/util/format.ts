// Human-readable quantities for event messages. Units always follow a space, with proper symbols.

function trim(x: number, digits: number): string {
  const s = x.toPrecision(digits);
  // Drop exponent forms for the ranges we care about and strip trailing zeros after a decimal point.
  const n = Number(s);
  let out = String(n);
  if (out.includes("e")) out = n.toFixed(Math.max(0, digits - 1));
  return out;
}

function scaled(x: number, unit: string, digits = 3): string {
  const a = Math.abs(x);
  if (a === 0) return `0 ${unit}`;
  if (a >= 1e6) return `${trim(x / 1e6, digits)} M${unit}`;
  if (a >= 1e3) return `${trim(x / 1e3, digits)} k${unit}`;
  if (a >= 1) return `${trim(x, digits)} ${unit}`;
  if (a >= 1e-3) return `${trim(x * 1e3, digits)} m${unit}`;
  if (a >= 1e-6) return `${trim(x * 1e6, digits)} µ${unit}`;
  return `${trim(x * 1e9, digits)} n${unit}`;
}

export const fmtA = (x: number) => scaled(x, "A");
export const fmtV = (x: number) => scaled(x, "V");
export const fmtW = (x: number) => scaled(x, "W");
export const fmtOhm = (x: number) => scaled(x, "Ω");
export const fmtF = (x: number) => scaled(x, "F");
export const fmtS = (x: number) => (x < 1 ? `${trim(x * 1e3, 2)} ms` : `${trim(x, 2)} s`);
export const fmtC = (x: number) => `${Math.round(x)} °C`;
export const fmtX = (x: number) => `${trim(x, 2)} times`;
