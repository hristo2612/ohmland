// Parts with energy storage: capacitors, relays (coil as R + L, contacts as a timed state machine) and speakers.

import type { Health, PartSpec, PartState } from "../types";
import {
  AMBIENT,
  CapCompanion,
  Device,
  G_OPEN,
  IndCompanion,
  Thermal,
  baseState,
  breakdownIG,
  clamp,
  finiteOr,
  stampBranch,
  stampG,
  volt,
  type Binder,
  type Ctx,
} from "../engine/device";
import { RESISTOR_HOT_C, RESISTOR_SMOKE_C } from "./basic";
import { Contact, ContactDevice } from "./contacts";
import { spread } from "../util/rng";
import { fmtF, fmtV, fmtW, fmtX } from "../util/format";

type Spec<K extends PartSpec["kind"]> = Extract<PartSpec, { kind: K }>;

const o = { i: 0, g: 0 };

// ---------------------------------------------------------------------------------------------------------------
// Capacitor. Polarised (electrolytic) parts conduct when reversed beyond about 1 V and wear out; any part with a
// voltage rating wears out above 1.2 x its rating.

const REV_KNEE = 1.0;
const REV_G = 1 / 2000;
const REV_VS = 0.15;

export class CapacitorDevice extends Device {
  a = -1;
  b = -1;
  C: number;
  comp!: CapCompanion;
  readonly polarized: boolean;
  readonly volts: number;
  leakG: number;
  damage = 0;
  dead = false;
  private reversedSent = false;
  private damagedSent = false;
  private reverseTime = 0;
  private savedV = 0;

  constructor(spec: Spec<"capacitor">) {
    super(spec);
    this.C = Math.max(0, finiteOr(spec.farads, 1e-6));
    this.polarized = spec.polarized === true;
    this.volts = Math.max(0, finiteOr(spec.volts, 0));
    const leak = finiteOr(spec.leakOhms, this.polarized ? 5e6 : 0);
    this.leakG = leak > 0 ? 1 / leak : 0;
    this.nonlinear = this.polarized;
  }
  bind(bd: Binder): void {
    this.a = bd.node(this.pin("pos"));
    this.b = bd.node(this.pin("neg"));
    this.comp = new CapCompanion(this.a, this.b, this.dead ? 0 : this.C);
    this.comp.v = this.savedV;
    bd.reactive(this.comp);
  }
  override stampLinear(A: Float64Array, n: number): void {
    if (this.leakG > 0 && !this.dead) stampG(A, n, this.a, this.b, this.leakG);
  }
  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array): void {
    if (this.dead) return;
    const v = volt(x, this.a) - volt(x, this.b);
    breakdownIG(v, REV_KNEE, REV_G, REV_VS, o);
    stampBranch(A, b, n, this.a, this.b, o.i, o.g, v);
  }
  private extraCurrent(v: number): number {
    if (this.dead) return 0;
    let i = v * this.leakG;
    if (this.polarized) {
      breakdownIG(v, REV_KNEE, REV_G, REV_VS, o);
      i += o.i;
    }
    return i;
  }
  totalCurrent(x: Float64Array): number {
    const v = this.comp.stateOf(x);
    return this.comp.currentFor(x) + this.extraCurrent(v);
  }
  pinCurrents(x: Float64Array): number[] {
    const i = this.totalCurrent(x);
    return [i, -i];
  }
  override accept(_x: Float64Array, ctx: Ctx): void {
    if (this.dead) return;
    const v = this.comp.v;
    const h = ctx.h;
    let rate = 0;
    if (this.polarized && v < -REV_KNEE) {
      const irev = -this.extraCurrent(v);
      rate += 0.02 * (-v - REV_KNEE) + 50 * Math.max(0, -v * irev);
      this.reverseTime += h;
      if (!this.reversedSent && this.reverseTime > 0.02) {
        this.reversedSent = true;
        ctx.emit(this.id, "reversed", `This electrolytic capacitor is in backwards (${fmtV(-v)} reversed). Current leaks through it and it heats up. Turn it round: the stripe marks the negative lead.`, { volts: -v });
      }
    } else if (v > 0) this.reverseTime = 0;
    if (this.volts > 0 && Math.abs(v) > 1.2 * this.volts) {
      rate += (Math.abs(v) / this.volts - 1.2) * 2;
    }
    if (rate <= 0) return;
    this.damage += rate * h;
    if (this.damage >= 1) {
      this.dead = true;
      this.comp.C = 0;
      ctx.markDirty();
      ctx.markBreak();
      const why =
        this.polarized && v < -REV_KNEE
          ? `It was connected backwards (${fmtV(-v)} reversed). Electrolytics must have their + lead on the more positive side.`
          : `It saw ${fmtV(Math.abs(v))}, ${fmtX(Math.abs(v) / this.volts)} its ${fmtV(this.volts)} rating.`;
      ctx.emit(this.id, "died", `The ${fmtF(this.C)} capacitor vented and failed. ${why}`, { volts: v });
    } else if (this.damage > 0.1 && !this.damagedSent) {
      this.damagedSent = true;
      const why = this.polarized && v < -REV_KNEE ? "it is reversed" : `it is over its ${fmtV(this.volts)} rating`;
      ctx.emit(this.id, "damaged", `The capacitor is bulging and getting damaged because ${why}.`, { volts: v });
    }
  }
  state(x: Float64Array): PartState {
    const v = this.comp.stateOf(x);
    const i = this.totalCurrent(x);
    const pLoss = v * this.extraCurrent(v);
    const health: Health = this.dead ? "dead" : this.damage > 0.5 ? "smoking" : this.damage > 0.1 ? "hot" : "ok";
    const s = baseState(i, v, Math.max(0, pLoss), AMBIENT, health);
    s.extra = { charge: this.C * v, energy: 0.5 * this.C * v * v, damage: this.damage };
    return s;
  }
  override save(): Record<string, unknown> {
    return { v: this.comp ? this.comp.v : this.savedV, damage: this.damage, dead: this.dead };
  }
  override restore(s: Record<string, unknown>): void {
    this.savedV = finiteOr(s.v as number, 0);
    if (this.comp) this.comp.v = this.savedV;
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.damagedSent = this.damage > 0.1;
    if (this.dead && this.comp) this.comp.C = 0;
  }
  override replace(): void {
    this.damage = 0;
    this.dead = false;
    this.damagedSent = false;
    this.reversedSent = false;
    this.comp.C = this.C;
    this.comp.v = 0;
    this.comp.i = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Relay. Coil: coilA -[R]- mid -[L || Rp]- coilB, where Rp (core loss) bounds the inductive kickback when nothing
// else does (well above the 300 V at which an opening contact arcs, so an unprotected coil sparks).
// The armature responds to the magnetising current: its "coil voltage" is |I_L| x coilOhms, which equals the
// terminal voltage in steady state. Contacts move operateMs after it rises past pullIn and releaseMs after it falls
// below dropOut. After each move the armature needs a short settle time (it bounces on its stop) before it can move
// again, which sets the buzz rate of a relay that switches its own coil. Each relay's real thresholds are spread
// a little (tolerance, seeded by id); its contacts spark and wear like any switch's.

const SETTLE = 0.002;

export class RelayDevice extends ContactDevice {
  ca = -1;
  cb = -1;
  mid = -1;
  readonly Rc: number;
  readonly L: number;
  readonly Rp: number;
  readonly pullIn: number;
  readonly dropOut: number;
  readonly operate: number;
  readonly release: number;
  ind!: IndCompanion;
  /** 0 = relaxed (COM-NC closed), 1 = energised (COM-NO closed). */
  pos: 0 | 1 = 0;
  moving: -1 | 0 | 1 = 0;
  moveAt = 0;
  /** When the pending move started (threshold crossing), for the armature animation. */
  moveFrom = 0;
  settledAt = -1;
  clicks = 0;
  /** Contact sets: [NO, NC] for COM, and for COM2 when the relay has a second pole. */
  readonly poles: [Contact, Contact][];
  protected readonly noun = "relay";
  private veqPrev = 0;
  private savedI = 0;
  private tNow = 0;

  constructor(spec: Spec<"relay">, seed?: string) {
    super(spec);
    this.Rc = Math.max(1, finiteOr(spec.coilOhms, 540));
    this.L = Math.max(1e-6, finiteOr(spec.coilHenries, 0.1));
    this.Rp = Math.min(2e5, Math.max(5e3, 100 * this.Rc));
    const tol = clamp(finiteOr(spec.tolerance, 0.05), 0, 0.3);
    this.pullIn = Math.max(0.01, finiteOr(spec.pullIn, 6.75)) * (1 + tol * spread(spec.id, "relay-pull-in", seed));
    const drop = Math.max(0, finiteOr(spec.dropOut, 0.9)) * (1 + tol * spread(spec.id, "relay-drop-out", seed));
    this.dropOut = Math.min(this.pullIn * 0.98, drop);
    this.operate = Math.max(0, finiteOr(spec.operateMs, 5)) / 1000;
    this.release = Math.max(0, finiteOr(spec.releaseMs, 3)) / 1000;
    this.timed = true;
    const pins = spec.pins as Record<string, unknown>;
    const second = typeof pins.com2 === "string" && pins.com2 !== "";
    this.poles = [[new Contact(false), new Contact(true)]];
    if (second) this.poles.push([new Contact(false), new Contact(true)]);
    this.contacts = this.poles.flat();
  }
  bind(b: Binder): void {
    this.ca = b.node(this.pin("coilA"));
    this.cb = b.node(this.pin("coilB"));
    this.poles.forEach(([no, nc], k) => {
      const sfx = k === 0 ? "" : "2";
      const com = b.node(this.pin(`com${sfx}`));
      no.p = com;
      nc.p = com;
      no.q = b.node(this.pin(`no${sfx}`));
      nc.q = b.node(this.pin(`nc${sfx}`));
    });
    this.mid = b.internal(`${this.id}#coil`);
    this.ind = new IndCompanion(this.mid, this.cb, this.L);
    this.ind.i = this.savedI;
    b.reactive(this.ind);
  }
  override stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.ca, this.mid, 1 / this.Rc);
    stampG(A, n, this.mid, this.cb, 1 / this.Rp);
    super.stampLinear(A, n);
  }
  private setContacts(t: number, quiet: boolean): void {
    for (const [no, nc] of this.poles) {
      no.set(this.pos === 1, t, quiet);
      nc.set(this.pos === 0, t, quiet);
    }
  }
  override beginStep(ctx: Ctx): void {
    this.tNow = ctx.t;
    if (this.moving === 0) return;
    if (ctx.t >= this.moveAt - 1e-12) {
      this.pos = this.moving > 0 ? 1 : 0;
      this.moving = 0;
      this.settledAt = ctx.t;
      this.clicks++;
      this.setContacts(ctx.t, false);
      ctx.markDirty();
      ctx.markBreak();
      const to = this.pos === 1 ? "no" : "nc";
      const msg = this.dead
        ? "Click: the armature moved, but the relay's worn contacts no longer connect."
        : this.pos === 1
          ? "Click: the relay pulled in, so COM now connects to NO."
          : "Click: the relay released, so COM is back on NC.";
      ctx.emit(this.id, "clicked", msg, { contact: to, to });
    } else ctx.addBreakpoint(this.moveAt);
  }
  private crossTime(ctx: Ctx, v0: number, v1: number, level: number): number {
    const t1 = ctx.t;
    const t0 = t1 - ctx.h;
    if (v1 === v0) return t1;
    const f = (level - v0) / (v1 - v0);
    return f >= 0 && f <= 1 ? t0 + f * (t1 - t0) : t1;
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    this.tNow = ctx.t;
    const veq = Math.abs(this.ind.i) * this.Rc;
    if (this.moving === 0) {
      if (this.pos === 0 && veq >= this.pullIn) {
        const tc = this.crossTime(ctx, this.veqPrev, veq, this.pullIn);
        this.moving = 1;
        this.moveFrom = Math.max(tc, this.settledAt + SETTLE);
        this.moveAt = this.moveFrom + this.operate;
        ctx.addBreakpoint(this.moveAt);
      } else if (this.pos === 1 && veq <= this.dropOut) {
        const tc = this.crossTime(ctx, this.veqPrev, veq, this.dropOut);
        this.moving = -1;
        this.moveFrom = Math.max(tc, this.settledAt + SETTLE);
        this.moveAt = this.moveFrom + this.release;
        ctx.addBreakpoint(this.moveAt);
      }
    } else if (this.moving === 1 && veq < this.dropOut) this.moving = 0;
    else if (this.moving === -1 && veq > this.pullIn) this.moving = 0;
    this.veqPrev = veq;
    super.accept(x, ctx);
  }
  /** Armature position 0 (relaxed) to 1 (pulled in), moving linearly over the operate or release time. */
  get armature(): number {
    if (this.moving === 0) return this.pos;
    const span = this.moveAt - this.moveFrom;
    const f = span > 0 ? clamp((this.tNow - this.moveFrom) / span, 0, 1) : 1;
    return this.moving > 0 ? f : 1 - f;
  }
  private coilCurrent(x: Float64Array): number {
    return (volt(x, this.ca) - volt(x, this.mid)) / this.Rc;
  }
  pinCurrents(x: Float64Array): number[] {
    const ic = this.coilCurrent(x);
    const byName = new Map<string, number>([
      ["coilA", ic],
      ["coilB", -ic],
    ]);
    this.poles.forEach(([no, nc], k) => {
      const sfx = k === 0 ? "" : "2";
      const ino = no.current(x);
      const inc = nc.current(x);
      byName.set(`com${sfx}`, ino + inc);
      byName.set(`no${sfx}`, -ino);
      byName.set(`nc${sfx}`, -inc);
    });
    return this.pinKeys.map((k) => byName.get(k) ?? 0);
  }
  state(x: Float64Array): PartState {
    const ic = this.coilCurrent(x);
    const v = volt(x, this.ca) - volt(x, this.cb);
    const vRp = volt(x, this.mid) - volt(x, this.cb);
    const p = ic * ic * this.Rc + (vRp * vRp) / this.Rp;
    const s = baseState(ic, v, p, AMBIENT, this.health());
    const [no, nc] = this.poles[0]!;
    s.closed = this.pos === 1 && !this.dead;
    s.extra = {
      contact: this.pos === 1 ? "no" : "nc",
      moving: this.moving !== 0,
      clicks: this.clicks,
      coilVolts: Math.abs(this.ind.i) * this.Rc,
      contactAmps: no.current(x) + nc.current(x),
      armature: this.armature,
      pullIn: this.pullIn,
      dropOut: this.dropOut,
      ...this.contactState(),
    };
    return s;
  }
  override save(): Record<string, unknown> {
    return {
      ...super.save(),
      pos: this.pos,
      moving: this.moving,
      moveAt: this.moveAt,
      moveFrom: this.moveFrom,
      settledAt: this.settledAt,
      clicks: this.clicks,
      iL: this.ind ? this.ind.i : this.savedI,
    };
  }
  override restore(s: Record<string, unknown>): void {
    super.restore(s);
    this.pos = s.pos === 1 ? 1 : 0;
    this.moving = s.moving === 1 ? 1 : s.moving === -1 ? -1 : 0;
    this.moveAt = finiteOr(s.moveAt as number, 0);
    this.moveFrom = finiteOr(s.moveFrom as number, this.moveAt);
    this.settledAt = finiteOr(s.settledAt as number, -1);
    this.clicks = finiteOr(s.clicks as number, 0);
    this.savedI = finiteOr(s.iL as number, 0);
    if (this.ind) this.ind.i = this.savedI;
    this.setContacts(0, true);
  }
  override replace(): void {
    super.replace();
    this.pos = 0;
    this.moving = 0;
    this.clicks = 0;
    this.setContacts(0, true);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Speaker: voice coil resistance plus a small inductance, with a voice coil thermal model.

export class SpeakerDevice extends Device {
  a = -1;
  b = -1;
  mid = -1;
  readonly R: number;
  readonly L: number;
  readonly watts: number;
  ind!: IndCompanion;
  thermal: Thermal;
  damage = 0;
  dead = false;
  private vLast = 0;
  private smoked = false;
  private savedI = 0;

  constructor(spec: Spec<"speaker">) {
    super(spec);
    this.R = Math.max(0.5, finiteOr(spec.ohms, 8));
    this.L = Math.max(1e-7, finiteOr(spec.henries, 5e-5));
    this.watts = Math.max(0.05, finiteOr(spec.watts, 0.5));
    this.thermal = new Thermal(62.5 / this.watts, 3);
  }
  bind(b: Binder): void {
    this.a = b.node(this.pin("a"));
    this.b = b.node(this.pin("b"));
    this.mid = b.internal(`${this.id}#coil`);
    this.ind = new IndCompanion(this.mid, this.b, this.L);
    this.ind.i = this.savedI;
    // L/R is well under a microsecond: treat it as stiff.
    this.ind.alwaysBE = true;
    b.reactive(this.ind);
  }
  override stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.a, this.mid, this.dead ? G_OPEN : 1 / this.R);
  }
  private current(x: Float64Array): number {
    return (volt(x, this.a) - volt(x, this.mid)) * (this.dead ? G_OPEN : 1 / this.R);
  }
  pinCurrents(x: Float64Array): number[] {
    const i = this.current(x);
    return [i, -i];
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    this.vLast = volt(x, this.a) - volt(x, this.b);
    const i = this.current(x);
    const p = i * i * this.R;
    this.thermal.update(p, ctx.h);
    if (this.dead) return;
    const T = this.thermal.temp;
    if (T > RESISTOR_SMOKE_C && !this.smoked) {
      this.smoked = true;
      ctx.emit(this.id, "smoke", `The speaker's voice coil is overheating: it is taking ${fmtW(p)}, ${fmtX(p / this.watts)} its ${fmtW(this.watts)} rating. Put a resistor (about 100 Ω) in series to limit the current.`, { watts: p });
    }
    if (T > 350) {
      this.damage += ((T - 350) / 300) * ctx.h;
      if (this.damage >= 1) {
        this.dead = true;
        ctx.markDirty();
        ctx.markBreak();
        ctx.emit(this.id, "died", "The speaker's voice coil burned open. Small speakers need a series resistor when driven from a battery.", { watts: p });
      }
    }
  }
  override get audioVolts(): number {
    return this.vLast;
  }
  state(x: Float64Array): PartState {
    const i = this.current(x);
    const v = volt(x, this.a) - volt(x, this.b);
    const T = this.thermal.temp;
    const health: Health = this.dead ? "dead" : T > RESISTOR_SMOKE_C ? "smoking" : T > RESISTOR_HOT_C ? "hot" : "ok";
    return baseState(i, v, i * i * this.R, T, health);
  }
  override save(): Record<string, unknown> {
    return { temp: this.thermal.temp, damage: this.damage, dead: this.dead, iL: this.ind ? this.ind.i : this.savedI };
  }
  override restore(s: Record<string, unknown>): void {
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.savedI = finiteOr(s.iL as number, 0);
    if (this.ind) this.ind.i = this.savedI;
  }
  override replace(): void {
    this.thermal.temp = AMBIENT;
    this.damage = 0;
    this.dead = false;
    this.smoked = false;
  }
}
