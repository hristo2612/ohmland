// <BenchInk />: the 2D ink view of the workbench. A top-down SVG drawing of the same BenchState as the 3D <Bench>,
// driven by the same store, actions and simulator snapshots. See docs/BENCH-VIEWS.md.

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { PITCH, boardGeometry } from "../board";
import { METER } from "../layout";
import { LabelsContext } from "../labels";
import { connectivity } from "../netlist";
import { BenchStoreContext, createBenchStore } from "../store";
import type { BenchAction } from "../types";
import type { BenchController, ScreenPoint } from "../view/controller";
import type { BenchRendererProps } from "../view/types";
import { NO_PAD, fitRect, growRect, rectOfPoints, unionRect, type Pad, type Rect } from "./camera";
import { BoardBase, BoardHoles, BoardXray } from "./draw/Board";
import { GlowLayer, LeadView, PartView, SmokeLayer, WireView } from "./draw/layers";
import { Marks } from "./draw/Marks";
import { BoxWires, InkOverlays, InkPush } from "./draw/Overlays";
import { MeterBody, MeterLeads } from "./draw/Meter";
import { Readouts } from "./draw/Readouts";
import { DefsContext, InkDefs } from "./draw/shared";
import { frameWithParts } from "../view/framing";
import { boxCorners, n3 } from "./frame";
import { attachInteraction, type InkApi } from "./interaction";
import { KeyCursor, anchorName, handleInkKey, partName, startCursor, type KeyEnv } from "./keys";
import { mergeInkLabels, type InkLabels } from "./labels";
import { buildModel, partBounds, targetOwners, targetPoint, targetRect, targetsRect, type InkModel, type InkPick } from "./model";
import { InkOverlay, partDetail, useFollow } from "./Overlay";
import { INK_CSS } from "./styles";
import { InkView } from "./view";
import { TagSlips, type SlipProjector } from "../view/TagSlips";
import { LOUPE, Loupe, createLoupeFeed } from "../view/Loupe";
import { BoardRuler } from "../view/Ruler";
import { SolderOverlay, type SolderViewApi } from "../solder/overlay/SolderOverlay";
import { IronLayer, ScorchLayer } from "./kinds/solder";
import { trayCoverOf } from "../view/tray-cover";

export type BenchInkProps = Omit<BenchRendererProps, "labels"> & {
  /** Translated UI strings (the shared BenchLabels plus the ink view's few, see INK_LABELS). */
  labels?: Partial<InkLabels>;
  /** Accepted for parity with the 3D view; the ink view frames the work area itself. */
  camera?: { position: [number, number, number]; target: [number, number, number] };
};


/** The ink view's controller: the shared contract plus a few helpers the 3D controller also has. */
export type InkController = BenchController & {
  /** Page (client) coordinates of a target, for tests and tutorials. */
  projectClient(target: string): { x: number; y: number } | null;
  /** The view shows its home framing (nothing has moved it). */
  atHome(): boolean;
  resetView(): void;
  /** What the pointer would grab at a client (page) point. */
  pickAt(clientX: number, clientY: number): InkPick | null;
  /** The camera: desk point in the middle and px per mm. */
  camera(): { x: number; z: number; s: number };
};

/** The target a focused element stands for, for its focus ring. */
function focusTarget(kb: string | null, meter: string | undefined): string | null {
  if (!kb) return null;
  if (kb.startsWith("part:")) return kb;
  if (kb.startsWith("clip:")) return `lead:${kb.slice(5)}`;
  if (kb.startsWith("probe:")) return kb;
  if (kb.startsWith("plug:")) return meter ? `part:${meter}/sockets` : null;
  if (kb === "dial") return meter ? `part:${meter}/dial` : null;
  if (kb.startsWith("wire:")) return kb.slice(5);
  return null;
}

/**
 * The loupe's picture in ink: a copy of the drawing (the desk and the marks over it, so the snap ring shows), made
 * again after each frame while the finger moves. A copy rather than SVG <use>: the drawing's styles reach it only as a
 * real descendant of the bench.
 */
function InkLens({ ids, view, x, y, d }: { ids: string[]; view: InkView; x: number; y: number; d: number }) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    let raf = 0;
    const copy = () => {
      const g = ref.current;
      if (!g) return;
      const parts: Node[] = [];
      for (const id of ids) {
        const src = document.getElementById(id);
        if (!src) continue;
        const c = src.cloneNode(true) as Element;
        c.removeAttribute("id");
        for (const el of c.querySelectorAll("[id],[tabindex]")) {
          el.removeAttribute("id");
          el.removeAttribute("tabindex");
        }
        parts.push(c);
      }
      g.replaceChildren(...parts);
    };
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(copy);
    };
    later();
    const off = view.onChange(later);
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, [ids.join(","), view, x, y]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <svg viewBox={`0 0 ${d} ${d}`} className="ohi-svg" aria-hidden="true">
      <g ref={ref} transform={`translate(${d / 2} ${d / 2}) scale(${LOUPE.zoom}) translate(${-x} ${-y})`} />
    </svg>
  );
}

/** How far a phone's home framing grows a lab's frame to take in a part cut by its edge (view/framing.ts). */
const PHONE_GROW = 1.7;

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
  const labelsNow = useRef(labels);
  labelsNow.current = labels;
  const defsId = `ohi${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const deskRef = useRef<SVGGElement | null>(null);
  const topRef = useRef<SVGGElement | null>(null);
  const [view] = useState(() => new InkView());
  const [keys] = useState(() => new KeyCursor());
  const [loupe] = useState(createLoupeFeed);
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
  const namesKey = JSON.stringify(props.names ?? {});
  useEffect(() => {
    store.setState({ names: JSON.parse(namesKey) as Record<string, string> });
  }, [store, namesKey]);
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
  const trayStripRef = useRef(0);
  trayStripRef.current = showTray && compact ? trayCoverOf("ink", tray.length, size.w).bottom : 0;
  /** The part of the view a docked panel covers (focus's `inset`): framing keeps clear of it. */
  const insetRef = useRef<Pad>(NO_PAD);
  /** The room to keep clear at each edge: the view's own chrome plus the docked panel. */
  const padNow = useCallback((): Pad => {
    const p = padRef.current;
    const i = insetRef.current;
    // A panel docked above the tray strip reports the strip in its inset too: count the strip once.
    const strip = trayStripRef.current;
    return { top: p.top + i.top, right: p.right + i.right, bottom: p.bottom + Math.max(0, i.bottom - strip), left: p.left + i.left };
  }, []);

  /**
   * The rectangle to frame: the lab's frame, with a part that pokes a little out of it taken in whole (parts are drawn
   * larger than life: a battery at its edge), else everything; on a phone with a breadboard, the board and its parts.
   */
  const homeRect = useCallback((): Rect => {
    const f = store.getState().frame;
    const m = modelRef.current;
    if (f) {
      const frame: Rect = [f[0], f[1], f[2], f[3]];
      const boxes = [...m.parts.values()].map(partBounds);
      if (m.meter) boxes.push(rectOfPoints(boxCorners(m.meter.f, [-METER.width / 2, -METER.length / 2, METER.width / 2, METER.length / 2]))!);
      return frameWithParts(frame, boxes, compact ? PHONE_GROW : undefined);
    }
    return compact && m.bench.board ? m.work : m.bounds;
  }, [store, compact]);
  const fitHomeNow = useCallback(
    (instant: boolean) => {
      // Generous paper round the work.
      const r = homeRect();
      const m = Math.max(4, Math.max(r[2] - r[0], r[3] - r[1]) * 0.06);
      const pad = padNow();
      const cam = fitRect(growRect(r, m), view.vp, pad, 14);
      // On a phone a whole breadboard is too small to touch: frame the busy part of it at a usable scale instead
      // (the learner pans to the rest).
      const MIN_TOUCH = 3.6;
      const busy = compact && cam.s < MIN_TOUCH && !store.getState().frame ? busyRect(modelRef.current) : null;
      if (busy) {
        const c = fitRect(busy, view.vp, pad, 14);
        view.fit(busy, pad, { instant, max: 14 });
        if (c.s < MIN_TOUCH) view.set({ ...view.cam, s: MIN_TOUCH }, false);
        return;
      }
      view.fit(growRect(r, m), pad, { instant, max: 14 });
    },
    [view, homeRect, compact, store, padNow],
  );
  /** What the view frames: home, or what focus() asked for. A resize frames it again (unless the learner moved). */
  const framing = useRef<{ targets: string[]; padding?: number; read?: number; near?: number; withHome?: boolean } | null>(null);
  const applyFraming = useCallback(
    (instant: boolean) => {
      if (!view.sized) return;
      const f = framing.current;
      const r = f && f.targets.length ? targetsRect(modelRef.current, f.targets) : null;
      if (!f || !r) {
        fitHomeNow(instant);
        return;
      }
      // Some bench round the targets: never tighter than about 24 mm, and never past a comfortable reading scale.
      const MIN = 24;
      const cx = (r[0] + r[2]) / 2;
      const cz = (r[1] + r[3]) / 2;
      const hw = Math.max(MIN, r[2] - r[0]) / 2;
      const hh = Math.max(MIN, r[3] - r[1]) / 2;
      const p = f.padding ?? 48;
      // The tray, the chrome and a docked panel come first; the margin round the targets takes at most a fifth of
      // the room they leave on each side, so the targets never shrink to nothing beside a tray and a dock.
      const base = padNow();
      const px = Math.min(p, Math.max(0, view.vp.w - base.left - base.right) * 0.2);
      const py = Math.min(p * 0.5, Math.max(0, view.vp.h - base.top - base.bottom) * 0.2);
      const pad = { top: base.top + py, right: base.right + px, bottom: base.bottom + py, left: base.left + px };
      const rect = growRect([cx - hw, cz - hh, cx + hw, cz + hh], 3);
      // Hands-on work comes no closer than its reading scale: the whole job stays in view (the loupe aims).
      const cap = f.read ? Math.min(18, f.read / PITCH) : 18;
      if (f.withHome && f.near !== undefined) {
        // The home view too, while it still shows the work close enough to aim at; else that close round the work.
        const home = homeRect();
        const ctx = unionRect(rect, growRect(home, Math.max(4, Math.max(home[2] - home[0], home[3] - home[1]) * 0.06)))!;
        if (fitRect(ctx, view.vp, pad, cap).s >= f.near) {
          view.fit(ctx, pad, { instant, max: cap });
          return;
        }
        view.fit(rect, pad, { instant, max: Math.min(cap, Math.max(f.near, 0.6)) });
        return;
      }
      view.fit(rect, pad, { instant, max: cap });
    },
    [view, fitHomeNow, padNow, homeRect],
  );
  const fitHome = useCallback(
    (instant = false) => {
      framing.current = null;
      applyFraming(instant);
    },
    [applyFraming],
  );

  // Camera: attach, fit once sized, keep the view on resize.
  useLayoutEffect(() => {
    view.attach(element, [deskRef.current, topRef.current]);
  }, [view, element]);
  useLayoutEffect(() => {
    if (!size.w || !size.h) return;
    const prev = { ...view.vp };
    view.resize(size.w, size.h);
    if (!view.fitted || !view.moved) applyFraming(true);
    else if (prev.w > 1) view.set({ ...view.cam });
  }, [size.w, size.h, view, applyFraming]);
  // Overlays follow what moves on the bench (a dragged part, a clip), at most once a frame.
  useEffect(() => store.subscribe((s, prev) => s.bench !== prev.bench && view.ping()), [store, view]);
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
    const { api: a, detach } = attachInteraction({
      element,
      store,
      view,
      model: () => modelRef.current,
      readOnly: () => readOnlyRef.current,
      emit,
      loupe: { feed: loupe, labels: () => labelsNow.current },
    });
    api.current = a;
    return () => {
      detach();
      api.current = null;
    };
  }, [element, store, view, emit, loupe]);

  // The solder overlay draws over this view through the same projection.
  const solderView = useMemo<SolderViewApi>(
    () => ({
      project: (t) => {
        const p = targetPoint(modelRef.current, t);
        if (!p) return null;
        const [x, y] = view.toScreen(p[0], p[1]);
        return { x, y, visible: x >= -20 && y >= -20 && x <= view.vp.w + 20 && y <= view.vp.h + 20 };
      },
      onViewChange: (cb) => view.onChange(cb),
      desk: (x, y) => view.toWorld(x, y),
    }),
    [view],
  );

  // Readable tags on a phone (view/TagSlips.tsx): where a target is now, and when the view moves.
  const slipProjector = useMemo<SlipProjector>(
    () => ({
      project: (t) => {
        const p = targetPoint(modelRef.current, t);
        if (!p) return null;
        const [x, y] = view.toScreen(p[0], p[1]);
        return { x, y, visible: x >= 0 && y >= 0 && x <= view.vp.w && y <= view.vp.h };
      },
      onViewChange: (cb) => view.onChange(cb),
    }),
    [view],
  );

  // Spotlight: dim everything but the targets (a generated CSS rule, so nothing re-renders).
  const [spot, setSpot] = useState<string[] | null>(null);
  const [quietPins, setQuietPins] = useState(false);
  const spotCss = useMemo(() => {
    if (!spot) return "";
    const owners = [...targetOwners(model, spot)];
    const not = owners.map((o) => `:not([data-own="${o.replace(/"/g, "")}"])`).join("");
    // Parts fade almost away; the board stays as quiet context.
    const dim = `#${defsId}-svg [data-own]${not}{opacity:.26}`;
    // A spotlit chip or display shows its pin numbers, unless a pin check hushes them (even up close).
    const pins = owners
      .map((o) => `#${defsId}-svg.is-spot [data-own="${o.replace(/"/g, "")}"] .pinno{display:${quietPins ? "none !important" : "inline"}}`)
      .join("");
    return (owners.includes("board") ? dim : `${dim}#${defsId}-svg.is-spot [data-own="board"]{opacity:.32 !important}`) + pins;
  }, [spot, quietPins, model, defsId]);

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
  // The keyboard's focus ring (drawn as a mark: an SVG outline would scale with the drawing).
  const [focusKb, setFocusKb] = useState<string | null>(null);
  const onFocusOut = () => setFocusKb(null);
  const onFocusIn = (e: React.FocusEvent) => {
    const kb = (e.target as Element).getAttribute?.("data-kb");
    const visible = !!(e.target as Element).matches?.(":focus-visible");
    setFocusKb(kb && kb !== "cursor" && visible ? kb : null);
    if (!kb) return;
    const s = store.getState();
    if (kb.startsWith("part:")) s.select({ type: "part", id: kb.slice(5) });
    else if (kb.startsWith("wire:")) s.select({ type: "wire", id: kb.slice(5) });
    else if (kb.startsWith("clip:")) s.select({ type: "lead", id: kb.slice(5).split(".")[0]! });
    else if (kb === "dial" || kb === "meter" || kb.startsWith("probe:") || kb.startsWith("plug:")) s.select({ type: "meter", id: s.bench.meter?.id ?? "M1" });
    else if (kb === "cursor") startCursor(keyEnv());
    // Keep what the keyboard focused on screen, whole (a click already shows where it is): glide over, and zoom out
    // if it does not fit, never in.
    if (kb !== "cursor" && visible) {
      const t = focusTarget(kb, s.bench.meter?.id);
      const r = t ? targetRect(modelRef.current, t) : null;
      if (r) {
        const [x0, y0] = view.toScreen(r[0], r[1]);
        const [x1, y1] = view.toScreen(r[2], r[3]);
        const p = padNow();
        if (x0 < p.left || y0 < p.top || x1 > view.vp.w - p.right || y1 > view.vp.h - p.bottom) {
          const cam = fitRect(growRect(r, 6), view.vp, p, view.cam.s);
          view.moved = true;
          view.glide({ ...cam, s: Math.min(view.cam.s, cam.s) }, 260);
        }
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
      projectClient: (target) => {
        const p = targetPoint(modelRef.current, target);
        if (!p || !element) return null;
        const r = element.getBoundingClientRect();
        const [x, y] = view.toScreen(p[0], p[1]);
        return { x: x + r.left, y: y + r.top };
      },
      onViewChange: (cb) => view.onChange(cb),
      focus: (targets, opts) => {
        framing.current = targets.length
          ? {
              targets: [...targets],
              ...(opts?.padding !== undefined ? { padding: opts.padding } : {}),
              ...(opts?.read ? { read: opts.read } : {}),
              ...(opts?.near !== undefined ? { near: opts.near } : {}),
              ...(opts?.withHome ? { withHome: true } : {}),
            }
          : null;
        const i = opts?.inset ?? {};
        insetRef.current = { top: i.top ?? 0, right: i.right ?? 0, bottom: i.bottom ?? 0, left: i.left ?? 0 };
        // The selection bar keeps clear of a docked panel too (styles.ts reads these).
        element?.style.setProperty("--ohi-inset-bottom", `${insetRef.current.bottom}px`);
        element?.style.setProperty("--ohi-inset-right", `${insetRef.current.right}px`);
        // Before the view has a size this waits; the first sizing frames it.
        applyFraming(!!opts?.instant);
      },
      spotlight: (targets, opts) => {
        setSpot(targets && targets.length ? [...targets] : null);
        setQuietPins(opts?.pins === false);
      },
      atHome: () => !view.moved && !framing.current,
      resetView: () => fitHome(false),
      pickAt: (cx, cy) => api.current?.pickAt(cx, cy) ?? null,
      camera: () => ({ ...view.cam }),
    };
    controllerRef.current = ctl;
    return () => {
      if (controllerRef.current === ctl) controllerRef.current = null;
    };
  }, [controllerRef, view, element, applyFraming, fitHome]);

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
            className={className ? `ohi-root ohb-ink ${className}` : "ohi-root ohb-ink"}
            data-quality={quality}
            data-theme={props.theme}
            tabIndex={0}
            role="application"
            aria-label={labels.inkCanvas}
            aria-roledescription="workbench"
            onKeyDown={onKey}
            onKeyUp={onKey}
            onFocus={onFocusIn}
            onBlur={onFocusOut}
            style={style}
          >
            <style>{INK_CSS}</style>
            {spotCss && <style>{spotCss}</style>}
            <svg id={`${defsId}-svg`} className={`ohi-svg${spot ? " is-spot" : ""}`} xmlns="http://www.w3.org/2000/svg">
              <InkDefs id={defsId} />
              <g ref={deskRef} id={`${defsId}-desk`}>
                {bench.board && (
                  <>
                    <BoardBase spec={bench.board} />
                    <BoardXray spec={bench.board} all={ui.xray} lit={xr?.strips ?? null} />
                    <BoardHoles spec={bench.board} />
                  </>
                )}
                <ScorchLayer store={store} />
                {parts
                  .filter((p) => p.layer === 0 && p.along === undefined)
                  .map((pi) => (
                    <PartView key={pi.part.id} pi={pi} store={store} name={nameOf(pi.part.id)} />
                  ))}
                {!dimRoom && <GlowLayer parts={parts} store={store} defs={defsId} quality={quality} />}
                {[...model.wires.values()].map((wi) => (
                  <WireView key={wi.wire.id} wi={wi} name={`${labels.wire} ${wi.wire.id}, ${wi.wire.a} ${wi.wire.b}`} />
                ))}
                {parts
                  .filter((p) => p.layer > 0 && p.along === undefined)
                  .map((pi) => (
                    <PartView key={pi.part.id} pi={pi} store={store} name={nameOf(pi.part.id)} />
                  ))}
                <BoxWires model={model} />
                {model.meter && <MeterBody mi={model.meter} store={store} name={labels.meter} />}
                <InkPush model={model} store={store} defs={defsId} />
                {[...model.leads.values()].map((li) => (
                  <LeadView key={li.lead.id} li={li} held={keyState.carry?.kind === "clip" && keyState.carry.id === li.lead.id ? keyState.carry.end : null} names={[`${labels.testLead} ${li.lead.id} a`, `${labels.testLead} ${li.lead.id} b`]} />
                ))}
                {model.meter && <MeterLeads mi={model.meter} held={keyState.carry?.kind === "probe" ? keyState.carry.color : null} labels={labels} />}
                <InkOverlays model={model} store={store} />
                {/* Gates ride the cables, over the leads and the dots. */}
                {parts
                  .filter((p) => p.along !== undefined)
                  .map((pi) => (
                    <PartView key={pi.part.id} pi={pi} store={store} name={nameOf(pi.part.id)} />
                  ))}
                <SmokeLayer parts={parts} store={store} />
                <IronLayer store={store} bench={bench} />
              </g>
              {dimRoom && <rect width="100%" height="100%" className="ohi-room" style={{ opacity: Math.min(0.82, (1 - ambient) * 0.9) }} />}
              <g ref={topRef} id={`${defsId}-top`}>
                {dimRoom && <GlowLayer parts={parts} store={store} defs={defsId} quality={quality} />}
                <Marks model={model} ui={ui} hintParts={hintParts} hintAnchors={hintAnchors} spot={spot} litPins={xr?.pins ?? []} focus={focusTarget(focusKb, bench.meter?.id)} />
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
            <Readouts store={store} model={model} view={view} labels={labels} spot={spot} compact={compact} />
            <TagSlips store={store} spot={spot} compact={compact} projector={slipProjector} />
            <BoardRuler store={store} projector={slipProjector} size={size} />
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
              onArmKey={() => {
                startCursor(keyEnv());
                focusCursor();
              }}
            />
            <SolderOverlay store={store} view={solderView} compact={compact} readOnly={readOnly} tray={showTray} />
            {/* The touch loupe: the drawing under the finger, cloned twice life size. */}
            <Loupe
              feed={loupe}
              size={size}
              lens={(st, d) => <InkLens ids={[`${defsId}-desk`, `${defsId}-top`]} view={view} x={st.x} y={st.y} d={d} />}
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
