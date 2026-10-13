// Worker side of the client protocol: drives an in-thread simulation from messages.

import type { SimulationOptions } from "./api";
import type { FromWorker, PortLike, ToWorker } from "./protocol";
import { SimulationImpl } from "./simulation";

export function attachSimHost(port: PortLike, opts: SimulationOptions = {}): SimulationImpl {
  const sim = new SimulationImpl(opts);
  const post = (m: FromWorker, transfer?: Transferable[]) => port.postMessage(m, transfer);
  let quiet = false;
  sim.onSnapshot((snapshot) => {
    if (!quiet) post({ type: "snapshot", snapshot });
  });
  let audioOff: (() => void) | null = null;

  port.onmessage = (ev: MessageEvent) => {
    const m = ev.data as ToWorker;
    try {
      switch (m.type) {
        case "load":
          sim.load(m.netlist);
          break;
        case "setInput":
          sim.setInput(m.id, m.key, m.value);
          break;
        case "run":
          sim.run({ speed: m.speed });
          break;
        case "pause":
          sim.pause();
          break;
        case "step": {
          quiet = true;
          const snapshot = sim.step(m.dt);
          quiet = false;
          post({ type: "reply", req: m.req, snapshot });
          break;
        }
        case "snapshot":
          post({ type: "reply", req: m.req, snapshot: sim.snapshot() });
          break;
        case "audio":
          if (m.enabled && !audioOff) {
            audioOff = sim.onAudio((samples, sampleRate) => post({ type: "audio", samples, sampleRate }, [samples.buffer]));
          } else if (!m.enabled && audioOff) {
            audioOff();
            audioOff = null;
          }
          break;
        case "dispose":
          sim.dispose();
          port.onmessage = null;
          break;
      }
    } catch (err) {
      quiet = false;
      post({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };
  post({ type: "ready" });
  return sim;
}
