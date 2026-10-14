// The joint-quality model (station engine SE2). Pure and deterministic.
//
// A joint is the work under the iron (a leg through a perfboard pad, two wires crossed or side by side) lumped into
// one thermal node, plus the solder on it: how much, how much of the work it has wetted, how much flux is left, how
// hot it got and for how long, and whether it was moved while it set. The iron heats the work through a contact
// conductance (a tinned tip and a molten solder bridge pass far more heat); solder fed to work above its melting
// point flows and wets it while flux lasts. When the work cools through the melt the joint sets, and the verdict is
// read from the record: there is no score, the joint's look, a tug and the meter say which it is.
//
// Calibrated to docs/curriculum/unit-3.md section 3.4 (test/solder-joint.test.ts checks each row).

import { ALLOYS, type Alloy } from "./alloys";
import { fluxBurn } from "./iron";
import { AMBIENT_C } from "./leadheat";

export type WorkKind = "pad" | "crossed" | "splice" | "heavy";

export type WorkSpec = {
  /** Heat capacity of the work (J/K) and its loss to the board, the wires and the air (W/K). */
  c: number;
  loss: number;
  /** Tip to work contact through a tinned tip (W/K); a molten bridge doubles it. */
  contact: number;
  /** Solder for a good fillet (mm³). */
  ideal: number;
  /** Seconds above the melt in one heating before the joint is burnt (flux cooked, pad lifting, insulation). */
  burnAfter: number;
};

export const WORK: Record<WorkKind, WorkSpec> = {
  // A leg through a pad: little metal, the board holds little heat.
  pad: { c: 0.17, loss: 0.033, contact: 0.1, ideal: 1.5, burnAfter: 10 },
  // Two 22 AWG solid copper wires crossed in the helping hands.
  crossed: { c: 0.284, loss: 0.033, contact: 0.1, ideal: 3, burnAfter: 15 },
  // Two wire ends side by side.
  splice: { c: 0.3, loss: 0.035, contact: 0.1, ideal: 4, burnAfter: 15 },
  // Two 14 AWG wires: a lot of copper to heat.
  heavy: { c: 1.7, loss: 0.137, contact: 0.2, ideal: 9, burnAfter: 20 },
};

export type Verdict = "good" | "cold" | "disturbed" | "too-much" | "too-little" | "bridge" | "burnt";
export type JointPhase = "bare" | "molten" | "set";

export type Joint = {
  kind: WorkKind;
  /** The solder in it (the first spool fed). */
  alloy: Alloy | null;
  tempC: number;
  peakC: number;
  /** Solder on the joint (mm³). */
  volume: number;
  /** Share of the work the solder has wetted, 0..1. */
  wetted: number;
  /** Flux left in the solder, 0..1 (fresh cored solder brings it). */
  flux: number;
  /** Seconds above the melt in this heating. */
  aboveMelt: number;
  /** Seconds left before solder that has cooled below the melt is solid (moving it then disturbs it). */
  setting: number;
  /** Moved while setting: a disturbed joint. */
  moved: boolean;
  /** Where the solder first came from: fed at the work, or carried on the tip. */
  fedAt: "work" | "tip" | null;
  /** A neighbouring pad joined by a solder bridge. */
  bridgeTo: string | null;
  /** Burnt so long the copper pad came away from the board. */
  lifted: boolean;
  phase: JointPhase;
  /** Read when the joint last set (null while bare). */
  verdict: Verdict | null;
  /** Solder was held to it while it was below the melt (nothing happened). */
  coldTouch: boolean;
};

export function newJoint(kind: WorkKind, init: Partial<Joint> = {}): Joint {
  return {
    kind,
    alloy: null,
    tempC: AMBIENT_C,
    peakC: AMBIENT_C,
    volume: 0,
    wetted: 0,
    flux: 0,
    aboveMelt: 0,
    setting: 0,
    moved: false,
    fedAt: null,
    bridgeTo: null,
    lifted: false,
    phase: "bare",
    verdict: null,
    coldTouch: false,
    ...init,
  };
}

/** What happens to a joint during one step. */
export type JointEnv = {
  /** The iron's tip temperature when it rests on this joint, else null. */
  tipC: number | null;
  /** The tip's tinning factor (1 tinned, 0.5 fresh, 0.25 oxidised). */
  tin?: number;
  /** Solder fed here this step (mm³) and its alloy. */
  feed?: number;
  alloy?: Alloy | null;
  /** A bead carried on the tip, landing on the work now. */
  bead?: { mm3: number; flux: number; alloy: Alloy | null } | null;
  /** Desoldering braid laid on the joint (with the iron on top it wicks molten solder away). */
  braid?: boolean;
  /** Pads a bridge could reach, preferred first. */
  neighbours?: readonly string[];
  /** Tugged, wiggled or knocked this step. */
  moved?: boolean;
};

export type JointStep = {
  joint: Joint;
  /** Heat the work took from the tip (W). */
  ironLoad: number;
  /** Conductance between tip and work this step (W/K). */
  contact: number;
  /** Solder the braid soaked up (mm³). */
  wicked: number;
};

/** Melting point of the solder in (or about to go into) a joint. */
export function meltOf(j: Joint, alloy?: Alloy | null): number {
  return ALLOYS[j.alloy ?? alloy ?? "lead-free"].liquidus;
}

const WET_RATE = 1.1;
const WET_SPAN = 25;
/** Flux burns slower in a pool of solder than on a bare tip. */
const POOL_BURN = 0.6;
/** Even without flux, molten tin creeps a little. */
const MIN_FLUX = 0.06;
/** Volume (times ideal) past which a pad's solder reaches its neighbour, and below which a braid breaks a bridge. */
const BRIDGE_AT = 2.5;
const UNBRIDGE_AT = 1.4;
/** How fast hot braid soaks up molten solder (mm³/s), and the thin film it leaves (times ideal). */
const WICK = 2.2;
const FILM = 0.15;
const PEAK_BURN = 420;

export function stepJoint(j0: Joint, dt: number, env: JointEnv): JointStep {
  const spec = WORK[j0.kind];
  const j: Joint = { ...j0 };
  const alloy = j.alloy ?? env.bead?.alloy ?? env.alloy ?? null;
  const a = ALLOYS[alloy ?? "lead-free"];
  const tip = env.tipC;

  // A bead carried on the tip lands on the work.
  if (env.bead && env.bead.mm3 > 0) {
    const v = j.volume + env.bead.mm3;
    j.flux = (j.flux * j.volume + env.bead.flux * env.bead.mm3) / v;
    j.volume = v;
    j.alloy = j.alloy ?? env.bead.alloy;
    j.fedAt = j.fedAt ?? "tip";
  }

  // Heat: through the tip's contact (a molten solder bridge passes twice as much), out to the board and air.
  const bridgeHot = tip !== null && tip >= a.liquidus && j.volume > 0.05;
  const contact = tip === null ? 0 : spec.contact * (env.tin ?? 1) * (bridgeHot ? 2 : 1) * (env.braid ? 0.6 : 1);
  const T = j.tempC;
  const ironLoad = tip === null ? 0 : contact * (tip - T);
  j.tempC = T + ((ironLoad - spec.loss * (T - AMBIENT_C)) / spec.c) * dt;
  j.peakC = Math.max(j.peakC, j.tempC);

  // Solder fed here: it melts on hot work, or where a hot tip meets the work; on cold work nothing happens.
  const feed = env.feed ?? 0;
  if (feed > 0) {
    if (j.tempC >= a.liquidus || (tip !== null && tip >= a.liquidus)) {
      const v = j.volume + feed;
      // Fresh cored solder brings fresh flux.
      j.flux = Math.min(1, (j.flux * j.volume + feed) / v + feed / (0.3 * spec.ideal));
      j.volume = v;
      j.alloy = j.alloy ?? env.alloy ?? null;
      j.fedAt = j.fedAt ?? "work";
    } else j.coldTouch = true;
  }

  const melt = meltOf(j, alloy);
  const liquid = j.volume > 0.05 && (j.tempC >= melt || bridgeHot);
  // Flux burns in the hot pool.
  if (j.volume > 0) j.flux *= Math.exp(-POOL_BURN * fluxBurn(j.tempC) * dt);
  // Wetting: molten solder runs along work that is above its melt, while flux keeps the metal clean.
  if (j.volume > 0.05 && j.tempC >= melt) {
    const heat = Math.min(1, (j.tempC - melt) / WET_SPAN);
    j.wetted += WET_RATE * Math.max(j.flux, MIN_FLUX) * heat * (1 - j.wetted) * dt;
    j.aboveMelt += dt;
  }

  // Desoldering braid with the iron on it drinks molten solder.
  let wicked = 0;
  if (env.braid && tip !== null && liquid) {
    wicked = Math.max(0, Math.min(j.volume - FILM * spec.ideal, WICK * dt));
    j.volume -= wicked;
    if (j.bridgeTo && j.volume < UNBRIDGE_AT * spec.ideal) j.bridgeTo = null;
  }

  // Too much solder on a pad reaches over to a neighbour.
  if (liquid && !j.bridgeTo && j.kind === "pad" && j.volume > BRIDGE_AT * spec.ideal && env.neighbours?.length) j.bridgeTo = env.neighbours[0]!;
  if (j.kind === "pad" && j.aboveMelt > spec.burnAfter + 6) j.lifted = true;

  // Phases: molten, setting as it cools through the melt, set.
  if (j.volume <= 0.05) {
    j.phase = "bare";
  } else if (liquid) {
    if (j.phase === "set") {
      // Melted again: a fresh chance (it was moved before, not now).
      j.moved = false;
    }
    j.phase = "molten";
    j.setting = 0;
    if (env.moved) j.moved = true;
  } else if (j.phase === "molten") {
    // Cooling through the melt: solid once the setting time has run out.
    if (j.setting <= 0) j.setting = ALLOYS[j.alloy ?? alloy ?? "lead-free"].setSeconds;
    if (env.moved) j.moved = true;
    j.setting -= dt;
    if (j.setting <= 0) {
      j.setting = 0;
      j.phase = "set";
      j.verdict = judge(j);
      j.aboveMelt = 0;
    }
  }
  if (j.phase === "set" && j.verdict === null) j.verdict = judge(j);
  return { joint: j, ironLoad, contact, wicked };
}

/** The verdict a joint's record gives, checked in the blueprint's order; the first match wins. */
export function judge(j: Joint): Verdict | null {
  if (j.volume <= 0.05) return null;
  const spec = WORK[j.kind];
  const melt = meltOf(j);
  const ratio = j.volume / spec.ideal;
  if (j.peakC > PEAK_BURN || j.lifted || j.aboveMelt > spec.burnAfter) return "burnt";
  if (j.bridgeTo) return "bridge";
  if (j.moved) return "disturbed";
  if (j.wetted < 0.6 || j.peakC < melt + 15) return "cold";
  if (ratio > 1.8) return "too-much";
  if (ratio < 0.5) return "too-little";
  return "good";
}

/** The verdict to show now: the record's while set, else a live reading (molten joints show their shape). */
export function verdictOf(j: Joint): Verdict | null {
  return j.phase === "set" ? (j.verdict ?? judge(j)) : j.phase === "bare" ? null : judge(j);
}

// ---------------------------------------------------------------------------------------------------------------
// What the learner can find out: the look, the meter, a tug.

export type JointShape = "none" | "volcano" | "ball" | "ring" | "lump" | "frosty" | "bridge" | "burnt";

export type JointLook = {
  shape: JointShape;
  /** Solder relative to a good fillet. */
  volume: number;
  wetted: number;
  molten: boolean;
  /** Finish once set: shiny (leaded), satin (lead-free), dull (cold or disturbed), dark (burnt flux). */
  finish: "liquid" | "bright" | "satin" | "dull" | "dark";
  /** A gap at the lead (cold, balled up). */
  gap: boolean;
  lifted: boolean;
};

export function jointLook(j: Joint): JointLook {
  const spec = WORK[j.kind];
  const v = j.verdict && j.phase === "set" ? j.verdict : verdictOf(j);
  const molten = j.phase === "molten";
  const shape: JointShape = !v ? "none" : v === "good" ? "volcano" : v === "too-much" ? "ball" : v === "too-little" ? "ring" : v === "cold" ? "lump" : v === "disturbed" ? "frosty" : v;
  const finish = molten ? "liquid" : v === "burnt" ? "dark" : v === "cold" || v === "disturbed" ? "dull" : ALLOYS[j.alloy ?? "lead-free"].finish;
  return { shape, volume: j.volume / spec.ideal, wetted: j.wetted, molten, finish, gap: v === "cold" && j.wetted < 0.45, lifted: j.lifted };
}

/** Electrically: about 0 Ω when sound; a cold or disturbed joint conducts at rest but opens when flexed or tugged. */
export type JointElectric = { ohms: number; intermittent: boolean; open: boolean };

export const GOOD_OHMS = 0.005;
const OPEN = { ohms: Infinity, intermittent: false, open: true } as const;

export function jointElectric(j: Pick<Joint, "kind" | "volume" | "wetted" | "lifted" | "phase"> & { verdict: Verdict | null }): JointElectric {
  if (j.volume <= 0.05 || !j.verdict) return OPEN;
  const ratio = j.volume / WORK[j.kind].ideal;
  switch (j.verdict) {
    case "burnt":
      return j.lifted ? OPEN : { ohms: GOOD_OHMS, intermittent: false, open: false };
    case "good":
    case "too-much":
    case "bridge":
      return { ohms: GOOD_OHMS, intermittent: false, open: false };
    case "too-little":
      return ratio >= 0.3 ? { ohms: GOOD_OHMS, intermittent: false, open: false } : { ohms: 0.6, intermittent: true, open: false };
    case "disturbed":
      return { ohms: 1, intermittent: true, open: false };
    case "cold":
      return { ohms: j.wetted < 0.2 ? 8 : 2.5, intermittent: true, open: false };
  }
}

/** Resistance now: an intermittent joint opens while the board is flexed or the leg is tugged (`flexed`). */
export function contactOhms(e: JointElectric, flexed: boolean): number {
  if (e.open) return Infinity;
  return e.intermittent && flexed ? Infinity : e.ohms;
}

export type TugResult = "held" | "loose" | "pulled";

/** What a tug or wiggle on the joint's leg or wire finds. */
export function tugResult(j: Pick<Joint, "kind" | "volume" | "wetted" | "lifted" | "phase"> & { verdict: Verdict | null }): TugResult {
  if (j.volume <= 0.05 || !j.verdict) return "pulled";
  if (j.phase === "molten") return "loose";
  const ratio = j.volume / WORK[j.kind].ideal;
  switch (j.verdict) {
    case "burnt":
      return j.lifted ? "pulled" : "held";
    case "good":
    case "too-much":
    case "bridge":
      return "held";
    case "too-little":
      return ratio < 0.4 ? "loose" : "held";
    case "disturbed":
      return "loose";
    case "cold":
      return j.wetted < 0.2 ? "pulled" : "loose";
  }
}
