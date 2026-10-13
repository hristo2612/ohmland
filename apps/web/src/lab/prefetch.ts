/**
 * Warm the lab before the learner reaches it: the lab step's code, the lab definition, the 3D bench chunk and the
 * simulator worker. Light on purpose (dynamic imports only), so the lesson player can import it.
 */
import type { SimClient } from "@ohmland/sim";
import { loadLab } from "./labs";

let warmSim: Promise<SimClient> | null = null;
const warmed = new Set<string>();

export function prefetchLab(labId: string): void {
  if (warmed.has(labId)) return;
  warmed.add(labId);
  void import("./LabStep").catch(() => undefined);
  void import("./BenchView").catch(() => undefined);
  void loadLab(labId).catch(() => undefined);
  if (!warmSim) {
    warmSim = import("@ohmland/sim/client").then((m) => m.createSimClient());
    warmSim.catch(() => {
      warmSim = null;
    });
  }
}

/** A simulator client: the warm one when there is one (each is handed out once), else a new one. */
export function takeSim(): Promise<SimClient> {
  const s = warmSim;
  warmSim = null;
  return s ?? import("@ohmland/sim/client").then((m) => m.createSimClient());
}
