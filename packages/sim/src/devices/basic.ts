// Linear and nearly linear parts: wires, resistors, switches, pots, batteries, cells and fuses.

import type { Health, InputKey, InputValue, PartSpec, PartState } from "../types";
import {
  AMBIENT,
  Device,
  G_OPEN,
  R_OFF,
  R_ON,
  Thermal,
  baseState,
  bool,
  clamp,
  finiteOr,
  num,
  stampG,
  stampI,
  volt,
  type Binder,
  type Ctx,
} from "../engine/device";
import { spread } from "../util/rng";
import { fmtA, fmtS, fmtV, fmtW, fmtX } from "../util/format";

type Spec<K extends PartSpec["kind"]> = Extract<PartSpec, { kind: K }>;

// ---------------------------------------------------------------------------------------------------------------

export class WireDevice extends Device {
  constructor(spec: Spec<"wire">) {
    super(spec);
    this.accepts = false;
  }
  bind(_b: Binder): void {}
  pinCurrents(): number[] {
    return [0, 0];
  }
  state(): PartState {
    return baseState(0, 0, 0);
  }
}

// ---------------------------------------------------------------------------------------------------------------

/** Two-terminal linear conductance. */
abstract class TwoTerminal extends Device {
  a = -1;
  b = -1;
  bind(b: Binder): void {
    this.a = b.node(this.pinNames[0]!);
    this.b = b.node(this.pinNames[1]!);
  }
  abstract get g(): number;
  override stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.a, this.b, this.g);
  }
  vOf(x: Float64Array): number {
    return volt(x, this.a) - volt(x, this.b);
  }
  pinCurrents(x: Float64Array): number[] {
    const i = this.vOf(x) * this.g;
    return [i, -i];
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Resistor with a first-order thermal model and burn-out.

export const RESISTOR_HOT_C = 100;
export const RESISTOR_SMOKE_C = 250;
const RESISTOR_BURN_C = 350;

export class ResistorDevice extends TwoTerminal {
  R: number;
  watts: number;
  thermal: Thermal;
  damage = 0;
  dead = false;
  private smoked = false;
  private pLast = 0;

  constructor(spec: Spec<"resistor"> | Spec<"probe-resistance">, private readonly heats = true) {
    super(spec);
    const tol = spec.kind === "resistor" ? clamp(finiteOr(spec.tolerance, 0), 0, 0.5) : 0;
    this.R = Math.max(1e-4, finiteOr(spec.ohms, 1000)) * (1 + tol * spread(spec.id, "resistor"));
    this.watts = spec.kind === "resistor" ? Math.max(0.01, finiteOr(spec.watts, 0.25)) : 0.25;
    // 250 C/W for a quarter watt part; bigger parts run cooler and have more thermal mass.
    this.thermal = new Thermal(62.5 / this.watts, 4 * Math.pow(this.watts / 0.25, 0.6));
    this.accepts = heats;
  }
  get g(): number {
    return this.dead ? G_OPEN : 1 / this.R;
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const v = this.vOf(x);
    const p = v * v * this.g;
    this.pLast = p;
    this.thermal.update(p, ctx.h);
    if (this.dead) return;
    const T = this.thermal.temp;
    const ratio = p / this.watts;
    if (T > RESISTOR_SMOKE_C && !this.smoked) {
      this.smoked = true;
      ctx.emit(
        this.id,
        "smoke",
        `The resistor is smoking. It is turning ${fmtW(p)} into heat, ${fmtX(ratio)} its ${fmtW(this.watts)} rating. A higher resistance or a part with a bigger power rating would stay cool.`,
        { watts: p, rating: this.watts, temp: T },
      );
    }
    if (T > RESISTOR_BURN_C) {
      this.damage += ((T - RESISTOR_BURN_C) / 300) * ctx.h;
      if (this.damage >= 1) {
        this.dead = true;
        ctx.markDirty();
        ctx.markBreak();
        ctx.emit(
          this.id,
          "died",
          `The resistor burned open after running at about ${fmtW(p)}, ${fmtX(ratio)} its ${fmtW(this.watts)} rating. It is now an open circuit, so no current flows through it.`,
          { watts: p, rating: this.watts, temp: T },
        );
      }
    }
  }
  health(): Health {
    if (this.dead) return "dead";
    const T = this.thermal.temp;
    return T > RESISTOR_SMOKE_C ? "smoking" : T > RESISTOR_HOT_C ? "hot" : "ok";
  }
  state(x: Float64Array): PartState {
    const v = this.vOf(x);
    const i = v * this.g;
    const s = baseState(i, v, v * i, this.thermal.temp, this.health());
    s.extra = { ohms: this.R, watts: this.watts };
    return s;
  }
  override setInput(key: InputKey, value: InputValue): boolean {
    if (key !== "ohms") return false;
    this.R = Math.max(1e-4, num(value, this.R));
    return true;
  }
  override inputValue(key: InputKey): InputValue | undefined {
    return key === "ohms" ? this.R : undefined;
  }
  override save(): Record<string, unknown> {
    return { temp: this.thermal.temp, damage: this.damage, dead: this.dead, smoked: this.smoked };
  }
  override restore(s: Record<string, unknown>): void {
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.smoked = s.smoked === true;
  }
  override replace(): void {
    this.thermal.temp = AMBIENT;
    this.damage = 0;
    this.dead = false;
    this.smoked = false;
  }
  get power(): number {
    return this.pLast;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Switches

export class SwitchDevice extends TwoTerminal {
  closed: boolean;
  constructor(spec: Spec<"switch"> | Spec<"pushbutton">) {
    super(spec);
    this.closed = spec.kind === "switch" ? spec.closed === true : spec.pressed === true;
    this.accepts = false;
  }
  private get key(): InputKey {
    return this.kind === "switch" ? "closed" : "pressed";
  }
  get g(): number {
    return this.closed ? 1 / R_ON : 1 / R_OFF;
  }
  state(x: Float64Array): PartState {
    const v = this.vOf(x);
    const i = v * this.g;
    const s = baseState(i, v, v * i);
    s.closed = this.closed;
    return s;
  }
  override setInput(key: InputKey, value: InputValue): boolean {
    if (key !== this.key && !(key === "closed" && this.kind === "pushbutton")) return false;
    this.closed = bool(value, this.closed);
    return true;
  }
  override inputValue(key: InputKey): InputValue | undefined {
    return key === this.key ? this.closed : undefined;
  }
}

export class SpdtDevice extends Device {
  com = -1;
  ta = -1;
  tb = -1;
  to: "a" | "b";
  constructor(spec: Spec<"spdt">) {
    super(spec);
    this.to = spec.to === "b" ? "b" : "a";
    this.accepts = false;
  }
  bind(b: Binder): void {
    this.com = b.node(this.pin("com"));
    this.ta = b.node(this.pin("a"));
    this.tb = b.node(this.pin("b"));
  }
  private ga(): number {
    return this.to === "a" ? 1 / R_ON : 1 / R_OFF;
  }
  private gb(): number {
    return this.to === "b" ? 1 / R_ON : 1 / R_OFF;
  }
  override stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.com, this.ta, this.ga());
    stampG(A, n, this.com, this.tb, this.gb());
  }
  pinCurrents(x: Float64Array): number[] {
    const vc = volt(x, this.com);
    const ia = (vc - volt(x, this.ta)) * this.ga();
    const ib = (vc - volt(x, this.tb)) * this.gb();
    return [ia + ib, -ia, -ib];
  }
  state(x: Float64Array): PartState {
    const [ic] = this.pinCurrents(x);
    const v = volt(x, this.com) - volt(x, this.to === "a" ? this.ta : this.tb);
    const s = baseState(ic!, v, Math.abs(v * ic!));
    s.closed = true;
    s.extra = { to: this.to };
    return s;
  }
  override setInput(key: InputKey, value: InputValue): boolean {
    if (key !== "to") return false;
    this.to = value === "b" || value === 1 || value === true ? "b" : "a";
    return true;
  }
  override inputValue(key: InputKey): InputValue | undefined {
    return key === "to" ? this.to : undefined;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Potentiometer: two resistors either side of the wiper, ends floored at a small minimum.

export class PotDevice extends Device {
  a = -1;
  w = -1;
  b = -1;
  R: number;
  position: number;
  thermal = new Thermal(250, 4);
  dead = false;
  damage = 0;
  private smoked = false;
  constructor(spec: Spec<"pot">) {
    super(spec);
    this.R = Math.max(10, finiteOr(spec.ohms, 10000));
    this.position = clamp(finiteOr(spec.position, 0.5), 0, 1);
  }
  bind(b: Binder): void {
    this.a = b.node(this.pin("a"));
    this.w = b.node(this.pin("wiper"));
    this.b = b.node(this.pin("b"));
  }
  get rMin(): number {
    return Math.max(1, this.R * 1e-4);
  }
  get g1(): number {
    return this.dead ? G_OPEN : 1 / Math.max(this.rMin, this.position * this.R);
  }
  get g2(): number {
    return this.dead ? G_OPEN : 1 / Math.max(this.rMin, (1 - this.position) * this.R);
  }
  override stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.a, this.w, this.g1);
    stampG(A, n, this.w, this.b, this.g2);
  }
  pinCurrents(x: Float64Array): number[] {
    const vw = volt(x, this.w);
    const ia = (volt(x, this.a) - vw) * this.g1;
    const ib = (volt(x, this.b) - vw) * this.g2;
    return [ia, -(ia + ib), ib];
  }
  private power(x: Float64Array): number {
    const vw = volt(x, this.w);
    const v1 = volt(x, this.a) - vw;
    const v2 = vw - volt(x, this.b);
    return v1 * v1 * this.g1 + v2 * v2 * this.g2;
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const p = this.power(x);
    this.thermal.update(p, ctx.h);
    if (this.dead) return;
    const T = this.thermal.temp;
    if (T > RESISTOR_SMOKE_C && !this.smoked) {
      this.smoked = true;
      ctx.emit(this.id, "smoke", `The potentiometer is smoking: it is dissipating ${fmtW(p)}. Turned close to one end, its track has almost no resistance left to limit the current. Add a fixed resistor in series.`, { watts: p });
    }
    if (T > RESISTOR_BURN_C) {
      this.damage += ((T - RESISTOR_BURN_C) / 300) * ctx.h;
      if (this.damage >= 1) {
        this.dead = true;
        ctx.markDirty();
        ctx.markBreak();
        ctx.emit(this.id, "died", `The potentiometer's track burned through. Next time, put a fixed resistor in series so the current stays limited at every setting.`, { watts: p });
      }
    }
  }
  state(x: Float64Array): PartState {
    const [ia] = this.pinCurrents(x);
    const vw = volt(x, this.w);
    const T = this.thermal.temp;
    const health: Health = this.dead ? "dead" : T > RESISTOR_SMOKE_C ? "smoking" : T > RESISTOR_HOT_C ? "hot" : "ok";
    const s = baseState(ia!, volt(x, this.a) - vw, this.power(x), T, health);
    const iwb = (vw - volt(x, this.b)) * this.g2;
    s.extra = { position: this.position, vWiperB: vw - volt(x, this.b), iWiperB: iwb };
    return s;
  }
  override setInput(key: InputKey, value: InputValue): boolean {
    if (key === "position") {
      this.position = clamp(num(value, this.position), 0, 1);
      return true;
    }
    if (key === "ohms") {
      this.R = Math.max(10, num(value, this.R));
      return true;
    }
    return false;
  }
  override inputValue(key: InputKey): InputValue | undefined {
    return key === "position" ? this.position : key === "ohms" ? this.R : undefined;
  }
  override save(): Record<string, unknown> {
    return { temp: this.thermal.temp, dead: this.dead, damage: this.damage, smoked: this.smoked };
  }
  override restore(s: Record<string, unknown>): void {
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
    this.dead = s.dead === true;
    this.damage = finiteOr(s.damage as number, 0);
    this.smoked = s.smoked === true;
  }
  override replace(): void {
    this.thermal.temp = AMBIENT;
    this.dead = false;
    this.damage = 0;
    this.smoked = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Batteries and cells: Norton source with internal resistance. Batteries add two polarisation states (fast and
// slow) that pull the terminal voltage down under heavy load and recover at rest, plus optional capacity.

const SHORT_FRACTION = 0.35;

export class SourceDevice extends Device {
  p = -1;
  m = -1;
  emf: number;
  r0: number;
  mAh: number;
  soc = 1;
  vp1 = 0;
  vp2 = 0;
  thermal = new Thermal(20, 200);
  private readonly polarizes: boolean;
  private shortTime = 0;
  private clearTime = 0;
  private shortedFlag = false;
  private rEff: number;
  private emfEff: number;
  private iOut = 0;
  private reversedFlag = false;

  constructor(spec: Spec<"battery"> | Spec<"cell">) {
    super(spec);
    this.emf = finiteOr(spec.emf, 9);
    this.r0 = Math.max(1e-3, finiteOr(spec.internalOhms, spec.kind === "cell" ? 1000 : 1.7));
    this.mAh = spec.kind === "battery" ? Math.max(0, finiteOr(spec.mAh, 0)) : 0;
    this.polarizes = spec.kind === "battery";
    this.rEff = this.r0;
    this.emfEff = this.emf;
  }
  bind(b: Binder): void {
    this.p = b.node(this.pin("pos"));
    this.m = b.node(this.pin("neg"));
  }
  /** Open-circuit voltage factor against state of charge (gentle slope, then a knee near empty). */
  private socFactor(): number {
    const s = this.soc;
    if (s >= 0.1) return 0.82 + 0.18 * s;
    return 0.838 * Math.pow(Math.max(0, s) / 0.1, 0.35);
  }
  private computeR(): number {
    const d = 1 - this.soc;
    return this.r0 * (1 + 1.5 * d * d);
  }
  override stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.p, this.m, 1 / this.rEff);
  }
  override stampRhs(b: Float64Array, ctx: Ctx): void {
    // Current pushed out of the positive terminal by the ideal source part.
    stampI(b, this.m, this.p, (this.emfEff / this.rEff) * ctx.sourceScale);
  }
  private outCurrent(x: Float64Array): number {
    const v = volt(x, this.p) - volt(x, this.m);
    return (this.emfEff - v) / this.rEff;
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const h = ctx.h;
    const v = volt(x, this.p) - volt(x, this.m);
    const i = (this.emfEff - v) / this.rEff;
    this.iOut = i;
    // Internal losses heat the battery.
    const pint = i * i * this.rEff + i * (this.vp1 + this.vp2);
    this.thermal.update(Math.max(0, pint), h);
    if (this.polarizes) {
      const t1 = this.r0 * 1.5 * i;
      const t2 = this.r0 * 0.6 * i;
      const tau1 = 0.3;
      const tau2 = Math.abs(t2) > Math.abs(this.vp2) ? 5 : 60;
      this.vp1 += (t1 - this.vp1) * (1 - Math.exp(-h / tau1));
      this.vp2 += (t2 - this.vp2) * (1 - Math.exp(-h / tau2));
    }
    if (this.mAh > 0) {
      this.soc = clamp(this.soc - (i * h) / (this.mAh * 3.6), 0, 1);
      const r = this.computeR();
      if (Math.abs(r - this.rEff) > 0.002 * this.rEff) {
        this.rEff = r;
        ctx.markDirty();
      }
    }
    this.emfEff = this.emf * this.socFactor() - this.vp1 - this.vp2;

    // Short-circuit detection: terminal voltage collapsed while delivering current.
    const oc = this.emf * this.socFactor();
    const shorted = i > 0 && v < SHORT_FRACTION * oc && i > (0.1 * oc) / this.r0;
    if (shorted) {
      this.shortTime += h;
      this.clearTime = 0;
      if (!this.shortedFlag && this.shortTime > 0.1) {
        this.shortedFlag = true;
        const what = this.kind === "cell" ? "cell" : "battery";
        ctx.emit(
          this.id,
          "shorted",
          `The ${what} is short-circuited: about ${fmtA(i)} is flowing and its terminal voltage has collapsed to ${fmtV(v)}. Nearly all of its energy is turning into heat inside it, and it drains fast.`,
          { amps: i, volts: v },
        );
      }
    } else {
      this.clearTime += h;
      if (this.clearTime > 1) {
        this.shortTime = 0;
        this.shortedFlag = false;
      }
    }
    // Being pushed backwards (charged) by a bigger source.
    if (i < -0.05 && !this.reversedFlag && this.kind === "battery") {
      this.reversedFlag = true;
      ctx.emit(this.id, "reversed", `Current is being forced backwards into the battery (${fmtA(-i)}). Batteries connected against each other fight, and single-use cells must never be charged.`, { amps: -i });
    } else if (i > 0) this.reversedFlag = false;
  }
  pinCurrents(x: Float64Array): number[] {
    const i = this.outCurrent(x);
    return [-i, i];
  }
  state(x: Float64Array): PartState {
    const v = volt(x, this.p) - volt(x, this.m);
    const i = this.outCurrent(x);
    const pint = Math.max(0, i * i * this.rEff + i * (this.vp1 + this.vp2));
    const T = this.thermal.temp;
    const health: Health = T > 110 ? "smoking" : T > 50 ? "hot" : "ok";
    // Contract: i flows from the first pin (pos) to the second (neg) through the part, so a discharging battery
    // shows a negative i. extra.out is the current delivered from the + terminal.
    const s = baseState(-i, v, pint, T, health);
    s.extra = { out: i, emf: this.emf * this.socFactor() - this.vp1 - this.vp2, soc: this.soc, internalOhms: this.rEff };
    return s;
  }
  override save(): Record<string, unknown> {
    return { soc: this.soc, vp1: this.vp1, vp2: this.vp2, temp: this.thermal.temp, shorted: this.shortedFlag, shortTime: this.shortTime };
  }
  override restore(s: Record<string, unknown>): void {
    this.shortedFlag = s.shorted === true;
    this.shortTime = finiteOr(s.shortTime as number, 0);
    this.soc = clamp(finiteOr(s.soc as number, 1), 0, 1);
    this.vp1 = finiteOr(s.vp1 as number, 0);
    this.vp2 = finiteOr(s.vp2 as number, 0);
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
    this.rEff = this.mAh > 0 ? this.computeR() : this.r0;
    this.emfEff = this.emf * this.socFactor() - this.vp1 - this.vp2;
  }
  override replace(): void {
    this.soc = 1;
    this.vp1 = 0;
    this.vp2 = 0;
    this.thermal.temp = AMBIENT;
    this.rEff = this.r0;
    this.emfEff = this.emf;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Fuse element: a normalised two-node thermal model (element and body). Steady state element temperature equals
// (I/In)^2; it melts at 2.4, so it never opens at its rating, opens in about 2 s at twice its rating and within
// milliseconds at ten times.

const FUSE_MELT = 2.4;
const FUSE_CE = 0.21;
const FUSE_REB = 0.35;
const FUSE_CB = 6.15;
const FUSE_RBA = 0.65;

export class FuseElement {
  te = 0;
  tb = 0;
  blown = false;
  /** Overload episode tracking, for messages. */
  overloadTime = 0;
  peak = 0;
  constructor(public rating: number) {}
  /** Integrates the thermal state; returns true if the fuse melted during this interval. */
  update(i: number, dt: number): boolean {
    if (this.blown) return false;
    const k2 = (i / this.rating) * (i / this.rating);
    if (k2 > 1) {
      this.overloadTime += dt;
      this.peak = Math.max(this.peak, Math.abs(i));
    } else if (this.te < 0.5) {
      this.overloadTime = 0;
      this.peak = 0;
    }
    const nsub = Math.max(1, Math.ceil(dt / 0.005));
    const d = dt / nsub;
    for (let s = 0; s < nsub; s++) {
      const qeb = (this.te - this.tb) / FUSE_REB;
      this.te += ((k2 - qeb) / FUSE_CE) * d;
      this.tb += ((qeb - this.tb / FUSE_RBA) / FUSE_CB) * d;
      if (this.te >= FUSE_MELT) {
        this.blown = true;
        return true;
      }
    }
    return false;
  }
  get tempC(): number {
    return AMBIENT + (Math.max(0, this.te) / FUSE_MELT) * 205;
  }
  reset(): void {
    this.te = 0;
    this.tb = 0;
    this.blown = false;
    this.overloadTime = 0;
    this.peak = 0;
  }
}

export class FuseDevice extends TwoTerminal {
  amps: number;
  R: number;
  el: FuseElement;
  constructor(spec: Spec<"fuse">) {
    super(spec);
    this.amps = Math.max(1e-3, finiteOr(spec.amps, 1));
    // Real fuses are imprecise: each instance melts at a slightly different current, fixed by its id.
    this.el = new FuseElement(this.amps * (1 + 0.08 * spread(spec.id, "fuse")));
    this.R = Math.min(3, 0.12 + 0.1 / this.amps);
  }
  get g(): number {
    return this.el.blown ? G_OPEN : 1 / this.R;
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const i = this.vOf(x) * this.g;
    if (this.el.update(i, ctx.h)) {
      ctx.markDirty();
      ctx.markBreak();
      const peak = Math.max(this.el.peak, Math.abs(i));
      ctx.emit(
        this.id,
        "blown",
        `The ${fmtA(this.amps)} fuse blew after ${fmtS(this.el.overloadTime)} carrying up to ${fmtA(peak)}, ${fmtX(peak / this.amps)} its rating. Its thin wire melted to protect the rest of the circuit.`,
        { amps: peak, rating: this.amps, seconds: this.el.overloadTime },
      );
    }
  }
  state(x: Float64Array): PartState {
    const v = this.vOf(x);
    const i = v * this.g;
    const health: Health = this.el.blown ? "dead" : this.el.te > 0.6 * FUSE_MELT ? "hot" : "ok";
    const s = baseState(i, v, v * i, this.el.tempC, health);
    s.closed = !this.el.blown;
    s.extra = { blown: this.el.blown, rating: this.amps };
    return s;
  }
  override save(): Record<string, unknown> {
    return { te: this.el.te, tb: this.el.tb, blown: this.el.blown };
  }
  override restore(s: Record<string, unknown>): void {
    this.el.te = finiteOr(s.te as number, 0);
    this.el.tb = finiteOr(s.tb as number, 0);
    this.el.blown = s.blown === true;
  }
  override replace(): void {
    this.el.reset();
  }
}
