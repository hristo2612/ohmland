/**
 * The bench behind the bench-view adapter (bench-view.ts): packages/bench's <BenchView>, which lazy-loads the 3D or
 * the ink renderer and hands out a controller hub that survives view switches (docs/BENCH-VIEWS.md).
 *
 * Until the ink renderer replaces its placeholder (INK_RENDERER in bench-view.ts), the ink view is the 3D bench seen
 * from straight above, so lessons keep working in both positions of the toggle.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Bench3DController, TrayItem } from "@ohmland/bench";
import { BenchView, preloadBenchView } from "@ohmland/bench/view";
import { m } from "../i18n";
import { INK_RENDERER, type BenchController, type BenchViewKind } from "./bench-view";
import type { SolutionStep } from "./define";
import type { Quality } from "./quality";
import type { LabRuntime } from "./runtime";
import { applyStep } from "./steps";

export type BenchSurfaceProps = {
  view: BenchViewKind;
  runtime: LabRuntime;
  tray: TrayItem[];
  quality: Quality;
  readOnly?: boolean;
  /** Lab hints: parts or anchors to point out. */
  highlight?: string[] | undefined;
  locked?: string[];
  /** The desk rectangle to frame, from the lab's bench config. */
  frame?: [number, number, number, number] | null;
  controllerRef: RefObject<BenchController | null>;
  onReady?: () => void;
};

/** Fetches the 3D renderer ahead of time (prefetch while the browser is idle). */
export const prepare = (): void => {
  void preloadBenchView("3d").catch(() => undefined);
};

/** The renderer that draws `view` today. */
const rendered = (view: BenchViewKind): BenchViewKind => (view === "ink" && !INK_RENDERER ? "3d" : view);

type Hub = BenchController & { inner(): BenchController | null };

export default function BenchSurface({ view, runtime, tray, quality, readOnly, highlight, locked, frame, controllerRef, onReady }: BenchSurfaceProps) {
  const [ready, setReady] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const hub = controllerRef as RefObject<Hub | null>;
  const inner3d = () => hub.current?.inner() as Bench3DController | null | undefined;
  const standIn = view === "ink" && !INK_RENDERER;

  // The ink stand-in: the 3D bench from straight above. Switching glides the camera.
  useEffect(() => {
    if (!ready || INK_RENDERER) return;
    const c = inner3d();
    if (standIn) c?.topView();
    else c?.resetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standIn, ready]);

  // The tray comes and goes with the lesson's beats: frame the bench again for the room that is left.
  const hasTray = tray.length > 0;
  const firstTray = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (firstTray.current) {
      firstTray.current = false;
      return;
    }
    const raf = requestAnimationFrame(() => {
      if (standIn) inner3d()?.topView();
      else inner3d()?.resetView();
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTray, ready]);

  // A test and tutorial hook, the same as the classic lab step's (apps/web/e2e/lab.ts drives it): page coordinates.
  useEffect(() => {
    window.ohmlandLab = {
      // Targets ("part:D1", anchors) through the view's controller; world points through the 3D one. Page px.
      project: (target) => {
        if (typeof target !== "string") return inner3d()?.projectClient(target as never) ?? null;
        const p = hub.current?.project(target);
        const r = host.current?.getBoundingClientRect();
        return p && r ? { x: p.x + r.left, y: p.y + r.top } : null;
      },
      pickAt: (x, y) => (hub.current?.inner() as { pickAt?(x: number, y: number): unknown } | null)?.pickAt?.(x, y) ?? null,
      bench: () => runtime.store.getState().bench,
      status: () => ({ ...runtime.session.status }),
      meter: () => runtime.session.view().meter,
      part: (id) => runtime.store.getState().snapshot?.parts[id] ?? null,
      sim: () => {
        const s = runtime.store.getState().snapshot;
        return s ? { t: s.t, lag: s.lag ?? 0 } : null;
      },
      view: () => rendered(view),
      showMe: (taskId) => runtime.showMe(taskId),
      panel: (id) => runtime.session.panels[id] ?? null,
      step: (s) => {
        const e = applyStep(runtime.store.getState().bench, s as SolutionStep);
        if (e.bench !== runtime.store.getState().bench) runtime.store.getState().apply(() => e.bench);
        for (const i of e.inputs) runtime.setInput(i.id, i.key, i.value);
      },
    };
    return () => {
      delete window.ohmlandLab;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, view]);

  const shown = useMemo(() => (highlight?.length ? highlight : undefined), [highlight]);

  return (
    <div ref={host} className="bench-surface" data-view={view} data-ink-stand-in={standIn || undefined} style={{ position: "absolute", inset: 0 }}>
      <BenchView
        view={rendered(view)}
        store={runtime.store}
        tray={tray}
        quality={quality}
        readOnly={!!readOnly}
        highlight={shown}
        locked={locked}
        frame={frame ?? null}
        labels={m.benchUi}
        onAction={runtime.onAction}
        controllerRef={controllerRef as { current: BenchController | null }}
        onReady={() => {
          setReady(true);
          onReady?.();
        }}
      />
    </div>
  );
}
