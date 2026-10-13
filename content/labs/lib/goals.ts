/**
 * Stop-gap goal helpers for the Unit 2 labs. They read only what LabView offers today (the latest snapshot, the event
 * log and the meter), so most history-based goals in docs/curriculum/unit-2.md are approximated. Each lab keeps the
 * blueprint's precise condition in a `// GOAL:` comment above its predicate. When the lab runtime ships its own
 * helpers (event windows, periods, glow history, instance values, panels: see LAB NEEDS in the blueprint, section 9),
 * replace these and tighten the goals.
 *
 * This file lives in a subfolder so the lab glob (content/labs/*.ts) never mistakes it for a lab.
 */
import type { LabView, PartState, SimEvent } from "@ohmland/lab";

/** A node's voltage in the latest snapshot, or undefined before the first one. */
export const volts = (lab: LabView, node: string): number | undefined => lab.snapshot?.nodes[node];

/** An LED's perceived brightness, 0 when the part is missing. */
export const glow = (lab: LabView, id: string): number => lab.part(id)?.glow ?? 0;

/** A switch, pushbutton or relay is closed (relay: COM on NO). */
export const closed = (lab: LabView, id: string): boolean => lab.part(id)?.closed === true;

/** Whether a part is on the bench and in the circuit right now. */
export const placed = (lab: LabView, id: string): boolean => lab.part(id) !== undefined;

/** A numeric value from a part's `extra` (relay coilVolts, npn ib, pot position, phototransistor light...). */
export function extraNum(lab: LabView, id: string, key: string): number | undefined {
  const x = lab.part(id)?.extra?.[key];
  return typeof x === "number" ? x : undefined;
}

/** A string value from a part's `extra` (spdt `to`, npn `region`, relay `contact`...). */
export function extraStr(lab: LabView, id: string, key: string): string | undefined {
  const x = lab.part(id)?.extra?.[key];
  return typeof x === "string" ? x : undefined;
}

export const between = (x: number | undefined, lo: number, hi: number): boolean => x !== undefined && x >= lo && x <= hi;

export const eventsOf = (lab: LabView, id: string, type: SimEvent["type"]): SimEvent[] =>
  lab.events.filter((e) => e.partId === id && e.type === type);

export const happened = (lab: LabView, id: string, type: SimEvent["type"]): boolean => eventsOf(lab, id, type).length > 0;

/** The part died during this lab (an event, or dead in the latest snapshot). */
export const died = (lab: LabView, id: string): boolean => happened(lab, id, "died") || lab.part(id)?.health === "dead";

/** Times a relay pulled in (COM moved to NO). */
export const pullIns = (lab: LabView, id: string): number[] =>
  eventsOf(lab, id, "clicked")
    .filter((e) => e.data?.["contact"] === "no")
    .map((e) => e.t);

/** Times a relay released (COM moved back to NC). */
export const releases = (lab: LabView, id: string): number[] =>
  eventsOf(lab, id, "clicked")
    .filter((e) => e.data?.["contact"] === "nc")
    .map((e) => e.t);

/** The most events (by time) that fall inside any window of `seconds`. */
export function mostInWindow(times: readonly number[], seconds: number): number {
  let best = 0;
  let start = 0;
  for (let end = 0; end < times.length; end++) {
    while ((times[end] ?? 0) - (times[start] ?? 0) >= seconds) start++;
    best = Math.max(best, end - start + 1);
  }
  return best;
}

/** The last `n` full periods of a self-switching relay (pull-in to pull-in), or fewer if it has not ticked enough. */
export function lastPeriods(lab: LabView, id: string, n: number): number[] {
  const t = pullIns(lab, id);
  return t
    .slice(1)
    .map((x, i) => x - (t[i] ?? x))
    .slice(-n);
}

/** At least `n` relay periods so far, the last `n` of them all between `lo` and `hi` seconds. */
export function ticksWithin(lab: LabView, id: string, n: number, lo: number, hi: number): boolean {
  const p = lastPeriods(lab, id, n);
  return p.length >= n && p.every((x) => x >= lo && x <= hi);
}

/** The meter is in continuity mode and shows a path (anything but OL). */
export const beeping = (lab: LabView): boolean =>
  lab.meter?.mode === "continuity" && lab.meter.display !== null && lab.meter.display.trim() !== "OL";

/** Every part in the latest snapshot. */
export const allParts = (lab: LabView): PartState[] => Object.values(lab.snapshot?.parts ?? {});

/** A part's effective resistance from its own voltage and current, if it carries any current. */
export function ohmsOf(lab: LabView, id: string): number | undefined {
  const p = lab.part(id);
  if (!p || Math.abs(p.i) < 1e-9) return undefined;
  return Math.abs(p.v / p.i);
}
