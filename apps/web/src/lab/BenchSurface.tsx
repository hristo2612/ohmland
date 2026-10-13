/**
 * The bench behind the bench-view adapter (bench-view.ts): today the 3D <Bench> from @ohmland/bench, with a
 * BenchController implemented on top of its camera helpers. The ink view is the same bench seen from straight above
 * until packages/bench ships its ink renderer; then this file renders <BenchView view> and hands its controller on.
 *
 * This module imports three.js (through @ohmland/bench), so it is its own lazy chunk.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Bench, partPose, prepareBench, type BenchController as Bench3D, type BenchState, type TrayItem } from "@ohmland/bench";
import { m } from "../i18n";
import type { BenchController, BenchViewKind, ScreenPoint } from "./bench-view";
import type { Quality } from "./quality";
import type { LabRuntime } from "./runtime";

export type BenchSurfaceProps = {
  view: BenchViewKind;
  runtime: LabRuntime;
  tray: TrayItem[];
  quality: Quality;
  readOnly?: boolean;
  /** Lab hints: parts or anchors to point out (merged with the controller's spotlight). */
  highlight?: string[] | undefined;
  locked?: string[];
  controllerRef: RefObject<BenchController | null>;
  onReady?: () => void;
};

/** Draws the bench's procedural textures ahead of time (prefetch.ts calls it while the browser is idle). */
export const prepare = prepareBench;

/** A point on a part to point at: the middle of its leads, a little above them (desk parts sit taller). */
function partPoint(bench: BenchState, id: string): [number, number, number] | null {
  const part = bench.parts.find((p) => p.id === id);
  if (!part) return null;
  const pose = partPose(bench, part);
  const legs = Object.values(pose.legs);
  if (pose.mount === "board" && legs.length) {
    const x = legs.reduce((s, l) => s + l[0], 0) / legs.length;
    const z = legs.reduce((s, l) => s + l[2], 0) / legs.length;
    return [x, Math.max(...legs.map((l) => l[1])) + 3, z];
  }
  const lift = part.kind === "battery" ? 14 : part.kind === "toggle-switch" ? 14 : 4;
  return [pose.origin[0], lift, pose.origin[2]];
}

export default function BenchSurface({ view, runtime, tray, quality, readOnly, highlight, locked, controllerRef, onReady }: BenchSurfaceProps) {
  const host = useRef<HTMLDivElement>(null);
  const inner = useRef<Bench3D | null>(null);
  const [spot, setSpot] = useState<string[] | null>(null);
  const [ready, setReady] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const listeners = new Set<() => void>();
    let raf = 0;
    let sig = "";
    // The 3D bench reports no camera events, so watch two fixed points on the desk and the element's size each frame
    // while anyone listens, and tell them when anything moved. Bench edits (a part moved) tell them too.
    const signature = () => {
      const r = host.current?.getBoundingClientRect();
      const a = inner.current?.project([0, 0, 0]);
      const b = inner.current?.project([100, 0, 60]);
      return [a?.x, a?.y, b?.x, b?.y, r?.left, r?.top, r?.width, r?.height].map((v) => Math.round((v ?? -1) * 4)).join(",");
    };
    const notify = () => listeners.forEach((cb) => cb());
    const tick = () => {
      raf = 0;
      if (!listeners.size) return;
      const s = signature();
      if (s !== sig) {
        sig = s;
        notify();
      }
      raf = requestAnimationFrame(tick);
    };
    const unsubBench = runtime.store.subscribe((s, prev) => {
      if (s.bench !== prev.bench && listeners.size) requestAnimationFrame(notify);
    });
    const controller: BenchController = {
      project(anchor) {
        const el = host.current;
        const c = inner.current;
        if (!el || !c) return null;
        let target: string | [number, number, number] = anchor;
        if (anchor.startsWith("part:")) {
          const p = partPoint(runtime.store.getState().bench, anchor.slice(5));
          if (!p) return null;
          target = p;
        }
        const p = c.project(target as never);
        if (!p) return null;
        const r = el.getBoundingClientRect();
        const pt: ScreenPoint = { x: p.x - r.left, y: p.y - r.top, visible: true };
        pt.visible = pt.x >= 0 && pt.y >= 0 && pt.x <= r.width && pt.y <= r.height;
        return pt;
      },
      onViewChange(cb) {
        listeners.add(cb);
        if (!raf) raf = requestAnimationFrame(tick);
        return () => {
          listeners.delete(cb);
        };
      },
      focus(targets) {
        // The 3D bench can only frame everything for now (BENCH-VIEWS.md asks packages/bench for real framing).
        if (targets.length) return;
        if (viewRef.current === "ink") inner.current?.topView();
        else inner.current?.resetView();
      },
      spotlight(targets) {
        setSpot(targets && targets.length ? targets : null);
      },
    };
    controllerRef.current = controller;
    return () => {
      cancelAnimationFrame(raf);
      unsubBench();
      listeners.clear();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [runtime, controllerRef]);

  // The ink stand-in: the same bench from straight above. Switching views glides the camera.
  useEffect(() => {
    if (!ready) return;
    if (view === "ink") inner.current?.topView();
    else inner.current?.resetView();
  }, [view, ready]);

  // A test and tutorial hook, the same as the classic lab step's (apps/web/e2e/lab.ts drives it): page coordinates.
  useEffect(() => {
    window.ohmlandLab = {
      project: (anchor) => {
        if (typeof anchor === "string" && anchor.startsWith("part:")) {
          const p = partPoint(runtime.store.getState().bench, anchor.slice(5));
          return p ? (inner.current?.project(p) ?? null) : null;
        }
        return inner.current?.project(anchor as never) ?? null;
      },
      pickAt: (x, y) => inner.current?.pickAt(x, y) ?? null,
      bench: () => runtime.store.getState().bench,
      status: () => ({ ...runtime.session.status }),
      meter: () => runtime.session.view().meter,
      part: (id) => runtime.store.getState().snapshot?.parts[id] ?? null,
      sim: () => {
        const s = runtime.store.getState().snapshot;
        return s ? { t: s.t, lag: s.lag ?? 0 } : null;
      },
    };
    return () => {
      delete window.ohmlandLab;
    };
  }, [runtime]);

  const shown = useMemo(() => {
    const all = [...(highlight ?? []), ...(spot ?? [])];
    return all.length ? [...new Set(all)] : undefined;
  }, [highlight, spot]);

  return (
    <div ref={host} className="bench-surface" data-view={view} data-ink-stand-in={view === "ink" || undefined} style={{ position: "absolute", inset: 0 }}>
      <Bench
        store={runtime.store}
        tray={tray}
        quality={quality}
        readOnly={!!readOnly}
        highlight={shown}
        locked={locked}
        labels={m.benchUi}
        onAction={runtime.onAction}
        controllerRef={inner}
        onReady={() => {
          setReady(true);
          onReady?.();
        }}
      />
    </div>
  );
}
