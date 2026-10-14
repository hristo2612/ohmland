// <Bench />: the interactive 3D workbench, on a sheet of grid paper.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { boardGeometry, boardOrigin, holeWorld } from "../board";
import { BOARD_TOP } from "../dims";
import { LabelsContext, mergeLabels } from "../labels";
import { anchorPosition, benchBounds, fitCamera, workCenter } from "../layout";
import { connectivity } from "../netlist";
import { BenchStoreContext, createBenchStore, useBench, type BenchStore } from "../store";
import { heldOf, hiddenParts } from "../seats";
import type { BenchAction, BenchState, PlacedPart, Quality, Vec3 } from "../types";
import { Breadboard, XRAY_HEX } from "../models/Breadboard";
import { RoomLight } from "../models/common";
import { JumperWire } from "../models/Leads";
import { installPaperTone, paperizeScene, type PaperPalette } from "../three/paper";
import { Spotlight } from "../three/post";
import type { BenchController, FocusOptions, Inset, ScreenPoint } from "../view/controller";
import type { BenchRendererProps } from "../view/types";
import { Desk, StudioEnvironment, StudioLights } from "./Studio";
import { useInteraction, handleBenchKey, type InteractionApi } from "./Interaction";
import { Overlay, trayCover } from "./Overlay";
import { PaletteContext, useReadPalette } from "./palette";
import { Readouts, StressTags, inspectKey } from "./Readouts";
import { TagSlips } from "../view/TagSlips";
import type { Pick } from "./pick";
import { PaperRenderer, PaperUpkeep, SoftShadows, type ShadowArea } from "./Render";
import { SpotlightRig, ViewRig, type ViewApi } from "./viewRig";
import { SolderOverlay, type SolderViewApi } from "../solder/overlay/SolderOverlay";
import { IronModel, ScorchMarks } from "../models/Solder";
import { perfMount } from "../solder/perfboard";
import { LeadView, MeterView, PartView, TargetMarker, WireView, makeFloor, snapshotKey } from "./views";
import { BoxWires3D, Overlays3D } from "./Overlays3D";

export type BenchProps = BenchRendererProps & {
  /** Initial camera. Defaults to a framing of the work area. */
  camera?: { position: Vec3; target: Vec3 };
  /** Draw the notebook's margin line left of the work area (default true). */
  margin?: boolean;
};

/** The 3D view's controller: the shared BenchController plus camera and test helpers. */
export type Bench3DController = BenchController & {
  /** Element-relative CSS px of a target, or of a world point [x, y, z] in mm. */
  project(target: string | Vec3): ScreenPoint | null;
  /** Page (client) coordinates of a target or world point, for tests and tutorials. */
  projectClient(target: string | Vec3): { x: number; y: number } | null;
  topView(): void;
  resetView(): void;
  /** True while the camera shows the default framing of the work area. */
  atHome(): boolean;
  /** What the pointer would grab at a client point. */
  pickAt(clientX: number, clientY: number): Pick | null;
  /** Renderer statistics of the last frame (draw calls, triangles) for performance checks. */
  stats(): { calls: number; triangles: number; geometries: number; textures: number };
};

export function Bench(props: BenchProps) {
  const { tray = [], snapshot = null, quality = "high", readOnly = false, highlight, className, style } = props;
  const [store] = useState(() => props.store ?? createBenchStore(props.initial));
  const labels = useMemo(() => mergeLabels(props.labels), [props.labels]);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  elementRef.current = element;
  const palette = useReadPalette(element, props.theme);
  const api = useRef<InteractionApi | null>(null);
  const view = useRef<ViewApi | null>(null);
  const viewPad = useRef({ left: 0, bottom: 0 });
  /** The part of the view a docked panel covers (focus's `inset`): framing keeps clear of it. */
  const inset = useRef<Required<Inset>>({ top: 0, right: 0, bottom: 0, left: 0 });
  const onAction = useRef(props.onAction);
  const onChange = useRef(props.onChange);
  onAction.current = props.onAction;
  onChange.current = props.onChange;
  const emit = useCallback((a: BenchAction) => onAction.current?.(a), []);
  const [spotTargets, setSpotTargets] = useState<string[] | null>(null);
  // Listeners live here, not in the canvas, so a subscription made before the first frame still hears it.
  const listeners = useMemo(() => new Set<() => void>(), []);
  const notify = useCallback(() => {
    for (const cb of [...listeners]) {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    }
  }, [listeners]);
  const pendingFocus = useRef<{ targets: string[]; opts?: FocusOptions } | null>(null);

  const controller = useMemo<Bench3DController>(
    () => ({
      project: (t) => view.current?.project(t) ?? null,
      // Any target (a part, a mark, an anchor) in page coordinates, as the ink view's projectClient gives it.
      projectClient: (t) => {
        const p = typeof t === "string" ? view.current?.project(t) : null;
        if (p && elementRef.current) {
          const r = elementRef.current.getBoundingClientRect();
          return { x: p.x + r.left, y: p.y + r.top };
        }
        return api.current?.project(t as string) ?? null;
      },
      onViewChange: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      focus: (targets, opts) => {
        const i = opts?.inset ?? {};
        inset.current = { top: i.top ?? 0, right: i.right ?? 0, bottom: i.bottom ?? 0, left: i.left ?? 0 };
        // The selection bar keeps clear of a docked panel too (Overlay.tsx reads these).
        elementRef.current?.style.setProperty("--ohb-inset-bottom", `${inset.current.bottom}px`);
        elementRef.current?.style.setProperty("--ohb-inset-right", `${inset.current.right}px`);
        if (view.current) view.current.focus(targets, opts);
        else pendingFocus.current = { targets: [...targets], opts };
      },
      spotlight: (targets) => setSpotTargets(targets && targets.length ? [...targets] : null),
      topView: () => api.current?.topView(),
      resetView: () => api.current?.resetView(),
      atHome: () => view.current?.atHome() ?? true,
      pickAt: (x, y) => api.current?.pickAt(x, y) ?? null,
      stats: () => api.current?.stats() ?? { calls: 0, triangles: 0, geometries: 0, textures: 0 },
    }),
    [listeners],
  );
  // The solder overlay draws over this view through the same controller.
  const solderView = useMemo<SolderViewApi>(
    () => ({ project: (t) => controller.project(t), onViewChange: (cb) => controller.onViewChange(cb), desk: (x, y) => api.current?.deskAt(x, y) ?? null }),
    [controller],
  );
  const controllerRef = props.controllerRef;
  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = controller;
    return () => {
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [controllerRef, controller]);

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
    store.setState({ frame: frameKey ? (frameKey.split(",").map(Number) as [number, number, number, number]) : null });
  }, [store, frameKey]);
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

  // Compact layout for narrow containers (phones). Measured before the first paint so the camera fit knows.
  const [size, setSize] = useState(() => ({ w: typeof window !== "undefined" ? window.innerWidth : 1000, h: typeof window !== "undefined" ? window.innerHeight : 700 }));
  useLayoutEffect(() => {
    if (!element) return;
    setSize({ w: element.clientWidth, h: element.clientHeight });
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(element);
    return () => ro.disconnect();
  }, [element]);
  const compact = size.w < 640;
  const showTray = !readOnly && tray.length > 0;
  // Nothing is drawn until the scene's shaders have compiled (in parallel, off the main thread where the browser can),
  // so the first frame does not stall on them one by one.
  const [held, setHeld] = useState(true);
  const release = useCallback(() => setHeld(false), []);
  viewPad.current = showTray ? trayCover(tray.length, compact) : { left: 0, bottom: 0 };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("select,input,textarea")) return;
    if (handleBenchKey(e.nativeEvent, store, api.current, readOnly)) e.preventDefault();
  };
  installPaperTone();

  return (
    <BenchStoreContext.Provider value={store}>
      <LabelsContext.Provider value={labels}>
        <PaletteContext.Provider value={palette}>
          <div
            ref={setElement}
            className={className ? `ohb-root ${className}` : "ohb-root"}
            data-dark={palette.dark || undefined}
            tabIndex={0}
            role="application"
            aria-label={labels.canvas}
            onKeyDown={onKey}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") handleBenchKey(e.nativeEvent, store, api.current, readOnly);
            }}
            style={{ position: "relative", width: "100%", height: "100%", touchAction: "none", outline: "none", overflow: "hidden", background: palette.paper, ...style }}
          >
            <Canvas
              frameloop={held ? "never" : "demand"}
              shadows={quality === "high" ? "percentage" : false}
              dpr={[1, quality === "high" ? 2 : 1.5]}
              camera={{ fov: 32, near: 2, far: 6000, position: [0, 320, 360] }}
              gl={{ antialias: quality === "low", alpha: false, toneMapping: THREE.CustomToneMapping, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
              style={{ position: "absolute", inset: 0 }}
            >
              <BenchScene
                store={store}
                element={element}
                api={api}
                view={view}
                readOnly={readOnly}
                quality={quality}
                highlight={highlight}
                emit={emit}
                camera={props.camera}
                onReady={props.onReady}
                viewPad={viewPad}
                inset={inset}
                palette={palette}
                margin={props.margin ?? true}
                spotTargets={spotTargets}
                setSpotTargets={setSpotTargets}
                notify={notify}
                pendingFocus={pendingFocus}
              />
              <Warmup held={held} offscreen={quality === "high"} dark={palette.dark} onWarm={release} />
            </Canvas>
            <StressTags controller={controller} spot={spotTargets} compact={compact} />
            <TagSlips store={store} spot={spotTargets} compact={compact} projector={controller} />
            <Overlay tray={tray} readOnly={readOnly} compact={compact} api={api} size={size} controller={controller} />
            <SolderOverlay store={store} view={solderView} compact={compact} readOnly={readOnly} tray={showTray} />
          </div>
        </PaletteContext.Provider>
      </LabelsContext.Provider>
    </BenchStoreContext.Provider>
  );
}

function CameraRig({
  center,
  initial,
  bench,
  viewPad,
}: {
  center: [number, number];
  initial?: BenchProps["camera"];
  bench: BenchState;
  viewPad: React.MutableRefObject<{ left: number; bottom: number }>;
}) {
  const set = useRef(false);
  const frame = useBench((s) => s.frame);
  const size = useThree((s) => s.size);
  return (
    <CameraControls
      makeDefault
      minDistance={36}
      maxDistance={1100}
      minPolarAngle={0}
      maxPolarAngle={1.3}
      minAzimuthAngle={-1.75}
      maxAzimuthAngle={1.75}
      dollyToCursor
      smoothTime={0.16}
      draggingSmoothTime={0.08}
      ref={(c) => {
        if (!c || set.current) return;
        set.current = true;
        // A first guess; the view rig frames the real models on the first frame.
        const fit = fitCamera(
          bench,
          size.width / Math.max(1, size.height),
          false,
          { left: viewPad.current.left / Math.max(1, size.width), bottom: viewPad.current.bottom / Math.max(1, size.height) },
          32,
          frame,
        );
        const pos = initial?.position ?? fit.position;
        const tgt = initial?.target ?? fit.target;
        void c.setLookAt(...pos, ...tgt, false);
        c.setBoundary(new THREE.Box3(new THREE.Vector3(center[0] - 420, -5, center[1] - 300), new THREE.Vector3(center[0] + 420, 120, center[1] + 320)));
        c.boundaryEnclosesCamera = false;
        // Left drag orbits, right drag pans, wheel zooms; one finger orbits, two fingers zoom and pan.
        // Values from camera-controls' ACTION table.
        c.mouseButtons.left = 1; // ROTATE
        c.mouseButtons.middle = 16; // DOLLY
        c.mouseButtons.right = 2; // TRUCK
        c.mouseButtons.wheel = 16; // DOLLY
        c.touches.one = 64; // TOUCH_ROTATE
        c.touches.two = 4096; // TOUCH_DOLLY_TRUCK
        c.touches.three = 128; // TOUCH_TRUCK
      }}
    />
  );
}

/** Calls back once the first frame is on screen (the frame after it has begun). */
function ReadySignal({ onReady }: { onReady?: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onReady?.());
  });
  return null;
}

/** The canvas-drawn textures the scene's materials use. */
function canvasTextures(scene: THREE.Object3D): Set<THREE.Texture> {
  const found = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      for (const v of Object.values(mat)) if ((v as THREE.CanvasTexture | null)?.isCanvasTexture) found.add(v as THREE.Texture);
    }
  });
  return found;
}

/** Longest the first frame waits for shaders to compile in the background; after that they finish as it draws. */
const MAX_WARM_MS = 2500;

/**
 * Compiles every material in the scene before the first frame, with KHR_parallel_shader_compile where the browser
 * has it (three's compileAsync), then lets the frame loop start. A cold GPU shader cache otherwise compiles them one
 * by one inside the first frame. `offscreen` compiles the variant that renders into post-processing's buffers.
 */
function Warmup({ held, offscreen, dark, onWarm }: { held: boolean; offscreen: boolean; dark: boolean; onWarm: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!held) {
      invalidate();
      return;
    }
    let waiting = true;
    const go = () => {
      if (!waiting) return;
      waiting = false;
      onWarm();
    };
    // Materials take their paper settings before they are compiled.
    paperizeScene(scene, dark);
    const target = offscreen ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }) : null;
    const before = gl.getRenderTarget();
    let compiled: Promise<unknown> = Promise.resolve();
    try {
      gl.setRenderTarget(target);
      compiled = gl.compileAsync(scene, camera);
    } catch {
      // drawn without the head start
    } finally {
      gl.setRenderTarget(before);
    }
    try {
      for (const tex of canvasTextures(scene)) gl.initTexture(tex);
    } catch {
      // uploaded by the first frame instead
    }
    const timer = window.setTimeout(go, MAX_WARM_MS);
    compiled.then(go, go);
    return () => {
      waiting = false;
      window.clearTimeout(timer);
      target?.dispose();
    };
  }, [held, offscreen, dark, gl, scene, camera, invalidate, onWarm]);
  return null;
}

/** Sets the page colour as the scene background (the canvas is opaque); it darkens with the room lights. */
function Background({ color, light = 1 }: { color: string; light?: number }) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    scene.background = new THREE.Color(color).multiplyScalar(roomShade(light));
    invalidate();
  }, [scene, color, light, invalidate]);
  return null;
}

/** How much of the page's own colour shows with the room lights at `light` (1 bright to about 0.1 dim). */
export const roomShade = (light: number) => 0.12 + 0.88 * Math.max(0, Math.min(1, light));

const snap = (v: number, step: number) => Math.round(v / step) * step;

function BenchScene({
  store,
  element,
  api,
  view,
  readOnly,
  quality,
  highlight,
  emit,
  camera,
  onReady,
  viewPad,
  inset,
  palette,
  margin,
  spotTargets,
  setSpotTargets,
  notify,
  pendingFocus,
}: {
  viewPad: React.MutableRefObject<{ left: number; bottom: number }>;
  inset: React.MutableRefObject<Required<Inset>>;
  store: BenchStore;
  element: HTMLElement | null;
  api: React.MutableRefObject<InteractionApi | null>;
  view: React.MutableRefObject<ViewApi | null>;
  readOnly: boolean;
  quality: Quality;
  highlight?: string[];
  emit: (a: BenchAction) => void;
  camera?: BenchProps["camera"];
  onReady?: () => void;
  palette: PaperPalette;
  margin: boolean;
  spotTargets: string[] | null;
  setSpotTargets: (t: string[] | null) => void;
  notify: () => void;
  pendingFocus: React.MutableRefObject<{ targets: string[]; opts?: FocusOptions } | null>;
}) {
  const bench = useBench((s) => s.bench);
  const ui = useBench((s) => s.ui);
  const invalidate = useThree((s) => s.invalidate);
  // Draw a frame on any change, except snapshots that change nothing visible (the simulator sends about 30 a second
  // even when the circuit is steady; rendering each one would keep post-processing busy for nothing).
  useEffect(() => {
    // Readouts and the desk clock also change with the snapshot.
    const extra = (s: ReturnType<typeof store.getState>) =>
      (s.bench.parts.some((p) => p.kind === "clock") ? `|t${Math.floor((s.snapshot?.t ?? 0) / 60)}` : "") + (s.inspect.length ? `|${inspectKey(s)}` : "");
    let seen = snapshotKey(store.getState().snapshot) + extra(store.getState());
    return store.subscribe((s, prev) => {
      if (s.snapshot !== prev.snapshot && s.bench === prev.bench && s.ui === prev.ui) {
        const key = snapshotKey(s.snapshot) + extra(s);
        if (key === seen) return;
        seen = key;
      }
      invalidate();
    });
  }, [store, invalidate]);
  useInteraction({ store, element, readOnly, api, emit, viewPad, view });
  const spot = useMemo(() => new Spotlight({ amount: 0, color: new THREE.Color(palette.paper) }), []);
  useEffect(() => () => spot.dispose(), [spot]);

  const center = useMemo(() => workCenter(bench), [bench.board]);
  const floor = useMemo(() => makeFloor(bench), [bench.board, bench.meter]);
  const conn = useMemo(() => connectivity(bench), [bench]);

  // Contact shadows: one sheet under the work area (moved and resized in coarse steps), one on the board.
  const bounds = benchBounds(bench);
  const res = quality === "high" ? 1024 : 512;
  const deskW = Math.min(900, Math.max(320, snap(bounds[2] - bounds[0] + 160, 80)));
  const deskD = Math.min(700, Math.max(260, snap(bounds[3] - bounds[1] + 140, 80)));
  const deskX = snap((bounds[0] + bounds[2]) / 2, 40);
  const deskZ = snap((bounds[1] + bounds[3]) / 2, 40);
  const shadowAreas = useMemo<ShadowArea[]>(() => {
    const out: ShadowArea[] = [
      { key: "desk", center: [deskX, deskZ], size: [deskW, deskD], y: 0, far: 34, opacity: palette.dark ? 0.8 : 0.52, blur: quality === "high" ? 2.4 : 1.6, resolution: res },
    ];
    if (bench.board) {
      const g = boardGeometry(bench.board);
      const [ox, oz] = boardOrigin(bench.board);
      out.push({ key: "board", center: [ox, oz], size: [g.width + 2, g.depth + 2], y: BOARD_TOP, far: 18, opacity: palette.dark ? 0.6 : 0.36, blur: 1.6, resolution: quality === "high" ? 768 : 512 });
    }
    return out;
  }, [deskX, deskZ, deskW, deskD, bench.board, quality, res, palette.dark]);
  // The page's margin line sits a few cells left of the work area (decided once per board, so it does not wander).
  const marginX = useMemo(() => (margin ? snap(benchBounds(store.getState().bench)[0] - 42, 5) : null), [margin, bench.board, store]);
  const changed = useMemo(() => ({}), [bench, ui.pressed]);

  // X-ray: everything joined to the hovered hole or lead.
  const xr = useMemo(() => {
    if (!ui.hover || !bench.board) return null;
    const members = conn.members(ui.hover);
    const geom = boardGeometry(bench.board);
    const holes: string[] = [];
    const strips = new Set<string>();
    const pins: string[] = [];
    for (const m of members) {
      if (m.startsWith("hole:")) {
        const id = m.slice(5);
        holes.push(id);
        const h = geom.holes.get(id);
        if (h) strips.add(h.strip);
      } else if (m.startsWith("pin:") || m.startsWith("wire:")) pins.push(m);
    }
    return { holes, strips, pins };
  }, [ui.hover, conn, bench.board]);

  const hl = useMemo(() => new Set(highlight ?? []), [highlight]);
  // Parts shut in a box are not drawn; gates on a lead ride that lead's cable.
  const hidden = useMemo(() => hiddenParts(bench), [bench]);
  const gatesOn = useMemo(() => {
    const out = new Map<string, PlacedPart[]>();
    for (const p of bench.parts) {
      if (p.kind !== "gate" || !p.params.on || !bench.leads.some((l) => l.id === p.params.on)) continue;
      const list = out.get(p.params.on) ?? [];
      list.push(p);
      out.set(p.params.on, list);
    }
    return out;
  }, [bench]);
  const riding = useMemo(() => new Set([...gatesOn.values()].flat().map((p) => p.id)), [gatesOn]);
  const selectedPart = ui.selection?.type === "part" ? ui.selection.id : null;
  // Parts sitting in holders take their pose from the holder.
  const holders = useMemo(() => {
    const out = new Map<string, PlacedPart>();
    for (const h of bench.parts) for (const id of Object.values(heldOf(h))) if (id) out.set(id, h);
    // Unit 3: a part through a perfboard follows the board; a clip on a lead and a tube on a wire follow their host.
    for (const p of bench.parts) {
      const board = perfMount(bench, p);
      if (board) out.set(p.id, board);
      const host =
        p.kind === "heat-sink-clip" && p.params.on
          ? p.params.on.slice(0, p.params.on.lastIndexOf("."))
          : p.kind === "heat-shrink" && p.params.on
            ? p.params.on
            : p.kind === "wall-adapter" && p.params.into
              ? p.params.into
              : null;
      const h = host ? bench.parts.find((x) => x.id === host) : undefined;
      if (h) out.set(p.id, h);
    }
    return out;
  }, [bench.parts]);
  const ambient = useBench((s) => s.ambient);
  const inspect = useBench((s) => s.inspect);
  const hasStation = bench.parts.some((p) => p.kind === "solder-station");
  const leadOpen = (id: string) => (ui.dragging && ui.selection?.type === "lead" && ui.selection.id === id ? 0.25 : 0);

  // Wire being drawn.
  const draft = ui.wireDraft;
  const draftFrom = draft && bench.board ? holeWorld(bench.board, draft.from) : null;
  const draftTo = draft?.target && bench.board ? holeWorld(bench.board, draft.target) : null;

  const highlightAnchors = (highlight ?? []).filter((h) => h.includes(":"));

  return (
    <>
      <Background color={palette.paper} light={ambient} />
      <StudioEnvironment intensity={(palette.dark ? 0.14 : 0.22) * ambient} />
      <StudioLights quality={quality} center={center} palette={palette} dim={ambient} />
      <Desk quality={quality} palette={palette} margin={marginX} light={ambient} />
      <SoftShadows areas={shadowAreas} version={changed} palette={palette} />
      <PaperUpkeep version={changed} dark={palette.dark} shadows={quality === "high"} />
      <CameraRig center={center} initial={camera} bench={bench} viewPad={viewPad} />
      <ViewRig store={store} apiRef={view} viewPad={viewPad} inset={inset} setSpotTargets={setSpotTargets} initialCamera={!!camera} onChange={notify} pendingFocus={pendingFocus} />
      <SpotlightRig store={store} targets={spotTargets} spot={spot} palette={palette} />
      <ReadySignal onReady={onReady} />
      <RoomLight.Provider value={ambient}>
      {bench.board && <Breadboard spec={bench.board} xray={ui.xray} litStrips={xr?.strips} litHoles={xr?.holes} />}
      {bench.parts.filter((p) => !hidden.has(p.id) && !riding.has(p.id)).map((p) => (
        <PartView
          key={p.id}
          part={p}
          holder={holders.get(p.id)}
          board={bench.board}
          selected={ui.selection?.type === "part" && ui.selection.id === p.id}
          hinted={hl.has(p.id)}
          pressed={!!ui.pressed[p.id]}
          quality={quality}
          floor={floor}
        />
      ))}
      {bench.board &&
        bench.wires.map((w) => (
          <WireView key={w.id} wire={w} board={bench.board!} selected={ui.selection?.type === "wire" && ui.selection.id === w.id} hinted={hl.has(w.id)} />
        ))}
      {bench.leads.map((l) => (
        <LeadView
          key={l.id}
          lead={l}
          bench={bench}
          selected={ui.selection?.type === "lead" && ui.selection.id === l.id}
          hinted={hl.has(l.id)}
          open={{ a: leadOpen(l.id), b: leadOpen(l.id) }}
          floor={floor}
          gates={gatesOn.get(l.id)}
          selectedPart={selectedPart}
          hintedParts={hl}
        />
      ))}
      <BoxWires3D bench={bench} />
      <Overlays3D bench={bench} store={store} floor={floor} />
      {bench.meter && <MeterView meter={bench.meter} bench={bench} selected={ui.selection?.type === "meter"} floor={floor} />}
      {hasStation && <IronModel bench={bench} />}
      {hasStation && <ScorchMarks />}
      </RoomLight.Provider>
      {draftFrom && (
        <>
          <TargetMarker at={[draftFrom[0], BOARD_TOP + 0.2, draftFrom[1]]} color={palette.blue} />
          {draftTo ? (
            <JumperWire a={new THREE.Vector3(draftFrom[0], BOARD_TOP, draftFrom[1])} b={new THREE.Vector3(draftTo[0], BOARD_TOP, draftTo[1])} color={ui.wireColor} />
          ) : null}
        </>
      )}
      {ui.snapTarget &&
        (() => {
          const p = anchorPosition(bench, ui.snapTarget);
          return p ? <TargetMarker at={[p[0], p[1] + 0.3, p[2]]} color={palette.blue} /> : null;
        })()}
      {xr?.pins.map((a) => {
        const p = anchorPosition(bench, a);
        return p ? <TargetMarker key={a} at={[p[0], p[1], p[2]]} color={XRAY_HEX} size={1.5} onTop={false} /> : null;
      })}
      {highlightAnchors.map((a) => {
        const p = anchorPosition(bench, a);
        return p ? <TargetMarker key={a} at={[p[0], p[1] + 0.3, p[2]]} color={palette.red} pulse size={2.6} /> : null;
      })}
      {inspect.length > 0 && <Readouts bench={bench} inspect={inspect} />}
      <PaperRenderer quality={quality} palette={palette} spot={spot} />
    </>
  );
}

export { boardOrigin };
