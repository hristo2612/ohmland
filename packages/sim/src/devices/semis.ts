// Semiconductors: LEDs, diodes, the 2N3904 NPN transistor and a phototransistor.

import type { Health, InputKey, InputValue, LedColor, PartSpec, PartState } from "../types";
import {
  AMBIENT,
  Device,
  G_OPEN,
  GMIN,
  Thermal,
  VT,
  addA,
  baseState,
  breakdownIG,
  clamp,
  diodeIG,
  finiteOr,
  num,
  pnjlim,
  stampBranch,
  stampG,
  vcritOf,
  volt,
  type Binder,
  type Ctx,
} from "../engine/device";
import { fmtA, fmtV, fmtW } from "../util/format";
import { spread } from "../util/rng";

type Spec<K extends PartSpec["kind"]> = Extract<PartSpec, { kind: K }>;

const lim = { limited: false };
const o1 = { i: 0, g: 0 };
const o2 = { i: 0, g: 0 };

// ---------------------------------------------------------------------------------------------------------------
// Junction diode with series resistance (internal node) and soft reverse breakdown.

type JunctionParams = { Is: number; nVt: number; rs: number; bv: number; gbd: number; vs: number };

abstract class JunctionDevice extends Device {
  an = -1;
  ca = -1;
  mid = -1;
  P: JunctionParams;
  vcrit: number;
  vdIter = 0;
  dead = false;

  constructor(spec: PartSpec, params: JunctionParams) {
    super(spec);
    this.P = params;
    this.vcrit = vcritOf(params.Is, params.nVt);
    this.nonlinear = true;
  }
  bind(b: Binder): void {
    this.an = b.node(this.pinNames[0]!);
    this.ca = b.node(this.pinNames[1]!);
    this.mid = this.P.rs > 0 ? b.internal(`${this.id}#j`) : this.an;
  }
  override stampLinear(A: Float64Array, n: number): void {
    if (this.P.rs > 0) stampG(A, n, this.an, this.mid, this.dead ? G_OPEN : 1 / this.P.rs);
  }
  override initIter(x: Float64Array): void {
    this.vdIter = volt(x, this.mid) - volt(x, this.ca);
  }
  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array, ctx: Ctx): void {
    if (this.dead) return;
    const P = this.P;
    lim.limited = false;
    const vd = pnjlim(volt(x, this.mid) - volt(x, this.ca), this.vdIter, P.nVt, this.vcrit, lim);
    if (lim.limited) ctx.noncon = true;
    this.vdIter = vd;
    diodeIG(vd, P.Is, P.nVt, o1);
    breakdownIG(vd, P.bv, P.gbd, P.vs, o2);
    stampBranch(A, b, n, this.mid, this.ca, o1.i + o2.i, o1.g + o2.g, vd);
  }
  /** Current from anode to cathode for a solution. */
  current(x: Float64Array): number {
    if (this.dead) return this.P.rs > 0 ? (volt(x, this.an) - volt(x, this.mid)) * G_OPEN : 0;
    if (this.P.rs > 0) return (volt(x, this.an) - volt(x, this.mid)) / this.P.rs;
    const vd = volt(x, this.mid) - volt(x, this.ca);
    diodeIG(vd, this.P.Is, this.P.nVt, o1);
    breakdownIG(vd, this.P.bv, this.P.gbd, this.P.vs, o2);
    return o1.i + o2.i;
  }
  pinCurrents(x: Float64Array): number[] {
    const i = this.current(x);
    return [i, -i];
  }
}

// ---------------------------------------------------------------------------------------------------------------
// LEDs. Fitted per colour so that Vf at 20 mA matches typical indicator LEDs; red sits near 1.75 V at 1 mA,
// 1.85 V at 5 mA and 1.95 V at 15 mA.

export const LED_FITS: Record<LedColor, { v20: number; nVt: number; rs: number }> = {
  red: { v20: 2.0, nVt: 0.05, rs: 5.3 },
  orange: { v20: 2.05, nVt: 0.05, rs: 5.3 },
  yellow: { v20: 2.1, nVt: 0.052, rs: 5.5 },
  green: { v20: 2.2, nVt: 0.055, rs: 6.0 },
  blue: { v20: 3.1, nVt: 0.075, rs: 9.0 },
  white: { v20: 3.1, nVt: 0.075, rs: 9.0 },
};

const GLOW_I0 = 2e-4;
const GLOW_FULL = 0.03;
/** The eye averages light over about 30 ms: fast switching looks steady and partly lit. */
const EYE_TAU = 0.03;
/** A brief flash of this much current or more still shows as a blip of FLASH_GLOW, fading over FLASH_TAU. */
const FLASH_AMPS = 0.01;
const FLASH_GLOW = 0.25;
const FLASH_TAU = 0.08;
/** Perceived brightness 0..1 for a current: roughly logarithmic, 0.85 near 15 mA, faint but visible at 0.5 mA. */
export function ledGlow(i: number): number {
  if (!(i > 1e-6)) return 0;
  return clamp(Math.log1p(i / GLOW_I0) / Math.log1p(GLOW_FULL / GLOW_I0), 0, 1);
}

export class LedDevice extends JunctionDevice {
  readonly color: LedColor;
  readonly maxA: number;
  readonly v20: number;
  damage = 0;
  iAvg = 0;
  /** Held glow of a recent brief flash (decays over FLASH_TAU). */
  flash = 0;
  thermal = new Thermal(300, 0.5);
  private peak = 0;
  private damagedSent = false;
  private reverseTime = 0;
  private reversedSent = false;

  constructor(spec: Spec<"led">) {
    const fit = LED_FITS[spec.color] ?? LED_FITS.red;
    const vd20 = fit.v20 - 0.02 * fit.rs;
    super(spec, { Is: 0.02 / Math.exp(vd20 / fit.nVt), nVt: fit.nVt, rs: fit.rs, bv: 5, gbd: 1 / 200e3, vs: 0.1 });
    this.color = LED_FITS[spec.color] ? spec.color : "red";
    this.maxA = Math.max(1e-3, finiteOr(spec.maxmA, 20)) / 1000;
    this.v20 = fit.v20;
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const h = ctx.h;
    const i = this.current(x);
    const v = volt(x, this.an) - volt(x, this.ca);
    // The eye integrates light over roughly 30 ms, so fast flicker looks like steady, dimmer light. A brief strong
    // pulse (a coil's kickback through an LED) is far too short to register in that average, yet a real eye
    // catches the blip: hold a small glow for it.
    this.iAvg += (Math.max(0, i) - this.iAvg) * (1 - Math.exp(-h / EYE_TAU));
    const blip = this.dead ? 0 : FLASH_GLOW * clamp((i - 0.2 * FLASH_AMPS) / (0.8 * FLASH_AMPS), 0, 1);
    this.flash = Math.max(blip, this.flash * Math.exp(-h / FLASH_TAU));
    this.thermal.update(Math.max(0, v * i), h);
    if (this.dead) return;

    const iAbs = 2.5 * this.maxA;
    let rate = 0;
    if (i > iAbs) {
      this.peak = Math.max(this.peak, i);
      const k = i / iAbs;
      rate = (k * k - 1) / 3;
      this.damage += rate * h;
    }
    if (this.damage >= 1) {
      this.dead = true;
      this.damage = 1;
      ctx.markDirty();
      ctx.markBreak();
      const r9 = Math.max(1, Math.round((9 - this.v20) / 0.015 / 10) * 10);
      ctx.emit(
        this.id,
        "died",
        `The LED burned out. About ${fmtA(this.peak)} flowed through it, but it is only made for ${fmtA(this.maxA)}. A series resistor keeps the current safe: R = (supply voltage - ${fmtV(this.v20)}) / 0.015 A, about ${r9} Ω on a 9 V battery.`,
        { amps: this.peak, ratedAmps: this.maxA },
      );
      return;
    }
    // Only warn about wear when the LED is not about to die anyway (a hard short kills it in milliseconds).
    if (this.damage >= 0.1 && !this.damagedSent && rate < 5) {
      this.damagedSent = true;
      ctx.emit(
        this.id,
        "damaged",
        `The LED is overdriven at ${fmtA(i)} (it is made for ${fmtA(this.maxA)}) and is wearing out: it will get dimmer and then fail. Use a bigger series resistor.`,
        { amps: i, ratedAmps: this.maxA },
      );
    }
    if (v < -5) {
      this.reverseTime += h;
      if (this.reverseTime > 0.05 && !this.reversedSent) {
        this.reversedSent = true;
        // Real LEDs block only about 5 V in reverse; past that one may break down and pass whatever the rest of the
        // circuit lets through. Judge that from what the circuit presents across the LED: behind a resistor it is a
        // few milliamps and harmless, straight across a battery it could be enough to damage it.
        const ohms = ctx.drivingOhms?.(this.an, this.ca) ?? Infinity;
        const worst = (-v - this.P.bv) / Math.max(ohms, 1e-3);
        const risky = worst > 2.5 * this.maxA;
        ctx.emit(
          this.id,
          "reversed",
          risky
            ? `The LED has ${fmtV(-v)} across it the wrong way round. LEDs only block about 5 V in reverse, and nothing in this circuit would limit the current if it gave way, so it could be damaged. Turn it around: the longer lead goes to the + side.`
            : `The LED is in backwards, with ${fmtV(-v)} across it the wrong way round. It blocks the flow, so it stays dark. The rest of the circuit keeps the current small, so it takes no harm. Turn it around: the longer lead goes to the + side.`,
          { volts: -v, risk: risky ? "damage" : "none", amps: Number.isFinite(worst) ? Math.max(0, worst) : 0 },
        );
      }
    } else if (v > 0) {
      this.reverseTime = 0;
      this.reversedSent = false;
    }
  }
  health(i: number): Health {
    if (this.dead) return "dead";
    const iAbs = 2.5 * this.maxA;
    return i > 2 * iAbs ? "smoking" : i > iAbs ? "hot" : "ok";
  }
  state(x: Float64Array): PartState {
    const i = this.current(x);
    const v = volt(x, this.an) - volt(x, this.ca);
    const s = baseState(i, v, v * i, this.thermal.temp, this.health(i));
    s.glow = this.dead ? 0 : Math.max(ledGlow(this.iAvg), this.flash) * (1 - 0.6 * this.damage);
    // stress: current as a share of the rated maximum (1 = at maxmA).
    s.extra = { damage: this.damage, color: this.color, stress: Math.max(0, i) / this.maxA };
    return s;
  }
  override save(): Record<string, unknown> {
    return { damage: this.damage, dead: this.dead, temp: this.thermal.temp, iAvg: this.iAvg, flash: this.flash, peak: this.peak };
  }
  override restore(s: Record<string, unknown>): void {
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.damagedSent = this.damage >= 0.1;
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
    this.iAvg = finiteOr(s.iAvg as number, 0);
    this.flash = finiteOr(s.flash as number, 0);
    this.peak = finiteOr(s.peak as number, 0);
  }
  override replace(): void {
    this.damage = 0;
    this.dead = false;
    this.damagedSent = false;
    this.thermal.temp = AMBIENT;
    this.peak = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Rectifier and signal diodes with standard SPICE-like parameters. They fail by heat (junction above about 175 C)
// or by a current far beyond their surge rating. So a 1N4001 straight across a battery carries amps, heats up
// over a second or so (while the battery reports `shorted`) and then fails; a 1N4148 fails almost at once.

const DIODES = {
  "1N4148": { Is: 2.52e-9, n: 1.752, rs: 0.568, bv: 100, rated: 0.2, surge: 2, rth: 350, tau: 0.5 },
  "1N4001": { Is: 14.11e-9, n: 1.984, rs: 0.0339, bv: 75, rated: 1, surge: 30, rth: 100, tau: 2 },
} as const;

const DIODE_MAX_C = 175;

export class DiodeDevice extends JunctionDevice {
  readonly model: keyof typeof DIODES;
  damage = 0;
  thermal: Thermal;
  private peak = 0;
  private damagedSent = false;
  constructor(spec: Spec<"diode">) {
    const model = spec.model && spec.model in DIODES ? spec.model : "1N4148";
    const m = DIODES[model];
    super(spec, { Is: m.Is, nVt: m.n * VT, rs: m.rs, bv: m.bv, gbd: 1 / 10, vs: 0.05 });
    this.model = model;
    this.thermal = new Thermal(m.rth, m.tau);
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const i = this.current(x);
    const v = volt(x, this.an) - volt(x, this.ca);
    this.thermal.update(Math.abs(v * i), ctx.h);
    if (this.dead) return;
    const m = DIODES[this.model];
    this.peak = Math.max(this.peak, Math.abs(i));
    let rate = 0;
    if (Math.abs(i) > m.surge) {
      const k = Math.abs(i) / m.surge;
      rate += (k * k - 1) * 5;
    }
    const T = this.thermal.temp;
    if (T > DIODE_MAX_C) rate += (T - DIODE_MAX_C) / 50;
    if (rate <= 0) return;
    this.damage += rate * ctx.h;
    if (this.damage >= 1) {
      this.dead = true;
      ctx.markDirty();
      ctx.markBreak();
      ctx.emit(
        this.id,
        "died",
        `The ${this.model} diode failed after carrying up to ${fmtA(this.peak)}; it is rated for about ${fmtA(m.rated)}. It is now open.`,
        { amps: this.peak, ratedAmps: m.rated, cause: T > DIODE_MAX_C ? "overheat" : "overcurrent" },
      );
    } else if (this.damage > 0.1 && !this.damagedSent && rate < 5) {
      this.damagedSent = true;
      ctx.emit(this.id, "damaged", `The ${this.model} diode is overheating: it is carrying ${fmtA(Math.abs(i))} and is rated for about ${fmtA(m.rated)}.`, {
        amps: Math.abs(i),
        ratedAmps: m.rated,
        cause: "overheat",
      });
    }
  }
  state(x: Float64Array): PartState {
    const i = this.current(x);
    const v = volt(x, this.an) - volt(x, this.ca);
    const T = this.thermal.temp;
    const health: Health = this.dead ? "dead" : T > 150 ? "smoking" : T > 100 ? "hot" : "ok";
    const s = baseState(i, v, v * i, T, health);
    s.extra = { model: this.model, damage: this.damage };
    return s;
  }
  override save(): Record<string, unknown> {
    return { damage: this.damage, dead: this.dead, temp: this.thermal.temp };
  }
  override restore(s: Record<string, unknown>): void {
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.damagedSent = this.damage > 0.1;
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
  }
  override replace(): void {
    this.damage = 0;
    this.dead = false;
    this.damagedSent = false;
    this.peak = 0;
    this.thermal.temp = AMBIENT;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 2N3904: Gummel-Poon lite (transport model with forward Early effect, high injection knee and base-emitter
// leakage), plus soft base-emitter reverse breakdown near 7 V.

const Q = {
  IS: 6.734e-15,
  BF: 416.4,
  // Reverse gain (emitter and collector swapped), as in the SPICE model. Higher values make astables with a low
  // base to collector resistor ratio latch with both transistors on at power-up.
  BR: 0.7371,
  NE: 1.259,
  ISE: 6.734e-15,
  IKF: 0.06678,
  VAF: 74.03,
  BVEBO: 7,
  ICMAX: 0.2,
  PMAX: 0.625,
  RTH: 200,
  RC: 1,
};
const EXP_LIM = 80;
const E_LIM = Math.exp(EXP_LIM);
function expLin(x: number): number {
  return x > EXP_LIM ? E_LIM * (1 + x - EXP_LIM) : Math.exp(x);
}
function dexpLin(x: number): number {
  return x > EXP_LIM ? E_LIM : Math.exp(x);
}

export class NpnDevice extends Device {
  c = -1;
  b = -1;
  e = -1;
  /** Internal collector node, behind the collector resistance RC. */
  ci = -1;
  vbeIter = 0;
  vbcIter = 0;
  dead = false;
  damage = 0;
  thermal = new Thermal(Q.RTH, 3);
  /**
   * This transistor's base current scale: its forward gain BF and base leakage ISE are spread together (fixed by
   * its id) so that hFE at 10 mA lies between about 150 and 250.
   */
  readonly bf: number;
  readonly ise: number;
  private readonly vcrit = vcritOf(Q.IS, VT);
  private cause: "overcurrent" | "overheat" = "overcurrent";
  private reverseTime = 0;
  private reversedSent = false;
  private peakIc = 0;
  private peakP = 0;
  private smoked = false;
  private damagedSent = false;
  // evaluation results
  ic = 0;
  ib = 0;
  gcbe = 0;
  gcbc = 0;
  gbbe = 0;
  gbbc = 0;

  constructor(spec: Spec<"npn">, seed?: string) {
    super(spec);
    this.nonlinear = true;
    const f = 1.12 + 0.27 * spread(spec.id, "npn-beta", seed);
    this.bf = Q.BF * f;
    this.ise = Q.ISE / f;
  }
  bind(bd: Binder): void {
    this.c = bd.node(this.pin("c"));
    this.b = bd.node(this.pin("b"));
    this.e = bd.node(this.pin("e"));
    this.ci = bd.internal(`${this.id}#c`);
  }
  override stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.c, this.ci, this.dead ? G_OPEN : 1 / Q.RC);
  }
  /** Evaluates terminal currents and their derivatives at (vbe, vbc). */
  evaluate(vbe: number, vbc: number): void {
    const vt = VT;
    const xf = vbe / vt;
    const xr = vbc / vt;
    const ef = expLin(xf);
    const er = expLin(xr);
    const If = Q.IS * (ef - 1);
    const gif = (Q.IS * dexpLin(xf)) / vt;
    const Ir = Q.IS * (er - 1);
    const gir = (Q.IS * dexpLin(xr)) / vt;
    const xe = vbe / (Q.NE * vt);
    const Ile = this.ise * (expLin(xe) - 1);
    const gle = (this.ise * dexpLin(xe)) / (Q.NE * vt);
    const den = Math.max(0.05, 1 - vbc / Q.VAF);
    const q1 = 1 / den;
    const dq1 = 1 - vbc / Q.VAF > 0.05 ? (q1 * q1) / Q.VAF : 0;
    const q2 = Math.max(-0.24, If / Q.IKF);
    const s = Math.sqrt(1 + 4 * q2);
    const qb = (q1 * (1 + s)) / 2;
    const dqbVbe = (q1 * (gif / Q.IKF)) / s;
    const dqbVbc = (dq1 * (1 + s)) / 2;
    const icc = (If - Ir) / qb;
    const dIccVbe = (gif - icc * dqbVbe) / qb;
    const dIccVbc = (-gir - icc * dqbVbc) / qb;
    this.ic = icc - Ir / Q.BR - GMIN * vbc;
    this.gcbe = dIccVbe;
    this.gcbc = dIccVbc - gir / Q.BR - GMIN;
    this.ib = If / this.bf + Ile + Ir / Q.BR + GMIN * (vbe + vbc);
    this.gbbe = gif / this.bf + gle + GMIN;
    this.gbbc = gir / Q.BR + GMIN;
  }
  override initIter(x: Float64Array): void {
    this.vbeIter = volt(x, this.b) - volt(x, this.e);
    this.vbcIter = volt(x, this.b) - volt(x, this.ci);
  }
  override stampNonlinear(A: Float64Array, bv: Float64Array, n: number, x: Float64Array, ctx: Ctx): void {
    if (this.dead) return;
    const { b, e } = this;
    const c = this.ci;
    lim.limited = false;
    const vbe = pnjlim(volt(x, b) - volt(x, e), this.vbeIter, VT, this.vcrit, lim);
    const vbc = pnjlim(volt(x, b) - volt(x, c), this.vbcIter, VT, this.vcrit, lim);
    if (lim.limited) ctx.noncon = true;
    this.vbeIter = vbe;
    this.vbcIter = vbc;
    this.evaluate(vbe, vbc);
    const { gcbe, gcbc, gbbe, gbbc } = this;
    const ieqc = this.ic - gcbe * vbe - gcbc * vbc;
    const ieqb = this.ib - gbbe * vbe - gbbc * vbc;
    addA(A, n, c, b, gcbe + gcbc);
    addA(A, n, c, e, -gcbe);
    addA(A, n, c, c, -gcbc);
    if (c >= 0) bv[c]! -= ieqc;
    addA(A, n, b, b, gbbe + gbbc);
    addA(A, n, b, e, -gbbe);
    addA(A, n, b, c, -gbbc);
    if (b >= 0) bv[b]! -= ieqb;
    addA(A, n, e, b, -(gcbe + gcbc + gbbe + gbbc));
    addA(A, n, e, e, gcbe + gbbe);
    addA(A, n, e, c, gcbc + gbbc);
    if (e >= 0) bv[e]! += ieqc + ieqb;
    // Base-emitter reverse breakdown (clips deep negative base swings, as in a real 2N3904).
    breakdownIG(vbe, Q.BVEBO, 1 / 50, 0.1, o2);
    if (o2.g > 1e-15) stampBranch(A, bv, n, b, e, o2.i, o2.g, vbe);
  }
  /** Terminal currents into c, b, e for a solution. */
  terminal(x: Float64Array): [number, number, number] {
    const ic = (volt(x, this.c) - volt(x, this.ci)) * (this.dead ? G_OPEN : 1 / Q.RC);
    let ib = 0;
    if (!this.dead) {
      const vbe = volt(x, this.b) - volt(x, this.e);
      const vbc = volt(x, this.b) - volt(x, this.ci);
      this.evaluate(vbe, vbc);
      breakdownIG(vbe, Q.BVEBO, 1 / 50, 0.1, o2);
      ib += this.ib + o2.i;
    }
    return [ic, ib, -(ic + ib)];
  }
  pinCurrents(x: Float64Array): number[] {
    return this.terminal(x);
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const [ic, ib, ie] = this.terminal(x);
    const vce = volt(x, this.c) - volt(x, this.e);
    const p = Math.max(0, vce * ic + (volt(x, this.b) - volt(x, this.e)) * ib);
    this.thermal.update(p, ctx.h);
    if (this.dead) return;
    const iMax = Math.max(Math.abs(ic), Math.abs(ie));
    let byCurrent = 0;
    let byHeat = 0;
    if (iMax > Q.ICMAX) {
      const k = iMax / Q.ICMAX;
      byCurrent = (k * k - 1) * 0.5;
    }
    this.peakIc = Math.max(this.peakIc, iMax);
    this.peakP = Math.max(this.peakP, p);
    const T = this.thermal.temp;
    if (T > 150) byHeat = (T - 150) / 100;
    if (byCurrent + byHeat > 0) {
      this.cause = byCurrent >= byHeat ? "overcurrent" : "overheat";
      this.damage += (byCurrent + byHeat) * ctx.h;
    }
    // Collector and emitter swapped: the transistor works backwards with a gain of only a few.
    const vbe = volt(x, this.b) - volt(x, this.e);
    const vbcx = volt(x, this.b) - volt(x, this.c);
    if (vbcx > 0.5 && vbe < 0.3 && ie > 1e-6) {
      this.reverseTime += ctx.h;
      if (this.reverseTime > 0.05 && !this.reversedSent) {
        this.reversedSent = true;
        ctx.emit(
          this.id,
          "reversed",
          "This transistor is in backwards: collector and emitter are swapped. Backwards it has almost no gain, so only a trickle flows. With the flat face toward you the legs are E, B, C from left to right.",
          { cause: "reverse", amps: ie },
        );
      }
    } else this.reverseTime = 0;
    if (T > 200 && !this.smoked) {
      this.smoked = true;
      ctx.emit(this.id, "smoke", `The transistor is overheating (${fmtW(p)}; its limit is ${fmtW(Q.PMAX)}). It needs less current or a lower voltage across it.`, {
        watts: p,
        cause: "overheat",
      });
    }
    if (this.damage >= 0.15 && !this.damagedSent && this.damage < 1) {
      this.damagedSent = true;
      ctx.emit(this.id, "damaged", `The transistor is being pushed past its limits: ${fmtA(iMax)} (the 2N3904 handles ${fmtA(Q.ICMAX)}) and ${fmtW(p)} of heat. It is getting damaged.`, {
        amps: iMax,
        watts: p,
        cause: this.cause,
      });
    }
    if (this.damage >= 1) {
      this.dead = true;
      ctx.markDirty();
      ctx.markBreak();
      const base = Math.abs(ib) > 0.05 ? " Always feed the base through a resistor (10 kΩ is a good start)." : "";
      ctx.emit(
        this.id,
        "died",
        `The transistor failed. It carried up to ${fmtA(this.peakIc)} and ${fmtW(this.peakP)}, beyond the 2N3904's ${fmtA(Q.ICMAX)} and ${fmtW(Q.PMAX)} limits.${base}`,
        { amps: this.peakIc, watts: this.peakP, cause: this.cause },
      );
    }
  }
  state(x: Float64Array): PartState {
    const [ic, ib, ie] = this.terminal(x);
    const vc = volt(x, this.c);
    const vb = volt(x, this.b);
    const ve = volt(x, this.e);
    const vce = vc - ve;
    const vbe = vb - ve;
    const vbc = vb - volt(x, this.ci);
    const p = vce * ic + vbe * ib;
    const T = this.thermal.temp;
    const health: Health = this.dead ? "dead" : T > 200 ? "smoking" : T > 100 ? "hot" : "ok";
    const region = this.dead
      ? "dead"
      : vbe < 0.45 && vbc < 0.45
        ? "off"
        : vbc > 0.4 && vbe > 0.45
          ? "saturation"
          : vbe > 0.45
            ? "active"
            : "reverse";
    // For transistors, i is the collector current and v is Vce.
    const s = baseState(ic, vce, p, T, health);
    s.extra = { ib, ie, vbe, vbc, region, beta: Math.abs(ib) > 1e-12 ? ic / ib : 0, bf: this.bf };
    return s;
  }
  override save(): Record<string, unknown> {
    return { damage: this.damage, dead: this.dead, temp: this.thermal.temp, cause: this.cause };
  }
  override restore(s: Record<string, unknown>): void {
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
    this.damagedSent = this.damage >= 0.15;
    if (s.cause === "overheat") this.cause = "overheat";
  }
  override replace(): void {
    this.damage = 0;
    this.dead = false;
    this.thermal.temp = AMBIENT;
    this.smoked = false;
    this.damagedSent = false;
    this.peakIc = 0;
    this.peakP = 0;
    this.reversedSent = false;
    this.cause = "overcurrent";
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Phototransistor (two leads): behaves like an NPN whose base current comes from light. Collector current is set by
// the light (about 2 mA at full light, 100 nA dark) until the load saturates it near 0.2 V. Connected backwards it
// passes almost nothing (and says so).

const PT_IMAX = 2e-3;
const PT_DARK = 1e-7;
/** Saturation: the current reaches about 75% of the photo current at 0.2 V. */
const PT_VK = 0.2;
const PT_VA = 50;
/** Reverse conduction as a fraction of the forward photo current. */
const PT_REV = 0.01;

export class PhototransistorDevice extends Device {
  c = -1;
  e = -1;
  light: number;
  private reverseTime = 0;
  private reversedSent = false;
  constructor(spec: Spec<"phototransistor">) {
    super(spec);
    this.nonlinear = true;
    this.light = clamp(finiteOr(spec.light, 0), 0, 1);
  }
  bind(b: Binder): void {
    this.c = b.node(this.pin("c"));
    this.e = b.node(this.pin("e"));
  }
  private ig(v: number, out: { i: number; g: number }): void {
    const iph = this.light * PT_IMAX + PT_DARK;
    const th = Math.tanh(v / PT_VK);
    const dth = (1 - th * th) / PT_VK;
    if (v >= 0) {
      const early = 1 + v / PT_VA;
      out.i = iph * th * early + GMIN * v;
      out.g = iph * dth * early + (iph * th) / PT_VA + GMIN;
    } else {
      out.i = PT_REV * iph * th + GMIN * v;
      out.g = PT_REV * iph * dth + GMIN;
    }
  }
  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array): void {
    const v = volt(x, this.c) - volt(x, this.e);
    this.ig(v, o1);
    stampBranch(A, b, n, this.c, this.e, o1.i, o1.g, v);
  }
  pinCurrents(x: Float64Array): number[] {
    this.ig(volt(x, this.c) - volt(x, this.e), o1);
    return [o1.i, -o1.i];
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const v = volt(x, this.c) - volt(x, this.e);
    if (v < -0.3) {
      this.reverseTime += ctx.h;
      if (this.reverseTime > 0.05 && !this.reversedSent) {
        this.reversedSent = true;
        ctx.emit(
          this.id,
          "reversed",
          "The phototransistor is in backwards, so it passes almost nothing whatever the light. Its collector (usually the shorter leg, by the flat side) goes to the more positive side.",
          { volts: -v, cause: "reverse" },
        );
      }
    } else if (v > 0) {
      this.reverseTime = 0;
      this.reversedSent = false;
    }
  }
  state(x: Float64Array): PartState {
    const v = volt(x, this.c) - volt(x, this.e);
    this.ig(v, o1);
    const s = baseState(o1.i, v, v * o1.i);
    s.extra = { light: this.light };
    return s;
  }
  override setInput(key: InputKey, value: InputValue): boolean {
    if (key !== "light") return false;
    this.light = clamp(num(value, this.light), 0, 1);
    return true;
  }
  override inputValue(key: InputKey): InputValue | undefined {
    return key === "light" ? this.light : undefined;
  }
}
