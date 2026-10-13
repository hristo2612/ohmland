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
import { RESISTOR_HOT_C } from "./basic";
import { Contact, ContactDevice } from "./contacts";
import { spread, toleranced } from "../util/rng";
import { fmtF, fmtOhm, fmtV, fmtW, fmtX } from "../util/format";

type Spec<K extends PartSpec["kind"]> = Extract<PartSpec, { kind: K }>;

const o = { i: 0, g: 0 };

// ---------------------------------------------------------------------------------------------------------------
// Capacitor. Each part's actual value is spread within its tolerance. Electrolytics (polarized) have a small ESR and
// leak a little; reversed beyond about 1 V they conduct, heat and wear out, and any part with a voltage rating
// wears out above 1.2 x its rating. Wear makes the leakage grow, so a meter in series sees the current creep up.

const REV_KNEE = 1.0;
const REV_G = 1 / 2000;
const REV_VS = 0.15;

export class CapacitorDevice extends Device {
  a = -1;
  b = -1;
  C: number;
  readonly nominal: number;
  readonly tolerance: number;
  readonly esr: number;
  comp!: CapCompanion;
  readonly polarized: boolean;
  readonly volts: number;
  leakG: number;
  damage = 0;
  dead = false;
  private cause: "reverse" | "overvoltage" = "reverse";
  private reversedSent = false;
  private damagedSent = false;
  private reverseTime = 0;
  private savedV = 0;
  /** Damage level the leakage stamp was last built for. */
  private leakDamage = 0;

  constructor(spec: Spec<"capacitor">, seed?: string) {
    super(spec);
    this.polarized = spec.polarized === true;
    this.nominal = Math.max(0, finiteOr(spec.farads, 1e-6));
    this.tolerance = clamp(finiteOr(spec.tolerance, this.polarized ? 0.2 : 0.1), 0, 0.5);
    const forced = finiteOr(spec.actualFarads, 0);
    this.C = forced > 0 ? forced : toleranced(this.nominal, this.tolerance, spec.id, "capacitor", seed);
    this.volts = Math.max(0, finiteOr(spec.volts, 0));
    const leak = finiteOr(spec.leakOhms, this.polarized ? 1e6 : 0);
    this.leakG = leak > 0 ? 1 / leak : 0;
    // Electrolytic ESR: about 0.1 Ω for 1000 µF, 0.3 Ω for 100 µF, 1 Ω for 10 µF (at most 2 Ω).
    const esrDefault = this.polarized && this.C > 0 ? clamp(0.1 * Math.sqrt(1e-3 / this.C), 0.1, 2) : 0;
    this.esr = Math.max(0, finiteOr(spec.esrOhms, esrDefault));
    this.nonlinear = this.polarized;
  }
  bind(bd: Binder): void {
    this.a = bd.node(this.pin("pos"));
    this.b = bd.node(this.pin("neg"));
    this.comp = new CapCompanion(this.a, this.b, this.dead ? 0 : this.C, this.esr);
    this.comp.v = this.savedV;
    bd.reactive(this.comp);
  }
  /** Leakage conductance: grows with damage (a damaged ceramic starts to leak too). */
  private get leak(): number {
    const d = this.leakDamage;
    return this.leakG * (1 + 50 * d) + (this.leakG === 0 ? 1e-6 * d : 0);
  }
  override stampLinear(A: Float64Array, n: number): void {
    const g = this.leak;
    if (!this.dead && g > 0) stampG(A, n, this.a, this.b, g);
  }
  private get revG(): number {
    return REV_G * (1 + 4 * this.damage);
  }
  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array): void {
    if (this.dead) return;
    const v = volt(x, this.a) - volt(x, this.b);
    breakdownIG(v, REV_KNEE, this.revG, REV_VS, o);
    stampBranch(A, b, n, this.a, this.b, o.i, o.g, v);
  }
  private extraCurrent(v: number): number {
    if (this.dead) return 0;
    let i = v * this.leak;
    if (this.polarized) {
      breakdownIG(v, REV_KNEE, this.revG, REV_VS, o);
      i += o.i;
    }
    return i;
  }
  totalCurrent(x: Float64Array): number {
    const v = volt(x, this.a) - volt(x, this.b);
    return this.comp.currentFor(x) + this.extraCurrent(v);
  }
  pinCurrents(x: Float64Array): number[] {
    const i = this.totalCurrent(x);
    return [i, -i];
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    if (this.dead) return;
    const v = volt(x, this.a) - volt(x, this.b);
    const h = ctx.h;
    let rate = 0;
    const reversed = this.polarized && v < -REV_KNEE;
    if (reversed) {
      const irev = -this.extraCurrent(v);
      rate += 0.02 * (-v - REV_KNEE) + 50 * Math.max(0, -v * irev);
      this.cause = "reverse";
      this.reverseTime += h;
      if (!this.reversedSent && this.reverseTime > 0.02) {
        this.reversedSent = true;
        ctx.emit(
          this.id,
          "reversed",
          `This electrolytic capacitor is in backwards (${fmtV(-v)} reversed). Current leaks through it and it heats up. Turn it round: the stripe marks the negative lead.`,
          { volts: -v, cause: "reverse" },
        );
      }
    } else if (v > 0) this.reverseTime = 0;
    if (this.volts > 0 && Math.abs(v) > 1.2 * this.volts) {
      rate += (Math.abs(v) / this.volts - 1.2) * 2;
      if (!reversed) this.cause = "overvoltage";
    }
    if (rate <= 0) return;
    this.damage += rate * h;
    // The leakage follows the damage in small jumps, so the matrix is not rebuilt on every step.
    if (this.damage - this.leakDamage > 0.02) {
      this.leakDamage = Math.min(1, this.damage);
      ctx.markDirty();
    }
    if (this.damage >= 1) {
      this.dead = true;
      this.comp.C = 0;
      ctx.markDirty();
      ctx.markBreak();
      const why =
        this.cause === "reverse"
          ? `It was connected backwards (${fmtV(-v)} reversed). Electrolytics must have their + lead on the more positive side.`
          : `It saw ${fmtV(Math.abs(v))}, ${fmtX(Math.abs(v) / this.volts)} its ${fmtV(this.volts)} rating.`;
      ctx.emit(this.id, "died", `The ${fmtF(this.nominal)} capacitor vented and failed. ${why}`, { volts: v, cause: this.cause });
    } else if (this.damage > 0.1 && !this.damagedSent) {
      this.damagedSent = true;
      const why = this.cause === "reverse" ? "it is reversed" : `it is over its ${fmtV(this.volts)} rating`;
      ctx.emit(this.id, "damaged", `The capacitor is bulging and getting damaged because ${why}. Its leakage current is rising.`, {
        volts: v,
        cause: this.cause,
      });
    }
  }
  state(x: Float64Array): PartState {
    const v = volt(x, this.a) - volt(x, this.b);
    const vc = this.comp.stateOf(x);
    const ic = this.comp.currentFor(x);
    const i = ic + this.extraCurrent(v);
    const pLoss = v * this.extraCurrent(v) + this.esr * ic * ic;
    const health: Health = this.dead ? "dead" : this.damage > 0.5 ? "smoking" : this.damage > 0.1 ? "hot" : "ok";
    const s = baseState(i, v, Math.max(0, pLoss), AMBIENT, health);
    s.extra = {
      charge: this.C * vc,
      energy: 0.5 * this.C * vc * vc,
      damage: this.damage,
      actualFarads: this.C,
      nominalFarads: this.nominal,
      tolerance: this.tolerance,
      esr: this.esr,
    };
    return s;
  }
  override save(): Record<string, unknown> {
    return { v: this.comp ? this.comp.v : this.savedV, damage: this.damage, dead: this.dead, cause: this.cause };
  }
  override restore(s: Record<string, unknown>): void {
    this.savedV = finiteOr(s.v as number, 0);
    if (this.comp) this.comp.v = this.savedV;
    this.damage = finiteOr(s.damage as number, 0);
    this.leakDamage = Math.min(1, this.damage);
    this.dead = s.dead === true;
    this.damagedSent = this.damage > 0.1;
    if (s.cause === "overvoltage") this.cause = "overvoltage";
    if (this.dead && this.comp) this.comp.C = 0;
  }
  override replace(): void {
    this.damage = 0;
    this.leakDamage = 0;
    this.dead = false;
    this.damagedSent = false;
    this.reversedSent = false;
    this.cause = "reverse";
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
// Speaker: voice coil resistance plus a small inductance, with a voice coil thermal model. The coil reaches its
// burn temperature when it dissipates its rated `watts` for a while: more than that, sustained, damages it and then
// burns it open. Its sound (the audio stream) is the coil voltage through a first-order acoustic high-pass: a small
// cone in free air loses the bass below about 300 Hz, one in an enclosure goes down to about 100 Hz.

const SPEAKER_BURN_C = 225;
const SPEAKER_SMOKE_C = 250;

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
  /** Acoustic output (volts, high-passed) for the audio stream. */
  private out = 0;
  private vLast = 0;
  private readonly tauAcoustic: number;
  private smoked = false;
  private damagedSent = false;
  private peakW = 0;
  private savedI = 0;

  constructor(spec: Spec<"speaker">) {
    super(spec);
    this.R = Math.max(0.5, finiteOr(spec.ohms, 8));
    this.L = Math.max(1e-7, finiteOr(spec.henries, 5e-5));
    this.watts = Math.max(0.05, finiteOr(spec.watts, 0.5));
    // 200 C/W per rated watt: the rating puts the coil at its 225 C limit.
    this.thermal = new Thermal(200 / this.watts, 3);
    this.tauAcoustic = 1 / (2 * Math.PI * (spec.enclosure === true ? 100 : 300));
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
    const v = volt(x, this.a) - volt(x, this.b);
    // Acoustic high-pass, exact for a input that changes linearly over the step.
    const k = Math.exp(-ctx.h / this.tauAcoustic);
    this.out = this.dead ? 0 : k * this.out + (v - this.vLast) * (this.tauAcoustic / ctx.h) * (1 - k);
    this.vLast = v;
    const i = this.current(x);
    const p = i * i * this.R;
    this.thermal.update(p, ctx.h);
    if (this.dead) return;
    const T = this.thermal.temp;
    if (T > SPEAKER_SMOKE_C && !this.smoked) {
      this.smoked = true;
      ctx.emit(
        this.id,
        "smoke",
        `The speaker's voice coil is overheating: it is taking ${fmtW(p)}, ${fmtX(p / this.watts)} its ${fmtW(this.watts)} rating. Put a resistor (about 100 Ω) in series to limit the current.`,
        { watts: p, rating: this.watts, cause: "overpower" },
      );
    }
    if (T > SPEAKER_BURN_C) {
      this.peakW = Math.max(this.peakW, p);
      const rate = (T - SPEAKER_BURN_C) / 100;
      this.damage += rate * ctx.h;
      if (this.damage >= 1) {
        this.dead = true;
        this.damage = 1;
        ctx.markDirty();
        ctx.markBreak();
        ctx.emit(
          this.id,
          "died",
          `The speaker's voice coil burned open after taking up to ${fmtW(this.peakW)}; it is rated for ${fmtW(this.watts)}. Small speakers need a series resistor when driven from a battery.`,
          { watts: this.peakW, rating: this.watts, cause: "overpower" },
        );
      } else if (this.damage > 0.1 && !this.damagedSent && rate < 5) {
        this.damagedSent = true;
        ctx.emit(this.id, "damaged", `The speaker is being driven past its ${fmtW(this.watts)} rating and its voice coil is cooking. Turn it down with a bigger series resistor.`, {
          watts: p,
          rating: this.watts,
          cause: "overpower",
        });
      }
    }
  }
  override get audioVolts(): number {
    return this.out;
  }
  state(x: Float64Array): PartState {
    const i = this.current(x);
    const v = volt(x, this.a) - volt(x, this.b);
    const T = this.thermal.temp;
    const health: Health = this.dead ? "dead" : T > SPEAKER_SMOKE_C ? "smoking" : T > RESISTOR_HOT_C ? "hot" : "ok";
    const s = baseState(i, v, i * i * this.R, T, health);
    s.extra = { damage: this.damage, watts: this.watts };
    return s;
  }
  override save(): Record<string, unknown> {
    return { temp: this.thermal.temp, damage: this.damage, dead: this.dead, iL: this.ind ? this.ind.i : this.savedI };
  }
  override restore(s: Record<string, unknown>): void {
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.damagedSent = this.damage > 0.1;
    this.savedI = finiteOr(s.iL as number, 0);
    if (this.ind) this.ind.i = this.savedI;
  }
  override replace(): void {
    this.thermal.temp = AMBIENT;
    this.damage = 0;
    this.dead = false;
    this.smoked = false;
    this.damagedSent = false;
    this.peakW = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Inductor (a coil): winding resistance in series with the inductance, plus a large resistance across the
// inductance (core loss and the winding's own capacitance) that bounds the kickback when nothing else carries the
// current: a switch interrupting a coil still arcs near 300 V. The winding heats like a resistor (I² R): its
// thermal model puts it near 200 °C at its rated watts, and sustained overload burns it open.

const COIL_HOT_C = 100;
const COIL_SMOKE_C = 250;
const COIL_BURN_C = 350;

export class InductorDevice extends Device {
  a = -1;
  b = -1;
  mid = -1;
  readonly L: number;
  readonly R: number;
  readonly Rp: number;
  readonly watts: number;
  ind!: IndCompanion;
  thermal: Thermal;
  damage = 0;
  dead = false;
  private smoked = false;
  private savedI = 0;
  private peakW = 0;

  constructor(spec: Spec<"inductor">) {
    super(spec);
    this.L = Math.max(1e-9, finiteOr(spec.henries, 1e-3));
    this.R = Math.max(1e-3, finiteOr(spec.ohms, 1));
    this.watts = Math.max(0.01, finiteOr(spec.watts, 1));
    this.Rp = 1e5;
    // 175 C/W per rated watt above ambient (the rating sits near 200 C), time constant growing with size.
    this.thermal = new Thermal(175 / this.watts, 8 * Math.pow(this.watts, 0.4));
  }
  bind(bd: Binder): void {
    this.a = bd.node(this.pin("a"));
    this.b = bd.node(this.pin("b"));
    this.mid = bd.internal(`${this.id}#L`);
    this.ind = new IndCompanion(this.mid, this.b, this.L);
    this.ind.i = this.dead ? 0 : this.savedI;
    bd.reactive(this.ind);
  }
  override stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.a, this.mid, this.dead ? G_OPEN : 1 / this.R);
    stampG(A, n, this.mid, this.b, 1 / this.Rp);
  }
  private current(x: Float64Array): number {
    return (volt(x, this.a) - volt(x, this.mid)) * (this.dead ? G_OPEN : 1 / this.R);
  }
  pinCurrents(x: Float64Array): number[] {
    const i = this.current(x);
    return [i, -i];
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const i = this.current(x);
    const p = i * i * this.R;
    this.thermal.update(p, ctx.h);
    if (this.dead) return;
    const T = this.thermal.temp;
    if (T > COIL_SMOKE_C && !this.smoked) {
      this.smoked = true;
      ctx.emit(
        this.id,
        "smoke",
        `The coil is smoking: its winding is turning ${fmtW(p)} into heat, ${fmtX(p / this.watts)} what it can shed. Only its ${fmtOhm(this.R)} of wire limits a steady current; inductance does not. Keep contact brief or add resistance.`,
        { watts: p, rating: this.watts, cause: "overpower" },
      );
    }
    if (T > COIL_BURN_C) {
      this.peakW = Math.max(this.peakW, p);
      this.damage += ((T - COIL_BURN_C) / 300) * ctx.h;
      if (this.damage >= 1) {
        this.dead = true;
        this.damage = 1;
        ctx.markDirty();
        ctx.markBreak();
        ctx.emit(
          this.id,
          "died",
          `The coil's winding burned open after taking up to ${fmtW(this.peakW)}. A coil on a battery is nearly a short circuit once its current has built up.`,
          { watts: this.peakW, rating: this.watts, cause: "overpower" },
        );
      }
    }
  }
  state(x: Float64Array): PartState {
    const i = this.current(x);
    const v = volt(x, this.a) - volt(x, this.b);
    const T = this.thermal.temp;
    const health: Health = this.dead ? "dead" : T > COIL_SMOKE_C ? "smoking" : T > COIL_HOT_C ? "hot" : "ok";
    const iL = this.ind.stateOf(x);
    const s = baseState(i, v, i * i * this.R, T, health);
    s.extra = { henries: this.L, ohms: this.R, iL, energy: 0.5 * this.L * iL * iL, damage: this.damage, watts: this.watts };
    return s;
  }
  override save(): Record<string, unknown> {
    return { temp: this.thermal.temp, damage: this.damage, dead: this.dead, smoked: this.smoked, iL: this.ind ? this.ind.i : this.savedI };
  }
  override restore(s: Record<string, unknown>): void {
    this.thermal.temp = finiteOr(s.temp as number, AMBIENT);
    this.damage = finiteOr(s.damage as number, 0);
    this.dead = s.dead === true;
    this.smoked = s.smoked === true;
    this.savedI = this.dead ? 0 : finiteOr(s.iL as number, 0);
    if (this.ind) this.ind.i = this.savedI;
  }
  override replace(): void {
    this.thermal.temp = AMBIENT;
    this.damage = 0;
    this.dead = false;
    this.smoked = false;
    this.peakW = 0;
  }
}
