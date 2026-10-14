// In-thread simulation: owns the engine, rebuilds on load(), runs a real-time scheduler, emits snapshots and audio.

import type { AudioListener, RunOptions, SimulateForOptions, Simulation, SimulationOptions, SnapshotListener } from "./api";
import { AudioStream, SAMPLE_RATE } from "./audio";
import { Engine } from "./engine/engine";
import type { InputKey, InputValue, Netlist, SimEvent, Snapshot } from "./types";

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Events that can repeat many times a second are merged per part within one snapshot, with data.count. */
const COALESCE = new Set(["clicked", "spark"]);
/** Fastest run() speed (time-lapse, for example a battery draining over a day). */
export const MAX_SPEED = 3600;
/** Above this speed the audio stream is muted (fast-forwarded sound is useless and would flood the player). */
const AUDIO_MAX_SPEED = 4;
/** Above this speed the largest solver step grows in proportion (time-lapse). */
const STEP_SCALE_FROM = 10;

export class SimulationImpl implements Simulation {
  private engine: Engine;
  private readonly opts: SimulationOptions;
  private readonly snapListeners = new Set<SnapshotListener>();
  private readonly audioListeners = new Set<AudioListener>();
  private pending: SimEvent[] = [];
  private audio: AudioStream | null = null;
  private runFlag = false;
  private speed = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastTick = 0;
  private lastSnap = 0;
  private lag = 0;
  private disposed = false;

  constructor(opts: SimulationOptions = {}) {
    this.opts = opts;
    this.engine = Engine.build({ parts: [] }, null, this.engineOpts());
  }

  private engineOpts() {
    return this.opts.maxStep !== undefined ? { maxStep: this.opts.maxStep } : {};
  }

  get time(): number {
    return this.engine.t;
  }
  get running(): boolean {
    return this.runFlag;
  }

  load(netlist: Netlist): void {
    this.collect();
    this.engine = Engine.build(netlist, this.engine, this.engineOpts());
    this.hookAudio();
  }

  setInput(partId: string, key: InputKey, value: InputValue): void {
    this.engine.setInput(partId, key, value);
  }

  run(opts: RunOptions = {}): void {
    const sp = opts.speed ?? 1;
    this.speed = Number.isFinite(sp) && sp > 0 ? Math.min(sp, MAX_SPEED) : 1;
    if (this.runFlag || this.disposed) return;
    this.runFlag = true;
    this.lastTick = now();
    this.lastSnap = 0;
    this.schedule(0);
  }

  pause(): void {
    this.runFlag = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.lag = 0;
  }

  step(dt: number, opts: { speed?: number } = {}): Snapshot {
    const speed = Math.min(MAX_SPEED, Math.max(1, opts.speed ?? 1));
    this.engine.stepScale = Math.max(1, speed / STEP_SCALE_FROM);
    this.setMuted(speed > AUDIO_MAX_SPEED);
    if (dt > 0 && Number.isFinite(dt)) this.engine.advance(this.engine.t + dt);
    const s = this.snapshot();
    this.audio?.flush();
    for (const cb of this.snapListeners) cb(s);
    return s;
  }

  /** Advances to an absolute simulated time without emitting anything (used by simulateFor). */
  advanceTo(t: number): void {
    if (t > this.engine.t) this.engine.advance(t);
  }

  snapshot(): Snapshot {
    this.collect();
    const e = this.engine;
    const s: Snapshot = { t: e.t, nodes: e.nodeVoltages(), parts: e.partStates(), events: this.pending, lag: this.runFlag ? this.lag : 0 };
    this.pending = [];
    return s;
  }

  onSnapshot(cb: SnapshotListener): () => void {
    this.snapListeners.add(cb);
    return () => this.snapListeners.delete(cb);
  }

  onAudio(cb: AudioListener): () => void {
    this.audioListeners.add(cb);
    this.hookAudio();
    return () => {
      this.audioListeners.delete(cb);
      this.hookAudio();
    };
  }

  dispose(): void {
    this.pause();
    this.disposed = true;
    this.snapListeners.clear();
    this.audioListeners.clear();
    this.engine.onAccept = null;
  }

  /** Solver statistics, for diagnostics and performance tests. */
  get stats() {
    return { ...this.engine.stats, nodes: this.engine.n, maxStep: this.engine.hmax };
  }

  // -------------------------------------------------------------------------------------------------------------

  private collect(): void {
    const evs = this.engine.drainEvents();
    for (const ev of evs) {
      if (ev.type === "serial") {
        // A board's printed lines: one event per board per snapshot, the text joined.
        const prev = this.pending.find((p) => p.partId === ev.partId && p.type === "serial");
        if (prev) {
          prev.message = ev.message;
          prev.data = { text: `${prev.data?.text ?? ""}\n${ev.data?.text ?? ""}`, lines: Number(prev.data?.lines ?? 0) + Number(ev.data?.lines ?? 0) };
          continue;
        }
      }
      if (COALESCE.has(ev.type)) {
        const prev = this.pending.find((p) => p.partId === ev.partId && p.type === ev.type);
        if (prev) {
          const count = Number(prev.data?.count ?? 1) + 1;
          prev.message = ev.message;
          prev.data = { ...(ev.data ?? {}), count };
          continue;
        }
      }
      this.pending.push(ev);
    }
  }

  private hookAudio(): void {
    const want = this.audioListeners.size > 0 && this.engine.hasSpeaker;
    if (!want) {
      this.engine.onAccept = null;
      return;
    }
    if (!this.audio) {
      this.audio = new AudioStream((samples) => {
        for (const cb of this.audioListeners) cb(samples, SAMPLE_RATE);
      });
    }
    const audio = this.audio;
    this.engine.onAccept = (e) => {
      if (!this.muted) audio.push(e.t, e.speakerVolts());
    };
  }

  private muted = false;
  /** Mutes or unmutes the audio stream; unmuting restarts it at the current time (no burst for the gap). */
  private setMuted(m: boolean): void {
    if (m === this.muted) return;
    this.muted = m;
    if (this.audio) {
      this.audio.flush();
      this.audio.reset();
    }
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => this.tick(), delay);
  }

  private tick(): void {
    this.timer = null;
    if (!this.runFlag) return;
    const start = now();
    const wallDt = Math.min(0.1, Math.max(0, (start - this.lastTick) / 1000));
    this.lastTick = start;
    const want = wallDt * this.speed;
    const e = this.engine;
    const t0 = e.t;
    const deadline = start + (this.opts.budgetMs ?? 10);
    e.stepScale = Math.max(1, this.speed / STEP_SCALE_FROM);
    this.setMuted(this.speed > AUDIO_MAX_SPEED);
    try {
      if (want > 0) e.advance(t0 + want, () => now() > deadline);
    } catch (err) {
      // A model bug must never take the worker down: report and keep going.
      e.emit("sim", "damaged", `Simulator error: ${String(err)}`);
    }
    const got = this.engine.t - t0;
    const behind = want > 0 ? Math.min(1, Math.max(0, 1 - got / want)) : 0;
    this.lag = this.lag * 0.7 + behind * 0.3;
    if (this.lag < 1e-3) this.lag = 0;
    const hz = this.opts.snapshotHz ?? 30;
    if (start - this.lastSnap >= 1000 / hz - 1) {
      this.lastSnap = start;
      const s = this.snapshot();
      this.audio?.flush();
      for (const cb of this.snapListeners) cb(s);
    }
    const spent = now() - start;
    this.schedule(Math.max(1, 16 - spent));
  }
}

export function createSimulation(opts: SimulationOptions = {}): Simulation {
  return new SimulationImpl(opts);
}

/**
 * Runs a netlist for a number of simulated seconds and returns snapshots every sampleEvery seconds (plus one at the
 * end). Each snapshot carries the events raised since the previous one. For tests and lab solution checks.
 */
export function simulateFor(netlist: Netlist, seconds: number, opts: SimulateForOptions = {}): Snapshot[] {
  const sim = new SimulationImpl(opts);
  if (opts.onAudio) sim.onAudio(opts.onAudio);
  sim.load(netlist);
  const every = opts.sampleEvery && opts.sampleEvery > 0 ? opts.sampleEvery : 1 / 30;
  const actions = [...(opts.actions ?? [])].sort((a, b) => a.t - b.t);
  const out: Snapshot[] = [];
  let ai = 0;
  let k = 1;
  const eps = 1e-12;
  for (;;) {
    while (ai < actions.length && actions[ai]!.t <= sim.time + eps) {
      const a = actions[ai++]!;
      sim.setInput(a.id, a.key, a.value);
    }
    if (sim.time >= seconds - eps) break;
    const nextSample = Math.min(k * every, seconds);
    const nextAction = ai < actions.length ? actions[ai]!.t : Infinity;
    const target = Math.min(nextSample, nextAction);
    sim.advanceTo(target);
    if (Math.abs(sim.time - nextSample) <= eps * 10 || sim.time >= seconds - eps) {
      out.push(sim.snapshot());
      k++;
    }
  }
  if (out.length === 0 || out[out.length - 1]!.t < sim.time - eps) out.push(sim.snapshot());
  sim.dispose();
  return out;
}
