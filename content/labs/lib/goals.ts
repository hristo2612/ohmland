/**
 * Interim goal helpers for the Unit 1 labs (docs/curriculum/unit-1.md). The lab runtime now has the blueprint's
 * helpers on LabView itself (docs/LABS.md: lab.meter.red, lab.across, lab.inSeries, lab.heldFor, lab.logged,
 * lab.note, lab.event, lab.seriesLoop ...), and the ones below that had a direct equivalent now call it. Every task
 * keeps the blueprint's exact condition in a `// GOAL:` comment above its predicate: finish each predicate against
 * the LabView helpers and slim this file down.
 *
 * Conventions used by the Unit 1 lab files while packages/bench does not own BenchState yet:
 * - Clip leads are `wire` parts whose `at` names the two anchors they join, "B1.pos|S1.a".
 * - The meter is the part `M1`. Its starting dial and lead sockets are props: mode, range, red, black
 *   (sockets: "com", "vohm", "ma", "a10", or "none" when unplugged).
 * - A resistor's `ohms` is its nominal (printed) value. `actualOhms`, when present, is the seeded real value the
 *   simulator should use (blueprint N6).
 */
import type { LabView, SimEvent } from "@ohmland/lab";

/** The meter's reading in its displayed unit, or NaN when there is none (so every comparison fails). */
export const reading = (lab: LabView): number => lab.meter?.value ?? Number.NaN;

export const between = (x: number, lo: number, hi: number): boolean => x >= lo && x <= hi;

const PREFIX: Record<string, number> = { µ: 1e-6, m: 1e-3, k: 1e3, M: 1e6 };

/** The reading in base units (Ω, V, A), using the display's unit annunciator ("kΩ", "mA"...). NaN when unknown. */
export const baseReading = (lab: LabView): number => {
  const unit = lab.meter?.unit;
  if (!unit) return Number.NaN;
  const factor = unit.length > 1 ? PREFIX[unit[0] ?? ""] : 1;
  return factor === undefined ? Number.NaN : reading(lab) * factor;
};

/** The meter shows a number from lo to hi, in its displayed unit. */
export const readsBetween = (lab: LabView, lo: number, hi: number): boolean => between(reading(lab), lo, hi);

export const meterMode = (lab: LabView) => lab.meter?.mode ?? "off";

export const showsOL = (lab: LabView): boolean => lab.meter?.display === "OL";

/** `meter.range`, `meter.red` and `meter.black` (N1): now plain LabView fields (lab.meter.range, .red, .black). */
export const meterRange = (lab: LabView) => lab.meter?.range ?? undefined;
export const redIn = (lab: LabView, socket: "com" | "vohm" | "ma" | "a10"): boolean => lab.meter?.red === socket;
export const blackIn = (lab: LabView, socket: "com" | "vohm" | "ma" | "a10"): boolean => lab.meter?.black === socket;

/** A simulator event of this type happened during the lab (on this part, if given): `lab.event(type, id)`. */
export const happened = (lab: LabView, type: SimEvent["type"], partId?: string): boolean => lab.event(type, partId);

/** Absolute current through a part in amps (0 when the part is missing). */
export const amps = (lab: LabView, id: string): number => Math.abs(lab.part(id)?.i ?? 0);

/** An LED's glow, 0..1 (0 when the part is missing). */
export const glow = (lab: LabView, id: string): number => lab.part(id)?.glow ?? 0;

/** `inSeries(M1, id)`: the meter is on a current range, in the right socket, carrying the part's current. */
export const meterInSeriesWith = (lab: LabView, id: string): boolean => lab.meterInSeriesWith(id);
