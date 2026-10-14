// A wall adapter's output, seen from the bench: the mains side is never modelled. Three kinds.
//
// - Regulated DC: `emf` behind a small output resistance, up to its current limit (a little above the rated
//   `amps`). Past the limit the output sags, and the limit folds back toward a quarter of itself as the output
//   collapses, so a short draws little and nothing cooks.
// - Unregulated DC: a transformer, rectifier and filter capacitor, reduced to what the bench sees: `emf` behind
//   `ohms` (the output sags with load) with a ripple riding on it. Between the crests of the rectified mains the
//   filter capacitor alone feeds the load, so the output falls by about I / (rippleHz x filterFarads), then the next
//   crest tops it up quickly: a sawtooth whose size follows the load current.
// - AC: a sine of `emf` volts RMS at `hz` behind `ohms`.

import type { Health, PartSpec, PartState } from "../types";
import { AMBIENT, Device, baseState, clamp, finiteOr, stampBranch, stampG, stampI, volt, type Binder, type Ctx } from "../engine/device";
import { MAINS_HZ } from "./chips";
import { fmtA, fmtV } from "../util/format";

type Spec = Extract<PartSpec, { kind: "supply" }>;

const TAU = 2 * Math.PI;
/** A regulated supply limits at this share of its rating, and folds back to FOLD of that into a short. */
const LIMIT_OVER = 1.15;
const FOLD = 0.25;
/** Share of each ripple period the crest takes to top the filter capacitor up. */
const CREST = 0.2;
/** Solver points per ripple or mains period (the scope sees a smooth wave). */
const POINTS = 40;

/** The ripple's shape over one period (phase 0..1): mean 0, from -0.5 at the trough to +0.5 at the crest. */
export function rippleShape(phase: number): number {
  const f = phase - Math.floor(phase);
  if (f < CREST) return -0.5 * Math.cos((Math.PI * f) / CREST);
  return 0.5 - (f - CREST) / (1 - CREST);
}

const sm = { i: 0, g: 0 };

export class SupplyDevice extends Device {
  p = -1;
  m = -1;
  readonly mode: "regulated" | "unregulated" | "ac";
  readonly emf: number;
  readonly R: number;
  readonly amps: number;
  readonly filter: number;
  readonly rippleHz: number;
  readonly hz: number;
  /** Current limit for the next step (folds back with the output voltage of the last accepted step). */
  private lim: number;
  /** Load current averaged over a couple of ripple periods (sets the ripple's size). */
  private iAvg = 0;
  private iOut = 0;
  private limitTime = 0;
  private clearTime = 0;
  private warned = false;

  constructor(spec: Spec) {
    super(spec);
    this.mode = spec.ac ? "ac" : spec.regulated ? "regulated" : "unregulated";
    this.emf = Math.max(0, finiteOr(spec.emf, 9));
    const defR = this.mode === "regulated" ? 0.05 : this.mode === "ac" ? 0.5 : 1;
    this.R = Math.max(1e-3, finiteOr(spec.ohms, defR));
    this.amps = Math.max(1e-3, finiteOr(spec.amps, 1));
    this.filter = Math.max(0, finiteOr(spec.filterFarads, 0));
    this.hz = Math.max(1, finiteOr(spec.hz, MAINS_HZ));
    this.rippleHz = Math.max(1, finiteOr(spec.rippleHz, 2 * MAINS_HZ));
    this.lim = this.amps * LIMIT_OVER;
    this.nonlinear = this.mode === "regulated";
    if (this.mode === "ac") this.maxStep = 1 / (this.hz * POINTS);
    else if (this.mode === "unregulated" && this.filter > 0) this.maxStep = 1 / (this.rippleHz * POINTS);
  }

  bind(b: Binder): void {
    this.p = b.node(this.pin("pos"));
    this.m = b.node(this.pin("neg"));
  }

  /** Peak to peak ripple for the present load (unregulated with a filter), volts. */
  get ripple(): number {
    return this.mode === "unregulated" && this.filter > 0 ? Math.max(0, this.iAvg) / (this.rippleHz * this.filter) : 0;
  }

  /** The open-circuit voltage at time t (linear kinds). */
  private source(t: number): number {
    if (this.mode === "ac") return this.emf * Math.SQRT2 * Math.sin(TAU * this.hz * t);
    return this.emf + this.ripple * rippleShape(t * this.rippleHz);
  }

  /** Regulated: current delivered out of + for an output voltage v, and its derivative. */
  private regulated(v: number, scale: number): void {
    const a = (this.emf * scale - v) / this.R;
    const L = this.lim;
    const d = a - L;
    const w = 1e-3 * this.amps;
    const r = Math.sqrt(d * d + w * w);
    sm.i = (a + L - r) / 2;
    sm.g = ((1 - d / r) / 2) * (-1 / this.R);
  }

  override stampLinear(A: Float64Array, n: number): void {
    if (this.mode !== "regulated") stampG(A, n, this.p, this.m, 1 / this.R);
  }

  override stampRhs(b: Float64Array, ctx: Ctx): void {
    if (this.mode === "regulated") return;
    // Current pushed out of + by the ideal source, at the end of the step being solved.
    stampI(b, this.m, this.p, (this.source(ctx.t + ctx.h) / this.R) * ctx.sourceScale);
  }

  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array, ctx: Ctx): void {
    if (this.mode !== "regulated") return;
    const v = volt(x, this.p) - volt(x, this.m);
    this.regulated(v, ctx.sourceScale);
    // Branch current from + to - through the supply is minus what it delivers.
    stampBranch(A, b, n, this.p, this.m, -sm.i, -sm.g, v);
  }

  private out(x: Float64Array, t: number): number {
    const v = volt(x, this.p) - volt(x, this.m);
    if (this.mode === "regulated") {
      this.regulated(v, 1);
      return sm.i;
    }
    return (this.source(t) - v) / this.R;
  }

  override accept(x: Float64Array, ctx: Ctx): void {
    const v = volt(x, this.p) - volt(x, this.m);
    const i = this.out(x, ctx.t);
    this.iOut = i;
    if (this.mode === "unregulated") this.iAvg += (i - this.iAvg) * (1 - Math.exp((-ctx.h * this.rippleHz) / 2));
    if (this.mode !== "regulated") return;
    // Fold back: the limit follows the output voltage, so a short draws only a quarter of it.
    const full = this.amps * LIMIT_OVER;
    this.lim = full * (FOLD + (1 - FOLD) * clamp(v / Math.max(1e-6, this.emf), 0, 1));
    const limiting = i > 0.9 * this.lim && v < this.emf - 0.05;
    if (limiting) {
      this.limitTime += ctx.h;
      this.clearTime = 0;
      if (!this.warned && this.limitTime > 0.5) {
        this.warned = true;
        ctx.emit(
          this.id,
          "warning",
          `The adapter is giving all it can, about ${fmtA(i)}, and its output has sagged to ${fmtV(v)}. Something draws more than its ${fmtA(this.amps)} rating: look for a short.`,
          { amps: i, volts: v, cause: "current-limit" },
        );
      }
    } else {
      this.clearTime += ctx.h;
      if (this.clearTime > 1) {
        this.limitTime = 0;
        this.warned = false;
      }
    }
  }

  pinCurrents(x: Float64Array): number[] {
    const i = this.iOut;
    void x;
    return [-i, i];
  }

  state(x: Float64Array): PartState {
    const v = volt(x, this.p) - volt(x, this.m);
    const i = this.iOut;
    const limiting = this.mode === "regulated" && i > 0.9 * this.lim && v < this.emf - 0.05;
    const health: Health = limiting && this.limitTime > 2 ? "hot" : "ok";
    // Contract: i flows from the first pin (pos) to the second (neg) through the part, negative while delivering.
    const s = baseState(-i, v, Math.max(0, i * i * this.R), AMBIENT, health);
    s.extra = { mode: this.mode, out: i, emf: this.emf, limiting, ripple: this.ripple, hz: this.mode === "ac" ? this.hz : this.mode === "unregulated" ? this.rippleHz : 0 };
    return s;
  }

  override save(): Record<string, unknown> {
    return { iAvg: this.iAvg, lim: this.lim };
  }
  override restore(s: Record<string, unknown>): void {
    this.iAvg = finiteOr(s.iAvg as number, 0);
    this.lim = finiteOr(s.lim as number, this.amps * LIMIT_OVER);
  }
  override replace(): void {
    this.iAvg = 0;
    this.lim = this.amps * LIMIT_OVER;
    this.limitTime = 0;
    this.warned = false;
  }
}
