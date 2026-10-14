// The soldering iron (station engine SE1): a tip with a heater, its temperature control, its coat of solder and the
// heat it gives to whatever it touches. Pure and deterministic; the station steps it a few hundredths of a second
// at a time. Calibrated to docs/curriculum/unit-3.md section 3.4: about 20 s to reach 330 °C, still above 200 °C a
// minute after switch-off and below 50 °C after about 7 minutes, a dip of 60 to 100 °C on a big copper bar.

import { ALLOYS, type Alloy } from "./alloys";
import { AMBIENT_C } from "./leadheat";

export type Tinning = "fresh" | "tinned" | "oxidised";

export const IRON = {
  /** Heater power (W), the tip's heat capacity (J/K) and its loss to the air (W/K). */
  heaterW: 60,
  c: 3.6,
  air: 0.024,
  /** Proportional band of the temperature control (°C): full power this far below the set point. */
  band: 8,
  minC: 150,
  maxC: 450,
  /** Seconds a hot tip may stay dry before it oxidises. */
  oxidiseAfter: 90,
  /** Most solder a tip can carry (mm³); more drips off. */
  maxBead: 6,
};

export type IronState = {
  tipC: number;
  tinning: Tinning;
  /** Seconds hot and dry (no solder on the tip). */
  dry: number;
  /** Solder carried on the tip (mm³), the flux left in it (0..1) and its alloy. */
  bead: number;
  beadFlux: number;
  beadAlloy: Alloy | null;
  /** Heater power in the last step (W). */
  heaterW: number;
};

export function freshIron(tinning: Tinning = "tinned", tipC = AMBIENT_C): IronState {
  return { tipC, tinning, dry: 0, bead: 0, beadFlux: 0, beadAlloy: null, heaterW: 0 };
}

/** How well a tip passes heat into work: a tinned tip best, a black oxidised one poorly. */
export function tinFactor(t: Tinning): number {
  return t === "tinned" ? 1 : t === "fresh" ? 0.5 : 0.25;
}

/** How fast rosin flux burns away at a temperature (per second): none below 200 °C, gone in about 2 s above 300 °C. */
export function fluxBurn(tempC: number): number {
  if (tempC <= 200) return 0;
  return 1.5 * Math.min(1, (tempC - 200) / 100);
}

/** Something the tip touches, drawing heat: a conductance (W/K) to a temperature. */
export type TipLoad = { g: number; tempC: number };

/**
 * Advance the iron `dt` seconds. `on` and `setC` come from the station; `loads` are what the tip touches (the heat
 * they draw is worked out here from the tip's temperature at the start of the step).
 */
export function stepIron(s: IronState, dt: number, on: boolean, setC: number, loads: readonly TipLoad[] = []): IronState {
  const set = Math.min(IRON.maxC, Math.max(IRON.minC, setC));
  const T = s.tipC;
  const heater = on ? IRON.heaterW * Math.min(1, Math.max(0, (set - T) / IRON.band)) : 0;
  let out = IRON.air * (T - AMBIENT_C);
  for (const l of loads) out += l.g * (T - l.tempC);
  const tipC = T + ((heater - out) / IRON.c) * dt;
  // A bead on the tip loses its flux; a hot dry tip oxidises.
  const beadFlux = s.bead > 0 ? s.beadFlux * Math.exp(-fluxBurn(tipC) * dt) : 0;
  const dry = tipC > 250 && s.bead < 0.05 ? s.dry + dt : s.bead >= 0.05 ? 0 : s.dry;
  const tinning: Tinning = s.tinning !== "oxidised" && dry > IRON.oxidiseAfter ? "oxidised" : s.tinning;
  // A bead freezes on a cold tip but stays put; below the solder's melt it cannot be passed on.
  return { tipC, tinning, dry, bead: s.bead, beadFlux, beadAlloy: s.bead > 0 ? s.beadAlloy : null, heaterW: heater };
}

/** Feed solder straight onto the tip (in the air, or where it rests): it melts into a bead and tins the tip. */
export function feedTip(s: IronState, mm3: number, alloy: Alloy): IronState {
  const spec = ALLOYS[alloy];
  if (s.tipC < spec.liquidus) return s;
  // An oxidised tip will not take solder: it balls up and rolls off.
  if (s.tinning === "oxidised") return s;
  const bead = Math.min(IRON.maxBead, s.bead + mm3);
  const fresh = bead > s.bead ? (bead - s.bead) / Math.max(bead, 1e-9) : 0;
  return { ...s, bead, beadFlux: Math.min(1, s.beadFlux * (1 - fresh) + fresh), beadAlloy: alloy, tinning: "tinned", dry: 0 };
}

/** Wipe the tip in the brass wool: the bead and the black come off (a tinned tip keeps a thin coat). */
export function wipeTip(s: IronState): IronState {
  return { ...s, bead: 0, beadFlux: 0, beadAlloy: null, tinning: s.tinning === "oxidised" ? "fresh" : s.tinning, dry: 0 };
}

/** Take the bead off the tip (it went onto the work). */
export function takeBead(s: IronState): { iron: IronState; mm3: number; flux: number; alloy: Alloy | null } {
  return { iron: { ...s, bead: 0, beadFlux: 0, beadAlloy: null }, mm3: s.bead, flux: s.beadFlux, alloy: s.beadAlloy };
}
