// <BenchInk />: the 2D ink view of the workbench. A top-down SVG drawing of the same BenchState as the 3D <Bench>,
// driven by the same store, actions and simulator snapshots. See docs/BENCH-VIEWS.md.

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useStore } from "zustand";
import type { Snapshot } from "@ohmland/sim";
import { boardGeometry } from "../board";
import { LabelsContext } from "../labels";
import { connectivity } from "../netlist";
import { BenchStoreContext, createBenchStore, type BenchStore } from "../store";
import type { BenchAction, BenchState, Quality, TrayItem } from "../types";
import type { BenchController, ScreenPoint } from "../view/controller";
import { fitRect, growRect, rectOfPoints, type Pad, type Rect } from "./camera";
import { BoardBase, BoardHoles, BoardXray } from "./draw/Board";
import { GlowLayer, LeadView, PartView, SmokeLayer, WireView } from "./draw/layers";
import { Marks } from "./draw/Marks";
import { MeterBody, MeterLeads } from "./draw/Meter";
import { Readouts } from "./draw/Readouts";
import { DefsContext, InkDefs } from "./draw/shared";
import { n3 } from "./frame";
import { attachInteraction, type InkApi } from "./interaction";
import { KeyCursor, anchorName, handleInkKey, partName, startCursor, type KeyEnv } from "./keys";
import { mergeInkLabels, type InkLabels } from "./labels";
import { buildModel, targetOwners, targetPoint, targetsRect, type InkModel, type InkPick } from "./model";
import { InkOverlay, partDetail, useFollow } from "./Overlay";
import { INK_CSS } from "./styles";
import { InkView } from "./view";

export type BenchInkProps = {
  /** Starting bench (ignored when `store` is given). */
  initial?: BenchState;
  /** Drive the bench from your own store (see createBenchStore); share it with the 3D view to switch views freely. */
  store?: BenchStore;
  /** Parts the learner can drag in. */
  tray?: TrayItem[];
  /** Latest simulator snapshot: LED glow, damage, relay state, meter display. Leave out when you own the store. */
  snapshot?: Snapshot | null;
  /** Called after every committed change (not during drags). */
  onChange?: (bench: BenchState) => void;
  /** Every user action, including inputs to forward to the simulator. */
  onAction?: (action: BenchAction) => void;
  /** "low" drops the glow halos' rays and the smoke animation. */
  quality?: Quality;
  readOnly?: boolean;
  /** Part ids the learner cannot move, rotate or delete (switches still flip and buttons still press). */
  locked?: string[];
  /** A desk rectangle [x0, z0, x1, z1] in mm to frame at the start and when the view is reset. */
  frame?: [number, number, number, number] | null;
  /** Part ids or anchors ("hole:e12", "pin:R1.a") to point out, for lab hints. */
  highlight?: string[];
  /** Translated UI strings (the shared BenchLabels plus the ink view's few, see INK_LABELS). */
  labels?: Partial<InkLabels>;
  /** Accepted for parity with the 3D view; the ink view frames the work area itself. */
  camera?: { position: [number, number, number]; target: [number, number, number] };
  className?: string;
  style?: CSSProperties;
  /** Called once the first drawing is on screen. */
  onReady?: () => void;
  /** Receives the BenchController (project, onViewChange, focus, spotlight), plus resetView and pickAt. */
  controllerRef?: React.MutableRefObject<BenchController | null>;
};

/** The ink view's controller: the shared contract plus a few helpers the 3D controller also has. */
export type InkController = BenchController & {
  resetView(): void;
  /** What the pointer would grab at a client (page) point. */
  pickAt(clientX: number, clientY: number): InkPick | null;
  /** The camera: desk point in the middle and px per mm. */
  camera(): { x: number; z: number; s: number };
};

/** The busy part of a breadboard: what sits in it and the jumpers, for framing on small screens. */
function busyRect(model: InkModel): Rect | null {
  const pts: [number, number][] = [];
  for (const pi of model.parts.values()) if (pi.mount === "board") pts.push(...Object.values(pi.legs));
  for (const wi of model.wires.values()) pts.push(wi.a, wi.b);
  return rectOfPoints(pts, 6);
}

export function BenchInk(props: BenchInkProps) {
  const { tray = [], snapshot = null, quality = "high", readOnly = false, highlight, className, style } = props;
  const [store] = useState(() => props.store ?? createBenchStore(props.initial));
  const labels = useMemo(() => mergeInkLabels(props.labels), [props.labels]);
  const defsId = `ohi${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const deskRef = useRef<SVGGElement | null>(null);
  const topRef = useRef<SVGGElement | null>(null);
  const [view] = useState(() => new InkView());
  const [keys] = useState(() => new KeyCursor());
  const api = useRef<InkApi | null>(null);
  const onAction = useRef(props.onAction);
  const onChange = useRef(props.onChange);
  onAction.current = props.onAction;
  onChange.current = props.onChange;
  const emit = useCallback((a: BenchAction) => onAction.current?.(a), []);
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  // Store wiring, as in the 3D view.
  useLayoutEffect(() => {
    store.setState({ emit });
  }, [store, emit]);
  useEffect(() => {
    if (props.snapshot !== undefined) store.setState({ snapshot });
  }, [store, snapshot, props.snapshot]);
  const lockedKey = (props.locked ?? []).join(",");
  useEffect(() => {
    store.setState({ locked: lockedKey ? lockedKey.split(",") : [] });
  }, [store, lockedKey]);
  const frameKey = props.frame ? props.frame.join(",") : "";
  useLayoutEffect(() => {
    if (props.frame !== undefined) store.setState({ frame: frameKey ? (frameKey.split(",").map(Number) as [number, number, number, number]) : null });
  }, [store, frameKey, props.frame]);
  useEffect(() => {
    // A drag changes the bench while its transaction is open and commits by closing it, so compare against the last
    // bench reported rather than the previous state.
    let reported = store.getState().bench;
    return store.subscribe((s) => {
      if (s.txBase || s.bench === reported) return;
      reported = s.bench;
      onChange.current?.(s.bench);
    });
  }, [store]);

  const bench = useStore(store, (s) => s.bench);
  const ui = useStore(store, (s) => s.ui);
  const ambient = useStore(store, (s) => s.ambient);
  const model = useMemo(() => buildModel(bench), [bench]);
  const modelRef = useRef<InkModel>(model);
  modelRef.current = model;

  // Size, compact layout (phones) and the space the chrome takes.
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setSize({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(element);
    return () => ro.disconnect();
  }, [element]);
  const compact = size.w > 0 && size.w < 640;
  const showTray = !readOnly && tray.length > 0;
  const pad = useMemo<Pad>(() => {
    const m = compact ? 14 : 28;
    return {
      top: m + 46,
      right: m,
      bottom: m + (showTray && compact ? 92 : 0) + (compact ? 10 : 40),
      left: m + (showTray && !compact ? 186 : 0),
    };
  }, [compact, showTray]);
  const padRef = useRef(pad);
  padRef.current = pad;

  /** The rectangle to frame: the lab's frame, else everything on a big screen, the work area on a phone. */
  const homeRect = useCallback((): Rect => {
    const f = store.getState().frame;
    if (f) return [f[0], f[1], f[2], f[3]];
    const m = modelRef.current;
    return compact ? m.work : m.bounds;
  }, [store, compact]);
  const fitHome = useCallback(
    (instant = false) => {
      // Generous paper round the work.
      const r = homeRect();
      const m = Math.max(4, Math.max(r[2] - r[0], r[3] - r[1]) * 0.06);
      const cam = fitRect(growRect(r, m), view.vp, padRef.current, 14);
      // On a phone a whole breadboard is too small to touch: frame the busy part of it at a usable scale instead
      // (the learner pans to the rest).
      const MIN_TOUCH = 3.6;
      if (compact && cam.s < MIN_TOUCH && !store.getState().frame) {
        const busy = busyRect(modelRef.current) ?? r;
        const c = fitRect(busy, view.vp, padRef.current, 14);
        view.fit(busy, padRef.current, { instant, max: 14 });
        if (c.s < MIN_TOUCH) view.set({ ...view.cam, s: MIN_TOUCH }, false);
        return;
      }
      view.fit(growRect(r, m), padRef.current, { instant, max: 14 });
    },
    [view, homeRect, compact, store],
  );

  // Camera: attach, fit once sized, keep the view on resize.
  useLayoutEffect(() => {
    view.attach(element, [deskRef.current, topRef.current]);
  }, [view, element]);
  useLayoutEffect(() => {
    if (!size.w || !size.h) return;
    const prev = { ...view.vp };
    view.resize(size.w, size.h);
    if (!view.fitted || !view.moved) fitHome(true);
    else if (prev.w > 1) view.set({ ...view.cam });
  }, [size.w, size.h, view, fitHome]);
  useEffect(() => () => view.dispose(), [view]);
  const [moved, setMoved] = useState(false);
  useEffect(() => view.onChange(() => setMoved(view.moved)), [view]);

  // Ready once the first drawing is painted.
  const ready = useRef(false);
  useEffect(() => {
    if (ready.current || !size.w) return;
    ready.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => props.onReady?.()));
  }, [size.w, props.onReady]);

  // Pointer interaction.
  useEffect(() => {
    if (!element) return;
    const { api: a, detach } = attachInteraction({ element, store, view, model: () => modelRef.current, readOnly: () => readOnlyRef.current, emit });
    api.current = a;
    return () => {
      detach();
      api.current = null;
    };
  }, [element, store, view, emit]);

  // Spotlight: dim everything but the targets (a generated CSS rule, so nothing re-renders).
  const [spot, setSpot] = useState<string[] | null>(null);
  const spotCss = useMemo(() => {
    if (!spot) return "";
    const owners = [...targetOwners(model, spot)];
    const not = owners.map((o) => `:not([data-own="${o.replace(/"/g, "")}"])`).join("");
    return `#${defsId}-svg [data-own]${not}{opacity:.16}`;
  }, [spot, model, defsId]);

  // Announcements for screen readers.
  const [said, setSaid] = useState("");
  const announce = useCallback((t: string) => setSaid(t), []);

  // Keyboard.
  const keyState = useSyncExternalStore(keys.subscribe, keys.get, keys.get);
  const cursorRef = useRef<SVGGElement | null>(null);
  const focusCursor = useCallback(() => {
    requestAnimationFrame(() => cursorRef.current?.focus({ preventScroll: true }));
  }, []);
  const keyEnv = (): KeyEnv => ({
    store,
    view,
    model: () => modelRef.current,
    api: () => api.current,
    keys,
    labels,
    readOnly,
    announce,
    focusCursor,
    fit: () => fitHome(false),
  });
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("select,input,textarea,[data-ink-ui]")) return;
    const kb = (e.target as Element).closest?.("[data-kb]")?.getAttribute("data-kb") ?? null;
    if (handleInkKey(e.nativeEvent, keyEnv(), kb)) e.preventDefault();
  };
  const onFocusIn = (e: React.FocusEvent) => {
    const kb = (e.target as Element).getAttribute?.("data-kb");
    if (!kb) return;
    const s = store.getState();
    if (kb.startsWith("part:")) s.select({ type: "part", id: kb.slice(5) });
    else if (kb.startsWith("wire:")) s.select({ type: "wire", id: kb.slice(5) });
    else if (kb.startsWith("clip:")) s.select({ type: "lead", id: kb.slice(5).split(".")[0]! });
    else if (kb === "dial" || kb === "meter" || kb.startsWith("probe:") || kb.startsWith("plug:")) s.select({ type: "meter", id: s.bench.meter?.id ?? "M1" });
    else if (kb === "cursor") startCursor(keyEnv());
    // Keep what has focus on screen.
    if (kb !== "cursor") {
      const p = targetPoint(modelRef.current, kb.startsWith("part:") ? kb : kb.startsWith("clip:") ? `lead:${kb.slice(5)}` : kb.startsWith("wire:") ? kb.slice(5) : kb === "dial" ? `part:${s.bench.meter?.id}/dial` : kb.startsWith("probe:") ? kb : `part:${s.bench.meter?.id}`);
      if (p) {
        const [sx, sy] = view.toScreen(p[0], p[1]);
        if (sx < 40 || sy < 40 || sx > view.vp.w - 40 || sy > view.vp.h - 40) view.glide({ ...view.cam, x: p[0], z: p[1] }, 260);
      }
    }
  };

  // Controller (docs/BENCH-VIEWS.md).
  const controllerRef = props.controllerRef;
  useEffect(() => {
    if (!controllerRef) return;
    const ctl: InkController = {
      project: (anchor: string): ScreenPoint | null => {
        const p = targetPoint(modelRef.current, anchor);
        if (!p) return null;
        const [x, y] = view.toScreen(p[0], p[1]);
        return { x, y, visible: x >= 0 && y >= 0 && x <= view.vp.w && y <= view.vp.h };
      },
      onViewChange: (cb) => view.onChange(cb),
      focus: (targets, opts) => {
        const r = targets.length ? targetsRect(modelRef.current, targets) : homeRect();
        if (!r) return;
        const p = opts?.padding ?? 48;
        const base = padRef.current;
        // Generous room round the parts in play, never closer than a comfortable reading scale.
        view.fit(growRect(r, 3), { top: base.top + p * 0.5, right: base.right + p, bottom: base.bottom + p * 0.5, left: base.left + p }, { instant: !!opts?.instant, max: 18 });
      },
      spotlight: (targets) => setSpot(targets && targets.length ? [...targets] : null),
      resetView: () => fitHome(false),
      pickAt: (cx, cy) => api.current?.pickAt(cx, cy) ?? null,
      camera: () => ({ ...view.cam }),
    };
    controllerRef.current = ctl;
    return () => {
      if (controllerRef.current === ctl) controllerRef.current = null;
    };
  }, [controllerRef, view, homeRect, fitHome]);

  // X-ray: everything joined to the hovered hole or lead.
  const conn = useMemo(() => (ui.hover ? connectivity(bench) : null), [ui.hover, bench]);
  const xr = useMemo(() => {
    if (!ui.hover || !conn || !bench.board) return null;
    const geom = boardGeometry(bench.board);
    const strips = new Set<string>();
    const pins: string[] = [];
    for (const m of conn.members(ui.hover)) {
      if (m.startsWith("hole:")) {
        const h = geom.holes.get(m.slice(5));
        if (h) strips.add(h.strip);
      } else if (m.startsWith("pin:") || m.startsWith("wire:")) pins.push(m);
    }
    return { strips, pins };
  }, [ui.hover, conn, bench.board]);

  const hintParts = useMemo(() => (highlight ?? []).filter((h) => !h.includes(":")), [highlight]);
  const hintAnchors = useMemo(() => (highlight ?? []).filter((h) => h.includes(":")), [highlight]);
  const parts = useMemo(() => [...model.parts.values()], [model]);
  const dimRoom = ambient < 0.98;

  // Names for screen readers.
  const nameOf = (id: string) => partName(bench, id, labels, partDetail);
  const cursor = keyState.cursor;
  const cursorLabel = cursor ? (cursor.anchor ? anchorName(bench, cursor.anchor, labels) : labels.cursor) : labels.cursor;

  // Hover tag: the name of the hole under the pointer or cursor, written in blue beside it.
  const hoverAnchor = ui.hover?.startsWith("hole:") ? ui.hover : null;
  const tagRef = useFollow(
    useCallback((cb: () => void) => view.onChange(cb), [view]),
    () => {
      if (!hoverAnchor || compact) return null;
      const p = targetPoint(modelRef.current, hoverAnchor);
      if (!p) return null;
      const [x, y] = view.toScreen(p[0], p[1]);
      return { x, y };
    },
  );

  return (
    <BenchStoreContext.Provider value={store}>
      <LabelsContext.Provider value={labels}>
        <DefsContext.Provider value={defsId}>
          <div
            ref={setElement}
            className={className ? `ohi-root ${className}` : "ohi-root"}
            data-quality={quality}
            tabIndex={0}
            role="application"
            aria-label={labels.inkCanvas}
            aria-roledescription="workbench"
            onKeyDown={onKey}
            onKeyUp={onKey}
            onFocus={onFocusIn}
            style={style}
          >
            <style>{INK_CSS}</style>
            {spotCss && <style>{spotCss}</style>}
            <svg id={`${defsId}-svg`} className={`ohi-svg${spot ? " is-spot" : ""}`} xmlns="http://www.w3.org/2000/svg">
              <InkDefs id={defsId} />
              <g ref={deskRef}>
                {bench.board && (
                  <>
                    <BoardBase spec={bench.board} />
                    <BoardXray spec={bench.board} all={ui.xray} lit={xr?.strips ?? null} />
                    <BoardHoles spec={bench.board} />
                  </>
                )}
                {parts
                  .filter((p) => p.layer === 0)
                  .map((pi) => (
                    <PartView key={pi.part.id} pi={pi} store={store} name={nameOf(pi.part.id)} />
                  ))}
                {!dimRoom && <GlowLayer parts={parts} store={store} defs={defsId} quality={quality} />}
                {[...model.wires.values()].map((wi) => (
                  <WireView key={wi.wire.id} wi={wi} name={`${labels.wire} ${wi.wire.id}, ${wi.wire.a} ${wi.wire.b}`} />
                ))}
                {parts
                  .filter((p) => p.layer > 0)
                  .map((pi) => (
                    <PartView key={pi.part.id} pi={pi} store={store} name={nameOf(pi.part.id)} />
                  ))}
                {model.meter && <MeterBody mi={model.meter} store={store} name={labels.meter} />}
                {[...model.leads.values()].map((li) => (
                  <LeadView key={li.lead.id} li={li} held={keyState.carry?.kind === "clip" && keyState.carry.id === li.lead.id ? keyState.carry.end : null} names={[`${labels.testLead} ${li.lead.id} a`, `${labels.testLead} ${li.lead.id} b`]} />
                ))}
                {model.meter && <MeterLeads mi={model.meter} held={keyState.carry?.kind === "probe" ? keyState.carry.color : null} labels={labels} />}
                <SmokeLayer parts={parts} store={store} />
              </g>
              {dimRoom && <rect width="100%" height="100%" className="ohi-room" style={{ opacity: Math.min(0.82, (1 - ambient) * 0.9) }} />}
              <g ref={topRef}>
                {dimRoom && <GlowLayer parts={parts} store={store} defs={defsId} quality={quality} />}
                <Marks model={model} ui={ui} hintParts={hintParts} hintAnchors={hintAnchors} spot={spot} litPins={xr?.pins ?? []} />
                <g
                  ref={cursorRef}
                  data-kb="cursor"
                  tabIndex={0}
                  role="button"
                  aria-label={cursorLabel}
                  transform={cursor ? `translate(${n3(cursor.pos[0])} ${n3(cursor.pos[1])})` : undefined}
                  className="ohi-cursor"
                >
                  {cursor && <circle r={2.2} className="cursor" />}
                </g>
              </g>
            </svg>
            <div ref={tagRef} className="ohi-tag" aria-hidden="true">
              {hoverAnchor ? hoverAnchor.slice(5) : ""}
            </div>
            <Readouts store={store} model={model} view={view} labels={labels} />
            <InkOverlay
              store={store}
              labels={labels}
              tray={tray}
              readOnly={readOnly}
              compact={compact}
              api={api}
              size={size}
              moved={moved}
              onFit={() => fitHome(false)}
              onZoom={(f) => view.zoomAt(view.vp.w / 2, view.vp.h / 2, f)}
              onArmKey={() => {
                startCursor(keyEnv());
                focusCursor();
              }}
            />
            <div className="ohi-sr" aria-live="polite">
              {said}
            </div>
          </div>
        </DefsContext.Provider>
      </LabelsContext.Provider>
    </BenchStoreContext.Provider>
  );
}
