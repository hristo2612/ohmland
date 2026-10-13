/**
 * Interim goal helpers for the Unit 1 labs (docs/curriculum/unit-1.md). They read only what today's LabView offers,
 * so several of them stand in for the blueprint's richer helpers (section 13, N1: meter sockets and range, probe
 * positions, `across`, `inSeries`, the lab notebook, `heldFor`, props). Every task keeps the blueprint's exact
 * condition in a `// GOAL:` comment above its predicate; when the lab runtime grows those features, finish the
 * predicates against it and slim this file down.
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

/**
 * Stand-ins for `meter.range`, `meter.red` and `meter.black` (N1). They read the meter part's PartState.extra,
 * which the runtime does not fill yet, so checks that use them cannot pass until it does.
 */
export const meterRange = (lab: LabView) => lab.part("M1")?.extra?.["range"];
export const redIn = (lab: LabView, socket: "com" | "vohm" | "ma" | "a10"): boolean => lab.part("M1")?.extra?.["red"] === socket;
export const blackIn = (lab: LabView, socket: "com" | "vohm" | "ma" | "a10"): boolean => lab.part("M1")?.extra?.["black"] === socket;

/** A simulator event of this type happened during the lab (on this part, if given). Stands in for `event(type, id)`. */
export const happened = (lab: LabView, type: SimEvent["type"], partId?: string): boolean =>
  lab.events.some((e) => e.type === type && (partId === undefined || e.partId === partId));

/** Absolute current through a part in amps (0 when the part is missing). */
export const amps = (lab: LabView, id: string): number => Math.abs(lab.part(id)?.i ?? 0);

/** An LED's glow, 0..1 (0 when the part is missing). */
export const glow = (lab: LabView, id: string): number => lab.part(id)?.glow ?? 0;

/**
 * Stand-in for `inSeries(M1, id)`: the meter is on a current range and reads the same current that flows through
 * the part (within 2%). The real check should come from the bench topology.
 */
export const meterInSeriesWith = (lab: LabView, id: string): boolean => {
  const mode = meterMode(lab);
  if (mode !== "dca-ma" && mode !== "dca-10a") return false;
  const metered = mode === "dca-ma" ? reading(lab) / 1000 : reading(lab);
  const through = amps(lab, id);
  return through > 0 && Math.abs(Math.abs(metered) - through) <= through * 0.02;
};
