// Messages between the main thread client and the simulator worker.

import type { InputKey, InputValue, Netlist, Snapshot } from "./types";

export type ToWorker =
  | { type: "load"; netlist: Netlist }
  | { type: "setInput"; id: string; key: InputKey; value: InputValue }
  | { type: "run"; speed: number }
  | { type: "pause" }
  | { type: "step"; dt: number; req: number }
  | { type: "snapshot"; req: number }
  | { type: "audio"; enabled: boolean }
  | { type: "dispose" };

export type FromWorker =
  | { type: "ready" }
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "reply"; req: number; snapshot: Snapshot }
  | { type: "audio"; samples: Float32Array; sampleRate: number }
  | { type: "error"; message: string };

/** The subset of Worker / MessagePort / DedicatedWorkerGlobalScope that both ends use. */
export interface PortLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent) => void) | null;
}
