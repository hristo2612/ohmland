// Main thread client: same method names as createSimulation(), but the engine runs in a Web Worker.
// This module is light (no engine code), so it can be imported from pages that only sometimes need the simulator.

import type { AudioListener, RunOptions, SimClient, SnapshotListener } from "./api";
import type { FromWorker, PortLike, ToWorker } from "./protocol";
import type { InputKey, InputValue, Netlist, Snapshot } from "./types";

export type WorkerLike = PortLike & { terminate?: () => void; close?: () => void; onerror?: ((ev: unknown) => void) | null };

export type SimClientOptions = {
  /** Use an existing worker or port (tests, custom bundling). Default: spawns ./worker.ts as a module worker. */
  worker?: WorkerLike | (() => WorkerLike);
};

export async function createSimClient(opts: SimClientOptions = {}): Promise<SimClient> {
  const w: WorkerLike = opts.worker
    ? typeof opts.worker === "function"
      ? opts.worker()
      : opts.worker
    : (new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike);

  const snapListeners = new Set<SnapshotListener>();
  const audioListeners = new Set<AudioListener>();
  const replies = new Map<number, (s: Snapshot) => void>();
  let nextReq = 1;
  let time = 0;
  let running = false;
  let disposed = false;
  let resolveReady!: () => void;
  let rejectReady!: (err: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  if ("onerror" in w) {
    // A worker that fails to load (bad URL, syntax error) must not leave the caller waiting forever.
    w.onerror = (ev: unknown) => {
      const msg = ev && typeof ev === "object" && "message" in ev ? String((ev as { message: unknown }).message) : "worker failed";
      rejectReady(new Error(`Simulator worker error: ${msg}`));
    };
  }

  const send = (m: ToWorker) => {
    if (!disposed) w.postMessage(m);
  };
  const deliver = (s: Snapshot) => {
    time = s.t;
    for (const cb of snapListeners) cb(s);
  };

  w.onmessage = (ev: MessageEvent) => {
    const m = ev.data as FromWorker;
    switch (m.type) {
      case "ready":
        resolveReady();
        break;
      case "snapshot":
        deliver(m.snapshot);
        break;
      case "reply": {
        const r = replies.get(m.req);
        replies.delete(m.req);
        deliver(m.snapshot);
        r?.(m.snapshot);
        break;
      }
      case "audio":
        for (const cb of audioListeners) cb(m.samples, m.sampleRate);
        break;
      case "error":
        console.error(`[sim worker] ${m.message}`);
        break;
    }
  };

  const request = (make: (req: number) => ToWorker) =>
    new Promise<Snapshot>((resolve) => {
      const req = nextReq++;
      replies.set(req, resolve);
      send(make(req));
    });

  await ready;

  return {
    load: (netlist: Netlist) => send({ type: "load", netlist }),
    setInput: (id: string, key: InputKey, value: InputValue) => send({ type: "setInput", id, key, value }),
    run: (o: RunOptions = {}) => {
      running = true;
      send({ type: "run", speed: o.speed ?? 1 });
    },
    pause: () => {
      running = false;
      send({ type: "pause" });
    },
    step: (dt: number) => request((req) => ({ type: "step", dt, req })),
    snapshot: () => request((req) => ({ type: "snapshot", req })),
    onSnapshot: (cb: SnapshotListener) => {
      snapListeners.add(cb);
      return () => snapListeners.delete(cb);
    },
    onAudio: (cb: AudioListener) => {
      audioListeners.add(cb);
      if (audioListeners.size === 1) send({ type: "audio", enabled: true });
      return () => {
        audioListeners.delete(cb);
        if (audioListeners.size === 0) send({ type: "audio", enabled: false });
      };
    },
    dispose: () => {
      if (disposed) return;
      send({ type: "dispose" });
      disposed = true;
      running = false;
      snapListeners.clear();
      audioListeners.clear();
      w.onmessage = null;
      if (w.terminate) w.terminate();
      else w.close?.();
    },
    get time() {
      return time;
    },
    get running() {
      return running;
    },
  };
}
