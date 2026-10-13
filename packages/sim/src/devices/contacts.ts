// Mechanical contacts: switches, pushbuttons, SPDT and DPDT switches, and the base for relay contacts.
//
// A closed contact is 0.05 Ω, an open one 1 GΩ. An open gap breaks down (arcs) above about 300 V: interrupting a
// coil's current without a protection diode makes the coil kick back until the gap conducts, which clamps the
// spike and raises a `spark` event. Contacts wear: a little for each make or break that carries current (more for
// big surges, as when an empty capacitor is switched in) and more for each spark. A part whose wear reaches 1 dies
// with its contacts stuck open (`died`, data.cause "worn").

import type { Health, InputKey, InputValue, PartSpec, PartState } from "../types";
import { Device, R_OFF, R_ON, baseState, bool, breakdownIG, finiteOr, stampBranch, stampG, volt, type Binder, type Ctx } from "../engine/device";
import { fmtV } from "../util/format";
import { seededRandom } from "../util/rng";

type Spec<K extends PartSpec["kind"]> = Extract<PartSpec, { kind: K }>;

/** Gap breakdown voltage, slope of the arc beyond it and the width of the knee. */
export const ARC_VOLTS = 300;
const ARC_G = 1 / 50;
const ARC_KNEE = 5;
/** Arc current that counts as a spark. */
const SPARK_AMPS = 1e-3;
/** Wear per make or break carrying current (x (1 + (I / 1 A)^2)), and per spark. */
const WEAR_SWITCHING = 1 / 6000;
const WEAR_SPARK = 1 / 1000;
/** Currents below this switch without wear; a make's surge is the peak over this window after closing. */
const WEAR_MIN_AMPS = 0.01;
const SURGE_WINDOW = 1e-3;

const o1 = { i: 0, g: 0 };
const o2 = { i: 0, g: 0 };

/** Arc current (p to q) and its derivative for a voltage across an open gap: zero until about 300 V either way. */
function arcIG(v: number, out: { i: number; g: number }): void {
  breakdownIG(v, ARC_VOLTS, ARC_G, ARC_KNEE, o1); // conducts for v < -ARC_VOLTS (negative current)
  breakdownIG(-v, ARC_VOLTS, ARC_G, ARC_KNEE, o2); // conducts for v > ARC_VOLTS
  out.i = o1.i - o2.i;
  out.g = o1.g + o2.g;
}

const arc = { i: 0, g: 0 };

/** One pair of contacts between nodes p and q. */
export class Contact {
  p = -1;
  q = -1;
  closed: boolean;
  /** Set by the owner when its contacts are worn out: stuck open. */
  stuck = false;
  wear = 0;
  sparks = 0;
  private arcing = false;
  private makeAt = -1;
  private surge = 0;
  private lastAmps = 0;

  constructor(closed: boolean) {
    this.closed = closed;
  }
  get g(): number {
    return this.closed && !this.stuck ? 1 / R_ON : 1 / R_OFF;
  }
  stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.p, this.q, this.g);
  }
  /** The arc across an open gap (nonlinear, does nothing below a few hundred volts). */
  stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array): void {
    if (this.closed && !this.stuck) return;
    const v = volt(x, this.p) - volt(x, this.q);
    if (v < ARC_VOLTS - 12 * ARC_KNEE && v > -(ARC_VOLTS - 12 * ARC_KNEE)) return;
    arcIG(v, arc);
    stampBranch(A, b, n, this.p, this.q, arc.i, arc.g, v);
  }
  /** Current from p to q (through the closed contact, or through an arc). */
  current(x: Float64Array): number {
    const v = volt(x, this.p) - volt(x, this.q);
    let i = v * this.g;
    if ((!this.closed || this.stuck) && (v > ARC_VOLTS - 12 * ARC_KNEE || v < 12 * ARC_KNEE - ARC_VOLTS)) {
      arcIG(v, arc);
      i += arc.i;
    }
    return i;
  }
  /** Opens or closes the contact at time t, booking the wear of breaking a current (not when quiet). */
  set(closed: boolean, t: number, quiet = false): void {
    if (closed === this.closed) return;
    if (quiet) {
      this.closed = closed;
      return;
    }
    if (this.makeAt >= 0) this.bookMake();
    this.closed = closed;
    if (closed) {
      this.makeAt = t;
      this.surge = 0;
    } else {
      if (this.lastAmps > WEAR_MIN_AMPS) this.wear += WEAR_SWITCHING * (1 + this.lastAmps * this.lastAmps);
      this.lastAmps = 0;
    }
  }
  private bookMake(): void {
    if (this.surge > WEAR_MIN_AMPS) this.wear += WEAR_SWITCHING * (1 + this.surge * this.surge);
    this.makeAt = -1;
  }
  /** Bookkeeping after an accepted step. Returns the arc voltage when a new spark started, else 0. */
  accept(x: Float64Array, t: number): number {
    const i = Math.abs(this.current(x));
    if (this.closed && !this.stuck) {
      this.lastAmps = i;
      if (this.makeAt >= 0) {
        if (i > this.surge) this.surge = i;
        if (t - this.makeAt >= SURGE_WINDOW) this.bookMake();
      }
      this.arcing = false;
      return 0;
    }
    const v = Math.abs(volt(x, this.p) - volt(x, this.q));
    if (i > SPARK_AMPS) {
      if (!this.arcing) {
        this.arcing = true;
        this.sparks++;
        this.wear += WEAR_SPARK;
        return Math.max(v, ARC_VOLTS);
      }
    } else if (i < SPARK_AMPS / 10) {
      this.arcing = false;
    }
    return 0;
  }
  reset(): void {
    this.wear = 0;
    this.sparks = 0;
    this.stuck = false;
    this.arcing = false;
    this.makeAt = -1;
    this.lastAmps = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Contact bounce. A closing contact hits, springs back open and hits again, each rebound shorter, for a few
// milliseconds; an opening one rebounds a little too. Chatter is a seeded schedule of contact flips, so every
// press differs but a run repeats exactly.

/** Default chatter: 1 to 5 ms per make. */
const BOUNCE_MIN_MS = 1;
const BOUNCE_MAX_MS = 5;
/** A changeover pole travels this long (0.5 to 2 ms) between its throws before it hits the new one. */
const TRAVEL_MIN = 0.5e-3;
const TRAVEL_MAX = 2e-3;

/** Longest chatter in ms for a `bounce` value: 0 means off. */
export function bounceMs(v: InputValue | undefined): number {
  if (v === true || v === "true" || v === "on") return BOUNCE_MAX_MS;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.min(50, v);
  if (typeof v === "string" && Number(v) > 0) return Math.min(50, Number(v));
  return 0;
}

/**
 * Times (seconds after the first touch or separation) at which the contact flips back and forth before it settles
 * in its new state. Dwell in the new state grows and the rebounds shrink. An even count: it ends in the new state.
 */
export function chatterOffsets(rnd: () => number, maxMs: number, make: boolean): number[] {
  const minMs = maxMs >= BOUNCE_MAX_MS ? BOUNCE_MIN_MS : 0.4 * maxMs;
  let span = (minMs + (maxMs - minMs) * rnd()) / 1000;
  const k = make ? 3 + Math.floor(rnd() * 6) : 1 + Math.floor(rnd() * 3);
  if (!make) span *= 0.4;
  const w: number[] = [];
  for (let j = 1; j <= k; j++) {
    w.push(j * (0.5 + rnd())); // settled in the new state
    w.push((k - j + 1) * 0.6 * (0.5 + rnd())); // rebounded
  }
  const sum = w.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let acc = 0;
  for (const x of w) {
    acc += (x / sum) * span;
    out.push(acc);
  }
  return out;
}

type Flip = { t: number; c: Contact; closed: boolean; loud?: boolean };

/** A part made of contacts on one actuator. Subclasses create `contacts` and bind their nodes. */
export abstract class ContactDevice extends Device {
  contacts: Contact[] = [];
  dead = false;
  /** Friendly name for messages ("switch", "button", "relay"). */
  protected abstract readonly noun: string;
  /** Longest chatter in ms, 0 for clean contacts. */
  bounce = 0;
  /** Scheduled contact flips (bounce), in time order. */
  protected flips: Flip[] = [];
  /** Actuations so far: mixed into the bounce seed so each press chatters differently. */
  private actuations = 0;
  protected readonly seed: string | undefined;

  constructor(spec: PartSpec, seed?: string) {
    super(spec);
    // Open gaps can arc, which is nonlinear; below a few hundred volts the stamp is skipped.
    this.nonlinear = true;
    this.seed = seed;
  }
  /** Random numbers for the next actuation's chatter. */
  protected bounceRandom(): () => number {
    return seededRandom(`bounce:${this.seed ?? ""}:${this.id}:${this.actuations++}`);
  }
  /** Moves contact c to its new state at t0 and, with bounce on, schedules the chatter that follows. */
  protected actuate(c: Contact, closed: boolean, t0: number, ctx: Ctx, rnd?: () => number): void {
    this.flips = this.flips.filter((f) => f.c !== c);
    if (this.bounce <= 0 || ctx.restoring) {
      c.set(closed, t0, ctx.restoring);
      return;
    }
    const r = rnd ?? this.bounceRandom();
    if (t0 <= ctx.t) c.set(closed, t0, false);
    else this.flips.push({ t: t0, c, closed, loud: true });
    let state = !closed;
    for (const dt of chatterOffsets(r, this.bounce, closed)) {
      this.flips.push({ t: t0 + dt, c, closed: state });
      state = !state;
    }
    this.flips.sort((a, b) => a.t - b.t);
    if (this.flips.length > 0) ctx.addBreakpoint(this.flips[0]!.t);
  }
  override beginStep(ctx: Ctx): void {
    const q = this.flips;
    if (q.length === 0) return;
    let changed = false;
    while (q.length > 0 && q[0]!.t <= ctx.t + 1e-12) {
      const f = q.shift()!;
      // Rebounds are quiet: the switching wear is booked once per actuation, not per rebound.
      f.c.set(f.closed, ctx.t, f.loud !== true);
      changed = true;
    }
    if (changed) {
      ctx.markDirty();
      ctx.markBreak();
    }
    if (q.length > 0) ctx.addBreakpoint(q[0]!.t);
  }
  /** True while contacts are still chattering. */
  get bouncing(): boolean {
    return this.flips.length > 0;
  }
  protected setBounce(value: InputValue): void {
    this.bounce = bounceMs(value);
  }
  get wear(): number {
    let w = 0;
    for (const c of this.contacts) w += c.wear;
    return Math.min(1, w);
  }
  get sparks(): number {
    let s = 0;
    for (const c of this.contacts) s += c.sparks;
    return s;
  }
  override stampLinear(A: Float64Array, n: number, _ctx?: Ctx): void {
    for (const c of this.contacts) c.stampLinear(A, n);
  }
  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array): void {
    for (const c of this.contacts) c.stampNonlinear(A, b, n, x);
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    for (const c of this.contacts) {
      const sparkVolts = c.accept(x, ctx.t);
      if (sparkVolts > 0) {
        ctx.emit(
          this.id,
          "spark",
          `A spark jumped across the ${this.noun}'s contacts as they opened: a coil in the circuit kicked back about ${fmtV(sparkVolts)} to keep its current flowing. A diode across the coil (band toward +) stops it. Every spark wears the contacts a little.`,
          { volts: sparkVolts, sparks: this.sparks, wear: this.wear },
        );
      }
    }
    if (!this.dead && this.wear >= 1) {
      this.dead = true;
      for (const c of this.contacts) c.stuck = true;
      ctx.markDirty();
      ctx.markBreak();
      ctx.emit(
        this.id,
        "died",
        `The ${this.noun}'s contacts are worn out and no longer connect. Sparks and switching surges ate them away. A diode across any coil it switches, and a resistor in series with big capacitors, make contacts last.`,
        { cause: "worn", sparks: this.sparks },
      );
    }
  }
  protected contactState(): Record<string, number | string | boolean> {
    return { wear: this.wear, sparks: this.sparks };
  }
  protected health(): Health {
    return this.dead ? "dead" : "ok";
  }
  override save(): Record<string, unknown> {
    return { wear: this.contacts.map((c) => c.wear), sparks: this.contacts.map((c) => c.sparks), dead: this.dead };
  }
  override restore(s: Record<string, unknown>): void {
    const w = Array.isArray(s.wear) ? (s.wear as number[]) : [];
    const sp = Array.isArray(s.sparks) ? (s.sparks as number[]) : [];
    this.contacts.forEach((c, k) => {
      c.wear = finiteOr(w[k], 0);
      c.sparks = finiteOr(sp[k], 0);
    });
    this.dead = s.dead === true;
    for (const c of this.contacts) c.stuck = this.dead;
  }
  override replace(): void {
    this.dead = false;
    this.flips = [];
    for (const c of this.contacts) c.reset();
  }
}

// ---------------------------------------------------------------------------------------------------------------

/** Switch (input `closed`) or pushbutton (input `pressed`, optionally normally closed). */
export class SwitchDevice extends ContactDevice {
  readonly c: Contact;
  /** Pushbuttons: actuator state. */
  pressed: boolean;
  readonly normallyClosed: boolean;
  protected readonly noun: string;

  constructor(spec: Spec<"switch"> | Spec<"pushbutton">, seed?: string) {
    super(spec, seed);
    this.normallyClosed = spec.kind === "pushbutton" && spec.normallyClosed === true;
    this.pressed = spec.kind === "pushbutton" && spec.pressed === true;
    const closed = spec.kind === "switch" ? spec.closed === true : this.pressed !== this.normallyClosed;
    this.c = new Contact(closed);
    this.contacts = [this.c];
    this.noun = spec.kind === "switch" ? "switch" : "button";
    this.bounce = bounceMs(spec.bounce);
    this.timed = true;
  }
  bind(b: Binder): void {
    this.c.p = b.node(this.pinNames[0]!);
    this.c.q = b.node(this.pinNames[1]!);
  }
  get closed(): boolean {
    return this.c.closed && !this.c.stuck;
  }
  pinCurrents(x: Float64Array): number[] {
    const i = this.c.current(x);
    return [i, -i];
  }
  state(x: Float64Array): PartState {
    const v = volt(x, this.c.p) - volt(x, this.c.q);
    const i = this.c.current(x);
    const s = baseState(i, v, Math.abs(v * i), 25, this.health());
    s.closed = this.closed;
    s.extra = this.contactState();
    if (this.kind === "pushbutton") {
      s.extra.pressed = this.pressed;
      s.extra.normallyClosed = this.normallyClosed;
    }
    if (this.bounce > 0) s.extra.bouncing = this.bouncing;
    return s;
  }
  /** Where the actuator puts the contact (the contact itself may still be chattering). */
  private target(): boolean {
    return this.kind === "pushbutton" ? this.pressed !== this.normallyClosed : this.switchClosed;
  }
  private switchClosed: boolean = this.kind === "switch" && (this.spec as Spec<"switch">).closed === true;
  override setInput(key: InputKey, value: InputValue, ctx: Ctx): boolean {
    if (key === "bounce") {
      this.setBounce(value);
      return true;
    }
    const before = this.target();
    if (this.kind === "pushbutton" && key === "pressed") {
      this.pressed = bool(value, this.pressed);
    } else if (key === "closed") {
      // Pushbuttons accept "closed" too: it sets the contact itself.
      const closed = bool(value, before);
      if (this.kind === "pushbutton") this.pressed = closed !== this.normallyClosed;
      else this.switchClosed = closed;
    } else return false;
    const after = this.target();
    if (after !== before || after !== this.c.closed) this.actuate(this.c, after, ctx.t, ctx);
    return true;
  }
  override inputValue(key: InputKey): InputValue | undefined {
    if (key === "bounce") return this.bounce;
    if (this.kind === "pushbutton") return key === "pressed" ? this.pressed : undefined;
    return key === "closed" ? this.switchClosed : undefined;
  }
}

/** SPDT (com, a, b) and DPDT (com1, a1, b1, com2, a2, b2) switches: input `to` ("a" or "b"). */
export class ThrowDevice extends ContactDevice {
  to: "a" | "b";
  /** Contact pairs per pole: [to a, to b]. */
  readonly poles: [Contact, Contact][];
  protected readonly noun = "switch";

  constructor(spec: Spec<"spdt"> | Spec<"dpdt">, seed?: string) {
    super(spec, seed);
    this.to = spec.to === "b" ? "b" : "a";
    const count = spec.kind === "dpdt" ? 2 : 1;
    this.poles = [];
    for (let k = 0; k < count; k++) this.poles.push([new Contact(this.to === "a"), new Contact(this.to === "b")]);
    this.contacts = this.poles.flat();
    this.bounce = bounceMs(spec.bounce);
    this.timed = true;
  }
  private names(k: number): [string, string, string] {
    return this.kind === "dpdt" ? [`com${k + 1}`, `a${k + 1}`, `b${k + 1}`] : ["com", "a", "b"];
  }
  bind(b: Binder): void {
    this.poles.forEach(([ca, cb], k) => {
      const [com, ta, tb] = this.names(k);
      const nc = b.node(this.pin(com));
      ca.p = nc;
      cb.p = nc;
      ca.q = b.node(this.pin(ta));
      cb.q = b.node(this.pin(tb));
    });
  }
  pinCurrents(x: Float64Array): number[] {
    // Pin order follows the spec's pins object; build by name.
    const byName = new Map<string, number>();
    this.poles.forEach(([ca, cb], k) => {
      const [com, ta, tb] = this.names(k);
      const ia = ca.current(x);
      const ib = cb.current(x);
      byName.set(com, ia + ib);
      byName.set(ta, -ia);
      byName.set(tb, -ib);
    });
    return this.pinKeys.map((k) => byName.get(k) ?? 0);
  }
  state(x: Float64Array): PartState {
    const [ca, cb] = this.poles[0]!;
    const ia = ca.current(x);
    const ib = cb.current(x);
    const sel = this.to === "a" ? ca : cb;
    const v = volt(x, sel.p) - volt(x, sel.q);
    const s = baseState(ia + ib, v, Math.abs(v * (ia + ib)), 25, this.health());
    s.closed = !this.dead;
    s.extra = { to: this.to, ...this.contactState() };
    if (this.bounce > 0) s.extra.bouncing = this.bouncing;
    if (this.poles.length > 1) {
      const [da, db] = this.poles[1]!;
      const sel2 = this.to === "a" ? da : db;
      s.extra.i2 = da.current(x) + db.current(x);
      s.extra.v2 = volt(x, sel2.p) - volt(x, sel2.q);
    }
    return s;
  }
  override setInput(key: InputKey, value: InputValue, ctx: Ctx): boolean {
    if (key === "bounce") {
      this.setBounce(value);
      return true;
    }
    if (key !== "to") return false;
    const to = value === "b" || value === 1 || value === true ? "b" : "a";
    const moved = to !== this.to;
    this.to = to;
    if (this.bounce <= 0 || ctx.restoring || !moved) {
      for (const [ca, cb] of this.poles) {
        ca.set(this.to === "a", ctx.t, ctx.restoring);
        cb.set(this.to === "b", ctx.t, ctx.restoring);
      }
      return true;
    }
    // With bounce: the pole leaves its old throw at once, travels, then hits the new throw and chatters on it.
    // The old throw never recloses, which is why a latch after a changeover switch debounces it.
    const rnd = this.bounceRandom();
    const travel = TRAVEL_MIN + (TRAVEL_MAX - TRAVEL_MIN) * rnd();
    for (const [ca, cb] of this.poles) {
      const [leave, reach] = this.to === "a" ? [cb, ca] : [ca, cb];
      this.flips = this.flips.filter((f) => f.c !== leave);
      leave.set(false, ctx.t, false);
      this.actuate(reach, true, ctx.t + travel, ctx, seededRandom(`${rnd()}`));
    }
    return true;
  }
  override inputValue(key: InputKey): InputValue | undefined {
    if (key === "bounce") return this.bounce;
    return key === "to" ? this.to : undefined;
  }
}
