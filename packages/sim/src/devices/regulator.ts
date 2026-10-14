// 7805 linear regulator (in, gnd, out). The output follows the input about 2 V below it until it reaches its set
// point (5 V, each part within about 1%), then stays there. It only sources current, up to about 2.2 A (less when
// the input is far above the output: foldback). It drops (Vin - Vout) x I as heat in a TO-220 package: about
// 65 °C/W in free air, 15 °C/W on a heat sink. At 150 °C inside it shuts its output off until it cools, as the real
// part does; left cycling in thermal shutdown it wears out over a couple of minutes (a simplification: real ones
// last longer, but a lab should show what running without a heat sink costs). Above 35 V in, or connected
// backwards, it is destroyed.

import type { Health, PartSpec, PartState } from "../types";
import { AMBIENT, Device, addA, baseState, finiteOr, stampBranch, stampG, stampI, volt, type Binder, type Ctx } from "../engine/device";
import { clampIG } from "./chips";
import { spread } from "../util/rng";
import { fmtA, fmtV, fmtW } from "../util/format";

type Spec = Extract<PartSpec, { kind: "regulator7805" }>;

const VSET = 5;
/** Dropout headroom at light load and the output resistance (about 2 V headroom at 1 A). */
const VDO = 1.95;
const RO = 0.05;
/** Smoothing of the min and max functions (keeps Newton happy at the corners). */
const SM_V = 0.04;
const SM_I = 1e-3;
const SM_L = 0.02;
/** Current limit, and the foldback above 7 V across the regulator. */
const ILIM = 2.2;
const IQ = 4e-3;
const BLEED = 1e4;
const RJC = 5;
const RCA_FREE = 60;
const RCA_SINK = 10;
const TAU_J = 0.05;
const SHUTDOWN_C = 150;
const RESUME_C = 140;
const VIN_ABS = 35;

const r = { i: 0, du: 0, dw: 0 };
const c = { i: 0, g: 0 };

export class RegulatorDevice extends Device {
  vin = -1;
  gnd = -1;
  out = -1;
  readonly vset: number;
  readonly heatsink: boolean;
  /** Case and junction temperatures. */
  tc = AMBIENT;
  tj = AMBIENT;
  shutdown = false;
  ilim = ILIM;
  /** Ground pin current over the next step (from the last accepted input voltage). */
  iq = 0;
  damage = 0;
  dead = false;
  private cause = "overheat";
  private warned = false;
  private damagedSent = false;
  private pLast = 0;

  constructor(spec: Spec, seed?: string) {
    super(spec);
    this.vset = VSET * (1 + 0.01 * spread(spec.id, "7805", seed));
    this.heatsink = spec.heatsink === true;
    this.nonlinear = true;
  }
  bind(b: Binder): void {
    this.vin = b.node(this.pin("in"));
    this.gnd = b.node(this.pin("gnd"));
    this.out = b.node(this.pin("out"));
    b.group([this.vin, this.out, this.gnd]);
  }
  override stampLinear(A: Float64Array, n: number): void {
    if (!this.dead) stampG(A, n, this.out, this.gnd, 1 / BLEED);
  }
  override stampRhs(b: Float64Array): void {
    if (this.iq > 0) stampI(b, this.vin, this.gnd, this.iq);
  }
  /** Pass current (in to out) and its derivatives for w = Vin - Vgnd, u = Vout - Vgnd. */
  private evaluate(w: number, u: number): void {
    const L = this.shutdown || this.dead ? 0 : this.ilim;
    if (L <= 0) {
      r.i = 0;
      r.du = 0;
      r.dw = 0;
      return;
    }
    // Target: the set point, or the input less the dropout headroom, whichever is lower.
    const a = this.vset;
    const bb = w - VDO;
    const d = a - bb;
    const rt = Math.sqrt(d * d + SM_V * SM_V);
    const vt = (a + bb - rt) / 2;
    const dvt = (1 + d / rt) / 2;
    const i0 = (vt - u) / RO;
    // It only sources: smooth max(i0, 0).
    const r2 = Math.sqrt(i0 * i0 + SM_I * SM_I);
    const i1 = (i0 + r2) / 2;
    const d1 = (1 + i0 / r2) / 2;
    // Current limit: smooth min(i1, L).
    const e = i1 - L;
    const r3 = Math.sqrt(e * e + SM_L * SM_L);
    r.i = (i1 + L - r3) / 2;
    const di = ((1 - e / r3) / 2) * d1;
    r.du = -di / RO;
    r.dw = (di * dvt) / RO;
  }
  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array): void {
    if (this.dead) return;
    const vg = volt(x, this.gnd);
    const w = volt(x, this.vin) - vg;
    const u = volt(x, this.out) - vg;
    this.evaluate(w, u);
    const ic = r.i - r.du * u - r.dw * w;
    const gu = r.du;
    const gw = r.dw;
    addA(A, n, this.vin, this.out, gu);
    addA(A, n, this.vin, this.vin, gw);
    addA(A, n, this.vin, this.gnd, -(gu + gw));
    if (this.vin >= 0) b[this.vin]! -= ic;
    addA(A, n, this.out, this.out, -gu);
    addA(A, n, this.out, this.vin, -gw);
    addA(A, n, this.out, this.gnd, gu + gw);
    if (this.out >= 0) b[this.out]! += ic;
    // Connected backwards, the substrate conducts from ground to the input.
    const rv = -w;
    if (rv > 0.15) {
      clampIG(rv, 1, c);
      stampBranch(A, b, n, this.gnd, this.vin, c.i, c.g, rv);
    }
  }
  /** [pass current in to out, reverse substrate current gnd to in]. */
  private currents(x: Float64Array): [number, number] {
    if (this.dead) return [0, 0];
    const vg = volt(x, this.gnd);
    const w = volt(x, this.vin) - vg;
    this.evaluate(w, volt(x, this.out) - vg);
    let rev = 0;
    if (-w > 0.15) {
      clampIG(-w, 1, c);
      rev = c.i;
    }
    return [r.i, rev];
  }
  pinCurrents(x: Float64Array): number[] {
    const [i, rev] = this.currents(x);
    const bleed = this.dead ? 0 : (volt(x, this.out) - volt(x, this.gnd)) / BLEED;
    const iq = this.dead ? 0 : this.iq;
    // Into in, gnd, out.
    return [i + iq - rev, -iq - bleed + rev, -i + bleed];
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const vg = volt(x, this.gnd);
    const w = volt(x, this.vin) - vg;
    const u = volt(x, this.out) - vg;
    const [i, rev] = this.currents(x);
    const p = Math.max(0, (w - u) * i + w * this.iq + (u * u) / BLEED + rev * Math.max(0, -w));
    this.pLast = p;
    const h = ctx.h;
    const rca = this.heatsink ? RCA_SINK : RCA_FREE;
    const tauC = this.heatsink ? 120 : 45;
    const tcTarget = AMBIENT + p * rca;
    this.tc = tcTarget + (this.tc - tcTarget) * Math.exp(-h / tauC);
    const tjTarget = this.tc + p * RJC;
    this.tj = tjTarget + (this.tj - tjTarget) * Math.exp(-h / TAU_J);
    if (this.dead) return;

    // Ground pin current follows the input (for the next step); foldback limit from the voltage across it.
    const iq = w > 0 ? IQ * Math.min(1, w / 7) : 0;
    if (Math.abs(iq - this.iq) > 1e-5) this.iq = iq;
    const across = w - u;
    this.ilim = across <= 7 ? ILIM : Math.max(0.4, ILIM - (across - 7) * 0.07);

    // Thermal protection.
    if (!this.shutdown && this.tj >= SHUTDOWN_C) {
      this.shutdown = true;
      ctx.markBreak();
      if (!this.warned) {
        this.warned = true;
        ctx.emit(
          this.id,
          "warning",
          `The regulator has reached ${SHUTDOWN_C} °C inside and switched its output off to cool down. It turns the difference between input and output into heat: (${fmtV(w)} - ${fmtV(u)}) x ${fmtA(i)} is about ${fmtW(p)}. A heat sink, a lower input voltage or less load keeps it running.`,
          { temp: this.tj, watts: p, cause: "thermal-shutdown" },
        );
      }
    } else if (this.shutdown && this.tj < RESUME_C) {
      this.shutdown = false;
      ctx.markBreak();
    }

    let rate = 0;
    let why = "";
    if (this.shutdown) {
      rate += 1 / 90;
      this.cause = "overheat";
      why = "It spent too long cycling in thermal shutdown. Give it a heat sink or a lower input voltage.";
    }
    if (w > VIN_ABS) {
      rate += 2 + (w - VIN_ABS);
      this.cause = "overvoltage";
      why = `Its input saw ${fmtV(w)}; a 7805 takes 35 V at most.`;
    }
    if (rev > 0.1) {
      const k = rev / 0.1;
      rate += k * k;
      this.cause = "reverse";
      why = "It is connected backwards: the input must be the most positive pin, the middle pin goes to ground.";
    }
    if (rate <= 0) return;
    this.damage += rate * h;
    if (this.damage >= 1) {
      this.damage = 1;
      this.dead = true;
      this.iq = 0;
      ctx.markDirty();
      ctx.markBreak();
      ctx.emit(this.id, "died", `The 7805 regulator failed. ${why}`, { cause: this.cause, temp: this.tj });
    } else if (this.damage > 0.3 && !this.damagedSent && rate < 5) {
      this.damagedSent = true;
      ctx.emit(this.id, "damaged", `The 7805 regulator is being damaged. ${why}`, { cause: this.cause, temp: this.tj });
    }
  }
  state(x: Float64Array): PartState {
    const vg = volt(x, this.gnd);
    const w = volt(x, this.vin) - vg;
    const u = volt(x, this.out) - vg;
    const pc = this.pinCurrents(x);
    const health: Health = this.dead ? "dead" : this.tj > SHUTDOWN_C - 5 || this.damage > 0.5 ? "smoking" : this.tj > 85 ? "hot" : "ok";
    const s = baseState(-pc[2]!, u, this.pLast, this.tj, health);
    const [i] = this.currents(x);
    s.extra = {
      vin: w,
      vset: this.vset,
      caseTemp: this.tc,
      dropout: !this.dead && w - VDO - RO * i < this.vset - 0.05,
      limiting: !this.dead && !this.shutdown && i > 0.95 * this.ilim,
      shutdown: this.shutdown,
      heatsink: this.heatsink,
      damage: this.damage,
    };
    return s;
  }
  override save(): Record<string, unknown> {
    return { tc: this.tc, tj: this.tj, shutdown: this.shutdown, damage: this.damage, dead: this.dead, cause: this.cause, warned: this.warned };
  }
  override restore(s: Record<string, unknown>): void {
    this.tc = finiteOr(s.tc as number, AMBIENT);
    this.tj = finiteOr(s.tj as number, AMBIENT);
    this.shutdown = s.shutdown === true;
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.damagedSent = this.damage > 0.3;
    this.warned = s.warned === true;
    if (typeof s.cause === "string") this.cause = s.cause;
  }
  override replace(): void {
    this.tc = AMBIENT;
    this.tj = AMBIENT;
    this.shutdown = false;
    this.damage = 0;
    this.dead = false;
    this.damagedSent = false;
    this.warned = false;
  }
}
