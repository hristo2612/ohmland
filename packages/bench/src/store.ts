// Bench store: the BenchState with undo/redo, the latest simulator snapshot and transient UI state.
// One store per <Bench>; pass your own with the `store` prop to drive it from outside.

import { createContext, useContext } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { Snapshot } from "@ohmland/sim";
import { advanceGates, type GateCounts } from "./flow";
import * as ops from "./ops";
import type { StationState } from "./solder/station";
import type {
  Anchor,
  BenchAction,
  BenchPartKind,
  BenchState,
  HoleId,
  LeadColor,
  MeterSocket,
  PartParamsMap,
  ProbeColor,
  Selection,
  TrayItem,
  Vec2,
  Vec3,
  WireColor,
} from "./types";

export type BenchMode = "select" | "wire";

export type BenchUi = {
  selection: Selection | null;
  /** Hole or lead under the pointer; drives the x-ray view of connected strips. */
  hover: Anchor | null;
  mode: BenchMode;
  wireColor: WireColor;
  leadColor: LeadColor;
  /** Show the metal strips inside the board all the time. */
  xray: boolean;
  /** Tray item waiting for a tap on the bench (touch placement). */
  armed: TrayItem | null;
  /** Context menu at container coordinates; `at` is when it opened (ms). */
  menu: { x: number; y: number; selection: Selection; at: number } | null;
  /** Something is being dragged (the camera is locked). */
  dragging: boolean;
  /** Wire being drawn from a hole. */
  wireDraft: { from: HoleId; to: Vec3 | null; target: HoleId | null } | null;
  /** Snap target under a dragged clip, probe or lead, for feedback. */
  snapTarget: Anchor | null;
  /** Pushbuttons held down right now. */
  pressed: Record<string, boolean>;
};

/**
 * Teaching overlays drawn over the bench in both views (docs/BENCH-VIEWS.md, "Overlays"):
 * - `flow`: dots riding every lead and part at a speed from its current ("current", plus to minus), or electrons
 *   drifting the other way, slowly ("electrons");
 * - `push`: ink hatching along every lead by its voltage, and a hill on every battery and sealed box;
 * - `trace`: the loop tracer inking the path from a terminal (`at` is when it started, performance.now() ms).
 */
export type BenchOverlay = {
  flow: "off" | "current" | "electrons";
  push: boolean;
  trace: { from: Anchor; at: number } | null;
};

export type BenchStoreState = {
  bench: BenchState;
  past: BenchState[];
  future: BenchState[];
  /** Bench at the start of the current drag, if one is in progress. */
  txBase: BenchState | null;
  /** Part ids the learner cannot move, rotate or remove (set by the `locked` prop). */
  locked: readonly string[];
  /** The desk rectangle the camera frames at the start and on "reset view" (set by the `frame` prop), or null for all. */
  frame: readonly [number, number, number, number] | null;
  snapshot: Snapshot | null;
  /** Readouts drawn over parts: an LED's stress bar, a resistor's temperature (lab instruments). */
  inspect: readonly InspectSpec[];
  /** Room lighting, 1 bright to about 0.1 dim (faint LED glows show up in a dim room). */
  ambient: number;
  /**
   * The solder station's live state (tip temperature, molten joints, heat in leads), when the bench has a station
   * or solder work; null otherwise. The solder overlay runs it (src/solder/station.ts).
   */
  station: StationState | null;
  /** What drives the station's clock: the simulator's time (snapshots) when one runs, else the wall clock. */
  stationClock: "auto" | "wall" | "sim";
  overlay: BenchOverlay;
  /** Dots each gate has counted so far (from the snapshots: a gate ticks once per dot that rides past). */
  gates: GateCounts;
  ui: BenchUi;
  /** Set by <Bench>: receives every BenchAction. */
  emit: (action: BenchAction) => void;

  /** Replace the bench through a pure function. Recorded for undo unless a drag transaction is open. */
  apply: (fn: (b: BenchState) => BenchState, action?: BenchAction) => void;
  begin: () => void;
  commit: () => void;
  cancel: () => void;
  undo: () => void;
  redo: () => void;
  /** Load a bench and clear history. */
  load: (bench: BenchState) => void;
  setUi: (patch: Partial<BenchUi>) => void;
  select: (selection: Selection | null) => void;

  /** Adds a part; `id` is used when it is free, else the next free id for the kind. */
  addPart: <K extends BenchPartKind>(kind: K, params: Partial<PartParamsMap[K]> | undefined, at: ops.Placement, id?: string) => string;
  movePart: (id: string, to: Vec2) => void;
  rotatePart: (id: string) => void;
  removePart: (id: string) => void;
  setParams: <K extends BenchPartKind>(id: string, params: Partial<PartParamsMap[K]>) => void;
  addWire: (a: HoleId, b: HoleId, color?: WireColor) => string | null;
  removeWire: (id: string) => void;
  addLead: (color: LeadColor, at: Vec2, id?: string) => string;
  clipLead: (id: string, end: "a" | "b", to: Anchor | null, pos?: Vec2) => void;
  removeLead: (id: string) => void;
  setMeterMode: (mode: NonNullable<BenchState["meter"]>["mode"]) => void;
  plugProbe: (color: ProbeColor, socket: MeterSocket | null, plugPos?: Vec2) => void;
  touchProbe: (color: ProbeColor, to: Anchor | null, pos?: Vec2) => void;
  /** Rotate the selected part, if any. */
  rotateSelected: () => void;
  /** Delete whatever is selected. */
  deleteSelected: () => void;
  /** Momentary input (pushbutton), not stored in the bench. */
  press: (id: string, pressed: boolean) => void;
  /** Switch overlays on or off (flow dots, the push view). */
  setOverlay: (patch: Partial<Omit<BenchOverlay, "trace">>) => void;
  /** Start the loop tracer from an anchor ("pin:B1.neg"), or clear it with null. */
  trace: (from: Anchor | null) => void;
};

export type BenchStore = StoreApi<BenchStoreState>;

/**
 * A readout over parts. `parts` lists part ids or kinds ("D1", "resistor"). "stress" is a bar of an LED's current
 * as a share of its maximum (green, amber past half, red past 90%); "heat" a part's temperature with a touch-feel
 * word (cool, warm, hot, ouch).
 */
export type InspectSpec = { show: "stress" | "heat"; parts: readonly string[] };

const HISTORY = 100;

const initialUi = (): BenchUi => ({
  selection: null,
  hover: null,
  mode: "select",
  wireColor: "red",
  leadColor: "red",
  xray: false,
  armed: null,
  menu: null,
  dragging: false,
  wireDraft: null,
  snapTarget: null,
  pressed: {},
});

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function createBenchStore(initial: BenchState = ops.emptyBench()): BenchStore {
  const store = createStore<BenchStoreState>()((set, get) => {
    const record = (next: BenchState, action?: BenchAction) => {
      const { bench, txBase, past } = get();
      if (next === bench) return;
      if (txBase) set({ bench: next });
      else set({ bench: next, past: [...past, bench].slice(-HISTORY), future: [] });
      if (action) get().emit(action);
    };
    return {
      bench: initial,
      past: [],
      future: [],
      txBase: null,
      locked: [],
      frame: null,
      snapshot: null,
      inspect: [],
      ambient: 1,
      station: null,
      stationClock: "auto",
      overlay: { flow: "off", push: false, trace: null },
      gates: {},
      ui: initialUi(),
      emit: () => {},

      apply: (fn, action) => record(fn(get().bench), action),
      begin: () => {
        if (!get().txBase) set({ txBase: get().bench });
      },
      commit: () => {
        const { txBase, bench, past } = get();
        if (!txBase) return;
        if (txBase === bench || JSON.stringify(txBase) === JSON.stringify(bench)) set({ txBase: null, bench: txBase });
        else set({ txBase: null, past: [...past, txBase].slice(-HISTORY), future: [] });
      },
      cancel: () => {
        const { txBase } = get();
        if (txBase) set({ bench: txBase, txBase: null });
      },
      undo: () => {
        const { past, bench, future } = get();
        const prev = past[past.length - 1];
        if (!prev) return;
        set({ bench: prev, past: past.slice(0, -1), future: [bench, ...future], txBase: null });
        get().emit({ type: "undo" });
      },
      redo: () => {
        const { past, bench, future } = get();
        const next = future[0];
        if (!next) return;
        set({ bench: next, past: [...past, bench], future: future.slice(1), txBase: null });
        get().emit({ type: "redo" });
      },
      load: (bench) => set({ bench, past: [], future: [], txBase: null, ui: { ...get().ui, selection: null, menu: null } }),
      setUi: (patch) => set({ ui: { ...get().ui, ...patch } }),
      select: (selection) => {
        const cur = get().ui.selection;
        if (cur?.type === selection?.type && cur?.id === selection?.id) return;
        set({ ui: { ...get().ui, selection, menu: null } });
        get().emit({ type: "select", selection });
      },

      addPart: (kind, params, at, wanted) => {
        const free = ops.trayId(get().bench, wanted);
        const [next, id] = ops.addPart(get().bench, kind, params, at, free);
        record(next, { type: "part:add", partId: id, kind });
        return id;
      },
      movePart: (id, to) => record(ops.movePart(get().bench, id, to), { type: "part:move", partId: id }),
      rotatePart: (id) => record(ops.rotatePart(get().bench, id), { type: "part:rotate", partId: id }),
      removePart: (id) => {
        if (get().locked.includes(id)) return;
        record(ops.removePart(get().bench, id), { type: "part:remove", partId: id });
        if (get().ui.selection?.id === id) get().select(null);
      },
      setParams: (id, params) => {
        const before = get().bench.parts.find((p) => p.id === id);
        record(ops.setPartParams(get().bench, id, params));
        if (!before) return;
        for (const [key, value] of Object.entries(params)) {
          if ((key === "to" || key === "position") && (before.params as Record<string, unknown>)[key] !== value) {
            get().emit({ type: "input", partId: id, key, value: value as string | number });
          }
        }
      },
      addWire: (a, b, color) => {
        const [next, id] = ops.addWire(get().bench, a, b, color ?? get().ui.wireColor);
        if (id) record(next, { type: "wire:add", wireId: id });
        return id;
      },
      removeWire: (id) => {
        record(ops.removeWire(get().bench, id), { type: "wire:remove", wireId: id });
        if (get().ui.selection?.id === id) get().select(null);
      },
      addLead: (color, at, wanted) => {
        const free = ops.trayId(get().bench, wanted);
        const [next, id] = ops.addLead(get().bench, color, at, free);
        record(next, { type: "lead:add", leadId: id });
        return id;
      },
      clipLead: (id, end, to, pos) => record(ops.clipLead(get().bench, id, end, to, pos), { type: "lead:clip", leadId: id, end, to }),
      removeLead: (id) => {
        record(ops.removeLead(get().bench, id), { type: "lead:remove", leadId: id });
        if (get().ui.selection?.id === id) get().select(null);
      },
      setMeterMode: (mode) => {
        const m = get().bench.meter;
        if (!m || m.mode === mode) return;
        record(ops.setMeterMode(get().bench, mode), { type: "meter:mode", mode });
        get().emit({ type: "input", partId: m.id, key: "mode", value: mode });
      },
      plugProbe: (color, socket, plugPos) => record(ops.plugProbe(get().bench, color, socket, plugPos), { type: "meter:plug", probe: color, socket }),
      touchProbe: (color, to, pos) => record(ops.touchProbe(get().bench, color, to, pos), { type: "meter:probe", probe: color, to }),
      rotateSelected: () => {
        const s = get().ui.selection;
        if (s?.type === "part" && get().locked.includes(s.id)) return;
        if (s?.type === "part") get().rotatePart(s.id);
        else if (s?.type === "meter") get().apply((b) => (b.meter ? ops.moveMeter(b, b.meter.pos, (b.meter.rot + 90) % 360) : b));
      },
      deleteSelected: () => {
        const s = get().ui.selection;
        if (!s) return;
        if (s.type === "part") get().removePart(s.id);
        else if (s.type === "wire") get().removeWire(s.id);
        else if (s.type === "lead") get().removeLead(s.id);
      },
      press: (id, pressed) => {
        const cur = get().ui.pressed;
        if (!!cur[id] === pressed) return;
        set({ ui: { ...get().ui, pressed: { ...cur, [id]: pressed } } });
        get().emit({ type: "input", partId: id, key: "pressed", value: pressed });
      },
      setOverlay: (patch) => set({ overlay: { ...get().overlay, ...patch } }),
      trace: (from) => set({ overlay: { ...get().overlay, trace: from ? { from, at: now() } : null } }),
    };
  });
  // Gates count the dots that ride past them, snapshot by snapshot (simulated time).
  store.subscribe((s, prev) => {
    if (s.snapshot === prev.snapshot || !s.bench.parts.some((p) => p.kind === "gate")) return;
    const dt = s.snapshot && prev.snapshot ? s.snapshot.t - prev.snapshot.t : 0;
    store.setState({ gates: advanceGates(s.gates, s.bench, s.snapshot, dt) });
  });
  return store;
}

export const BenchStoreContext = createContext<BenchStore | null>(null);

/** The store of the nearest <Bench>. */
export function useBenchStore(): BenchStore {
  const s = useContext(BenchStoreContext);
  if (!s) throw new Error("useBenchStore must be used inside <Bench>");
  return s;
}

/** Select from the nearest <Bench> store. */
export function useBench<T>(selector: (s: BenchStoreState) => T): T {
  return useStore(useBenchStore(), selector);
}

const NO_STORE: BenchStore = createBenchStore();

/**
 * Select from the nearest bench store when there is one; a model drawn alone (a gallery, a preview, a test) reads an
 * empty bench instead of throwing.
 */
export function useBenchMaybe<T>(selector: (s: BenchStoreState) => T): T {
  return useStore(useContext(BenchStoreContext) ?? NO_STORE, selector);
}

/** The nearest bench store, or null outside one. */
export function useBenchStoreMaybe(): BenchStore | null {
  return useContext(BenchStoreContext);
}
