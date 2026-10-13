// Public API shapes shared by the in-thread simulation and the worker client.

import type { InputKey, InputValue, Netlist, Snapshot } from "./types";

export type RunOptions = {
  /**
   * Simulated seconds per wall second. 1 is real time, below 1 is slow motion, up to 3600 for time-lapse (an hour
   * per second: a battery draining over a day). Above 4 the audio stream is muted. Default 1.
   */
  speed?: number;
};

export type SnapshotListener = (snapshot: Snapshot) => void;
/** Receives a chunk of mono samples (speaker voltage, normalised to -1..1 with a soft limiter). */
export type AudioListener = (samples: Float32Array, sampleRate: number) => void;

export type SimulationOptions = {
  /** Snapshots per wall second while running. Default 30. */
  snapshotHz?: number;
  /** CPU time per scheduler tick while running, in ms. Default 10. */
  budgetMs?: number;
  /** Largest integration step in seconds (default 2 ms, or 1/44100 s when a speaker is present). */
  maxStep?: number;
};

export type ScheduledInput = { t: number; id: string; key: InputKey; value: InputValue };

export type SimulateForOptions = SimulationOptions & {
  /** Seconds between returned snapshots. Default 1/30. */
  sampleEvery?: number;
  /** Inputs to apply at given simulated times (for example pressing a button at t = 0.5). */
  actions?: ScheduledInput[];
  onAudio?: AudioListener;
};

export interface Simulation {
  /** Full rebuild. Parts whose id survives keep their physical state (charge, heat, damage, blown fuses). */
  load(netlist: Netlist): void;
  setInput(partId: string, key: InputKey, value: InputValue): void;
  /** Advances simulated time with wall time x speed, emitting snapshots at about 30 Hz. */
  run(opts?: RunOptions): void;
  pause(): void;
  /** Advances exactly dt simulated seconds, synchronously. Returns (and emits) a snapshot. */
  step(dt: number): Snapshot;
  /** The current state, with the events raised since the previous snapshot. */
  snapshot(): Snapshot;
  onSnapshot(cb: SnapshotListener): () => void;
  onAudio(cb: AudioListener): () => void;
  dispose(): void;
  readonly time: number;
  readonly running: boolean;
}

export interface SimClient {
  load(netlist: Netlist): void;
  setInput(partId: string, key: InputKey, value: InputValue): void;
  run(opts?: RunOptions): void;
  pause(): void;
  step(dt: number): Promise<Snapshot>;
  snapshot(): Promise<Snapshot>;
  onSnapshot(cb: SnapshotListener): () => void;
  onAudio(cb: AudioListener): () => void;
  dispose(): void;
  /** Simulated time of the latest snapshot received. */
  readonly time: number;
  readonly running: boolean;
}
