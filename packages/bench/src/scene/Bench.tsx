// <Bench />: the interactive 3D workbench.

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { Bloom, EffectComposer, Outline, Selection, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { Snapshot } from "@ohmland/sim";
import { boardGeometry, boardOrigin, holeWorld } from "../board";
import { BOARD_TOP } from "../dims";
import { LabelsContext, mergeLabels, type BenchLabels } from "../labels";
import { anchorPosition, fitCamera, workCenter } from "../layout";
import { connectivity } from "../netlist";
import { BenchStoreContext, createBenchStore, useBench, type BenchStore } from "../store";
import { heldOf } from "../seats";
import type { BenchAction, BenchState, PlacedPart, Quality, TrayItem } from "../types";
import { Readouts, inspectKey } from "./Readouts";
import { Breadboard, XRAY_HEX } from "../models/Breadboard";
import { RoomLight } from "../models/common";
import { JumperWire } from "../models/Leads";
import { BACKGROUND, Desk, StudioEnvironment, StudioLights } from "./Studio";
import { useInteraction, handleBenchKey, type InteractionApi } from "./Interaction";
import { Overlay } from "./Overlay";
import { ACCENT, LeadView, MeterView, PartView, SELECT_HEX, TargetMarker, WireView, makeFloor, snapshotKey } from "./views";

export type BenchProps = {
  /** Starting bench (ignored when `store` is given). */
  initial?: BenchState;
  /** Drive the bench from your own store (see createBenchStore). */
  store?: BenchStore;
  /** Parts the learner can drag in. */
  tray?: TrayItem[];
  /** Latest simulator snapshot: LED glow, damage, relay state, meter display. */
  snapshot?: Snapshot | null;
  /** Called after every committed change (not during drags). */
  onChange?: (bench: BenchState) => void;
  /** Every user action, including inputs to forward to the simulator. */
  onAction?: (action: BenchAction) => void;
  quality?: Quality;
  readOnly?: boolean;
  /** Part ids the learner cannot move, rotate or delete (switches still flip and buttons still press). */
  locked?: string[];
  /** Part ids or anchors ("hole:e12", "pin:R1.a") to point out, for lab hints. */
  highlight?: string[];
  /** Translated UI strings. */
  labels?: Partial<BenchLabels>;
  /** Initial camera. Defaults to a three-quarter view of the work area. */
  camera?: { position: [number, number, number]; target: [number, number, number] };
  className?: string;
  style?: CSSProperties;
  /** Called once the first frame has rendered. */
  onReady?: () => void;
  /** Receives camera helpers (top view, reset view, project an anchor to page coordinates). */
  controllerRef?: React.MutableRefObject<BenchController | null>;
};

export type BenchController = Pick<InteractionApi, "topView" | "resetView" | "project" | "stats" | "pickAt">;

export function Bench(props: BenchProps) {
  const { tray = [], snapshot = null, quality = "high", readOnly = false, highlight, className, style } = props;
  const [store] = useState(() => props.store ?? createBenchStore(props.initial));
  const labels = useMemo(() => mergeLabels(props.labels), [props.labels]);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const api = useRef<InteractionApi | null>(null);
  const viewPad = useRef({ left: 0, bottom: 0 });
  const onAction = useRef(props.onAction);
  const onChange = useRef(props.onChange);
  onAction.current = props.onAction;
  onChange.current = props.onChange;
  const emit = useCallback((a: BenchAction) => onAction.current?.(a), []);
  const controllerRef = props.controllerRef;
  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = {
      topView: () => api.current?.topView(),
      resetView: () => api.current?.resetView(),
      project: (t) => api.current?.project(t) ?? null,
      stats: () => api.current?.stats() ?? { calls: 0, triangles: 0, geometries: 0, textures: 0 },
      pickAt: (x, y) => api.current?.pickAt(x, y) ?? null,
    };
    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef]);

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
  viewPad.current = { left: showTray && !compact ? 204 : 0, bottom: showTray && compact ? 104 : 0 };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("select,input,textarea")) return;
    if (handleBenchKey(e.nativeEvent, store, api.current, readOnly)) e.preventDefault();
  };

  return (
    <BenchStoreContext.Provider value={store}>
      <LabelsContext.Provider value={labels}>
        <div
          ref={setElement}
          className={className ? `ohb-root ${className}` : "ohb-root"}
          tabIndex={0}
          role="application"
          aria-label={labels.canvas}
          onKeyDown={onKey}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") handleBenchKey(e.nativeEvent, store, api.current, readOnly);
          }}
          style={{ position: "relative", width: "100%", height: "100%", touchAction: "none", outline: "none", overflow: "hidden", background: BACKGROUND, ...style }}
        >
          <Canvas
            frameloop={held ? "never" : "demand"}
            shadows={quality === "high" ? "percentage" : false}
            dpr={[1, quality === "high" ? 2 : 1.5]}
            camera={{ fov: 32, near: 2, far: 6000, position: [0, 320, 360] }}
            gl={{ antialias: quality === "low", toneMapping: THREE.NeutralToneMapping, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
            onCreated={({ scene }) => {
              scene.background = new THREE.Color(BACKGROUND);
              scene.fog = new THREE.Fog(BACKGROUND, 1300, 3000);
            }}
            style={{ position: "absolute", inset: 0 }}
          >
            <BenchScene store={store} element={element} api={api} readOnly={readOnly} quality={quality} highlight={highlight} emit={emit} camera={props.camera} onReady={props.onReady} viewPad={viewPad} />
            <Warmup held={held} offscreen={quality === "high"} onWarm={release} />
          </Canvas>
          <Overlay tray={tray} readOnly={readOnly} compact={compact} api={api} size={size} />
        </div>
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
  const size = useThree((s) => s.size);
  return (
    <CameraControls
      makeDefault
      minDistance={45}
      maxDistance={1100}
      minPolarAngle={0}
      maxPolarAngle={1.3}
      minAzimuthAngle={-1.75}
      maxAzimuthAngle={1.75}
      dollyToCursor
      smoothTime={0.18}
      draggingSmoothTime={0.08}
      ref={(c) => {
        if (!c || set.current) return;
        set.current = true;
        const fit = fitCamera(bench, size.width / Math.max(1, size.height), false, {
          left: viewPad.current.left / Math.max(1, size.width),
          bottom: viewPad.current.bottom / Math.max(1, size.height),
        });
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

const EDGE_HEX = new THREE.Color(SELECT_HEX).getHex();

/**
 * Outline, bloom and tone mapping, memoised so they never re-render with the scene. (Snapshots arrive about 30 times
 * a second; only the part models and the meter read them, through their own store subscriptions. Re-rendering the
 * whole scene per snapshot sent the outline composer into an update loop: "Maximum update depth exceeded".)
 */
const PostEffects = memo(function PostEffects() {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false} autoClear={false}>
      <Outline visibleEdgeColor={EDGE_HEX} hiddenEdgeColor={EDGE_HEX} edgeStrength={12} width={1400} blur xRay />
      <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={0.75} radius={0.6} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
});

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
function Warmup({ held, offscreen, onWarm }: { held: boolean; offscreen: boolean; onWarm: () => void }) {
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
    // While the GPU compiles, upload the drawn textures (the desk alone is 2048 px), which the first frame would do.
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
  }, [held, offscreen, gl, scene, camera, invalidate, onWarm]);
  return null;
}

function BenchScene({
  store,
  element,
  api,
  readOnly,
  quality,
  highlight,
  emit,
  camera,
  onReady,
  viewPad,
}: {
  viewPad: React.MutableRefObject<{ left: number; bottom: number }>;
  store: BenchStore;
  element: HTMLElement | null;
  api: React.MutableRefObject<InteractionApi | null>;
  readOnly: boolean;
  quality: Quality;
  highlight?: string[];
  emit: (a: BenchAction) => void;
  camera?: BenchProps["camera"];
  onReady?: () => void;
}) {
  const bench = useBench((s) => s.bench);
  const ui = useBench((s) => s.ui);
  const invalidate = useThree((s) => s.invalidate);
  // Draw a frame on any change, except snapshots that change nothing visible (the simulator sends about 30 a second
  // even when the circuit is steady; rendering each one would keep shadows and post-processing busy for nothing).
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
  useInteraction({ store, element, readOnly, api, emit, viewPad });

  const center = useMemo(() => workCenter(bench), [bench.board]);
  const floor = useMemo(() => makeFloor(bench), [bench.board, bench.meter]);
  const conn = useMemo(() => connectivity(bench), [bench]);

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
  // Parts sitting in holders take their pose from the holder.
  const holders = useMemo(() => {
    const out = new Map<string, PlacedPart>();
    for (const h of bench.parts) for (const id of Object.values(heldOf(h))) if (id) out.set(id, h);
    return out;
  }, [bench.parts]);
  const ambient = useBench((s) => s.ambient);
  const inspect = useBench((s) => s.inspect);
  const leadOpen = (id: string, end: "a" | "b") => (ui.dragging && ui.selection?.type === "lead" && ui.selection.id === id ? (end === "a" ? 0.25 : 0.25) : 0);

  // Wire being drawn.
  const draft = ui.wireDraft;
  const draftFrom = draft && bench.board ? holeWorld(bench.board, draft.from) : null;
  const draftTo = draft?.target && bench.board ? holeWorld(bench.board, draft.target) : null;

  const highlightAnchors = (highlight ?? []).filter((h) => h.includes(":"));

  return (
    <>
      <StudioEnvironment intensity={0.5 * ambient} />
      <StudioLights quality={quality} center={center} dim={ambient} />
      <RoomTone ambient={ambient} />
      <Desk quality={quality} />
      <CameraRig center={center} initial={camera} bench={bench} viewPad={viewPad} />
      <ReadySignal onReady={onReady} />
      <RoomLight.Provider value={ambient}>
      <Selection>
        {bench.board && <Breadboard spec={bench.board} xray={ui.xray} litStrips={xr?.strips} litHoles={xr?.holes} />}
        {bench.parts.map((p) => (
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
            open={{ a: leadOpen(l.id, "a"), b: leadOpen(l.id, "b") }}
            floor={floor}
          />
        ))}
        {bench.meter && (
          <MeterView
            meter={bench.meter}
            bench={bench}
            selected={ui.selection?.type === "meter"}
            floor={floor}
          />
        )}
        {quality === "high" && <PostEffects />}
      </Selection>
      </RoomLight.Provider>
      {draftFrom && (
        <>
          <TargetMarker at={[draftFrom[0], BOARD_TOP + 0.2, draftFrom[1]]} color={SELECT_HEX} />
          {draftTo ? (
            <JumperWire a={new THREE.Vector3(draftFrom[0], BOARD_TOP, draftFrom[1])} b={new THREE.Vector3(draftTo[0], BOARD_TOP, draftTo[1])} color={ui.wireColor} />
          ) : null}
        </>
      )}
      {ui.snapTarget && (() => {
        const p = anchorPosition(bench, ui.snapTarget);
        return p ? <TargetMarker at={[p[0], p[1] + 0.3, p[2]]} color={ACCENT} /> : null;
      })()}
      {xr?.pins.map((a) => {
        const p = anchorPosition(bench, a);
        return p ? <TargetMarker key={a} at={[p[0], p[1], p[2]]} color={XRAY_HEX} size={1.5} onTop={false} /> : null;
      })}
      {highlightAnchors.map((a) => {
        const p = anchorPosition(bench, a);
        return p ? <TargetMarker key={a} at={[p[0], p[1] + 0.3, p[2]]} color={ACCENT} pulse size={2.6} /> : null;
      })}
      {inspect.length > 0 && <Readouts bench={bench} inspect={inspect} />}
    </>
  );
}

/** Scene background and fog follow the room lights. */
function RoomTone({ ambient }: { ambient: number }) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const c = new THREE.Color(BACKGROUND).multiplyScalar(0.12 + 0.88 * Math.max(0, Math.min(1, ambient)));
    scene.background = c;
    if (scene.fog) (scene.fog as THREE.Fog).color = c;
    invalidate();
  }, [scene, ambient, invalidate]);
  return null;
}

export { boardOrigin };
