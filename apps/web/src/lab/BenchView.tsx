/**
 * The 3D workbench for a lab or the sandbox. This module is the only one in src/lab that imports three.js (through
 * @ohmland/bench), so it is its own lazy chunk; the panels render before it arrives.
 */
import { useEffect, useRef } from "react";
import { Bench, prepareBench, type Bench3DController, type TrayItem } from "@ohmland/bench";
import { m } from "../i18n";
import type { Quality } from "./quality";
import type { LabRuntime } from "./runtime";

export type BenchViewProps = {
  runtime: LabRuntime;
  tray: TrayItem[];
  quality: Quality;
  readOnly?: boolean;
  highlight?: string[] | undefined;
  locked?: string[];
  /** The desk rectangle to frame, from the lab's bench config. */
  frame?: [number, number, number, number] | null;
  onReady?: () => void;
};

/** A test and tutorial hook: where an anchor is on screen, and what the lab state is. */
type LabHook = {
  project(anchor: string): { x: number; y: number } | null;
  pickAt(x: number, y: number): unknown;
  bench(): unknown;
  status(): Record<string, string>;
  meter(): unknown;
  part(id: string): unknown;
  /** Simulated time and lag (0..1) of the latest snapshot. */
  sim(): { t: number; lag: number } | null;
  /** Plays a task's part of the solution on the bench ("Show me"), for tests and screenshots. */
  showMe(taskId: string): Promise<void>;
  /** A lab panel's state. */
  panel(id: string): unknown;
  /** Applies one solution step to the bench, as a learner's move would (bench lessons; for scripts on small screens). */
  step?(s: unknown): void;
  /** Which view draws the bench ("3d" or "ink"; bench lessons). */
  view?(): string;
};

declare global {
  interface Window {
    ohmlandLab?: LabHook;
  }
}

/** Draws the bench's procedural textures ahead of time (prefetch.ts calls it while the browser is idle). */
export const prepare = prepareBench;

export default function BenchView({ runtime, tray, quality, readOnly, highlight, locked, frame, onReady }: BenchViewProps) {
  const ctrl = useRef<Bench3DController | null>(null);
  useEffect(() => {
    window.ohmlandLab = {
      project: (anchor) => ctrl.current?.projectClient(anchor) ?? null,
      pickAt: (x, y) => ctrl.current?.pickAt(x, y) ?? null,
      bench: () => runtime.store.getState().bench,
      status: () => ({ ...runtime.session.status }),
      meter: () => runtime.session.view().meter,
      part: (id) => runtime.store.getState().snapshot?.parts[id] ?? null,
      sim: () => {
        const s = runtime.store.getState().snapshot;
        return s ? { t: s.t, lag: s.lag ?? 0 } : null;
      },
      showMe: (taskId) => runtime.showMe(taskId),
      panel: (id) => runtime.session.panels[id] ?? null,
    };
    return () => {
      delete window.ohmlandLab;
    };
  }, [runtime]);
  return (
    <Bench
      store={runtime.store}
      tray={tray}
      quality={quality}
      readOnly={!!readOnly}
      highlight={highlight}
      locked={locked}
      frame={frame ?? null}
      labels={m.benchUi}
      onAction={runtime.onAction}
      controllerRef={ctrl}
      onReady={onReady}
    />
  );
}
