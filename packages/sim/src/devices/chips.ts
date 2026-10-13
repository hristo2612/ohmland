// Mixed-signal chips: the 555 timer and logic chips (74HC and 4000B families).
//
// They are behavioural: comparators and logic levels are decided from node voltages, internal state (a latch, a
// count) changes as events, and the analog solver only sees what the pins really do (an output is a voltage source
// behind a resistance, an input is a protection diode to each rail and almost nothing else). The engine locates
// every threshold crossing in time (Device.crossing), so switching happens at the right instant, and output changes
// land after a propagation delay as soft breaks (Ctx.markEdge).
//
// Floating inputs are not zeros: every CMOS input has a very weak link (about 1 GΩ, 10 MΩ with a hand close by) to
// a wandering voltage made of slow drift and mains hum. Anything real on the pin (a 10 kΩ pull-down, an output, a
// finger bridging it to a rail through skin) swamps it; nothing on the pin, and the input reads noise.

import type { Health, InputKey, InputValue, PartSpec, PartState } from "../types";
import {
  AMBIENT,
  Device,
  Thermal,
  baseState,
  clamp,
  finiteOr,
  num,
  stampBranch,
  stampG,
  stampI,
  volt,
  type Binder,
  type Ctx,
} from "../engine/device";
import { seededRandom, spread } from "../util/rng";
import { fmtA, fmtV, fmtW } from "../util/format";
import { DIGIT_SEGMENTS, LOGIC_PINOUTS, TIMER555_PINS } from "./pinouts";

type Spec<K extends PartSpec["kind"]> = Extract<PartSpec, { kind: K }>;

const TAU = 2 * Math.PI;
/** Mains frequency of the hum a floating input picks up. */
export const MAINS_HZ = 50;
const o = { i: 0, g: 0 };

// ---------------------------------------------------------------------------------------------------------------
// Shared input physics

/**
 * What a floating input picks up: slow drift (three incommensurate tones well under a hertz to a few hertz) plus
 * mains hum, spanning a little beyond both rails. Seeded per pin, so runs repeat.
 */
export class Pickup {
  private readonly f0: number;
  private readonly f1: number;
  private readonly f2: number;
  private readonly p0: number;
  private readonly p1: number;
  private readonly p2: number;
  private readonly ph: number;
  /** Last value stamped (volts above the chip's ground pin). */
  v = 0;
  constructor(key: string) {
    const r = seededRandom(key);
    this.f0 = 0.15 + 0.5 * r();
    this.f1 = 0.7 + 1.5 * r();
    this.f2 = 2.5 + 4 * r();
    this.p0 = TAU * r();
    this.p1 = TAU * r();
    this.p2 = TAU * r();
    this.ph = TAU * r();
  }
  /** Voltage (above the chip's ground) at time t for a supply of vs and a hand at proximity p (0..1). */
  at(t: number, vs: number, p: number): number {
    const drift = 0.5 * Math.sin(TAU * this.f0 * t + this.p0) + 0.3 * Math.sin(TAU * this.f1 * t + this.p1) + 0.15 * Math.sin(TAU * this.f2 * t + this.p2);
    const hum = (0.06 + 1.2 * p) * Math.sin(TAU * MAINS_HZ * t + this.ph);
    return Math.max(0, vs) * (0.5 + 0.85 * drift + hum);
  }
}

/** Pickup conductance: about 1 GΩ, down to 10 MΩ with a hand right by the chip. */
export function pickupG(proximity: number): number {
  return 1e-9 * (1 + 99 * proximity);
}

const CL_NVT = 0.0257;
const CL_IS = 1e-14;
/** Below this forward voltage a protection diode is left out of the stamp (it carries picoamps). */
const CL_ON = 0.15;

/**
 * A protection diode with a series resistance rs, as a smooth explicit function (no internal node): the junction
 * law up to where its slope reaches 1 / rs, then a straight line of slope 1 / rs.
 */
export function clampIG(v: number, rs: number, out: { i: number; g: number }): void {
  const v1 = CL_NVT * Math.log(CL_NVT / (CL_IS * rs));
  if (v <= v1) {
    const e = Math.exp(v / CL_NVT);
    out.i = CL_IS * (e - 1);
    out.g = (CL_IS * e) / CL_NVT;
  } else {
    out.i = CL_IS * (Math.exp(v1 / CL_NVT) - 1) + (v - v1) / rs;
    out.g = 1 / rs;
  }
}

/** Current through a protection diode at forward voltage v (0 when it is off). */
function clampI(v: number, rs: number): number {
  if (v <= CL_ON) return 0;
  clampIG(v, rs, o);
  return o.i;
}

/** Shared bookkeeping for chips: heat, damage and its events, proximity. */
abstract class ChipBase extends Device {
  vcc = -1;
  gnd = -1;
  /** Last accepted supply voltage (vcc pin minus ground pin). */
  vs = 0;
  powered = false;
  proximity = 0;
  damage = 0;
  dead = false;
  thermal: Thermal;
  protected powerUps = 0;
  protected readonly seed: string | undefined;
  protected cause = "overheat";
  private damagedSent = false;
  private smoked = false;

  constructor(spec: PartSpec, seed: string | undefined, rth: number, tau: number) {
    super(spec);
    this.seed = seed;
    this.thermal = new Thermal(rth, tau);
    this.nonlinear = true;
    this.timed = true;
  }
  protected abstract get label(): string;
  /** Unknown index of each pin, in pinKeys order (filled by bind). */
  protected pinIdx: number[] = [];
  /** Power the chip is turning into heat: the sum over its pins of pin voltage x current into the pin. */
  protected heat(x: Float64Array): number {
    const pc = this.pinCurrents(x);
    const vg = volt(x, this.gnd);
    let p = 0;
    for (let k = 0; k < pc.length; k++) p += (volt(x, this.pinIdx[k]!) - vg) * pc[k]!;
    return Math.max(0, p);
  }
  /** Adds damage at `rate` per second; emits damaged, smoke and died events. Returns true if it just died. */
  protected wear(rate: number, cause: string, ctx: Ctx, why: () => string): boolean {
    const T = this.thermal.temp;
    if (T > 150 && !this.smoked) {
      this.smoked = true;
      ctx.emit(this.id, "smoke", `The ${this.label} is too hot to touch and starting to smoke (${Math.round(T)} °C inside). ${why()}`, { temp: T, cause });
    }
    if (rate <= 0) return false;
    this.cause = cause;
    this.damage += rate * ctx.h;
    if (this.damage >= 1) {
      this.damage = 1;
      this.dead = true;
      this.powered = false;
      ctx.markDirty();
      ctx.markBreak();
      ctx.emit(this.id, "died", `The ${this.label} is dead. ${why()}`, { cause });
      return true;
    }
    if (this.damage > 0.15 && !this.damagedSent && rate < 5) {
      this.damagedSent = true;
      ctx.emit(this.id, "damaged", `The ${this.label} is being damaged. ${why()}`, { cause });
    }
    return false;
  }
  protected health(): Health {
    if (this.dead) return "dead";
    const T = this.thermal.temp;
    return T > 150 || this.damage > 0.5 ? "smoking" : T > 85 || this.damage > 0.05 ? "hot" : "ok";
  }
  override setInput(key: InputKey, value: InputValue): boolean {
    if (key !== "proximity") return false;
    this.proximity = clamp(num(value, this.proximity), 0, 1);
    return true;
  }
  override inputValue(key: InputKey): InputValue | undefined {
    return key === "proximity" ? this.proximity : undefined;
  }
  protected saveBase(): Record<string, unknown> {
    return { temp: this.thermal.temp, damage: this.damage, dead: this.dead, cause: this.cause, powerUps: this.powerUps, smoked: this.smoked };
  }
  protected restoreBase(s: Record<string, unknown>): void {
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.damagedSent = this.damage > 0.15;
    this.smoked = s.smoked === true;
    this.powerUps = finiteOr(s.powerUps as number, 0);
    if (typeof s.cause === "string") this.cause = s.cause;
  }
  protected replaceBase(): void {
    this.thermal.temp = AMBIENT;
    this.damage = 0;
    this.dead = false;
    this.damagedSent = false;
    this.smoked = false;
    this.cause = "overheat";
  }
}

/** Pins in canonical order: a copy of the spec whose pins object lists every pin of the part, in pin-number order. */
export function withPins<S extends PartSpec>(spec: S, names: readonly string[]): S {
  const given = (spec.pins ?? {}) as Record<string, string | undefined>;
  const pins: Record<string, string | undefined> = {};
  for (const nm of names) pins[nm] = given[nm];
  return { ...spec, pins } as S;
}

// ---------------------------------------------------------------------------------------------------------------
// 555 timer
//
// Inside: a divider of three equal resistors (5 kΩ bipolar, 100 kΩ CMOS) from vcc to gnd. The top tap is the
// control pin (upper threshold, 2/3 of the supply unless pin 5 is driven), the bottom tap (half the control voltage)
// is the trigger reference. Threshold comparator: thresh above ctrl. Trigger comparator: trig below the lower tap.
// Latch priorities: reset low (below about 0.7 V) forces it low over everything, then an active trigger sets it
// high (so a trigger held low keeps the output high even past the threshold), then the threshold resets it. Output
// and discharge follow the latch after about 100 ns. The discharge pin is a transistor to ground (about 12 Ω).
// Bipolar output stage: a Darlington to vcc (high about 1.4 V below the supply at a few mA, 1.7 V at 100 mA,
// saturating near 250 mA) and a transistor to ground. CMOS: MOSFETs to both rails (rail to rail, weaker source).

const T555 = {
  bipolar: {
    rDiv: 5e3,
    gq: 6e-4,
    vFunc: 3,
    vMin: 4.5,
    vMax: 16,
    vAbs: 18,
    tpd: 1e-7,
    iOutMax: 0.2,
    iDisMax: 0.05,
  },
  cmos: {
    rDiv: 1e5,
    gq: 1.2e-5,
    vFunc: 1.5,
    vMin: 2,
    vMax: 15,
    vAbs: 18,
    tpd: 1e-7,
    iOutMax: 0.1,
    iDisMax: 0.05,
  },
};
/** Bipolar output high: two junctions (Darlington) with a soft current limit. */
const HI_NVT = 0.062;
const HI_IS = 3.5e-13;
const HI_LIM = 0.25;
/** Past this the junction law continues as a straight line (the limit has long taken over by then). */
const HI_VLIN = HI_NVT * Math.log((10 * HI_LIM) / HI_IS);
const HI_BLEED = 1e4;
/** Bipolar output low: saturating transistor plus a resistive tail. */
const LO_ISAT = 0.06;
const LO_RON = 10;
const LO_RHI = 25;
/** Reset pin threshold (volts above ground) and comparator hysteresis. */
const RESET_V = 0.7;
const HYST = 0.003;

/** Darlington pull-up current (vcc to out) and its derivative, for v = vcc - out. */
function darlingtonIG(v: number, out: { i: number; g: number }): void {
  let raw: number;
  let graw: number;
  if (v <= HI_VLIN) {
    const e = Math.exp(v / HI_NVT);
    raw = HI_IS * (e - 1);
    graw = (HI_IS * e) / HI_NVT;
  } else {
    const e = Math.exp(HI_VLIN / HI_NVT);
    graw = (HI_IS * e) / HI_NVT;
    raw = HI_IS * (e - 1) + (v - HI_VLIN) * graw;
  }
  if (raw <= 0) {
    out.i = raw;
    out.g = graw;
    return;
  }
  const den = HI_LIM + raw;
  out.i = (HI_LIM * raw) / den;
  out.g = ((HI_LIM * HI_LIM) / (den * den)) * graw;
}

/** A saturating switch: isat x tanh(v / (isat x ron)) plus an optional parallel resistance. */
function switchIG(v: number, isat: number, ron: number, rpar: number, out: { i: number; g: number }): void {
  const th = Math.tanh(v / (isat * ron));
  out.i = isat * th + (rpar > 0 ? v / rpar : 0);
  out.g = (1 - th * th) / ron + (rpar > 0 ? 1 / rpar : 0);
}

export class Timer555Device extends ChipBase {
  readonly cmos: boolean;
  private readonly P: (typeof T555)["bipolar"];
  trig = -1;
  out = -1;
  reset = -1;
  ctrl = -1;
  thresh = -1;
  dis = -1;
  lower = -1;
  /** Comparator outputs (true = active) and the latch. */
  th = false;
  tr = false;
  rs = false;
  q = false;
  /** What the output stage and discharge transistor currently do (the latch, one propagation delay later). */
  outQ = false;
  private pend: -1 | 0 | 1 = -1;
  private pendAt = 0;
  private readonly pk: Pickup[];
  /** Pin positions in pinKeys order, for heat and pin currents. */
  private underTime = 0;
  private underSent = false;
  private overT = 0;

  constructor(spec: Spec<"timer555">, seed?: string) {
    super(withPins(spec, TIMER555_PINS), seed, 120, 5);
    this.cmos = spec.cmos === true;
    this.P = this.cmos ? T555.cmos : T555.bipolar;
    this.pk = ["trig", "thresh", "reset"].map((p) => new Pickup(`pickup:${seed ?? ""}:${spec.id}:${p}`));
  }
  protected get label(): string {
    return this.cmos ? "CMOS 555" : "555";
  }
  bind(b: Binder): void {
    this.gnd = b.node(this.pin("gnd"));
    this.trig = b.node(this.pin("trig"));
    this.out = b.node(this.pin("out"));
    this.reset = b.node(this.pin("reset"));
    this.ctrl = b.node(this.pin("ctrl"));
    this.thresh = b.node(this.pin("thresh"));
    this.dis = b.node(this.pin("dis"));
    this.vcc = b.node(this.pin("vcc"));
    this.pinIdx = [this.gnd, this.trig, this.out, this.reset, this.ctrl, this.thresh, this.dis, this.vcc];
    this.lower = b.internal(`${this.id}#lower`);
    b.group([this.vcc, this.ctrl, this.lower, this.gnd]);
    b.group([this.trig, this.gnd]);
    b.group([this.thresh, this.gnd]);
    b.group([this.reset, this.gnd]);
    b.group([this.out, this.vcc, this.gnd]);
    b.group([this.dis, this.gnd]);
  }
  override stampLinear(A: Float64Array, n: number): void {
    const g = 1 / this.P.rDiv;
    stampG(A, n, this.vcc, this.ctrl, g);
    stampG(A, n, this.ctrl, this.lower, g);
    stampG(A, n, this.lower, this.gnd, g);
    const gp = pickupG(this.proximity);
    stampG(A, n, this.trig, this.gnd, gp);
    stampG(A, n, this.thresh, this.gnd, gp);
    stampG(A, n, this.reset, this.gnd, gp);
    if (this.dead) return;
    stampG(A, n, this.vcc, this.gnd, this.P.gq);
    if (!this.cmos) stampG(A, n, this.out, this.gnd, 1 / HI_BLEED);
  }
  override stampRhs(b: Float64Array, ctx: Ctx): void {
    const t = ctx.t + ctx.h;
    const gp = pickupG(this.proximity);
    const pins = [this.trig, this.thresh, this.reset];
    for (let k = 0; k < 3; k++) {
      const pk = this.pk[k]!;
      pk.v = pk.at(t, this.vs, this.proximity);
      stampI(b, this.gnd, pins[k]!, gp * pk.v);
    }
  }
  /** Output stage strength for the supply: CMOS gets stronger with more gate drive. */
  private cmosK(): number {
    return Math.max(0.1, (this.vs - 0.8) / 4.2);
  }
  /** Current from vcc into the output (high side) for v = vcc - out. */
  private highIG(v: number, out: { i: number; g: number }): void {
    if (this.cmos) {
      const k = this.cmosK();
      switchIG(v, 0.02 * k, 50 / k, 0, out);
    } else darlingtonIG(v, out);
  }
  /** Current from the output to ground (low side) for v = out - gnd. */
  private lowIG(v: number, out: { i: number; g: number }): void {
    if (this.cmos) {
      const k = this.cmosK();
      switchIG(v, 0.1 * k, 12 / k, 0, out);
    } else switchIG(v, LO_ISAT, LO_RON, LO_RHI, out);
  }
  private disIG(v: number, out: { i: number; g: number }): void {
    if (this.cmos) switchIG(v, 0.08 * this.cmosK(), 10, 0, out);
    else switchIG(v, 0.15, 12, 0, out);
  }
  private get driving(): boolean {
    return this.powered && !this.dead;
  }
  /**
   * Newton iteration memory for the output stage and discharge transistor. Their characteristics flatten out far
   * from their operating point (current limits), where Newton overshoots wildly, so right after the stage switches
   * the first iteration is taken at a typical on-state voltage and later ones may move only so far per iteration
   * (the idea of SPICE's junction limiting).
   */
  private vOn = 0;
  private vDis = 0;
  private fresh = true;
  override initIter(x: Float64Array): void {
    const vg = volt(x, this.gnd);
    const vo = volt(x, this.out);
    if (this.fresh) {
      this.vOn = this.outQ && !this.cmos ? 1.4 : 0.2;
      this.vDis = 0.2;
    } else {
      this.vOn = this.outQ ? volt(x, this.vcc) - vo : vo - vg;
      this.vDis = volt(x, this.dis) - vg;
    }
  }
  /** Limits a new iterate of a stage voltage against the previous one. */
  private limit(vnew: number, vold: number, ctx: Ctx, darlington: boolean): number {
    if (darlington) {
      // Junction region: at most a junction-limited step upward (pnjlim), unlimited once on the straight part.
      if (vnew > vold + 2 * HI_NVT && vnew > 1.2 && vold < HI_VLIN) {
        ctx.noncon = true;
        return Math.max(vold, 1.2) + HI_NVT * Math.log(1 + (vnew - Math.max(vold, 1.2)) / HI_NVT);
      }
      return vnew;
    }
    const step = 1.5;
    if (vnew > vold + step) {
      ctx.noncon = true;
      return vold + step;
    }
    if (vnew < vold - step) {
      ctx.noncon = true;
      return vold - step;
    }
    return vnew;
  }
  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array, ctx: Ctx): void {
    if (this.dead) return;
    const vg = volt(x, this.gnd);
    const vc = volt(x, this.vcc);
    // Substrate diode: conducts when the supply is reversed.
    const dr = vg - vc;
    if (dr > CL_ON) {
      clampIG(dr, 1, o);
      stampBranch(A, b, n, this.gnd, this.vcc, o.i, o.g, dr);
    }
    const vo = volt(x, this.out);
    // Output pin diodes to both rails: an inductive load (a speaker, a relay coil) that keeps its current flowing
    // when the stage switches is clamped about a diode drop beyond the rails.
    const up = vo - vc;
    if (up > CL_ON) {
      clampIG(up, 2, o);
      stampBranch(A, b, n, this.out, this.vcc, o.i, o.g, up);
    }
    const dn = vg - vo;
    if (dn > CL_ON) {
      clampIG(dn, 2, o);
      stampBranch(A, b, n, this.gnd, this.out, o.i, o.g, dn);
    }
    if (!this.driving) return;
    if (this.outQ) {
      const v = (this.vOn = this.limit(vc - vo, this.vOn, ctx, !this.cmos));
      this.highIG(v, o);
      stampBranch(A, b, n, this.vcc, this.out, o.i, o.g, v);
    } else {
      const v = (this.vOn = this.limit(vo - vg, this.vOn, ctx, false));
      this.lowIG(v, o);
      stampBranch(A, b, n, this.out, this.gnd, o.i, o.g, v);
      const vd = (this.vDis = this.limit(volt(x, this.dis) - vg, this.vDis, ctx, false));
      this.disIG(vd, o);
      stampBranch(A, b, n, this.dis, this.gnd, o.i, o.g, vd);
    }
  }
  /**
   * Currents: [vcc to out (high side, less the clamp to vcc), out to gnd (low side, bleed and clamp to gnd), dis to
   * gnd, substrate gnd to vcc].
   */
  private stage(x: Float64Array): [number, number, number, number] {
    if (this.dead) return [0, 0, 0, 0];
    const vg = volt(x, this.gnd);
    const vc = volt(x, this.vcc);
    const vo = volt(x, this.out);
    const sub = clampI(vg - vc, 1);
    const clampUp = clampI(vo - vc, 2);
    const lo0 = (this.cmos ? 0 : (vo - vg) / HI_BLEED) - clampI(vg - vo, 2);
    if (!this.driving) return [-clampUp, lo0, 0, sub];
    if (this.outQ) {
      this.highIG(vc - vo, o);
      return [o.i - clampUp, lo0, 0, sub];
    }
    this.lowIG(vo - vg, o);
    const lo = o.i;
    this.disIG(volt(x, this.dis) - vg, o);
    return [-clampUp, lo + lo0, o.i, sub];
  }
  pinCurrents(x: Float64Array): number[] {
    const vg = volt(x, this.gnd);
    const vc = volt(x, this.vcc);
    const vt = volt(x, this.ctrl);
    const vl = volt(x, this.lower);
    const g = 1 / this.P.rDiv;
    const [hi, lo, dis, sub] = this.stage(x);
    const gp = pickupG(this.proximity);
    const iTrig = gp * (volt(x, this.trig) - vg - this.pk[0]!.v);
    const iThr = gp * (volt(x, this.thresh) - vg - this.pk[1]!.v);
    const iRst = gp * (volt(x, this.reset) - vg - this.pk[2]!.v);
    const iq = this.dead ? 0 : this.P.gq * (vc - vg);
    const iTop = (vc - vt) * g;
    const iMid = (vt - vl) * g;
    const iBot = (vl - vg) * g;
    // Into each pin: gnd, trig, out, reset, ctrl, thresh, dis, vcc.
    const iVcc = iTop + iq + hi - sub;
    const iOut = -hi + lo;
    const iCtrl = iMid - iTop;
    const iGnd = -(iBot + iq + lo + dis - sub + iTrig + iThr + iRst);
    return [iGnd, iTrig, iOut, iRst, iCtrl, iThr, dis, iVcc];
  }
  /** Comparator inputs: threshold (thresh - ctrl), trigger (lower - trig), reset (0.7 - reset). */
  private comps(x: Float64Array): [number, number, number] {
    const vg = volt(x, this.gnd);
    return [volt(x, this.thresh) - volt(x, this.ctrl), volt(x, this.lower) - volt(x, this.trig), RESET_V - (volt(x, this.reset) - vg)];
  }
  private static latch(q: boolean, th: boolean, tr: boolean, rs: boolean): boolean {
    return rs ? false : tr ? true : th ? false : q;
  }
  override crossing(x0: Float64Array, x1: Float64Array): number {
    if (!this.driving) return Infinity;
    const d0 = this.comps(x0);
    const d1 = this.comps(x1);
    const st = [this.th, this.tr, this.rs];
    let f = Infinity;
    for (let k = 0; k < 3; k++) {
      const on = st[k]!;
      const a = d0[k]!;
      const c = d1[k]!;
      const crossed = on ? c < -HYST : c > HYST;
      if (!crossed) continue;
      // Only crossings that change what the latch does need an exact time.
      const s = [...st];
      s[k] = !on;
      if (Timer555Device.latch(this.q, s[0]!, s[1]!, s[2]!) === this.q) continue;
      const lvl = on ? -HYST : HYST;
      const fk = c === a ? 0 : (lvl - a) / (c - a);
      if (fk < f) f = fk;
    }
    return f;
  }
  private schedule(q: boolean, ctx: Ctx): void {
    if (q === this.outQ) {
      this.pend = -1;
      return;
    }
    if (this.pend === (q ? 1 : 0)) return;
    this.pend = q ? 1 : 0;
    this.pendAt = ctx.t + this.P.tpd;
    ctx.addBreakpoint(this.pendAt);
  }
  override beginStep(ctx: Ctx): void {
    if (this.pend < 0) return;
    if (ctx.t >= this.pendAt - 1e-12) {
      this.outQ = this.pend === 1;
      this.pend = -1;
      this.fresh = true;
      ctx.markEdge();
    } else ctx.addBreakpoint(this.pendAt);
  }
  private updateComparators(x: Float64Array): void {
    const [a, b, c] = this.comps(x);
    if (this.th ? a < -HYST : a > HYST) this.th = !this.th;
    if (this.tr ? b < -HYST : b > HYST) this.tr = !this.tr;
    if (this.rs ? c < -HYST : c > HYST) this.rs = !this.rs;
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const vg = volt(x, this.gnd);
    const vs = volt(x, this.vcc) - vg;
    this.vs = vs;
    const P = this.P;
    const p = this.heat(x);
    this.thermal.update(p, ctx.h);
    if (this.dead) return;
    this.fresh = false;
    // Currents as solved for this step (before anything below switches the stage).
    const stage = this.stage(x);

    // Power: below a few volts nothing inside works; when it comes up the latch starts in a random state (a
    // monostable may fire once at switch-on), then the comparators have their say.
    const on = this.powered ? vs > P.vFunc - 0.2 : vs > P.vFunc;
    if (on !== this.powered) {
      this.powered = on;
      ctx.markDirty();
      ctx.markEdge();
      if (on) {
        const rnd = seededRandom(`powerup:${this.seed ?? ""}:${this.id}:${this.powerUps++}`);
        this.q = rnd() < 0.6;
        const [a, b, c] = this.comps(x);
        this.th = a > 0;
        this.tr = b > 0;
        this.rs = c > 0;
        this.q = Timer555Device.latch(this.q, this.th, this.tr, this.rs);
        this.outQ = this.q;
        this.pend = -1;
        this.fresh = true;
      } else this.pend = -1;
    }
    if (this.powered) {
      this.updateComparators(x);
      const q = Timer555Device.latch(this.q, this.th, this.tr, this.rs);
      if (q !== this.q) this.q = q;
      this.schedule(this.q, ctx);
    }

    // Abuse
    const [hi, lo, dis, sub] = stage;
    let rate = 0;
    let cause = "";
    let why = "";
    const iOut = Math.max(Math.abs(hi), Math.abs(lo));
    if (vs > P.vAbs) {
      rate += 2 + 5 * (vs - P.vAbs);
      cause = "overvoltage";
      why = `It had ${fmtV(vs)} across its supply pins; it is made for ${P.vMin} to ${P.vMax} V.`;
    }
    if (sub > 0.05) {
      const k = sub / 0.05;
      rate += k * k;
      cause = "reverse";
      why = "Its supply is connected backwards (pin 8 must go to +, pin 1 to ground), so current pours through it. Check the notch: pin 1 is to its left.";
    }
    if (iOut > P.iOutMax) {
      const k = iOut / P.iOutMax;
      rate += (k * k - 1) * 2;
      cause = "overcurrent";
      why = `Its output carried ${fmtA(iOut)}, more than the ${fmtA(P.iOutMax)} it can handle. Something on pin 3 is close to a short: add resistance (a speaker needs about 100 Ω in series).`;
    }
    if (Math.abs(dis) > P.iDisMax) {
      const k = Math.abs(dis) / P.iDisMax;
      rate += (k * k - 1) / 2;
      cause = "overcurrent";
      why = `Its discharge pin (7) sank ${fmtA(Math.abs(dis))}. Pin 7 must never connect straight to +: keep at least 1 kΩ (10 kΩ is safer) between them.`;
    }
    const T = this.thermal.temp;
    if (T > 150) {
      rate += (T - 150) / 50;
      if (!cause) {
        cause = "overheat";
        why = `It is dissipating ${fmtW(p)}; a small chip like this sheds well under 1 W.`;
      }
    }
    if (iOut > P.iOutMax) this.overT += ctx.h;
    else this.overT = 0;
    // Running below its minimum supply: works poorly. Said once.
    if (vs > 0.5 && vs < P.vMin) {
      this.underTime += ctx.h;
      if (this.underTime > 0.05 && !this.underSent) {
        this.underSent = true;
        ctx.emit(this.id, "warning", `The ${this.label} is running on ${fmtV(vs)}, below the ${P.vMin} V it is made for, so its timing and output levels are unreliable.`, {
          volts: vs,
          cause: "undervoltage",
        });
      }
    } else this.underTime = 0;
    const msg = why || `It overheated at ${Math.round(T)} °C.`;
    if (this.wear(rate, cause || "overheat", ctx, () => msg)) this.outQ = false;
  }
  state(x: Float64Array): PartState {
    const pc = this.pinCurrents(x);
    const vg = volt(x, this.gnd);
    const vs = volt(x, this.vcc) - vg;
    const s = baseState(-pc[2]!, volt(x, this.out) - vg, this.heat(x), this.thermal.temp, this.health());
    s.extra = {
      output: !this.driving ? "off" : this.outQ ? "high" : "low",
      latch: this.q,
      trigger: this.tr,
      threshold: this.th,
      reset: this.rs,
      discharge: this.driving && !this.outQ,
      upper: volt(x, this.ctrl) - vg,
      lower: volt(x, this.lower) - vg,
      supply: vs,
      supplyAmps: pc[7]!,
      dischargeAmps: pc[6]!,
      powered: this.powered,
      cmos: this.cmos,
      damage: this.damage,
    };
    return s;
  }
  override save(): Record<string, unknown> {
    return { ...this.saveBase(), th: this.th, tr: this.tr, rs: this.rs, q: this.q, outQ: this.outQ, powered: this.powered, pend: this.pend, pendAt: this.pendAt, vs: this.vs };
  }
  override restore(s: Record<string, unknown>): void {
    this.restoreBase(s);
    this.th = s.th === true;
    this.tr = s.tr === true;
    this.rs = s.rs === true;
    this.q = s.q === true;
    this.outQ = s.outQ === true;
    this.powered = s.powered === true && !this.dead;
    this.pend = s.pend === 1 ? 1 : s.pend === 0 ? 0 : -1;
    this.pendAt = finiteOr(s.pendAt as number, 0);
    this.vs = finiteOr(s.vs as number, 0);
  }
  override replace(): void {
    this.replaceBase();
    this.powered = false;
    this.pend = -1;
    this.outQ = false;
    this.q = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Logic families

type Family = {
  label: "74HC" | "4000B";
  /** Below this supply nothing inside works (outputs float). */
  vFunc: number;
  /** Recommended supply range and the absolute maximum (destroyed above it). */
  vMin: number;
  vMax: number;
  vAbs: number;
  /** Output resistance and gate propagation delay for a supply. */
  rOut(vs: number): number;
  tpd(vs: number): number;
  /** Absolute maximum output current and input protection diode current. */
  iOutMax: number;
  iClampMax: number;
  /** Datasheet input bands as fractions of the supply: low below lo, high above hi, undefined between. */
  lo: number;
  hi: number;
  /** Where an input really switches (fraction of the supply) and a tiny hysteresis. */
  vt: number;
  hyst: number;
  /** Extra supply current at 5 V when an input sits right at mid-rail (both input transistors half on). */
  shoot: number;
};

const HC: Family = {
  label: "74HC",
  vFunc: 1.5,
  vMin: 2,
  vMax: 6,
  vAbs: 7,
  // About 50 Ω at 5 V (0.2 V drop at 4 mA), weaker at low supplies.
  rOut: (vs) => (50 * 4.2) / Math.max(0.3, vs - 0.8),
  tpd: (vs) => (9e-9 * 4.2) / Math.max(0.3, vs - 0.8),
  iOutMax: 0.025,
  iClampMax: 0.02,
  lo: 0.3,
  hi: 0.7,
  vt: 0.5,
  hyst: 0.01,
  shoot: 2e-3,
};

const CD4000B: Family = {
  label: "4000B",
  vFunc: 2.5,
  vMin: 3,
  vMax: 18,
  vAbs: 20,
  // About 1 kΩ at 5 V, 500 Ω at 9 V, 300 Ω at 15 V: weak outputs.
  rOut: (vs) => (1000 * 4.4) / Math.max(0.3, vs - 0.6),
  tpd: (vs) => (1.2e-7 * 4.4) / Math.max(0.3, vs - 0.6),
  iOutMax: 0.015,
  iClampMax: 0.01,
  lo: 0.3,
  hi: 0.7,
  vt: 0.5,
  hyst: 0.01,
  shoot: 1e-3,
};

/** Schmitt-trigger inputs (74HC14): rising threshold about 0.56 of the supply, falling about 0.36. */
const SCHMITT_UP = 0.56;
const SCHMITT_DOWN = 0.36;

/** What a model uses to drive its outputs: out(k, level, delay in units of the family's gate delay). */
export interface OutputDriver {
  out(k: number, level: 0 | 1, delay: number): void;
}

type ModelDef = {
  family: Family;
  label: string;
  vcc: string;
  gnd: string;
  inputs: readonly string[];
  outputs: readonly string[];
  schmitt?: boolean;
  /** Inputs each output depends on (default: all), for leaving the oscillation guard. */
  deps?: number[][];
  /** Size of the internal state and a random power-up state. */
  stateSize?: number;
  powerUp?(st: number[], rnd: () => number): void;
  /** Internal state changes for new input levels (prev: the levels before this change). */
  update?(cur: Uint8Array, prev: Uint8Array, st: number[]): void;
  /** Drives every output from the inputs and state. */
  drive(cur: Uint8Array, st: number[], d: OutputDriver): void;
  /** Extra read-outs for the snapshot. */
  report?(st: number[], cur: Uint8Array, extra: Record<string, number | string | boolean>): void;
};

function quad2(label: string, fn: (a: number, b: number) => number): ModelDef {
  return {
    family: HC,
    label,
    vcc: "vcc",
    gnd: "gnd",
    inputs: ["a1", "b1", "a2", "b2", "a3", "b3", "a4", "b4"],
    outputs: ["y1", "y2", "y3", "y4"],
    deps: [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
    ],
    drive(cur, _st, d) {
      for (let g = 0; g < 4; g++) d.out(g, fn(cur[2 * g]!, cur[2 * g + 1]!) ? 1 : 0, 1);
    },
  };
}

function hex1(label: string, schmitt: boolean): ModelDef {
  return {
    family: HC,
    label,
    vcc: "vcc",
    gnd: "gnd",
    schmitt,
    inputs: ["a1", "a2", "a3", "a4", "a5", "a6"],
    outputs: ["y1", "y2", "y3", "y4", "y5", "y6"],
    deps: [[0], [1], [2], [3], [4], [5]],
    drive(cur, _st, d) {
      for (let g = 0; g < 6; g++) d.out(g, cur[g] ? 0 : 1, schmitt ? 1.3 : 1);
    },
  };
}

const NOR3: ModelDef = {
  family: HC,
  label: "74HC27",
  vcc: "vcc",
  gnd: "gnd",
  inputs: ["a1", "b1", "c1", "a2", "b2", "c2", "a3", "b3", "c3"],
  outputs: ["y1", "y2", "y3"],
  deps: [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ],
  drive(cur, _st, d) {
    for (let g = 0; g < 3; g++) d.out(g, cur[3 * g] || cur[3 * g + 1] || cur[3 * g + 2] ? 0 : 1, 1);
  },
};

/** Dual D flip-flop: rising-edge clock, active-low preset and clear (both low: both outputs high). */
const DFF: ModelDef = {
  family: HC,
  label: "74HC74",
  vcc: "vcc",
  gnd: "gnd",
  inputs: ["clr1", "d1", "clk1", "pre1", "clr2", "d2", "clk2", "pre2"],
  outputs: ["q1", "qn1", "q2", "qn2"],
  deps: [
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [4, 5, 6, 7],
  ],
  stateSize: 2,
  powerUp(st, rnd) {
    st[0] = rnd() < 0.5 ? 1 : 0;
    st[1] = rnd() < 0.5 ? 1 : 0;
  },
  update(cur, prev, st) {
    for (let f = 0; f < 2; f++) {
      const clr = cur[4 * f]!;
      const pre = cur[4 * f + 3]!;
      if (!pre) st[f] = 1;
      else if (!clr) st[f] = 0;
      else if (cur[4 * f + 2] && !prev[4 * f + 2]) st[f] = prev[4 * f + 1]!; // D as it was just before the edge
    }
  },
  drive(cur, st, d) {
    for (let f = 0; f < 2; f++) {
      const both = !cur[4 * f] && !cur[4 * f + 3];
      d.out(2 * f, both ? 1 : st[f] ? 1 : 0, 1.6);
      d.out(2 * f + 1, both ? 1 : st[f] ? 0 : 1, 1.6);
    }
  },
  report(st, _cur, extra) {
    extra.state1 = st[0]!;
    extra.state2 = st[1]!;
  },
};

/** Dual 4-bit ripple counter: falling-edge clock, level-held active-high clear; stages ripple one delay apart. */
const RIPPLE = [1.4, 2.1, 2.8, 3.5];
const C393: ModelDef = {
  family: HC,
  label: "74HC393",
  vcc: "vcc",
  gnd: "gnd",
  inputs: ["clk1", "clr1", "clk2", "clr2"],
  outputs: ["qa1", "qb1", "qc1", "qd1", "qa2", "qb2", "qc2", "qd2"],
  deps: [[0, 1], [0, 1], [0, 1], [0, 1], [2, 3], [2, 3], [2, 3], [2, 3]],
  stateSize: 2,
  powerUp(st, rnd) {
    st[0] = Math.floor(rnd() * 16);
    st[1] = Math.floor(rnd() * 16);
  },
  update(cur, prev, st) {
    for (let c = 0; c < 2; c++) {
      if (cur[2 * c + 1]) st[c] = 0;
      else if (prev[2 * c] && !cur[2 * c]) st[c] = (st[c]! + 1) & 15;
    }
  },
  drive(_cur, st, d) {
    for (let c = 0; c < 2; c++) for (let k = 0; k < 4; k++) d.out(4 * c + k, (st[c]! >> k) & 1 ? 1 : 0, RIPPLE[k]!);
  },
  report(st, _cur, extra) {
    extra.count1 = st[0]!;
    extra.count2 = st[1]!;
  },
};

/** 4026B: decade counter (rising edge, inhibit and reset active high) with decoded 7-segment outputs. */
const C4026: ModelDef = {
  family: CD4000B,
  label: "4026B",
  vcc: "vdd",
  gnd: "vss",
  inputs: ["clk", "inh", "dei", "rst"],
  outputs: ["deo", "co", "a", "b", "c", "d", "e", "f", "g", "ucs"],
  deps: [[2], [0, 1, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 3]],
  stateSize: 1,
  powerUp(st, rnd) {
    st[0] = Math.floor(rnd() * 10);
  },
  update(cur, prev, st) {
    if (cur[3]) st[0] = 0;
    else if (cur[0] && !prev[0] && !cur[1] && !prev[1]) st[0] = (st[0]! + 1) % 10;
  },
  drive(cur, st, d) {
    const n = st[0]!;
    const segs = DIGIT_SEGMENTS[n]!;
    const shown = cur[2] === 1;
    d.out(0, shown ? 1 : 0, 1);
    // Carry out: high for 0 to 4, low for 5 to 9, so it rises as the count rolls from 9 to 0.
    d.out(1, n < 5 ? 1 : 0, 2);
    "abcdefg".split("").forEach((s, k) => d.out(2 + k, shown && segs.includes(s) ? 1 : 0, 2));
    d.out(9, segs.includes("c") ? 1 : 0, 2);
  },
  report(st, cur, extra) {
    extra.count = st[0]!;
    extra.digit = cur[2] ? String(st[0]!) : " ";
  },
};

export const LOGIC_MODELS: Record<string, ModelDef> = {
  "74HC00": quad2("74HC00", (a, b) => (a && b ? 0 : 1)),
  "74HC02": quad2("74HC02", (a, b) => (a || b ? 0 : 1)),
  "74HC08": quad2("74HC08", (a, b) => (a && b ? 1 : 0)),
  "74HC32": quad2("74HC32", (a, b) => (a || b ? 1 : 0)),
  "74HC86": quad2("74HC86", (a, b) => (a !== b ? 1 : 0)),
  "74HC04": hex1("74HC04", false),
  "74HC14": hex1("74HC14", true),
  "74HC27": NOR3,
  "74HC74": DFF,
  "74HC393": C393,
  "4026B": C4026,
};

// ---------------------------------------------------------------------------------------------------------------
// Logic chip device

type InCh = { name: string; idx: number; pos: number; pk: Pickup };
type OutCh = {
  name: string;
  idx: number;
  pos: number;
  /** -1 floating (unpowered or dead), else the level the output stage drives. */
  value: -1 | 0 | 1;
  /** Pending level and when it lands (-1: none). */
  pend: -1 | 0 | 1;
  pendAt: number;
  /** This output's delay spread (each gate on a chip is a little different). */
  spread: number;
  /** Level the logic wants (kept while the oscillation guard holds the output at mid-rail). */
  want: 0 | 1;
  /** Recent toggle times, for the oscillation guard. */
  toggles: number[];
  osc: boolean;
  firmSince: number;
  /** Time spent over the current limit (for the warning). */
  overT: number;
};

/** An output toggling this many times within OSC_WINDOW is oscillating far faster than anyone can see. */
const OSC_TOGGLES = 40;
const OSC_WINDOW = 2e-5;
/** Its inputs must be firm (outside the undefined band) this long before the guard lets go. */
const OSC_RELEASE = 5e-5;

export class LogicDevice extends ChipBase implements OutputDriver {
  readonly def: ModelDef;
  readonly fam: Family;
  ins: InCh[] = [];
  outs: OutCh[] = [];
  readonly cur: Uint8Array;
  readonly prev: Uint8Array;
  st: number[];
  rOut: number;
  tpdNow: number;
  /** Extra supply current from inputs parked mid-rail (applied over the next step). */
  shootAmps = 0;
  private now = 0;
  private ctx: Ctx | null = null;
  private vccPos = 0;
  private gndPos = 0;
  private warnedOverload = false;
  private warnedSupply = false;
  private oscSent = false;

  constructor(spec: Spec<"logic">, seed?: string) {
    const def = LOGIC_MODELS[spec.model] ?? LOGIC_MODELS["74HC00"]!;
    const order = LOGIC_PINOUTS[spec.model] ?? LOGIC_PINOUTS["74HC00"];
    super(withPins(spec, order), seed, 100, 5);
    this.def = def;
    this.fam = def.family;
    this.cur = new Uint8Array(def.inputs.length);
    this.prev = new Uint8Array(def.inputs.length);
    this.st = new Array<number>(def.stateSize ?? 0).fill(0);
    this.rOut = this.fam.rOut(5);
    this.tpdNow = this.fam.tpd(5);
    const pos = (nm: string) => this.pinKeys.indexOf(nm);
    this.vccPos = pos(def.vcc);
    this.gndPos = pos(def.gnd);
    this.ins = def.inputs.map((nm) => ({ name: nm, idx: -1, pos: pos(nm), pk: new Pickup(`pickup:${seed ?? ""}:${spec.id}:${nm}`) }));
    this.outs = def.outputs.map((nm) => ({
      name: nm,
      idx: -1,
      pos: pos(nm),
      value: -1,
      pend: -1,
      pendAt: 0,
      spread: 1 + 0.15 * spread(spec.id, `tpd-${nm}`, seed),
      want: 0,
      toggles: [],
      osc: false,
      firmSince: -1,
      overT: 0,
    }));
  }
  protected get label(): string {
    return this.def.label;
  }
  bind(b: Binder): void {
    this.vcc = b.node(this.pin(this.def.vcc));
    this.gnd = b.node(this.pin(this.def.gnd));
    this.pinIdx = new Array<number>(this.pinKeys.length).fill(-1);
    this.pinIdx[this.vccPos] = this.vcc;
    this.pinIdx[this.gndPos] = this.gnd;
    for (const c of this.ins) {
      c.idx = b.node(this.pin(c.name));
      this.pinIdx[c.pos] = c.idx;
      b.group([c.idx, this.vcc, this.gnd]);
    }
    for (const c of this.outs) {
      c.idx = b.node(this.pin(c.name));
      this.pinIdx[c.pos] = c.idx;
      b.group([c.idx, this.vcc, this.gnd]);
    }
    b.group([this.vcc, this.gnd]);
  }
  private get G(): number {
    return 1 / this.rOut;
  }
  override stampLinear(A: Float64Array, n: number): void {
    const gp = pickupG(this.proximity);
    for (const c of this.ins) stampG(A, n, c.idx, this.gnd, gp);
    if (this.dead) return;
    const G = this.G;
    for (const c of this.outs) {
      if (c.osc && c.value >= 0) {
        stampG(A, n, c.idx, this.vcc, G / 2);
        stampG(A, n, c.idx, this.gnd, G / 2);
      } else if (c.value === 1) stampG(A, n, c.idx, this.vcc, G);
      else if (c.value === 0) stampG(A, n, c.idx, this.gnd, G);
    }
  }
  override stampRhs(b: Float64Array, ctx: Ctx): void {
    const t = ctx.t + ctx.h;
    const gp = pickupG(this.proximity);
    for (const c of this.ins) {
      c.pk.v = c.pk.at(t, this.vs, this.proximity);
      stampI(b, this.gnd, c.idx, gp * c.pk.v);
    }
    if (this.shootAmps > 0) stampI(b, this.vcc, this.gnd, this.shootAmps);
  }
  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array): void {
    if (this.dead) return;
    const vc = volt(x, this.vcc);
    const vg = volt(x, this.gnd);
    const dr = vg - vc;
    if (dr > CL_ON) {
      clampIG(dr, 1, o);
      stampBranch(A, b, n, this.gnd, this.vcc, o.i, o.g, dr);
    }
    for (const c of this.ins) this.stampClamps(A, b, n, x, c.idx, vc, vg);
    for (const c of this.outs) this.stampClamps(A, b, n, x, c.idx, vc, vg);
  }
  private stampClamps(A: Float64Array, b: Float64Array, n: number, x: Float64Array, idx: number, vc: number, vg: number): void {
    const v = volt(x, idx);
    const up = v - vc;
    if (up > CL_ON) {
      clampIG(up, 20, o);
      stampBranch(A, b, n, idx, this.vcc, o.i, o.g, up);
    }
    const dn = vg - v;
    if (dn > CL_ON) {
      clampIG(dn, 20, o);
      stampBranch(A, b, n, this.gnd, idx, o.i, o.g, dn);
    }
  }
  /** Output current (out of the pin into the load) for an output channel. */
  private outAmps(x: Float64Array, c: OutCh): number {
    if (this.dead || c.value < 0) return 0;
    const vo = volt(x, c.idx);
    const G = this.G;
    if (c.osc) return (volt(x, this.vcc) - vo) * (G / 2) - (vo - volt(x, this.gnd)) * (G / 2);
    return c.value === 1 ? (volt(x, this.vcc) - vo) * G : -(vo - volt(x, this.gnd)) * G;
  }
  pinCurrents(x: Float64Array): number[] {
    const out = new Array<number>(this.pinKeys.length).fill(0);
    const vc = volt(x, this.vcc);
    const vg = volt(x, this.gnd);
    const gp = pickupG(this.proximity);
    let iVcc = 0;
    let iGnd = 0;
    const clamps = (idx: number, pos: number) => {
      if (this.dead) return;
      const v = volt(x, idx);
      const up = clampI(v - vc, 20);
      const dn = clampI(vg - v, 20);
      out[pos]! += up - dn;
      iVcc -= up;
      iGnd += dn;
    };
    for (const c of this.ins) {
      const ip = gp * (volt(x, c.idx) - vg - c.pk.v);
      out[c.pos]! += ip;
      iGnd -= ip;
      clamps(c.idx, c.pos);
    }
    for (const c of this.outs) {
      if (!this.dead && c.value >= 0) {
        const vo = volt(x, c.idx);
        const G = this.G;
        const fromVcc = c.osc ? (vc - vo) * (G / 2) : c.value === 1 ? (vc - vo) * G : 0;
        const toGnd = c.osc ? (vo - vg) * (G / 2) : c.value === 0 ? (vo - vg) * G : 0;
        out[c.pos]! += toGnd - fromVcc;
        iVcc += fromVcc;
        iGnd -= toGnd;
      }
      clamps(c.idx, c.pos);
    }
    if (!this.dead) {
      const sub = clampI(vg - vc, 1);
      iVcc += this.shootAmps - sub;
      iGnd += sub - this.shootAmps;
    }
    out[this.vccPos]! += iVcc;
    out[this.gndPos]! += iGnd;
    return out;
  }

  // -- logic ----------------------------------------------------------------------------------------------------

  /** Thresholds an input must cross to go high or low (fractions of the supply). */
  private get upFrac(): number {
    return this.def.schmitt ? SCHMITT_UP : this.fam.vt + this.fam.hyst / 2;
  }
  private get downFrac(): number {
    return this.def.schmitt ? SCHMITT_DOWN : this.fam.vt - this.fam.hyst / 2;
  }
  override crossing(x0: Float64Array, x1: Float64Array): number {
    if (!this.powered || this.dead) return Infinity;
    const g0 = volt(x0, this.gnd);
    const g1 = volt(x1, this.gnd);
    const s0 = volt(x0, this.vcc) - g0;
    const s1 = volt(x1, this.vcc) - g1;
    let f = Infinity;
    for (let k = 0; k < this.ins.length; k++) {
      const c = this.ins[k]!;
      const high = this.cur[k] === 1;
      const fr = high ? this.downFrac : this.upFrac;
      const d0 = volt(x0, c.idx) - g0 - fr * s0;
      const d1 = volt(x1, c.idx) - g1 - fr * s1;
      if (high ? d1 >= 0 : d1 <= 0) continue;
      const fk = d0 === d1 ? 0 : d0 / (d0 - d1);
      if (fk < f) f = fk;
    }
    return f;
  }
  /** OutputDriver: schedule output k to a level after `units` gate delays (inertial: short pulses are swallowed). */
  out(k: number, level: 0 | 1, units: number): void {
    const c = this.outs[k]!;
    c.want = level;
    if (c.osc) return;
    const ctx = this.ctx;
    if (c.pend >= 0) {
      if (c.pend === level) return;
      c.pend = -1;
      if (level === c.value) return;
    } else if (level === c.value) return;
    c.pend = level;
    c.pendAt = this.now + this.tpdNow * units * c.spread;
    ctx?.addBreakpoint(c.pendAt);
  }
  private refresh(): void {
    this.def.drive(this.cur, this.st, this);
  }
  override beginStep(ctx: Ctx): void {
    let changed = false;
    for (const c of this.outs) {
      if (c.pend < 0) continue;
      if (ctx.t >= c.pendAt - 1e-12) {
        c.value = c.pend;
        c.pend = -1;
        changed = true;
        // Oscillation guard: an output flipping tens of times within microseconds (a gate fed back on itself) is
        // shown as what a meter would see, a steady half level, instead of being simulated edge by edge.
        const tg = c.toggles;
        tg.push(ctx.t);
        while (tg.length > 0 && tg[0]! < ctx.t - OSC_WINDOW) tg.shift();
        if (tg.length >= OSC_TOGGLES) {
          c.osc = true;
          c.firmSince = -1;
          tg.length = 0;
          if (!this.oscSent) {
            this.oscSent = true;
            ctx.emit(
              this.id,
              "warning",
              `Output ${c.name} of the ${this.label} is oscillating at several megahertz (its own change feeds back to its input). That is far too fast to see: a meter reads about half the supply. Break the loop, or add a resistor and capacitor to slow it down.`,
              { cause: "oscillating", pin: c.name },
            );
          }
        }
      } else ctx.addBreakpoint(c.pendAt);
    }
    if (changed) {
      ctx.markDirty();
      ctx.markEdge();
    }
  }
  private readLevels(x: Float64Array, exact: boolean): boolean {
    const vg = volt(x, this.gnd);
    const vs = volt(x, this.vcc) - vg;
    let changed = false;
    for (let k = 0; k < this.ins.length; k++) {
      const v = volt(x, this.ins[k]!.idx) - vg;
      const was = this.cur[k]!;
      const lvl = exact ? (v > this.fam.vt * vs ? 1 : 0) : was ? (v < this.downFrac * vs ? 0 : 1) : v > this.upFrac * vs ? 1 : 0;
      if (lvl !== was) {
        this.cur[k] = lvl;
        changed = true;
      }
    }
    return changed;
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const vg = volt(x, this.gnd);
    const vs = volt(x, this.vcc) - vg;
    this.vs = vs;
    this.now = ctx.t;
    this.ctx = ctx;
    const fam = this.fam;
    const p = this.heat(x);
    this.thermal.update(p, ctx.h);
    if (this.dead) return;
    // Abuse is judged on the step as solved, before anything below switches an output.
    this.abuse(x, vs, p, ctx);
    if (this.dead) return;

    const on = this.powered ? vs > fam.vFunc - 0.2 : vs > fam.vFunc;
    if (on !== this.powered) {
      this.powered = on;
      if (on) {
        this.rOut = fam.rOut(vs);
        this.tpdNow = fam.tpd(vs);
        const rnd = seededRandom(`powerup:${this.seed ?? ""}:${this.id}:${this.powerUps++}`);
        this.def.powerUp?.(this.st, rnd);
        this.readLevels(x, true);
        this.prev.set(this.cur);
        this.def.update?.(this.cur, this.cur, this.st);
        this.refresh();
      } else {
        for (const c of this.outs) {
          c.value = -1;
          c.pend = -1;
          c.osc = false;
          c.toggles.length = 0;
        }
        ctx.markDirty();
        ctx.markEdge();
      }
    }
    if (this.powered) {
      const r = fam.rOut(vs);
      if (Math.abs(r - this.rOut) > 0.02 * this.rOut) {
        this.rOut = r;
        ctx.markDirty();
      }
      this.tpdNow = fam.tpd(vs);
      if (this.readLevels(x, false)) {
        this.def.update?.(this.cur, this.prev, this.st);
        this.prev.set(this.cur);
        this.refresh();
      }
      this.releaseGuard(x, vs, ctx);
    }

    // Inputs parked between the bands draw extra supply current (both input transistors conduct).
    let shoot = 0;
    if (this.powered) {
      const k = fam.shoot * (vs / 5) * (vs / 5);
      for (const c of this.ins) {
        const u = (volt(x, c.idx) - vg) / Math.max(0.1, vs) - 0.5;
        if (u > -0.3 && u < 0.3) shoot += k * Math.exp(-(u * u) / 0.0144);
      }
    }
    this.shootAmps = shoot;
  }
  /** The oscillation guard lets go of an output once its inputs have been firm for a while. */
  private releaseGuard(x: Float64Array, vs: number, ctx: Ctx): void {
    const deps = this.def.deps;
    const vg = volt(x, this.gnd);
    let released = false;
    this.outs.forEach((c, k) => {
      if (!c.osc) return;
      const ins = deps?.[k] ?? this.ins.map((_, j) => j);
      const firm = ins.every((j) => {
        const u = (volt(x, this.ins[j]!.idx) - vg) / Math.max(0.1, vs);
        return u < this.fam.lo || u > this.fam.hi;
      });
      if (!firm) c.firmSince = -1;
      else if (c.firmSince < 0) c.firmSince = ctx.t;
      else if (ctx.t - c.firmSince > OSC_RELEASE) {
        c.osc = false;
        c.value = c.want;
        released = true;
      }
    });
    if (released) {
      ctx.markDirty();
      ctx.markEdge();
    }
  }
  private abuse(x: Float64Array, vs: number, p: number, ctx: Ctx): void {
    const fam = this.fam;
    let rate = 0;
    let cause = "";
    let why = "";
    if (vs > fam.vAbs) {
      rate += 2 + 5 * (vs - fam.vAbs);
      cause = "overvoltage";
      why = `It had ${fmtV(vs)} on its supply pins; ${fam.label} chips are made for ${fam.vMin} to ${fam.vMax} V (${fam.vAbs} V at most).${fam.label === "74HC" ? " Feed them from a 5 V regulator." : ""}`;
    } else if (vs > fam.vMax + 0.3 && !this.warnedSupply) {
      this.warnedSupply = true;
      ctx.emit(this.id, "warning", `The ${this.label} has ${fmtV(vs)} on its supply, above the ${fam.vMax} V it is made for. It is close to being destroyed.`, {
        volts: vs,
        cause: "overvoltage",
      });
    }
    const vg = volt(x, this.gnd);
    const vc = volt(x, this.vcc);
    const sub = clampI(vg - vc, 1);
    if (sub > 0.05) {
      const k = sub / 0.05;
      rate += k * k;
      cause = "reverse";
      why = `Its supply is connected backwards (${this.def.vcc.toUpperCase()} must go to +), so current pours straight through it. Check the notch: pin 1 is to its left.`;
    }
    for (const c of this.outs) {
      const i = Math.abs(this.outAmps(x, c));
      if (i > fam.iOutMax) {
        const k = i / fam.iOutMax;
        rate += (k * k - 1) / 20;
        c.overT += ctx.h;
        if (!cause) {
          cause = "overcurrent";
          why = `Output ${c.name} carried ${fmtA(i)}; a ${fam.label} output survives about ${fmtA(fam.iOutMax)}. It is shorted to a rail or fighting another output.`;
        }
        if (c.overT > 0.02 && !this.warnedOverload) {
          this.warnedOverload = true;
          ctx.emit(
            this.id,
            "warning",
            `Output ${c.name} of the ${this.label} is delivering ${fmtA(i)}, more than the ${fmtA(fam.iOutMax)} it can survive. It may be shorted to a supply rail or tied to another output that drives the other way.`,
            { amps: i, pin: c.name, cause: "overload" },
          );
        }
      } else c.overT = 0;
    }
    for (const c of this.ins) {
      const v = volt(x, c.idx);
      const i = Math.max(clampI(v - vc, 20), clampI(vg - v, 20));
      if (i > fam.iClampMax) {
        const k = i / fam.iClampMax;
        rate += (k * k - 1) / 5;
        if (!cause) {
          cause = "overvoltage";
          why = `Input ${c.name} was driven ${v > vc ? "above its supply" : "below ground"}, pushing ${fmtA(i)} through its protection diode. Inputs must stay between the chip's own supply rails.`;
        }
      }
    }
    const T = this.thermal.temp;
    if (T > 150) rate += (T - 150) / 50;
    if (!why) why = `It is dissipating ${fmtW(p)} and overheated.`;
    if (this.wear(rate, cause || "overheat", ctx, () => why)) {
      for (const c of this.outs) {
        c.value = -1;
        c.pend = -1;
      }
    }
  }
  state(x: Float64Array): PartState {
    const pc = this.pinCurrents(x);
    const vg = volt(x, this.gnd);
    const vs = volt(x, this.vcc) - vg;
    const s = baseState(pc[this.vccPos]!, vs, this.heat(x), this.thermal.temp, this.health());
    const extra: Record<string, number | string | boolean> = { model: this.def.label, family: this.fam.label, powered: this.powered, damage: this.damage };
    const fs = Math.max(0.1, vs);
    for (const c of this.ins) {
      const u = (volt(x, c.idx) - vg) / fs;
      extra[c.name] = !this.powered ? "Z" : u < this.fam.lo ? "L" : u > this.fam.hi ? "H" : "X";
    }
    for (const c of this.outs) extra[c.name] = c.value < 0 ? "Z" : c.osc ? "~" : c.value ? "H" : "L";
    if (this.outs.some((c) => c.osc)) extra.oscillating = true;
    this.def.report?.(this.st, this.cur, extra);
    s.extra = extra;
    return s;
  }
  override save(): Record<string, unknown> {
    return {
      ...this.saveBase(),
      st: [...this.st],
      cur: [...this.cur],
      prev: [...this.prev],
      powered: this.powered,
      vs: this.vs,
      outs: this.outs.map((c) => ({ value: c.value, pend: c.pend, pendAt: c.pendAt, want: c.want, osc: c.osc })),
    };
  }
  override restore(s: Record<string, unknown>): void {
    this.restoreBase(s);
    const arr = (v: unknown) => (Array.isArray(v) ? (v as number[]) : []);
    arr(s.st).forEach((v, k) => {
      if (k < this.st.length) this.st[k] = finiteOr(v, 0);
    });
    arr(s.cur).forEach((v, k) => {
      if (k < this.cur.length) this.cur[k] = v ? 1 : 0;
    });
    arr(s.prev).forEach((v, k) => {
      if (k < this.prev.length) this.prev[k] = v ? 1 : 0;
    });
    this.powered = s.powered === true && !this.dead;
    this.vs = finiteOr(s.vs as number, 0);
    this.rOut = this.fam.rOut(Math.max(this.fam.vFunc, this.vs));
    this.tpdNow = this.fam.tpd(Math.max(this.fam.vFunc, this.vs));
    const outs = Array.isArray(s.outs) ? (s.outs as Record<string, unknown>[]) : [];
    outs.forEach((v, k) => {
      const c = this.outs[k];
      if (!c || !v) return;
      c.value = v.value === 1 ? 1 : v.value === 0 ? 0 : -1;
      c.pend = v.pend === 1 ? 1 : v.pend === 0 ? 0 : -1;
      c.pendAt = finiteOr(v.pendAt as number, 0);
      c.want = v.want === 1 ? 1 : 0;
      c.osc = v.osc === true;
    });
  }
  override replace(): void {
    this.replaceBase();
    this.powered = false;
    this.warnedOverload = false;
    this.warnedSupply = false;
    for (const c of this.outs) {
      c.value = -1;
      c.pend = -1;
      c.osc = false;
      c.toggles.length = 0;
    }
  }
}
