/**
 * The lab authoring API (docs/LABS.md). A lab file in content/labs/<id>.ts default-exports defineLab({...}).
 * Imported by labs as "@ohmland/lab".
 *
 * A lab is three things: a starting bench (parts, clip leads, jumper wires, instruments), a list of tasks whose goals
 * are predicates over a read-only LabView of the simulated bench, and a solution (bench actions) that a test replays
 * headlessly to prove every task can be done. Goals check real simulated state, never scripted fakes.
 *
 * This module is light: types, defineLab and the LabView builder. The bench maths comes from the pure
 * "@ohmland/bench/core" entry, never from three.js.
 */
import type { BenchPartKind, BenchState, LeadColor, MeterSocket, PartParamsMap, PlacedPart, WireColor } from "@ohmland/bench/core";
import type { InputKey, InputValue, MeterMode, NodeId, PartKind, PartState, SimEvent, SimEventType, Snapshot } from "@ohmland/sim";

export type { BenchPartKind, BenchState, InputKey, InputValue, LeadColor, MeterMode, MeterSocket, NodeId, PartKind, PartState, PlacedPart, SimEvent, SimEventType, Snapshot, WireColor };
export { createLabView } from "./view";

// ---------------------------------------------------------------------------------------------------------------
// Bench configuration

/**
 * Where something sits. Strings, so labs read like a build sheet:
 * - a breadboard hole: "e12" (the part's first lead goes there, the rest follow its footprint);
 * - two holes for the first two leads: "e5-e12", "a12-rail-:12";
 * - rails: "rail+:12" and "rail-:12" are the near plus and minus rails at column 12, "top+:12" and "top-:12" the far
 *   ones (raw ids "bp12", "bn12", "tp12", "tn12" also work);
 * - "rails": a battery with snap leads plugged into the near rails at the left end of the board;
 * - a desk spot: "desk:left", "desk:right", "desk:front", "desk:back", "desk:center", "desk:front-left" ... or
 *   "desk:x,z" in millimetres from the centre of the work area (x to the right, z toward you);
 * - "shelf" and other names ("mat:relay", "prop:lemon"): a free desk spot (the back row for "shelf").
 */
export type Spot = string;

/**
 * Something a clip, probe or wire end can attach to: a part lead "R1.a", a hole "e12" or "rail+:12", a jumper end
 * "W1.b", a clip "TL1.a", a probe "probe:red", or any raw bench anchor ("pin:R1.a", "hole:e12").
 */
export type Attach = string;

type PartCommon = {
  /** Reference designator used by goals and actions ("D1", "R1", "B1"). Letters, digits, "_" and "-". */
  id: string;
  at?: Spot;
  /** Explicit holes per lead ({ a: "e5", b: "e12" }), when `at` cannot say it. */
  holes?: Record<string, string>;
  /** Degrees around the vertical axis (quarter turns on the board). */
  rot?: number;
  /** Locked parts cannot be moved, rotated or removed (switches still flip, buttons still press). */
  locked?: boolean;
  /** Friendly name for panels and the Hall of Fried Parts ("Red LED"). Defaults to one made from the kind. */
  label?: string;
};

/** A part on the bench at the start. `params` are typed by kind (see PartParamsMap in @ohmland/bench). */
export type BenchPart = { [K in BenchPartKind]: PartCommon & { kind: K; params?: Partial<PartParamsMap[K]> } }[BenchPartKind];

/**
 * The first drafts of the Unit 1 and 2 labs used simulator kinds and a loose `props` bag. They still load:
 * "switch" becomes a toggle switch (closed = thrown to b, its pins a and b map to com and b), "wire" becomes a clip lead
 * (at "B1.pos|S1.a") or a jumper ("d12-d24"), "multimeter" configures the meter (props mode, range, red, black),
 * "cell" a lemon, "probe-resistance" a cup of water, "capacitor" a ceramic or electrolytic, "pot" a trimmer and
 * "spdt" a slide switch. New labs should use BenchPart.
 */
export type LegacyPart = PartCommon & { kind: BenchPartKind | PartKind; props?: Record<string, number | string | boolean> };

export type LabPart = BenchPart | LegacyPart;

/** A crocodile clip lead joining two points: "B1.pos -> S1.a" (colours follow red, black, green, yellow ...). */
export type LeadSpec = string | { id?: string; from: Attach | null; to: Attach | null; color?: LeadColor; locked?: boolean };

/** A jumper wire between two breadboard holes: "a12 -> rail-:12". */
export type WireSpec = string | { id?: string; from: string; to: string; color?: WireColor };

/** What the learner can drag in. `id` names the placed part (later copies get the next free id). */
export type LabTrayItem =
  | { id?: string; kind: BenchPartKind; params?: Record<string, unknown>; props?: Record<string, number | string | boolean>; count?: number; label?: string }
  | { id?: string; kind: "lead" | "wire"; params?: { color?: LeadColor }; props?: Record<string, number | string | boolean>; count?: number; label?: string }
  | { id?: string; kind: PartKind; props?: Record<string, number | string | boolean>; count?: number; label?: string };

export type MeterConfig = {
  kind: "meter";
  at?: Spot;
  rot?: number;
  /** Starting dial position (default "off"). */
  mode?: MeterMode;
  /** "auto" or a manual range label: 200mV 2V 20V 200V 600V, 200 2k 20k 200k 2M 20M, 200uA 2mA 20mA 200mA, 10A. */
  range?: string;
  /** Sockets the plugs start in (default red in VΩ, black in COM; null leaves the plug on the desk). */
  red?: MeterSocket | null;
  black?: MeterSocket | null;
  /** Where the probe tips start (default: lying on the desk). */
  probes?: { red?: Attach; black?: Attach };
  /** Where loose probe tips lie on the desk ("desk:x,z"), when not beside the meter (a meter off to one side of the view). */
  tips?: { red?: Spot; black?: Spot };
  /** Spare 200 mA fuses for "Replace meter fuse" (default unlimited). */
  spareFuses?: number;
};

/** One line on the oscilloscope: a node voltage (named node or anchor, against `ref` or ground), a current or a glow. */
export type ScopeTrace =
  | { label: string; volts: string; ref?: string }
  | { label: string; amps: string }
  | { label: string; glow: string };

export type ScopeConfig = {
  kind: "scope";
  /** One or two traces. */
  traces: ScopeTrace[];
  /** Seconds across the screen (default 5). */
  window?: number;
  /** Fixed vertical range; auto when absent. */
  range?: [number, number];
  /**
   * Single shot: an "Arm" button; the next time the learner works a switch or button (only switching off, with
   * `edge: "off"`: a button let go, a switch thrown to a) the scope catches the next `ms` milliseconds at a fast time
   * base (the simulator steps finely through the moment). For spikes too quick for the live trace: a coil's kickback.
   */
  capture?: { ms: number; edge?: "on" | "off" };
  /** Show the speaker's pitch beside the traces (a frequency readout). */
  pitch?: string;
};

/** What starts or stops the stopwatch or the logger: a switch thrown, a button pressed, or a relay contact moving. */
export type TriggerSpec =
  | { part: string; to: "a" | "b" }
  | { part: string; pressed: boolean }
  | { part: string; contact: "no" | "nc" };

/**
 * A data logger: plots node voltages against time from the moment a run starts (the `start` trigger, or the Start
 * button), with a cursor that reads off time and value. Goals read runs with `lab.loggerRuns()`.
 */
export type LoggerConfig = { kind: "logger"; traces: ScopeTrace[]; start?: TriggerSpec | TriggerSpec[]; seconds?: number; range?: [number, number] };

/**
 * A stopwatch that starts and stops by itself (a switch thrown, a relay clicking). Each finished run is kept; `watch`
 * names a node whose voltage is noted when a run starts (was the timing capacitor empty?). Goals read `lab.runs()`.
 */
export type StopwatchConfig = { kind: "stopwatch"; start: TriggerSpec; stop: TriggerSpec; watch?: string };

/** An auto-tapper: presses and releases a pushbutton by itself, `hz` times a second (default 4), while switched on. */
export type TapperConfig = { kind: "tapper"; part: string; hz?: number };

/** @deprecated Use LoggerConfig, StopwatchConfig or TapperConfig. */
export type PlannedInstrument = LoggerConfig | StopwatchConfig | TapperConfig;

export type InstrumentConfig = "meter" | "scope" | MeterConfig | ScopeConfig | LoggerConfig | StopwatchConfig | TapperConfig;

// ---------------------------------------------------------------------------------------------------------------
// Panels: small worksheets beside the tasks. Auto panels fill themselves from the bench; answer panels hold what the
// learner submits. Goals read them with `lab.panel(id)`; solutions answer them with `{ do: "panel", id, value }`.

export type PanelConfig = PanelShow &
  (
  /** A continuity table: every pair of a part's legs in each switch position (or released and held), filled in as the meter probes them. */
  | { kind: "continuity"; id: string; part: string; title?: string }
  /** A truth table: the switches' positions and whether the LED is lit, logged for every combination tried. Clears when the wiring changes. */
  | {
      kind: "truth-table";
      id: string;
      /** Each switch, with names for its two positions (thrown to a and to b), as the lesson calls them. */
      inputs: { part: string; label: string; a: string; b: string }[];
      /** The LED that is the output. */
      output: { part: string; label?: string };
      title?: string;
    }
  /**
   * Name every leg of a (mystery) part. Submissions are counted, wrong ones too. `swap` lists two groups of roles
   * that may be exchanged (which pole is "A" is up to the learner). `peek` lets the learner look inside once right.
   */
  | { kind: "pin-map"; id: string; part: string; roles: PinRole[]; swap?: [string[], string[]]; title?: string; peek?: boolean }
  /** Tag each item with one option ("S3": normally open or normally closed). */
  | { kind: "tags"; id: string; items: { id: string; label: string }[]; options: { id: string; label: string }[]; answer: Record<string, string>; title?: string }
  /** Tap every hole joined to `start` on a little map of the board (columns `cols`), then check. */
  | { kind: "hole-hunt"; id: string; start: string; cols: [number, number]; title?: string }
  /** Build a schematic symbol: two slots and an optional dashed link. `answer` is what counts as right. */
  | { kind: "symbol"; id: string; answer: { slots: [SymbolKind, SymbolKind]; linked: boolean }; title?: string });

/** Panels show all the time, or only while one of `show`'s tasks is the current one (and after it is done). */
export type PanelShow = { show?: string[] };

/** A role a leg can have in a pin map, and the legs (as wired inside the part) that truly have it. */
export type PinRole = { id: string; label: string; legs: string[] };

export type SymbolKind = "spst" | "spdt" | "button" | "none";

/** What `lab.panel(id)` returns, by panel kind. */
export type PanelState = {
  /** Continuity: "legA|legB@state" -> beep or open. Truth table: "a,b" (input positions) -> lit. */
  cells: Record<string, boolean>;
  /** Every cell the panel can have (continuity and truth tables), so goals can tell when it is complete. */
  size: number;
  /** Answer panels: the last answer submitted (leg -> role, item -> option, picked holes, symbol). */
  answer: unknown;
  submissions: number;
  wrong: number;
  /** The last submission was right. */
  correct: boolean;
};

/**
 * A slider bound to a simulator input: light on a phototransistor, a fingertip's resistance, a trimmer's knob.
 * Goals read it with `lab.control(id)`.
 */
export type ControlConfig = {
  id: string;
  label: string;
  /** The part whose input the slider drives, or "*" for every part that takes this input (all phototransistors). */
  part: string;
  key: Extract<InputKey, "light" | "ohms" | "position">;
  min: number;
  max: number;
  value: number;
  step?: number;
  /** "log" for resistances that span decades. */
  scale?: "linear" | "log";
  /** How to show the value: a unit such as "Ω" or "%". */
  unit?: string;
};

export type BenchConfig = {
  /** "half" is a 400-point board, "full" (or "breadboard") an 830-point one. */
  board: "none" | "half" | "full" | "breadboard";
  /** A full board whose power rails are broken in the middle (between columns 31 and 33). */
  splitRails?: boolean;
  /**
   * What the camera frames at the start (and on "reset view"): the rectangle spanned by these places (holes such as
   * "tp1" and "bn30", or desk spots), plus a small margin. Default: the whole bench.
   */
  frame?: Spot[];
  parts: LabPart[];
  leads?: LeadSpec[];
  wires?: WireSpec[];
  tray: LabTrayItem[];
  instruments: InstrumentConfig[];
  controls?: ControlConfig[];
  /** Names for nodes, so goals and scope traces can say "c" instead of an anchor: { c: "C1.pos" }. */
  nodes?: Record<string, Attach>;
};

// ---------------------------------------------------------------------------------------------------------------
// Tasks

/** A number the learner types into the lab notebook. Goals read it with `lab.note(id)`, in `unit`. */
export type NoteSpec = { id: string; label: string; unit?: string };

export type MascotLines = {
  /** Said when the lab (or the task) starts. */
  start?: string;
  /** Said when a hint is shown. */
  hint?: string;
  /** Said on success. */
  success?: string;
  /** Said when a part fries. */
  fried?: string;
  /** Said once every required task is done. */
  exit?: string;
};

export type LabTask = {
  /** Unique within the lab; stored in progress for XP. */
  id: string;
  /** What to do (markdown). */
  prompt: string;
  /** True once the task is done. Required tasks are checked in order, optional ones all the time. */
  goal: (lab: LabView) => boolean;
  /** Progressive hints, gentlest first (markdown). */
  hints: string[];
  /** Shown when the goal is met (markdown). */
  success: string;
  /** What to notice afterwards (markdown), shown under the success line. */
  notice?: string;
  /** Not needed to finish the lab: a bonus. Gives task XP, never blocks Continue, can be skipped. */
  optional?: boolean;
  /** Same as `optional` (the blueprint's word). */
  bonus?: boolean;
  /** Mascot lines for this task (override the lab's). */
  mascot?: MascotLines;
  /** Part ids or anchors ("hole:e12", "pin:R1.a") pulsed on the bench once the learner opens a hint. */
  highlight?: string[];
  /** Notebook entries shown with this task. */
  note?: NoteSpec | NoteSpec[];
  /** Achievement trigger fired when this task is done (see progress/achievements.ts, `labEvent`). */
  trigger?: string;
};

// ---------------------------------------------------------------------------------------------------------------
// Solutions: bench actions as data. A test replays them headlessly; "Show me" plays them on the bench.

export type SolutionStep =
  | { do: "place"; part: string; kind: BenchPartKind; at: Spot; params?: Record<string, unknown>; rot?: number }
  | { do: "move"; part: string; at: Spot; rot?: number }
  | { do: "rotate"; part: string }
  | { do: "remove"; part: string }
  /** Add a clip lead (from the tray) between two points; either end may be null (lying on the desk). */
  | { do: "lead"; id?: string; from: Attach | null; to: Attach | null; color?: LeadColor }
  /** Move one clip of a lead (null unclips it and leaves it on the desk). */
  | { do: "clip"; lead: string; end: "a" | "b"; to: Attach | null }
  | { do: "wire"; id?: string; from: string; to: string; color?: WireColor }
  | { do: "unwire"; wire: string }
  /** Touch the probe tips (null lifts one) and optionally set the dial and range. */
  | { do: "probe"; red?: Attach | null; black?: Attach | null; mode?: MeterMode; range?: string }
  | { do: "plug"; probe: "red" | "black"; socket: MeterSocket | null }
  | { do: "dial"; mode: MeterMode; range?: string }
  /** Throw a slide or toggle switch (to the other side, or to `to`). */
  | { do: "flip"; part: string; to?: "a" | "b" }
  /** Hold a pushbutton for `seconds` (default 0.3), then let go. */
  | { do: "press"; part: string; seconds?: number }
  /** A raw simulator input. */
  | { do: "set"; part: string; key: InputKey; value: InputValue }
  | { do: "control"; id: string; value: number }
  | { do: "replace"; part: string }
  | { do: "replaceFuse" }
  | { do: "note"; id: string; value: number | string }
  /** Answer a panel (pin map, tags, hole hunt, symbol). Pin maps take wired leg names: { coil1: "coil", com1: "com" }. */
  | { do: "panel"; id: string; value: unknown }
  /** Switch the auto-tapper on or off. */
  | { do: "tapper"; on: boolean }
  | { do: "wait"; seconds: number }
  /** Checkpoint: by here this task must be done. Splits the solution for "Show me". */
  | { do: "check"; task: string };

export type FriedInfo = { partId: string; kind: string; event: SimEvent; lab: LabView };

export type LabDefinition = {
  id: string;
  title: string;
  bench: BenchConfig;
  tasks: LabTask[];
  solution: SolutionStep[];
  /** Lab-wide mascot lines (start, hint, success, fried, exit). */
  mascot?: MascotLines;
  /**
   * Labels for the Hall of Fried Parts, by part id or kind ({ D1: "Red LED, no resistor on 9 V", led: "Red LED" }),
   * or a function for labels that depend on the circuit.
   */
  fried?: Record<string, string> | ((f: FriedInfo) => string | undefined);
  /** Notebook: extra tags for logged readings ({ open: (lab) => !lab.closed("S1") }). */
  notebook?: { tags?: Record<string, (lab: LabView) => boolean> };
  /** Achievement triggers checked on every snapshot; each fires once per visit. */
  triggers?: Record<string, (lab: LabView) => boolean>;
  /** Worksheets beside the tasks: continuity and truth tables, pin maps, tags, a hole hunt, a symbol builder. */
  panels?: PanelConfig[];
  /** Simulation speed (1 is real time). */
  speed?: number;
};

// ---------------------------------------------------------------------------------------------------------------
// The view a goal receives

export type MeterView = {
  mode: MeterMode;
  /** The range in use ("20V", "200mA"), manual or chosen by auto-range. */
  range: string | null;
  /** True when the range is "auto". */
  auto: boolean;
  /** Socket each plug is in, or null when unplugged. */
  red: MeterSocket | null;
  black: MeterSocket | null;
  /** What each probe tip touches (bench anchor) or null. */
  redAt: string | null;
  blackAt: string | null;
  /** Raw display text ("9.41", "OL", "-0.42"), or null when off. */
  display: string | null;
  /** Display unit ("V", "mA", "kΩ"), or null. */
  unit: string | null;
  /** The display as a number in its own unit; OL is Infinity; null when blank. */
  value: number | null;
  /** The reading in base units (V, A, Ω). */
  si: number | null;
  fuse: "ok" | "blown";
  beep: boolean;
};

export type Reading = {
  t: number;
  mode: MeterMode;
  range: string | null;
  display: string;
  unit: string | null;
  /** In the display unit (Infinity for OL). */
  value: number;
  /** In base units. */
  si: number;
  /** What the probes were on: part ids ("R1", "across:R1", "rev:R1"), "series:D1" for current, plus lab tags. */
  tags: string[];
};

export type TaskStatus = "todo" | "done" | "skipped";

/** One timed run of the stopwatch, in simulated seconds. `watch` is the watched node's voltage when it started. */
export type StopwatchRun = { start: number; stop: number; seconds: number; watch?: number };

/** Summary of a history source over a window. */
export type Stats = { min: number; max: number; mean: number; span: number; n: number };

/** The read-only view a goal receives. */
export type LabView = {
  /** Simulated seconds. */
  readonly t: number;
  readonly bench: Readonly<BenchState> & {
    /** Clip-lead ends (and probe tips) not attached to anything. */
    readonly detachedLeadEnds: number;
  };
  readonly snapshot: Readonly<Snapshot> | null;
  /** Every simulator event since the lab started (or the bench was reset). */
  readonly events: readonly SimEvent[];
  readonly meter: MeterView | null;
  /** Scratch space that survives between checks of the same task. */
  readonly memory: Record<string, unknown>;
  /** Scratch space shared by every task and trigger of the lab (a value measured in one task, compared in a later one). */
  readonly shared: Record<string, unknown>;

  /** Simulated state of a part. A slide or toggle switch reports `closed` when thrown to b. */
  part(id: string): PartState | undefined;
  /** The part as placed on the bench (kind, params, holes). */
  benchPart(id: string): PlacedPart | undefined;
  /** A part's or prop's settings (its bench params). */
  prop(id: string): Record<string, unknown> | undefined;
  /** The leads a part has ("a", "b"; "e", "b", "c"; a relay's eight), or [] when it is not on the bench. */
  legs(id: string): readonly string[];

  /** An LED glows at least `min` (0..1, default 0.1) and is not dead. */
  isLit(id: string, min?: number): boolean;
  /** A part (of this kind, if given: "led", "resistor", "fuse", "meter-fuse" ...) died during this lab. */
  fried(kind?: string): boolean;
  died(id: string): boolean;
  /** A switch, pushbutton, relay (COM on NO) or fuse is closed. */
  closed(id: string): boolean;
  /** A simulator event of this type happened (on this part, if given). */
  event(type: SimEventType, partId?: string): boolean;
  /** How many such events (within the last `seconds`, if given). */
  count(type: SimEventType, partId?: string, seconds?: number): number;

  /** Volts at a node (a name from bench.nodes or an attach point), against `ref` (default ground). */
  volts(node: string, ref?: string): number | undefined;
  /** Size of the current through a part, in amps (0 when missing). */
  amps(id: string): number;
  /** Two attach points are metal-connected or on the same node. */
  connected(a: Attach, b: Attach): boolean;
  /** The parts form one closed series loop in this order, starting from the first part's plus side, nothing else on any junction. */
  seriesLoop(ids: readonly string[]): boolean;
  /** Current flows nowhere (or not through `partId`): below 1 µA. */
  loopOpen(partId?: string): boolean;

  /** Red probe on the part's first pin and black on its second (or reversed with "rev", either with "either"). */
  across(partId: string, dir?: "rev" | "either"): boolean;
  /** Same as across(partId), as an options object. */
  probesAcross(partId: string, opts?: { reversed?: boolean; either?: boolean }): boolean;
  /** The meter is on a current range and carries the same current as the part. */
  inSeries(meterId: string, partId: string): boolean;
  meterInSeriesWith(partId: string): boolean;
  /** The meter shows `value` within `tol` (relative, default 0.05), in its display unit or in `unit` ("V", "mA", "kΩ"). */
  meterReads(value: number, opts?: { tol?: number; unit?: string }): boolean;

  /** `cond` has stayed true for `seconds` of simulated time (per task, per `key`). */
  heldFor(seconds: number, cond: boolean, key?: string): boolean;
  /** Recent samples of "glow:D1", "i:R1", "v:R1", "volts:<node>" or "temp:R1" over the last `seconds` (default 10). */
  history(source: string, seconds?: number): [number, number][];
  /** Seconds between an LED's flashes over the last few cycles, or null when it is not blinking. */
  blinkPeriod(ledId: string): number | null;
  /** Pitch of the sound from the speakers, in Hz, or null when silent or absent. */
  toneHz(speakerId: string): number | null;
  /** Relay clicks (within the last `seconds`, if given). */
  relayClicks(id: string, seconds?: number): number;
  relayClicked(id: string): boolean;
  /**
   * Seconds between rising crossings of a history source through `level` (default: halfway between its lowest and
   * highest), over the last `seconds` (default 12): a blinking LED's or a ticking node's periods, oldest first.
   */
  periods(source: string, level?: number, seconds?: number): number[];
  /** Seconds between a relay's pull-ins (COM moving to NO), over the last `seconds` (default 12), oldest first. */
  relayPeriods(id: string, seconds?: number): number[];
  /** A two-lead part joins `a` and `b` (either way round, or first lead on `a` with "forward"). */
  joins(partId: string, a: Attach, b: Attach, dir?: "forward"): boolean;
  /** Minimum, maximum, mean and span (max minus min) of a history source over the last `seconds` (default 2). */
  stats(source: string, seconds?: number): Stats | null;
  /** Seconds a history source spent at or above `level` within the last `seconds` (default 10). */
  timeAbove(source: string, level: number, seconds?: number): number;
  /** Speaker pitch over the last `seconds` (default 4): [time, Hz], Hz 0 while silent. Short windows, so glides show. */
  toneHistory(seconds?: number): [number, number][];
  /** A number from a part's simulated state: an instance value ("actualOhms", "actualFarads", "pullIn", "bf"). */
  actual(id: string, key: string): number | undefined;
  /** A panel's state (see PanelConfig). */
  panel(id: string): PanelState;
  /** Finished stopwatch runs, oldest first. */
  runs(): readonly StopwatchRun[];
  /** When the data logger's current run started (simulated seconds), or null. */
  loggerStart(): number | null;
  /** The auto-tapper is working this pushbutton. */
  tapping(partId: string): boolean;

  /** Stable meter readings captured by the notebook, oldest first. */
  readonly readingsLog: readonly Reading[];
  /** The latest reading with this tag. */
  logged(tag: string): Reading | undefined;
  readings(tag?: string): Reading[];
  /** A number the learner typed into the notebook, in its unit, or null. */
  note(id: string): number | null;
  /** A slider's value. */
  control(id: string): number | undefined;
  /** Status of a task in this lab. */
  task(id: string): TaskStatus;
  /** Fire an achievement trigger (once per visit). */
  trigger(name: string): void;
};

// ---------------------------------------------------------------------------------------------------------------

const ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Declares a lab. Checks the cheap invariants at load time so a broken lab fails loudly. */
export function defineLab(def: LabDefinition): LabDefinition {
  const fail = (msg: string): never => {
    throw new Error(`Lab "${def.id}": ${msg}`);
  };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(def.id)) throw new Error(`Lab id "${def.id}" must be kebab-case`);
  if (!def.tasks.length) fail("has no tasks");
  const tasks = new Set<string>();
  for (const t of def.tasks) {
    if (tasks.has(t.id)) fail(`two tasks have the id "${t.id}"`);
    tasks.add(t.id);
  }
  const ids = new Set<string>();
  for (const p of def.bench.parts) {
    if (!ID.test(p.id)) fail(`part id "${p.id}" must start with a letter and use letters, digits, "_" or "-"`);
    if (ids.has(p.id)) fail(`two parts have the id "${p.id}"`);
    ids.add(p.id);
  }
  for (const s of def.solution) if (s.do === "check" && !tasks.has(s.task)) fail(`solution checks unknown task "${s.task}"`);
  const panels = new Set<string>();
  for (const p of def.panels ?? []) {
    if (panels.has(p.id)) fail(`two panels have the id "${p.id}"`);
    panels.add(p.id);
    for (const t of p.show ?? []) if (!tasks.has(t)) fail(`panel "${p.id}" shows with unknown task "${t}"`);
  }
  for (const s of def.solution) if (s.do === "panel" && !panels.has(s.id)) fail(`solution answers unknown panel "${s.id}"`);
  return def;
}

/** Whether a task is optional (the `optional` and `bonus` flags mean the same). */
export const isOptional = (t: Pick<LabTask, "optional" | "bonus">): boolean => !!(t.optional || t.bonus);
