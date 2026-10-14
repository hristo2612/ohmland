// Base class and shared helpers for device models.
// Node index -1 is the reference node ("gnd"). Matrices are dense, row-major, n x n.

import type { Health, InputKey, InputValue, PartKind, PartSpec, PartState, SimEventType } from "../types";

export type Method = "be" | "tr";

export const AMBIENT = 25;
export const GMIN = 1e-12;
export const R_ON = 0.05;
export const R_OFF = 1e9;
export const G_OPEN = 1e-9;

/** What the engine exposes to devices while stamping and accepting steps. */
export interface Ctx {
  /** Start time of the step being solved, or end time of the step just accepted (in accept()). */
  t: number;
  /** Step size being solved or just accepted. */
  h: number;
  method: Method;
  /** Scales independent sources during source stepping (normally 1). */
  sourceScale: number;
  /** True while a rebuild carries live inputs over: state changes then are not new physical events. */
  restoring: boolean;
  /** Set by devices when they limit a junction voltage during an iteration. */
  noncon: boolean;
  emit(partId: string, type: SimEventType, message: string, data?: Record<string, number | string>): void;
  /** Linear stamps changed (resistance, switch state, mode): rebuild the linear matrix. */
  markDirty(): void;
  /** A discontinuity happened: restart integration with a small backward Euler step. */
  markBreak(): void;
  /**
   * A digital output changed (a logic level switched, a 555 flipped). Softer than markBreak: the engine first takes
   * a nanosecond step so everything wired to the output responds at once (other chips see the new level within
   * their propagation delay, not a microsecond later), then restarts integration at a moderate step, because
   * capacitor voltages and inductor currents are continuous across the edge.
   */
  markEdge(): void;
  addBreakpoint(t: number): void;
  /**
   * The resistance the rest of the circuit presents between two unknowns (-1 for the reference), from the factors of
   * the step just solved: what a part sees "looking out" of two of its pins. Infinity when nothing joins them. Read
   * it in accept() to judge a risk (a reversed LED behind a resistor is safe, straight across a battery it is not).
   */
  drivingOhms?(i: number, j: number): number;
}

export interface Binder {
  /** Index for a netlist node name (after wire merging), -1 for ground. */
  node(name: string): number;
  /** Allocates a private internal node. */
  internal(name: string): number;
  /** Registers a reactive element so the engine can stamp and error-check it. */
  reactive(r: Reactive): void;
  /**
   * Declares that these already bound unknowns couple with each other (an output with its supply pins, an LED
   * with its internal node). A device that declares groups couples only within them; one that declares none
   * couples all of its unknowns. Chips with many pins use this to keep the matrix sparse.
   */
  group(nodes: number[]): void;
}

// ---------------------------------------------------------------------------------------------------------------
// Stamping helpers

export function stampG(A: Float64Array, n: number, i: number, j: number, g: number): void {
  if (i >= 0) {
    A[i * n + i]! += g;
    if (j >= 0) A[i * n + j]! -= g;
  }
  if (j >= 0) {
    A[j * n + j]! += g;
    if (i >= 0) A[j * n + i]! -= g;
  }
}

/** A current I flowing through an element from node i to node j (it leaves i and enters j). */
export function stampI(b: Float64Array, i: number, j: number, I: number): void {
  if (i >= 0) b[i]! -= I;
  if (j >= 0) b[j]! += I;
}

/** Linearised two-terminal nonlinear branch: i(v) ~ i0 + g (v - v0), v = V(i) - V(j). */
export function stampBranch(A: Float64Array, b: Float64Array, n: number, i: number, j: number, i0: number, g: number, v0: number): void {
  stampG(A, n, i, j, g);
  stampI(b, i, j, i0 - g * v0);
}

/** Adds g to matrix entry (row r, column c), skipping ground. */
export function addA(A: Float64Array, n: number, r: number, c: number, g: number): void {
  if (r >= 0 && c >= 0) A[r * n + c]! += g;
}

export function volt(x: Float64Array, i: number): number {
  return i >= 0 ? x[i]! : 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Junction maths

export const VT = 0.025693; // thermal voltage at 25 C

/** SPICE style junction voltage limiting. Returns the limited voltage; sets out.limited when it changed it. */
export function pnjlim(vnew: number, vold: number, vt: number, vcrit: number, out: { limited: boolean }): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else {
      vnew = vt * Math.log(vnew / vt);
    }
    out.limited = true;
  }
  return vnew;
}

export function vcritOf(Is: number, nVt: number): number {
  return nVt * Math.log(nVt / (Math.SQRT2 * Is));
}

const EXP_MAX = 80;
const E_MAX = Math.exp(EXP_MAX);

/** Shockley diode current and conductance with an exponent clamp (linear continuation past e^80). */
export function diodeIG(vd: number, Is: number, nVt: number, out: { i: number; g: number }): void {
  const x = vd / nVt;
  if (x > EXP_MAX) {
    out.i = Is * (E_MAX * (1 + x - EXP_MAX) - 1);
    out.g = (Is * E_MAX) / nVt;
  } else {
    const e = Math.exp(x);
    out.i = Is * (e - 1);
    out.g = (Is * e) / nVt;
  }
  out.i += GMIN * vd;
  out.g += GMIN;
}

/**
 * Soft reverse breakdown: zero until the reverse voltage nears bv, then a conductance gbd (smooth knee of width vs).
 * Returns current in the forward direction (negative when conducting in reverse) and its derivative.
 */
export function breakdownIG(vd: number, bv: number, gbd: number, vs: number, out: { i: number; g: number }): void {
  const z = (-vd - bv) / vs;
  let sp: number;
  let sig: number;
  if (z > 30) {
    sp = z;
    sig = 1;
  } else if (z < -30) {
    sp = 0;
    sig = 0;
  } else {
    const e = Math.exp(z);
    sp = Math.log1p(e);
    sig = e / (1 + e);
  }
  out.i = -gbd * vs * sp;
  out.g = gbd * sig;
}

// ---------------------------------------------------------------------------------------------------------------
// Reactive companions (trapezoidal, or backward Euler right after a discontinuity)

export abstract class Reactive {
  /** History of the state variable at the last accepted points (aligned with the engine's time history). */
  readonly hist = new Float64Array(3);
  /** Absolute and relative tolerance for the local truncation error check. */
  abstract readonly absTol: number;
  relTol = 2e-3;
  /**
   * Stiff elements whose time constant is far below any useful step (a speaker's voice coil inductance) always use
   * backward Euler, which cannot ring, and are left out of the error check.
   */
  alwaysBE = false;
  geq = 0;
  ieq = 0;
  constructor(
    public a: number,
    public b: number,
  ) {}
  /** Computes geq for the step (linear part). */
  abstract prepare(h: number, method: Method): void;
  /** Computes ieq for the step (right-hand side). */
  abstract history(h: number, method: Method): void;
  /** State variable (capacitor voltage or inductor current) for the solution x. */
  abstract stateOf(x: Float64Array): number;
  abstract accept(x: Float64Array): void;
  abstract get state(): number;
  stampLinear(A: Float64Array, n: number): void {
    if (this.geq !== 0) stampG(A, n, this.a, this.b, this.geq);
  }
  stampRhs(b: Float64Array): void {
    if (this.ieq !== 0) stampI(b, this.a, this.b, this.ieq);
  }
}

/**
 * Capacitor companion, optionally with a series resistance (ESR) folded in: the branch is C in series with esr, so
 * no extra node is needed. The state variable is the voltage on C itself.
 */
export class CapCompanion extends Reactive {
  readonly absTol = 1e-3;
  /** Capacitor voltage and current (a to b) at the last accepted point. */
  v = 0;
  i = 0;
  /** Companion of C alone (the branch values geq and ieq include the ESR). */
  private gc = 0;
  constructor(
    a: number,
    b: number,
    public C: number,
    public esr = 0,
  ) {
    super(a, b);
  }
  prepare(h: number, method: Method): void {
    if (this.alwaysBE) method = "be";
    this.gc = this.C <= 0 ? 0 : method === "be" ? this.C / h : (2 * this.C) / h;
    this.geq = this.gc / (1 + this.esr * this.gc);
  }
  history(_h: number, method: Method): void {
    if (this.alwaysBE) method = "be";
    if (this.C <= 0) {
      this.ieq = 0;
      return;
    }
    const ic = method === "be" ? -this.gc * this.v : -this.gc * this.v - this.i;
    this.ieq = ic / (1 + this.esr * this.gc);
  }
  /** Branch current (a to b) for a solution. */
  currentFor(x: Float64Array): number {
    return this.geq * (volt(x, this.a) - volt(x, this.b)) + this.ieq;
  }
  stateOf(x: Float64Array): number {
    const vab = volt(x, this.a) - volt(x, this.b);
    return this.esr > 0 ? vab - this.esr * (this.geq * vab + this.ieq) : vab;
  }
  accept(x: Float64Array): void {
    const vab = volt(x, this.a) - volt(x, this.b);
    this.i = this.C <= 0 ? 0 : this.geq * vab + this.ieq;
    this.v = vab - this.esr * this.i;
  }
  get state(): number {
    return this.v;
  }
}

export class IndCompanion extends Reactive {
  readonly absTol = 1e-6;
  /** Inductor current (a to b) and voltage at the last accepted point. */
  i = 0;
  v = 0;
  constructor(
    a: number,
    b: number,
    public L: number,
  ) {
    super(a, b);
  }
  prepare(h: number, method: Method): void {
    if (this.alwaysBE) method = "be";
    this.geq = method === "be" ? h / this.L : h / (2 * this.L);
  }
  history(_h: number, method: Method): void {
    if (this.alwaysBE) method = "be";
    this.ieq = method === "be" ? this.i : this.i + this.geq * this.v;
  }
  stateOf(x: Float64Array): number {
    return this.geq * (volt(x, this.a) - volt(x, this.b)) + this.ieq;
  }
  accept(x: Float64Array): void {
    this.v = volt(x, this.a) - volt(x, this.b);
    this.i = this.geq * this.v + this.ieq;
  }
  get state(): number {
    return this.i;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// First-order thermal model, exact for piecewise constant power.

export class Thermal {
  temp = AMBIENT;
  constructor(
    public rth: number,
    public tau: number,
  ) {}
  update(p: number, dt: number): void {
    const target = AMBIENT + p * this.rth;
    this.temp = target + (this.temp - target) * Math.exp(-dt / this.tau);
  }
}

// ---------------------------------------------------------------------------------------------------------------

export type PinCurrents = number[];

export abstract class Device {
  readonly id: string;
  readonly kind: PartKind;
  spec: PartSpec;
  /** Original netlist node names, in the contract's pin order. */
  readonly pinNames: string[];
  readonly pinKeys: string[];
  nonlinear = false;
  /** Needs beginStep() calls (timers, scheduled contact moves). */
  timed = false;
  /** Needs accept() calls (thermal, damage, accumulators). */
  accepts = true;

  constructor(spec: PartSpec) {
    this.id = spec.id;
    this.kind = spec.kind;
    this.spec = spec;
    const pins = spec.pins as Record<string, string>;
    this.pinKeys = Object.keys(pins);
    this.pinNames = this.pinKeys.map((k) => {
      const v = pins[k];
      return typeof v === "string" && v.length > 0 ? v : `${spec.id}.${k}~float`;
    });
  }

  pin(key: string): string {
    const i = this.pinKeys.indexOf(key);
    return i >= 0 ? this.pinNames[i]! : `${this.id}.${key}~float`;
  }

  abstract bind(b: Binder): void;
  stampLinear(_A: Float64Array, _n: number, _ctx: Ctx): void {}
  stampRhs(_b: Float64Array, _ctx: Ctx): void {}
  /** Called before each Newton solve with the starting solution, to reset junction limiting memory. */
  initIter(_x: Float64Array): void {}
  stampNonlinear(_A: Float64Array, _b: Float64Array, _n: number, _x: Float64Array, _ctx: Ctx): void {}
  /** Called with the accepted solution at the end of each step (ctx.t is the new time, ctx.h the step). */
  accept(_x: Float64Array, _ctx: Ctx): void {}
  /** Called at the start of each step with the step's start time. */
  beginStep(_ctx: Ctx): void {}
  /**
   * Event location for behavioural parts with thresholds (comparators, logic inputs). Given the accepted solution
   * x0 and a candidate solution x1 at the end of the step, returns the fraction of the step (0..1) at which the
   * first crossing that matters happens (linear interpolation), or Infinity when there is none. The engine then
   * shortens the step to land just past the crossing, so switching times are exact rather than step-quantised.
   */
  crossing(_x0: Float64Array, _x1: Float64Array): number {
    return Infinity;
  }
  /** Currents flowing into the part at each pin (same order as pinNames). */
  abstract pinCurrents(x: Float64Array): PinCurrents;
  abstract state(x: Float64Array): PartState;
  /** Applies a live input. Returns true if the key applies to this part. */
  setInput(_key: InputKey, _value: InputValue, _ctx: Ctx): boolean {
    return false;
  }
  /** Value of an input as currently applied (used to carry live inputs across rebuilds). */
  inputValue(_key: InputKey): InputValue | undefined {
    return undefined;
  }
  /** Persistent physical state, carried across rebuilds for parts whose id survives. */
  save(): Record<string, unknown> {
    return {};
  }
  restore(_s: Record<string, unknown>): void {}
  /** Fresh part with the same id: clears damage and history. */
  replace(_ctx: Ctx): void {}
  /** Sum of reactive states for audio or diagnostics; optional. */
  get audioVolts(): number {
    return 0;
  }
}

export function baseState(i: number, v: number, p: number, temp = AMBIENT, health: Health = "ok"): PartState {
  return { i, v, p, temp, health };
}

export function num(v: InputValue | undefined, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  return fallback;
}

export function bool(v: InputValue | undefined, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "true" || v === "1" || v === "on" || v === "closed" || v === "pressed";
  return fallback;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function finiteOr(x: number | undefined, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}
