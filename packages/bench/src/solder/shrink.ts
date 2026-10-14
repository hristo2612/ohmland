// Heat-shrink tube and the heat gun (station engine SE4). A 2:1 polyolefin tube starts shrinking near 90 °C and is
// fully shrunk by about 120 °C; held too hot for too long it splits. The gun's air cools with distance, so keeping
// it moving a hand's width away shrinks a tube evenly. Pure.

import { AMBIENT_C } from "./leadheat";

export const TUBE_SIZES = [1.6, 3.2, 6.4] as const;
export type TubeSize = (typeof TUBE_SIZES)[number];

/** The gun's air at the nozzle (°C), and how fast it cools with distance (mm). */
export const GUN = { airC: 320, fall: 28, reach: 90 };
const SHRINK_FROM = 90;
const SHRINK_FULL = 120;
/** A tube heated past this for SPLIT_SECONDS splits. */
const SPLIT_C = 215;
const SPLIT_SECONDS = 1.5;
/** How quickly a thin tube follows the air around it (s). */
const TUBE_TAU = 0.9;

export type TubeState = {
  /** Tube temperature (°C). */
  tempC: number;
  /** 0 as bought, 1 fully shrunk (to half its diameter). */
  shrink: number;
  /** Seconds spent too hot. */
  scorch: number;
  split: boolean;
};

export function freshTube(): TubeState {
  return { tempC: AMBIENT_C, shrink: 0, scorch: 0, split: false };
}

/** Air temperature the gun blows onto something `mm` from its nozzle (ambient past its reach). */
export function gunAirC(mm: number, on = true): number {
  if (!on || mm > GUN.reach) return AMBIENT_C;
  return AMBIENT_C + (GUN.airC - AMBIENT_C) * Math.exp(-Math.max(0, mm) / GUN.fall);
}

/** Advance a tube `dt` seconds in air at `airC`. Shrinking never undoes itself. */
export function stepTube(t: TubeState, dt: number, airC: number): TubeState {
  const tempC = airC + (t.tempC - airC) * Math.exp(-dt / TUBE_TAU);
  const target = Math.min(1, Math.max(0, (tempC - SHRINK_FROM) / (SHRINK_FULL - SHRINK_FROM)));
  const shrink = Math.max(t.shrink, t.shrink + (target - t.shrink) * Math.min(1, dt * 2.5));
  const scorch = tempC > SPLIT_C ? t.scorch + dt : t.scorch;
  return { tempC, shrink, scorch, split: t.split || scorch > SPLIT_SECONDS };
}

/** Diameter now (mm): a 2:1 tube shrinks to half. */
export function tubeMm(size: number, shrink: number): number {
  return size * (1 - 0.5 * shrink);
}

/** A shrunk tube grips what it covers when it has closed down onto it. */
export function tubeGrips(size: number, shrink: number, coveredMm: number): boolean {
  return shrink >= 0.9 && tubeMm(size, shrink) <= coveredMm * 1.05;
}
