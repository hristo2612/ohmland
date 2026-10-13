/**
 * Meter checks shared by the Unit 1 labs (docs/curriculum/unit-1.md). They read `lab.meter` (docs/LABS.md).
 */
import type { LabView, Reading } from "@ohmland/lab";

/** The meter is set by hand (not auto) to this range: "20V", "2k", "200mA" ... */
export const rangeIs = (lab: LabView, range: string): boolean => !!lab.meter && !lab.meter.auto && lab.meter.range === range;

/** The display shows a number from lo to hi in its own unit (not OL, not blank). */
export const readsIn = (lab: LabView, lo: number, hi: number): boolean => {
  const v = lab.meter?.value;
  return v !== null && v !== undefined && Number.isFinite(v) && v >= lo && v <= hi;
};

/** The reading in base units (V, A, Ω) is from lo to hi (not OL, not blank). */
export const siIn = (lab: LabView, lo: number, hi: number): boolean => {
  const m = lab.meter;
  return !!m && m.value !== null && Number.isFinite(m.value) && m.si !== null && m.si >= lo && m.si <= hi;
};

/** The display says OL (over the range's limit). */
export const showsOL = (lab: LabView): boolean => lab.meter?.value === Infinity;

/** A logged reading in base units, or NaN. */
export const si = (r: Reading | undefined): number => (r && Number.isFinite(r.si) ? r.si : Number.NaN);

/** The readings with every one of these tags, oldest first. */
export const taggedAll = (lab: LabView, ...tags: string[]): Reading[] => lab.readingsLog.filter((r) => tags.every((t) => r.tags.includes(t)));

/** The latest reading with every one of these tags. */
export const latest = (lab: LabView, ...tags: string[]): Reading | undefined => taggedAll(lab, ...tags).at(-1);

/** `x` is within `tol` (relative) of `want`. */
export const near = (x: number | null | undefined, want: number, tol: number): boolean =>
  x !== null && x !== undefined && Number.isFinite(x) && Math.abs(x - want) <= Math.abs(want) * tol;
