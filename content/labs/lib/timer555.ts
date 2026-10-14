/**
 * 555 checks shared by the Unit 4 labs of the timer-555 and alarm modules (docs/curriculum/unit-4.md, section 2.3).
 * Times are always compared with values worked out from the parts' actual values (`lab.actual`), never the nominal
 * ones: electrolytics spread by up to 18% in the simulator.
 */
import type { LabView, StopwatchRun } from "@ohmland/lab";

/** A part's actual value: ohms for a resistor, farads for a capacitor (the nominal value until the simulator says). */
export function actual(lab: LabView, id: string): number {
  const key = lab.benchPart(id)?.kind === "resistor" ? "actualOhms" : "actualFarads";
  const v = lab.actual(id, key);
  if (v !== undefined && Number.isFinite(v)) return v;
  const p = lab.prop(id) ?? {};
  return Number(p["ohms"] ?? p["farads"] ?? 0);
}

/** The one-shot's glow: 1.1 × R × C (exactly ln 3 × R × C: the capacitor fills from empty to two thirds). */
export function oneShotT(lab: LabView, r: string | number, c: string): number {
  const ohms = typeof r === "number" ? r : actual(lab, r);
  return Math.log(3) * ohms * actual(lab, c);
}

/** The astable's period: 0.693 × (R1 + 2 × R2) × C. */
export function astableT(lab: LabView, r1: number, r2: number, c: string): number {
  return Math.LN2 * (r1 + 2 * r2) * actual(lab, c);
}

/** A trimmer's ohms between its `a` end and the wiper. */
export function trimOhms(lab: LabView, id: string): number {
  const p = lab.prop(id) ?? {};
  const ohms = Number(p["ohms"] ?? 0);
  const pos = lab.part(id)?.extra?.["position"];
  return ohms * (typeof pos === "number" ? pos : Number(p["position"] ?? 0));
}

/** The LED flashes: at least `n` flashes began within the last `seconds`. */
export function blinking(lab: LabView, led: string, n = 2, seconds = 5): boolean {
  return lab.periods(`glow:${led}`, 0.3, seconds).length >= n - 1 && lab.history(`glow:${led}`, seconds).some(([, g]) => g < 0.1);
}

/** The latest stopwatch run, or undefined. */
export function lastRun(lab: LabView): StopwatchRun | undefined {
  const runs = lab.runs();
  return runs[runs.length - 1];
}

/** A run (the latest by default) lasted within `tol` (a share, 0.08 is 8%) of `t` seconds. */
export function runNear(lab: LabView, t: number, tol: number, run = lastRun(lab)): boolean {
  return !!run && t > 0 && Math.abs(run.seconds - t) <= tol * t;
}

/**
 * A run that began with the timing capacitor empty (the stopwatch `watch`es it): not a tap in the middle of a glow,
 * nor the glow a 555 may wake up with (its latch starts at random).
 */
export const fromEmpty = (r: StopwatchRun): boolean => (r.watch ?? 0) < 1;

/** The latest run that began with the capacitor empty. */
export function cleanRun(lab: LabView): StopwatchRun | undefined {
  return [...lab.runs()].reverse().find(fromEmpty);
}

/** Runs that started after simulated time `since`. */
export function runsSince(lab: LabView, since: number): StopwatchRun[] {
  return lab.runs().filter((r) => r.start >= since - 1e-6);
}

/** The chip sits across the channel with its notch (pin 1) to the left. */
export function seatedRight(lab: LabView, chip: string): boolean {
  const s = lab.chipSeat(chip);
  return !!s && s.straddles && s.pin1 === "left" && !s.turned;
}

/** A broken bench first: remembers (in the task's memory) that `broken` held once, then asks for `fixed`. */
export function brokenThen(lab: LabView, broken: boolean, fixed: () => boolean): boolean {
  if (broken) lab.memory["broken"] = true;
  return lab.memory["broken"] === true && !broken && fixed();
}
