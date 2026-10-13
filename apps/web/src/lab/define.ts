/**
 * The lab authoring API (docs/ARCHITECTURE.md, "Labs"). A lab file in content/labs/<id>.ts default-exports
 * defineLab({...}). Goals are pure predicates over a read-only LabView of the simulated bench, so a lab checks real
 * simulated state, never a scripted fake.
 *
 * The bench placement and action types here are deliberately loose: packages/bench owns BenchState and will tighten
 * them when the runtime lands. Imported by labs as "@ohmland/lab".
 */
import type { InputKey, MeterMode, PartKind, PartState, SimEvent, Snapshot } from "@ohmland/sim";

export type { InputKey, MeterMode, PartKind, PartState, SimEvent, Snapshot };

/** A part on the bench at the start, or in the tray. `at` is a bench anchor such as a breadboard hole ("a12"). */
export type PartPlacement = {
  /** Reference designator used by goals and actions ("D1", "R1", "B1"). */
  id: string;
  kind: PartKind;
  at?: string;
  /** Kind-specific values (ohms, color, emf ...), matching the PartSpec fields in @ohmland/sim. */
  props?: Record<string, number | string | boolean>;
  /** Locked parts cannot be moved or removed by the learner. */
  locked?: boolean;
};

export type TrayItem = { kind: PartKind; props?: Record<string, number | string | boolean>; count?: number };

export type BenchConfig = {
  board: "none" | "breadboard";
  parts: PartPlacement[];
  tray: TrayItem[];
  instruments: ("meter")[];
};

/** What a learner can do on the bench, as data. Solutions replay these in tests. */
export type BenchAction =
  | { do: "place"; part: string; kind: PartKind; at: string; props?: Record<string, number | string | boolean> }
  | { do: "move"; part: string; at: string }
  | { do: "remove"; part: string }
  | { do: "wire"; from: string; to: string; id?: string }
  | { do: "set"; part: string; key: InputKey; value: number | string | boolean }
  | { do: "probe"; red: string; black: string; mode: MeterMode }
  | { do: "wait"; seconds: number };

export type MeterView = { mode: MeterMode; display: string | null; unit: string | null; value: number | null };

/** The read-only view a goal receives. */
export type LabView = {
  /** BenchState from @ohmland/bench (typed once the bench lands). */
  readonly bench: unknown;
  readonly snapshot: Readonly<Snapshot> | null;
  /** Every simulator event since the lab started. */
  readonly events: readonly SimEvent[];
  readonly meter: MeterView | null;
  part(id: string): PartState | undefined;
  /** Whether the meter shows `value` (in its displayed unit) within a relative tolerance (default 5%). */
  meterReads(value: number, opts?: { tol?: number }): boolean;
  /** Whether an LED glows at least `min` (0..1, default 0.15). */
  isLit(id: string, min?: number): boolean;
  /** Whether any part (of this kind, if given) has died since the lab started. */
  fried(kind?: PartKind): boolean;
};

export type LabTask = {
  id: string;
  /** What to do (markdown). */
  prompt: string;
  goal: (lab: LabView) => boolean;
  /** Progressive hints, gentlest first (markdown). */
  hints: string[];
  /** Shown when the goal is met (markdown). */
  success: string;
  /** Optional: the task is not needed to finish the lab (a playful extra). */
  optional?: boolean;
};

export type LabDefinition = {
  id: string;
  title: string;
  bench: BenchConfig;
  tasks: LabTask[];
  /** Bench actions that solve every task in order; a test replays them against the simulator. */
  solution: BenchAction[];
};

/** Declares a lab. Checks the cheap invariants at load time so a broken lab fails loudly. */
export function defineLab(def: LabDefinition): LabDefinition {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(def.id)) throw new Error(`Lab id "${def.id}" must be kebab-case`);
  if (!def.tasks.length) throw new Error(`Lab "${def.id}" has no tasks`);
  const ids = new Set<string>();
  for (const t of def.tasks) {
    if (ids.has(t.id)) throw new Error(`Lab "${def.id}" has two tasks with id "${t.id}"`);
    ids.add(t.id);
  }
  const placed = new Set<string>();
  for (const p of def.bench.parts) {
    if (placed.has(p.id)) throw new Error(`Lab "${def.id}" places two parts with id "${p.id}"`);
    placed.add(p.id);
  }
  return def;
}

/** Builds a LabView from raw runtime state. Pure, so goals are easy to test against canned snapshots. */
export function createLabView(input: {
  bench: unknown;
  snapshot: Snapshot | null;
  events: readonly SimEvent[];
  meter: MeterView | null;
  kindOf: (partId: string) => PartKind | undefined;
}): LabView {
  const { snapshot, events, meter, kindOf } = input;
  return {
    bench: input.bench,
    snapshot,
    events,
    meter,
    part: (id) => snapshot?.parts[id],
    meterReads(value, opts) {
      const tol = opts?.tol ?? 0.05;
      if (!meter || meter.value === null) return false;
      return Math.abs(meter.value - value) <= Math.abs(value) * tol + 1e-9;
    },
    isLit(id, min = 0.15) {
      const p = snapshot?.parts[id];
      return !!p && p.health !== "dead" && (p.glow ?? 0) >= min;
    },
    fried(kind) {
      const dead = events.filter((e) => e.type === "died" || e.type === "blown").map((e) => e.partId);
      if (snapshot) for (const [id, p] of Object.entries(snapshot.parts)) if (p.health === "dead") dead.push(id);
      return dead.some((id) => !kind || kindOf(id) === kind);
    },
  };
}
