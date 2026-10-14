// Modified nodal analysis engine: Newton-Raphson for nonlinear parts, trapezoidal integration with backward Euler
// after discontinuities, adaptive steps from a local truncation error estimate, and a breakpoint queue.
//
// Unknowns are node voltages only. Ideal wires merge nodes (union-find), sources are Norton equivalents and inductors
// use Norton companions, so no branch-current rows are needed.

import { DenseLU } from "../solver/dense";
import { SparseLU } from "../solver/sparse";
import type { InputKey, InputValue, Netlist, PartState, SimEvent, SimEventType } from "../types";
import { createDevice } from "../devices";
import { Device, GMIN, type Binder, type Ctx, type Method, type Reactive } from "./device";
import { WireDevice } from "../devices/basic";
import { EdgeWatch } from "./watch";

export type EngineOptions = {
  /** Largest step in seconds. Defaults to 2 ms, or one audio sample period when a speaker is present. */
  maxStep?: number;
};

/** Newton convergence: relative and absolute (volts) tolerance on the update (SPICE defaults). */
/** Conductance tying each isolated circuit to the reference (one node each, so no current flows through it). */
const TIE_G = 1e-3;
const RELTOL = 1e-3;
const VNTOL = 1e-6;
const H_BREAK = 1e-6;
const H_MIN = 1e-12;
/** First step after a digital edge: short enough that every input the edge reaches registers it at once. */
const H_SETTLE = 1e-9;
/** Restart step after a digital edge settled: this share of the smooth step before it, at most H_EDGE_RESTART. */
const EDGE_RESTART_SHARE = 0.05;
const H_EDGE_RESTART = 1e-4;
/** Threshold crossings are located to within this time, or this share of the step that found them if more. */
const EVENT_TOL = 2e-8;
const EVENT_REL = 1e-3;
/** Watchdog: this many accepted steps in a row under H_TINY force coarse steps of H_FORCED for FORCE_SPAN. */
const H_TINY = 1e-8;
const TINY_RUN = 500;
const H_FORCED = 2e-7;
const FORCE_SPAN = 1e-5;
/** Below this step a Newton failure is treated as a fold (a regenerative snap) and solved as a jump at once. */
const H_REDUCE_MIN = 6e-6;
const MAX_ITER = 6;
const TRTOL = 4;
/** Jumps remembered per circuit (an oscillator has two kinds, so this covers several oscillators). */
const JUMP_MEMORY = 8;
/** Unknowns that change by more than this in a jump define it (volts). */
const JUMP_MOVE = 0.3;
/** A remembered jump applies when each of its moved unknowns is within this of where it started (volts, relative). */
const JUMP_MATCH_ABS = 0.03;
const JUMP_MATCH_REL = 0.03;
/** Pseudo-transient continuation: starting stray conductance (S) and how fast it is relaxed. */
const PTC_G0 = 1e-2;
const PTC_RELAX = 8;
export const AUDIO_RATE = 44100;
export const DEFAULT_MAX_STEP = 2e-3;

function overrides(d: Device, name: keyof Device): boolean {
  // True when a subclass provides its own implementation of an optional hook.
  return (d as unknown as Record<string, unknown>)[name] !== (Device.prototype as unknown as Record<string, unknown>)[name];
}

export class Engine implements Ctx {
  // Ctx
  t = 0;
  h = 0;
  method: Method = "be";
  sourceScale = 1;
  noncon = false;
  restoring = false;

  readonly devices: Device[] = [];
  readonly byId = new Map<string, Device>();
  readonly nodeIndex = new Map<string, number>();
  readonly nodeNames: string[] = [];
  /** Internal (private) node name to unknown index. */
  readonly internalIndex = new Map<string, number>();
  readonly reactives: Reactive[] = [];
  readonly wires: WireDevice[] = [];
  n = 0;
  hasSpeaker = false;

  private nonlinearDevs: Device[] = [];
  private rhsDevs: Device[] = [];
  private timedDevs: Device[] = [];
  private acceptDevs: Device[] = [];
  /** Devices with thresholds whose crossings the engine locates in time. */
  private eventDevs: Device[] = [];

  private lu!: SparseLU;
  private nlPos!: Int32Array;
  private Alin!: Float64Array;
  /**
   * One node of every circuit that shares nothing with the reference (a battery lying alone, a second circuit on the
   * same bench). Each is tied to the reference: a single tie carries no current, it only fixes the island's level,
   * which otherwise hangs on gmin alone and can make long time-lapse runs ill-conditioned.
   */
  private ties: number[] = [];
  private bstep!: Float64Array;
  private bwork!: Float64Array;
  /** Last accepted solution. */
  x!: Float64Array;
  private xIter!: Float64Array;
  private xNew!: Float64Array;
  private xBack!: Float64Array;
  /** Accepted solution before x, for the predictor. */
  private xPrev!: Float64Array;
  private hPrev = 0;
  /** True when x and xPrev lie on the same smooth stretch (no discontinuity between them). */
  private canPredict = false;
  /** Set for the current step: start Newton from a linear extrapolation of the last two points. */
  private predict = false;
  /** Recent jumps (solution before and after, and which unknowns moved), first guesses for similar jumps. */
  private readonly jumps: { pre: Float64Array; post: Float64Array; moved: Int32Array; count: number; isMoved: Uint8Array }[] = [];
  private jumpNext = 0;

  private linearDirty = true;
  private linFactored = false;
  private lastH = -1;
  private lastMethod: Method = "be";
  private needBreak = true;
  /** A digital edge happened (soft break, see markEdge). */
  private edgeBreak = false;
  /** Count of markBreak calls, to tell a device's hard break from the engine's own restarts. */
  private breakMarks = 0;
  private hNext = H_BREAK;
  /** Last step size accepted on a smooth stretch (what the error control allows), to restart at after an edge. */
  private hSmooth = H_BREAK;
  hmax = DEFAULT_MAX_STEP;
  /**
   * Time-lapse: the scheduler multiplies the largest step by this when running much faster than real time. The
   * models stay stable at any step (thermal, battery and fuse states are integrated exactly or sub-stepped, relay
   * timers are breakpoints, reactive parts are error-controlled), so this only trades away detail nobody can see.
   */
  stepScale = 1;
  private gshunt = 0;
  /** While true the shunt pulls each node towards xAnchor instead of ground (pseudo-transient continuation). */
  private anchored = false;
  private xAnchor!: Float64Array;
  private lastIters = 0;
  private freshStart = true;
  private cautious = 0;
  /** Step to restart with after a jump (the edge is already resolved to this scale). */
  private hRestart = 0;

  private readonly histT = new Float64Array(3);
  private histCount = 0;
  private breakpoints: number[] = [];

  /** Events raised since the owner last drained them. */
  events: SimEvent[] = [];
  /** Optional hook called after every accepted step (audio sampling, meters). */
  onAccept: ((e: Engine) => void) | null = null;
  /** Watched nodes (Netlist.watch): crossings counted and timed after every accepted step. */
  edgeWatch: EdgeWatch | null = null;

  stats = { steps: 0, iterations: 0, factorizations: 0, rejected: 0, failed: 0, rescued: 0, remembered: 0, located: 0, forced: 0 };
  private tinySteps = 0;
  private forceUntil = -1;

  // -------------------------------------------------------------------------------------------------------------
  // Ctx implementation

  emit(partId: string, type: SimEventType, message: string, data?: Record<string, number | string>): void {
    const ev: SimEvent = { t: this.t, partId, type, message };
    if (data) ev.data = data;
    this.events.push(ev);
  }
  markDirty(): void {
    this.linearDirty = true;
  }
  markBreak(): void {
    this.needBreak = true;
    this.breakMarks++;
  }
  markEdge(): void {
    this.edgeBreak = true;
  }
  drivingOhms(i: number, j: number): number {
    const n = this.n;
    if (n === 0 || i === j || !this.lu) return Infinity;
    // One more solve with the factors in hand: a unit current in at i and out at j, the voltage that results.
    const b = new Float64Array(n);
    const x = new Float64Array(n);
    if (i >= 0) b[i] = 1;
    if (j >= 0) b[j] = -1;
    this.lu.solve(b, x);
    const v = (i >= 0 ? x[i]! : 0) - (j >= 0 ? x[j]! : 0);
    return Number.isFinite(v) && v > 0 ? v : Infinity;
  }
  addBreakpoint(t: number): void {
    if (!(t > this.t + 1e-12) || !Number.isFinite(t)) return;
    const bp = this.breakpoints;
    let i = 0;
    while (i < bp.length && bp[i]! < t) i++;
    if (i < bp.length && Math.abs(bp[i]! - t) < 1e-12) return;
    if (i > 0 && Math.abs(bp[i - 1]! - t) < 1e-12) return;
    bp.splice(i, 0, t);
  }

  // -------------------------------------------------------------------------------------------------------------
  // Building

  static build(netlist: Netlist, prev: Engine | null, opts: EngineOptions = {}): Engine {
    const e = new Engine();
    const seen = new Set<string>();
    const seed = typeof netlist?.seed === "string" && netlist.seed !== "" ? netlist.seed : undefined;
    for (const spec of netlist?.parts ?? []) {
      if (!spec || typeof spec.id !== "string" || seen.has(spec.id)) continue;
      const d = createDevice(spec, seed);
      if (!d) continue;
      seen.add(spec.id);
      e.devices.push(d);
      e.byId.set(d.id, d);
      if (d instanceof WireDevice) e.wires.push(d);
      if (d.kind === "speaker") e.hasSpeaker = true;
    }

    // Union-find over node names; wires merge their two ends.
    const parent = new Map<string, string>();
    const find = (a: string): string => {
      let r = a;
      while (parent.get(r) !== r) r = parent.get(r)!;
      let c = a;
      while (c !== r) {
        const nx = parent.get(c)!;
        parent.set(c, r);
        c = nx;
      }
      return r;
    };
    const add = (a: string) => {
      if (!parent.has(a)) parent.set(a, a);
    };
    for (const d of e.devices) for (const nm of d.pinNames) add(nm);
    for (const w of e.wires) {
      const ra = find(w.pinNames[0]!);
      const rb = find(w.pinNames[1]!);
      if (ra !== rb) parent.set(ra, rb);
    }

    // Reference node: "gnd" if any part uses it, else the first battery's negative terminal, else anything.
    const usesGnd = e.devices.some((d) => d.pinNames.includes("gnd"));
    let refName = "gnd";
    if (!usesGnd) {
      const src = e.devices.find((d) => d.kind === "battery" || d.kind === "cell");
      refName = src ? src.pin("neg") : (e.devices.find((d) => d.pinNames.length > 0)?.pinNames[0] ?? "gnd");
    }
    add(refName);
    const refRoot = find(refName);
    // Provisional ids: one per merged node group, then one per internal node a device asks for.
    const groupId = new Map<string, number>();
    groupId.set(refRoot, -1);
    let groups = 0;
    const names = [...parent.keys()];
    for (const nm of names) {
      const r = find(nm);
      if (!groupId.has(r)) groupId.set(r, groups++);
    }

    // Pass 1: record which unknowns each device couples, to choose an elimination order with little fill-in.
    // A device couples all of its unknowns unless it declares coupling groups (chips with many pins do).
    let extra: string[] = [];
    let touched: number[] = [];
    let declared: number[][] = [];
    const deviceGroups: number[][][] = [];
    /** Every unknown each device touches (for islands), whatever its coupling groups. */
    const touchedBy: number[][] = [];
    let touchesRef = false;
    const refDevices: boolean[] = [];
    const recordId = (id: number) => {
      if (id >= 0) touched.push(id);
      else touchesRef = true;
      return id;
    };
    const probe: Binder = {
      node: (name: string) => {
        if (parent.has(name)) return recordId(groupId.get(find(name))!);
        extra.push(name);
        return recordId(groups + extra.length - 1);
      },
      internal: (name: string) => {
        extra.push(name);
        return recordId(groups + extra.length - 1);
      },
      reactive: () => {},
      group: (nodes: number[]) => {
        declared.push(nodes.filter((u) => u >= 0));
      },
    };
    for (const d of e.devices) {
      touched = [];
      declared = [];
      touchesRef = false;
      d.bind(probe);
      deviceGroups.push(declared.length > 0 ? declared : [touched]);
      touchedBy.push(touched);
      refDevices.push(touchesRef);
    }
    const incidence = deviceGroups.flat();
    const total = groups + extra.length;
    const order = minimumDegreeOrder(total, incidence);
    const finalOf = new Int32Array(total);
    order.forEach((pid, k) => (finalOf[pid] = k));

    // Islands: unknowns linked through devices. Each island that never reaches the reference gets one tie (at a
    // source's minus terminal when it has one).
    const up = Array.from({ length: total }, (_, k) => k);
    const root = (k: number): number => {
      while (up[k] !== k) k = up[k] = up[up[k]!]!;
      return k;
    };
    const grounded = new Set<number>();
    for (const ids of touchedBy) for (let j = 1; j < ids.length; j++) up[root(ids[j]!)] = root(ids[0]!);
    touchedBy.forEach((ids, k) => {
      if (refDevices[k] && ids.length) grounded.add(root(ids[0]!));
    });
    const tieOf = new Map<number, number>();
    for (const sourcesFirst of [true, false]) {
      e.devices.forEach((d, k) => {
        const ids = touchedBy[k]!;
        const isSource = d.kind === "battery" || d.kind === "cell";
        if (!ids.length || (sourcesFirst && !isSource)) return;
        const r = root(ids[0]!);
        if (grounded.has(r) || tieOf.has(r)) return;
        const neg = isSource && parent.has(d.pin("neg")) ? groupId.get(find(d.pin("neg"))) : undefined;
        tieOf.set(r, neg !== undefined && neg >= 0 ? neg : ids[0]!);
      });
    }
    e.ties = [...tieOf.values()].map((pid) => finalOf[pid]!);

    for (const nm of names) {
      const g = groupId.get(find(nm))!;
      e.nodeIndex.set(nm, g < 0 ? -1 : finalOf[g]!);
      e.nodeNames.push(nm);
    }
    if (!e.nodeIndex.has("gnd")) {
      // Report "gnd" as 0 V even when no part uses it (it then coincides with the chosen reference).
      e.nodeIndex.set("gnd", -1);
      e.nodeNames.push("gnd");
    }

    // Pass 2: bind for real with the final numbering (devices ask for the same nodes in the same order).
    extra = [];
    const binder: Binder = {
      node: (name: string) => {
        const idx = parent.has(name) ? e.nodeIndex.get(name) : undefined;
        if (idx !== undefined) return idx;
        extra.push(name);
        const k = finalOf[groups + extra.length - 1]!;
        e.internalIndex.set(name, k);
        return k;
      },
      internal: (name: string) => {
        extra.push(name);
        const k = finalOf[groups + extra.length - 1]!;
        e.internalIndex.set(name, k);
        return k;
      },
      reactive: (r: Reactive) => {
        e.reactives.push(r);
      },
      group: () => {},
    };
    for (const d of e.devices) d.bind(binder);
    e.n = total;

    for (const d of e.devices) {
      if (d.nonlinear) e.nonlinearDevs.push(d);
      if (overrides(d, "stampRhs")) e.rhsDevs.push(d);
      if (d.timed) e.timedDevs.push(d);
      if (d.accepts && overrides(d, "accept")) e.acceptDevs.push(d);
      if (overrides(d, "crossing")) e.eventDevs.push(d);
    }

    const n = e.n;
    // Structural pattern: every device couples all of its unknowns.
    const mask = new Uint8Array(Math.max(1, n * n));
    for (const nodes of incidence) {
      for (const u of nodes) for (const v of nodes) mask[finalOf[u]! * n + finalOf[v]!] = 1;
    }
    e.lu = new SparseLU(n, mask);
    // Matrix entries that nonlinear devices (or the diagonal shunt) may touch.
    const nl = new Set<number>();
    for (let i = 0; i < n; i++) nl.add(i * n + i);
    e.devices.forEach((d, k) => {
      if (!d.nonlinear) return;
      for (const nodes of deviceGroups[k]!) for (const u of nodes) for (const v of nodes) nl.add(finalOf[u]! * n + finalOf[v]!);
    });
    e.nlPos = Int32Array.from(nl);
    e.Alin = new Float64Array(Math.max(1, n * n));
    e.bstep = new Float64Array(Math.max(1, n));
    e.bwork = new Float64Array(Math.max(1, n));
    e.x = new Float64Array(Math.max(1, n));
    e.xIter = new Float64Array(Math.max(1, n));
    e.xNew = new Float64Array(Math.max(1, n));
    e.xBack = new Float64Array(Math.max(1, n));
    e.xPrev = new Float64Array(Math.max(1, n));
    e.xAnchor = new Float64Array(Math.max(1, n));
    e.hmax = opts.maxStep ?? (e.hasSpeaker ? 1 / AUDIO_RATE : DEFAULT_MAX_STEP);

    if (prev) e.inherit(prev);
    if (netlist?.watch?.length) {
      const named = [...new Set([...e.nodeIndex.values()].filter((k) => k >= 0))];
      e.edgeWatch = new EdgeWatch(netlist.watch, (nm) => e.nodeIndex.get(nm), named, prev?.edgeWatch ?? null);
    }
    e.needBreak = true;
    e.freshStart = true;
    return e;
  }

  /** Carries time, physical state, live inputs and a solution guess over from the previous engine. */
  private inherit(prev: Engine): void {
    this.t = prev.t;
    this.restoring = true;
    for (const d of this.devices) {
      const old = prev.byId.get(d.id);
      if (!old || old.kind !== d.kind) continue;
      d.restore(old.save());
      const oldSpec = old.spec as unknown as Record<string, unknown>;
      const newSpec = d.spec as unknown as Record<string, unknown>;
      for (const key of INPUT_KEYS) {
        if (oldSpec[key] !== newSpec[key]) continue;
        const v = old.inputValue(key);
        if (v !== undefined) d.setInput(key, v, this);
      }
    }
    this.restoring = false;
    // Initial guess for Newton from the old node voltages (by name, including internal nodes).
    const oldV = new Map<string, number>();
    for (const [nm, idx] of prev.nodeIndex) oldV.set(nm, idx >= 0 ? prev.x[idx]! : 0);
    for (const [nm, idx] of prev.internalIndex) oldV.set(nm, prev.x[idx]!);
    for (const map of [this.nodeIndex, this.internalIndex]) {
      for (const [nm, idx] of map) {
        const v = oldV.get(nm);
        if (idx >= 0 && v !== undefined) this.x[idx] = v;
      }
    }
    // Pending breakpoints in the future (relay timers re-register themselves through restore()).
    this.events = [];
  }

  // -------------------------------------------------------------------------------------------------------------
  // Inputs

  setInput(partId: string, key: InputKey, value: InputValue): boolean {
    const d = this.byId.get(partId);
    if (!d) return false;
    if (key === "replace") {
      d.replace(this);
      this.markDirty();
      this.markBreak();
      return true;
    }
    const ok = d.setInput(key, value, this);
    if (ok) {
      this.markDirty();
      this.markBreak();
    }
    return ok;
  }

  // -------------------------------------------------------------------------------------------------------------
  // Time stepping

  /** Advances until t reaches tEnd (exactly). Stops early when shouldStop() returns true; returns false then. */
  advance(tEnd: number, shouldStop?: () => boolean): boolean {
    let guard = 0;
    while (tEnd - this.t > 1e-13) {
      this.stepOnce(tEnd);
      if (shouldStop && (++guard & 3) === 0 && shouldStop()) return tEnd - this.t <= 1e-13;
    }
    return true;
  }

  private nextLimit(tEnd: number): number {
    const bp = this.breakpoints;
    while (bp.length > 0 && bp[0]! <= this.t + 1e-13) bp.shift();
    return bp.length > 0 && bp[0]! < tEnd ? bp[0]! : tEnd;
  }

  /** Takes one accepted step that does not pass tEnd or the next breakpoint. */
  stepOnce(tEnd: number): void {
    for (const d of this.timedDevs) d.beginStep(this);

    // A hard break (switch, input, part dying) restarts with a small backward Euler step. A soft one (a digital
    // edge) first settles the edge with a nanosecond step, then restarts at a moderate step (see markEdge).
    const hard = this.needBreak;
    const soft = !hard && this.edgeBreak;
    const isBreak = hard || soft;
    let method: Method = isBreak ? "be" : "tr";
    if (isBreak) {
      this.needBreak = false;
      this.edgeBreak = false;
      // Restart the error history at the discontinuity.
      this.histCount = 1;
      this.histT[0] = this.t;
      for (const r of this.reactives) r.hist[0] = r.state;
    }
    const limit = this.nextLimit(tEnd);
    let h = soft ? H_SETTLE : isBreak ? Math.min(this.hNext, Math.max(H_BREAK, this.hRestart)) : this.hNext;
    this.hRestart = 0;
    h = Math.min(h, this.hmax * this.stepScale);
    const room = limit - this.t;
    if (room <= 0) return;
    if (!(h > 0)) h = H_BREAK;
    // Watchdog: while forced, take steps of at least a fraction of a microsecond and never rescue (see below).
    const forced = this.t < this.forceUntil;
    if (forced) h = Math.max(h, H_FORCED);
    const clipped = h >= room || room < 2 * h;
    if (h >= room) h = room;
    else if (room < 2 * h) h = room / 2;

    // A settle step solves a known discontinuity (an output switching): give Newton more room before rescue.
    const maxIter = this.freshStart ? 100 : soft ? 4 * MAX_ITER : MAX_ITER;
    let failedHere = false;
    let locates = 0;
    let tol = EVENT_TOL;
    /** Step the error control allowed before an event shortened this one (resumed afterwards). */
    let hResume = 0;
    this.predict = !isBreak && this.canPredict;
    for (let attempt = 0; ; attempt++) {
      this.prepare(h, method);
      let ok = this.newton(maxIter, false);
      let jumped = false;
      if (!ok) {
        failedHere = true;
        if (h > H_REDUCE_MIN && this.reactives.length > 0 && attempt < 6) {
          this.stats.rejected++;
          h = Math.max(h / 4, H_MIN);
          continue;
        }
        // Either a hard operating point or a fold: a regenerative circuit (an astable, a latch) has run off the
        // end of its solution branch and must snap to the other one. Treat it as a discontinuity: solve the jump
        // with backward Euler (no memory of the old currents), by homotopy if needed, then restart integration.
        if (method === "tr") {
          method = "be";
          this.prepare(h, method);
        }
        ok = !forced && this.rescue();
        if (ok) {
          this.stats.rescued++;
          this.needBreak = true;
          this.hRestart = h;
          jumped = true;
        } else {
          // Give up on this point: keep the previous solution so time still moves on and the worker never freezes.
          this.stats.failed++;
          this.xIter.set(this.x);
          this.needBreak = true;
        }
      }
      let hGrow = h * 2;
      if (ok && !jumped && method === "tr" && this.histCount >= 3) {
        const ratio = this.lteRatio(h);
        if (ratio > 1 && h > 1e-9 && attempt < 12) {
          this.stats.rejected++;
          h = h * Math.max(0.1, 0.9 * Math.pow(ratio, -1 / 3));
          continue;
        }
        const grow = ratio > 0 ? Math.min(2, 0.9 * Math.pow(ratio, -1 / 3)) : 2;
        hGrow = h * Math.max(0.25, grow);
        // What the error control would allow next, unless this step was cut short (a breakpoint, an event).
        if (!clipped && locates === 0) this.hSmooth = hGrow;
      } else if (ok && !jumped && !isBreak && this.reactives.length === 0) this.hSmooth = hGrow;
      // Event location: on a smooth stretch, land just past the first threshold crossing instead of jumping over it.
      if (ok && !jumped && !isBreak && !forced && this.eventDevs.length > 0 && locates < 16) {
        let f = Infinity;
        for (const d of this.eventDevs) {
          const fd = d.crossing(this.x, this.xIter);
          if (fd < f) f = fd;
        }
        if (f < 1) {
          const tc = Math.max(0, f) * h;
          // Located to a small share of the step the error control wanted: a crossing on a millisecond curve
          // needs no nanosecond precision.
          if (locates === 0) tol = Math.max(EVENT_TOL, EVENT_REL * h);
          if (h - tc > tol) {
            this.stats.located++;
            locates++;
            if (hResume === 0) hResume = hGrow;
            h = Math.max(tc + 0.5 * tol, H_MIN);
            continue;
          }
        }
      }
      this.hNext = Math.max(hGrow, hResume);
      // Be careful for a few steps after a convergence failure: those cluster near sharp transitions.
      if (failedHere) this.cautious = 3;
      else if (this.cautious > 0) this.cautious--;
      if (this.cautious > 0 || this.lastIters > 8) this.hNext = Math.min(this.hNext, h);
      const marks = this.breakMarks;
      this.acceptStep(h, limit, !isBreak && !jumped && ok);
      if (soft && this.breakMarks === marks) {
        // The edge has settled (everything wired to it has seen the new level). Restart integration with a
        // backward Euler step that is a small share of what the error control used before the edge: capacitor
        // voltages are continuous across it, and the first-order error of that one step (it grows with the square
        // of its size) stays well under 0.1% of the timing.
        this.needBreak = true;
        // Without capacitors or coils there is nothing to integrate: carry on with full steps.
        const hr =
          this.reactives.length === 0
            ? this.hmax * this.stepScale
            : Math.min(H_EDGE_RESTART, this.hmax * this.stepScale, Math.max(H_BREAK, EDGE_RESTART_SHARE * this.hSmooth));
        this.hRestart = hr;
        this.hNext = hr;
      }
      // Watchdog: a long run of tiny steps (a circuit the solver keeps snapping back and forth on) would stall
      // simulated time and freeze the bench. Then skip ahead for a moment with coarse steps instead.
      if (h < H_TINY && !soft) this.tinySteps++;
      else this.tinySteps = 0;
      if (this.tinySteps > TINY_RUN) {
        this.tinySteps = 0;
        this.forceUntil = this.t + FORCE_SPAN;
        this.stats.forced++;
      }
      return;
    }
  }

  private prepare(h: number, method: Method): void {
    this.h = h;
    this.method = method;
    const n = this.n;
    if (this.linearDirty || h !== this.lastH || method !== this.lastMethod) {
      for (const r of this.reactives) r.prepare(h, method);
      const A = this.Alin;
      A.fill(0);
      for (let i = 0; i < n; i++) A[i * n + i] = GMIN;
      for (const k of this.ties) A[k * n + k] = GMIN + TIE_G;
      for (const d of this.devices) d.stampLinear(A, n, this);
      for (const r of this.reactives) r.stampLinear(A, n);
      this.linearDirty = false;
      this.linFactored = false;
      this.lastH = h;
      this.lastMethod = method;
    }
    const b = this.bstep;
    b.fill(0);
    for (const r of this.reactives) {
      r.history(h, method);
      r.stampRhs(b);
    }
    for (const d of this.rhsDevs) d.stampRhs(b, this);
  }

  /** Newton-Raphson from the last accepted solution (or from the current iterate when fromCurrent is set). */
  private newton(maxIter: number, fromCurrent: boolean): boolean {
    const n = this.n;
    if (n === 0) {
      this.lastIters = 0;
      return true;
    }
    const xi = this.xIter;
    const xn = this.xNew;
    const lu = this.lu;
    if (!fromCurrent) {
      if (this.predict && this.hPrev > 0) {
        const r = this.h / this.hPrev;
        const x = this.x;
        const xp = this.xPrev;
        for (let i = 0; i < n; i++) xi[i] = x[i]! + (x[i]! - xp[i]!) * r;
      } else xi.set(this.x);
    }
    if (this.nonlinearDevs.length === 0 && this.gshunt === 0) {
      // Linear circuit: the factors stay valid until the linear matrix changes.
      if (!this.linFactored) {
        lu.a.set(this.Alin);
        lu.factor();
        this.linFactored = true;
        this.stats.factorizations++;
      }
      lu.solve(this.bstep, xn);
      for (let i = 0; i < n; i++) if (!Number.isFinite(xn[i]!)) return false;
      xi.set(xn);
      this.lastIters = 1;
      this.stats.iterations++;
      return true;
    }
    this.linFactored = false;
    for (const d of this.nonlinearDevs) d.initIter(xi);
    const a = lu.a;
    const Al = this.Alin;
    const nlPos = this.nlPos;
    a.set(Al);
    for (let it = 0; it < maxIter; it++) {
      // Only nonlinear devices (and the diagonal shunt) change the matrix between iterations.
      if (it > 0) for (let q = 0; q < nlPos.length; q++) a[nlPos[q]!] = Al[nlPos[q]!]!;
      this.bwork.set(this.bstep);
      this.noncon = false;
      for (const d of this.nonlinearDevs) d.stampNonlinear(a, this.bwork, n, xi, this);
      if (this.gshunt > 0) {
        const g = this.gshunt;
        const anchor = this.anchored ? this.xAnchor : null;
        const bw = this.bwork;
        for (let i = 0; i < n; i++) {
          a[i * n + i]! += g;
          if (anchor) bw[i]! += g * anchor[i]!;
        }
      }
      lu.factor();
      lu.solve(this.bwork, xn);
      this.stats.iterations++;
      this.stats.factorizations++;
      let conv = !this.noncon;
      for (let i = 0; i < n; i++) {
        const v = xn[i]!;
        if (!Number.isFinite(v)) return false;
        const o = xi[i]!;
        const d = v > o ? v - o : o - v;
        if (conv && d > RELTOL * Math.max(v < 0 ? -v : v, o < 0 ? -o : o) + VNTOL) conv = false;
      }
      xi.set(xn);
      if (conv) {
        this.lastIters = it + 1;
        return true;
      }
    }
    this.lastIters = maxIter;
    return false;
  }

  /** gmin stepping from the last accepted solution: a shunt to ground on every node, relaxed in steps. */
  private gminStepping(factor: number): boolean {
    this.xIter.set(this.x);
    let ok = true;
    for (let g = 1e-3; g > 1e-13; g /= factor) {
      this.gshunt = g;
      if (!this.newton(40, true)) {
        ok = false;
        break;
      }
    }
    this.gshunt = 0;
    return ok && this.newton(80, true);
  }

  /**
   * Convergence aids, cheapest first: a remembered jump, plain Newton with more room, pseudo-transient continuation,
   * then gmin and source stepping. Oscillators snap through the same few folds over and over, so the change made by
   * the last similar jump is an excellent first guess for this one: Newton from there converges in a few iterations.
   */
  private rescue(): boolean {
    if (this.jumpFromMemory()) {
      this.stats.remembered++;
      return true;
    }
    // Near a fold Newton can fail although the circuit can still continue on its branch: try that first.
    this.predict = false;
    if (this.newton(12, false)) return true;
    const ok = this.pseudoTransient() || this.gminAndSourceStepping();
    if (ok) this.rememberJump();
    return ok;
  }

  /**
   * Tries the change made by the most similar remembered jump as the starting guess. Similar means: on the nodes
   * that jump moved, the circuit now sits where it sat before that jump. The result is rejected if it moved other
   * nodes a lot (that would be some other part of the circuit flipping, which needs the careful path).
   */
  private jumpFromMemory(): boolean {
    const n = this.n;
    const x = this.x;
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < this.jumps.length; k++) {
      const jm = this.jumps[k]!;
      // Worst mismatch on the moved unknowns, relative to a tolerance that is tight near 0 V (base voltages decide
      // when a snap happens) and looser on large voltages.
      let d = 0;
      for (let q = 0; q < jm.count; q++) {
        const i = jm.moved[q]!;
        const p = jm.pre[i]!;
        const e = Math.abs(x[i]! - p) / (JUMP_MATCH_ABS + JUMP_MATCH_REL * Math.abs(p));
        if (e > d) d = e;
      }
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best < 0 || bestD > 1) return false;
    const jm = this.jumps[best]!;
    const xi = this.xIter;
    for (let i = 0; i < n; i++) xi[i] = x[i]! + jm.post[i]! - jm.pre[i]!;
    if (!this.newton(12, true)) return false;
    for (let i = 0; i < n; i++) {
      const moved = Math.abs(xi[i]! - x[i]!);
      if (moved > JUMP_MOVE && !jm.isMoved[i]) return false;
    }
    this.rememberJump(best);
    return true;
  }

  /** Stores the jump just solved (from x to xIter), replacing slot k, or the oldest slot. */
  private rememberJump(k = -1): void {
    const n = this.n;
    const x = this.x;
    const xi = this.xIter;
    let any = false;
    for (let i = 0; i < n && !any; i++) any = Math.abs(xi[i]! - x[i]!) > JUMP_MOVE;
    if (!any) return;
    if (k < 0) {
      if (this.jumps.length < JUMP_MEMORY) {
        k = this.jumps.push({ pre: new Float64Array(n), post: new Float64Array(n), moved: new Int32Array(n), count: 0, isMoved: new Uint8Array(n) }) - 1;
      } else {
        k = this.jumpNext;
        this.jumpNext = (this.jumpNext + 1) % JUMP_MEMORY;
      }
    }
    const jm = this.jumps[k]!;
    jm.pre.set(x);
    jm.post.set(xi);
    jm.count = 0;
    for (let i = 0; i < n; i++) {
      const m = Math.abs(xi[i]! - x[i]!) > JUMP_MOVE;
      jm.isMoved[i] = m ? 1 : 0;
      if (m) jm.moved[jm.count++] = i;
    }
  }

  /**
   * Pseudo-transient continuation: a small capacitance from every node to ground, integrated in pseudo time from the
   * last good solution with growing pseudo steps until it no longer matters. That follows the path the real circuit
   * takes through a snap (stray capacitance sets it), so the circuit lands on the physical branch, where gmin
   * stepping from scratch can drift to an unrelated (for example a symmetric) solution.
   */
  private pseudoTransient(): boolean {
    const xi = this.xIter;
    xi.set(this.x);
    this.xAnchor.set(this.x);
    let g = PTC_G0;
    let ok = false;
    this.anchored = true;
    for (let k = 0; k < 200; k++) {
      this.gshunt = g;
      this.xBack.set(xi);
      if (this.newton(12, true)) {
        this.xAnchor.set(xi);
        if (g <= 1e-12) {
          ok = true;
          break;
        }
        g /= this.lastIters <= 4 ? PTC_RELAX : 2;
      } else {
        xi.set(this.xBack);
        g *= 4;
        if (g > 1e3) break;
      }
    }
    this.gshunt = 0;
    this.anchored = false;
    return ok && this.newton(40, true);
  }

  /** The classic aids, as a last resort: gmin stepping (coarse, then fine), then source stepping. */
  private gminAndSourceStepping(): boolean {
    if (this.gminStepping(1000)) return true;
    if (this.gminStepping(100)) return true;
    if (this.gminStepping(10)) return true;

    // source stepping
    this.xIter.fill(0);
    this.sourceScale = 0;
    this.prepare(this.h, this.method);
    let s = 0;
    let ds = 0.1;
    let good = this.newton(80, true);
    while (good && s < 1) {
      const sTry = Math.min(1, s + ds);
      this.sourceScale = sTry;
      this.prepare(this.h, this.method);
      this.xBack.set(this.xIter);
      if (this.newton(80, true)) {
        s = sTry;
        ds = Math.min(ds * 2, 0.5);
      } else {
        this.xIter.set(this.xBack);
        ds /= 4;
        if (ds < 1e-4) good = false;
      }
    }
    this.sourceScale = 1;
    this.prepare(this.h, this.method);
    return good && s >= 1 && this.newton(80, true);
  }

  private lteRatio(h: number): number {
    const T = this.histT;
    const t0 = T[0]!;
    const t1 = T[1]!;
    const t2 = T[2]!;
    const t3 = this.t + h;
    const x = this.xIter;
    let worst = 0;
    const h3 = (h * h * h) / 2; // h^3/12 * 6 (third derivative = 6 x third divided difference)
    for (const r of this.reactives) {
      if (r.alwaysBE) continue;
      const x3 = r.stateOf(x);
      const hs = r.hist;
      const x0 = hs[0]!;
      const x1 = hs[1]!;
      const x2 = hs[2]!;
      const d01 = (x1 - x0) / (t1 - t0);
      const d12 = (x2 - x1) / (t2 - t1);
      const d23 = (x3 - x2) / (t3 - t2);
      const d012 = (d12 - d01) / (t2 - t0);
      const d123 = (d23 - d12) / (t3 - t1);
      const d0123 = (d123 - d012) / (t3 - t0);
      const lte = h3 * Math.abs(d0123);
      const tol = TRTOL * (r.relTol * Math.max(Math.abs(x3), Math.abs(x2)) + r.absTol);
      const ratio = lte / tol;
      if (ratio > worst) worst = ratio;
    }
    return Number.isFinite(worst) ? worst : 10;
  }

  private acceptStep(h: number, limit: number, smooth: boolean): void {
    const x = this.xIter;
    this.xPrev.set(this.x);
    this.hPrev = h;
    this.canPredict = smooth;
    for (const r of this.reactives) r.accept(x);
    let tNew = this.t + h;
    if (Math.abs(tNew - limit) < 1e-12) tNew = limit;
    // Error history
    if (this.histCount < 3) {
      this.histT[this.histCount] = tNew;
      for (const r of this.reactives) r.hist[this.histCount] = r.state;
      this.histCount++;
    } else {
      this.histT[0] = this.histT[1]!;
      this.histT[1] = this.histT[2]!;
      this.histT[2] = tNew;
      for (const r of this.reactives) {
        const hs = r.hist;
        hs[0] = hs[1]!;
        hs[1] = hs[2]!;
        hs[2] = r.state;
      }
    }
    this.x.set(x);
    this.t = tNew;
    this.h = h;
    this.freshStart = false;
    this.stats.steps++;
    for (const d of this.acceptDevs) d.accept(x, this);
    if (this.onAccept) this.onAccept(this);
    if (this.edgeWatch) this.edgeWatch.accept(this.t, this.x);
  }

  // -------------------------------------------------------------------------------------------------------------
  // Read-out

  voltage(name: string): number {
    const idx = this.nodeIndex.get(name);
    return idx !== undefined && idx >= 0 ? this.x[idx]! : 0;
  }

  nodeVoltages(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const nm of this.nodeNames) {
      const idx = this.nodeIndex.get(nm)!;
      out[nm] = idx >= 0 ? this.x[idx]! : 0;
    }
    return out;
  }

  partStates(): Record<string, PartState> {
    const out: Record<string, PartState> = {};
    for (const d of this.devices) {
      if (d instanceof WireDevice) continue;
      out[d.id] = d.state(this.x);
      const sub = d.subStates(this.x);
      if (sub) Object.assign(out, sub);
    }
    if (this.wires.length > 0) {
      const wi = this.wireCurrents();
      for (const w of this.wires) {
        const i = wi.get(w.id) ?? 0;
        const v = this.voltage(w.pinNames[0]!) - this.voltage(w.pinNames[1]!);
        out[w.id] = { i, v, p: 0, temp: 25, health: "ok" };
      }
    }
    return out;
  }

  /**
   * Wires are merged away by union-find, so their currents come from KCL: the current each non-wire pin draws at a
   * node name must arrive through the wires touching it. Each wire cluster is solved as equal tiny resistors.
   */
  wireCurrents(): Map<string, number> {
    const out = new Map<string, number>();
    if (this.wires.length === 0) return out;
    const inj = new Map<string, number>();
    for (const d of this.devices) {
      if (d instanceof WireDevice) continue;
      const pc = d.pinCurrents(this.x);
      for (let k = 0; k < d.pinNames.length; k++) {
        const nm = d.pinNames[k]!;
        inj.set(nm, (inj.get(nm) ?? 0) + (pc[k] ?? 0));
      }
    }
    // Clusters of names connected by wires.
    const adj = new Map<string, WireDevice[]>();
    for (const w of this.wires) {
      for (const nm of w.pinNames) {
        let l = adj.get(nm);
        if (!l) adj.set(nm, (l = []));
        l.push(w);
      }
    }
    const done = new Set<string>();
    for (const start of adj.keys()) {
      if (done.has(start)) continue;
      const names: string[] = [];
      const stack = [start];
      done.add(start);
      while (stack.length) {
        const nm = stack.pop()!;
        names.push(nm);
        for (const w of adj.get(nm)!) {
          for (const o of w.pinNames) {
            if (!done.has(o)) {
              done.add(o);
              stack.push(o);
            }
          }
        }
      }
      const m = names.length;
      const idx = new Map(names.map((nm, k) => [nm, k]));
      const cw = new Set<WireDevice>();
      for (const nm of names) for (const w of adj.get(nm)!) cw.add(w);
      if (m <= 1) {
        for (const w of cw) out.set(w.id, 0);
        continue;
      }
      // Laplacian L phi = -inj with the first name grounded.
      const k = m - 1;
      const lu = new DenseLU(k);
      const rhs = new Float64Array(k);
      const sol = new Float64Array(k);
      for (const w of cw) {
        const a = idx.get(w.pinNames[0]!)! - 1;
        const b = idx.get(w.pinNames[1]!)! - 1;
        if (a === b) continue;
        if (a >= 0) lu.a[a * k + a]! += 1;
        if (b >= 0) lu.a[b * k + b]! += 1;
        if (a >= 0 && b >= 0) {
          lu.a[a * k + b]! -= 1;
          lu.a[b * k + a]! -= 1;
        }
      }
      for (let r = 0; r < k; r++) rhs[r] = -(inj.get(names[r + 1]!) ?? 0);
      lu.factor();
      lu.solve(rhs, sol);
      const phi = (nm: string) => {
        const r = idx.get(nm)! - 1;
        return r >= 0 ? sol[r]! : 0;
      };
      for (const w of cw) out.set(w.id, phi(w.pinNames[0]!) - phi(w.pinNames[1]!));
    }
    return out;
  }

  /** Sum of the voltages across all speakers (for the audio stream). */
  speakerVolts(): number {
    let v = 0;
    for (const d of this.devices) if (d.kind === "speaker") v += d.audioVolts;
    return v;
  }

  drainEvents(): SimEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}

export const INPUT_KEYS: InputKey[] = ["pressed", "closed", "position", "light", "mode", "range", "to", "ohms", "bounce", "proximity", "power"];

/**
 * Greedy minimum-degree ordering of the unknowns (devices couple all of their nodes). Eliminating low-degree nodes
 * first (internal series-resistance nodes, then signal nodes, supply rails last) keeps LU fill-in small, which makes
 * the sparse-aware dense factorisation much cheaper. Deterministic: ties go to the lower provisional id.
 */
function minimumDegreeOrder(total: number, incidence: number[][]): number[] {
  const adj: Set<number>[] = [];
  for (let i = 0; i < total; i++) adj.push(new Set());
  for (const nodes of incidence) {
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const u = nodes[a]!;
        const v = nodes[b]!;
        if (u === v) continue;
        adj[u]!.add(v);
        adj[v]!.add(u);
      }
    }
  }
  const done = new Uint8Array(total);
  const order: number[] = [];
  for (let k = 0; k < total; k++) {
    let best = -1;
    let bestDeg = Infinity;
    for (let i = 0; i < total; i++) {
      if (done[i]) continue;
      const d = adj[i]!.size;
      if (d < bestDeg) {
        bestDeg = d;
        best = i;
      }
    }
    done[best] = 1;
    order.push(best);
    const nb = [...adj[best]!];
    for (const v of nb) {
      adj[v]!.delete(best);
      for (const w of nb) if (w !== v) adj[v]!.add(w);
    }
  }
  return order;
}
