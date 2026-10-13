/**
 * Warm the lab before the learner reaches it: the lab step's code, the lab definition, the 3D bench chunk and the
 * simulator worker, all at once. Light on purpose (dynamic imports only), so the lesson player can import it.
 *
 * The lab step and the bench are "preloadable" components: once their chunk is in they render straight away, with no
 * Suspense fallback (React holds a revealed fallback back for 300 ms, which twice over was most of a warm lab's wait).
 */
import { createElement, lazy, type ComponentType, type FunctionComponent } from "react";
import type { SimClient } from "@ohmland/sim";
import type { BenchViewProps } from "./BenchView";
import type { LabStepProps } from "./LabStep";
import { loadLab } from "./labs";

type Preloadable<P, M> = { preload(): Promise<M>; Component: FunctionComponent<P> };

/** A lazy component that renders at once, without suspending, when its chunk has already loaded. */
function preloadable<P extends object, M extends { default: ComponentType<P> }>(load: () => Promise<M>): Preloadable<P, M> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<M> | null = null;
  const preload = () =>
    (pending ??= load().then(
      (mod) => {
        loaded = mod.default;
        return mod;
      },
      (err: unknown) => {
        pending = null;
        throw err;
      },
    ));
  const Lazy = lazy(preload);
  const Component = (props: P) => createElement((loaded ?? Lazy) as ComponentType<P>, props);
  return { preload, Component };
}

export const LabStepChunk = preloadable<LabStepProps, typeof import("./LabStep")>(() => import("./LabStep"));
export const BenchViewChunk = preloadable<BenchViewProps, typeof import("./BenchView")>(() => import("./BenchView"));

/** Runs `fn` when the browser is idle (soon, where idle callbacks are missing). */
function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 200);
}

let warmSim: Promise<SimClient> | null = null;
const warmed = new Set<string>();

/** Starts loading everything a lab needs, in parallel. Safe to call often: each lab is warmed once. */
export function prefetchLab(labId: string): void {
  if (warmed.has(labId)) return;
  warmed.add(labId);
  void LabStepChunk.preload().catch(() => undefined);
  void BenchViewChunk.preload()
    .then((bench) => whenIdle(bench.prepare))
    .catch(() => undefined);
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
