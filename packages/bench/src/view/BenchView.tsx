// <BenchView view="3d" | "ink" />: one bench, two renderers. Each renderer is its own lazy chunk, so the ink view never
// loads three.js and the 3D view never loads the ink renderer. Switching keeps the same store, so nothing is lost.

import { Suspense, lazy, useDeferredValue, useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { createBenchStore } from "../store";
import type { Vec3 } from "../types";
import { createControllerHub, type BenchController, type BenchViewKind } from "./controller";
import type { BenchRendererProps } from "./types";

export type BenchViewProps = BenchRendererProps & {
  view: BenchViewKind;
  /** 3D only: initial camera (defaults to a fit of the work area). */
  camera?: { position: Vec3; target: Vec3 };
  /** Shown while a renderer's code loads for the first time. Defaults to an empty sheet in the bench's place. */
  fallback?: ReactNode;
};

type Renderer = ComponentType<BenchRendererProps & { camera?: BenchViewProps["camera"] }>;

const loaders: Record<BenchViewKind, () => Promise<{ default: Renderer }>> = {
  "3d": () => import("../scene/Bench").then((m) => ({ default: m.Bench as Renderer })),
  ink: () => import("../ink").then((m) => ({ default: m.BenchInk as Renderer })),
};

const renderers: Record<BenchViewKind, Renderer> = {
  "3d": lazy(loaders["3d"]),
  ink: lazy(loaders.ink),
};

/** Fetch a renderer's code ahead of time (for instance while the learner reads the step before a lab). */
export function preloadBenchView(view: BenchViewKind): Promise<unknown> {
  return loaders[view]();
}

const SHEET: CSSProperties = { position: "absolute", inset: 0, background: "var(--paper, #F6F2E9)" };

export function BenchView(props: BenchViewProps) {
  const { view, fallback, controllerRef, store: given, initial, ...rest } = props;
  // One store for the life of the view, whichever renderer draws it.
  const [store] = useState(() => given ?? createBenchStore(initial));
  // A controller that survives view switches: overlays subscribe once.
  const [hub] = useState(createControllerHub);
  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = hub;
    return () => {
      if (controllerRef.current === hub) controllerRef.current = null;
    };
  }, [controllerRef, hub]);
  // The renderer writes its controller here; the hub follows it.
  const innerRef = useMemo(() => {
    let current: BenchController | null = null;
    return {
      get current() {
        return current;
      },
      set current(next: BenchController | null) {
        current = next;
        hub.attach(next);
      },
    };
  }, [hub]);
  // While the next renderer's code loads, keep showing the current one.
  const shown = useDeferredValue(view);
  const Renderer = renderers[shown];
  return (
    <Suspense fallback={fallback ?? <div className="ohb-root ohb-loading" style={SHEET} />}>
      <Renderer key={shown} {...rest} store={store} controllerRef={innerRef} />
    </Suspense>
  );
}
