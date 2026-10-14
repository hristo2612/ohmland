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
import type { SolderLab } from "./solder";
import type { ChipSeat, Level } from "./chips";
import type { Burst, Duty, Spell, Tally } from "./signals";

export type { SolderLab, SolderBoard, SolderJoint } from "./solder";
export type { BenchPartKind, BenchState, InputKey, InputValue, LeadColor, MeterMode, MeterSocket, NodeId, PartKind, PartState, PlacedPart, SimEvent, SimEventType, Snapshot, WireColor };
export type { Burst, ChipSeat, Duty, Level, Spell, Tally };
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
 * - a holder's seat: "in:H1" (the first free seat that fits) or "in:H1.r" (that seat): resistor clips, a test
 *   station's bay, a lemon's electrode slot, a reject bin;
 * - another part's place: "on:B1" (solutions only) swaps the two, clips and probe tips included;
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

/**
 * A dashed reference line across the scope: a share of a node's voltage (`{ of: "U1.8", fraction: 2 / 3 }`, which
 * follows the supply as it sags) or a fixed level (`{ volts: 3 }`). Drawn on the first trace's scale.
 */
export type ScopeLevel = { of: string; fraction: number; label?: string; ref?: string } | { volts: number; label?: string };

export type ScopeConfig = {
  kind: "scope";
  /** One or two traces. */
  traces: ScopeTrace[];
  /** Reference lines (the 555's 1/3 and 2/3 lines). */
  levels?: ScopeLevel[];
  /**
   * A duty readout under the traces: high time, low time and the share spent high, for trace 0 (`true`) or the trace
   * with this index. A volts trace's node is watched for exact edges, so a kilohertz signal reads true.
   */
  duty?: boolean | number;
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

/**
 * What starts or stops the stopwatch or the logger: a switch thrown, a button pressed, a relay contact moving, an LED
 * lighting or going dark (`lit`), or a node rising above or falling below a level in volts (the node is watched, so
 * the time is exact).
 */
export type TriggerSpec =
  | { part: string; to: "a" | "b" }
  | { part: string; pressed: boolean }
  | { part: string; contact: "no" | "nc" }
  | { part: string; lit: boolean }
  | { node: string; above: number }
  | { node: string; below: number };

/**
 * A data logger: plots node voltages against time from the moment a run starts (the `start` trigger, or the Start
 * button), with a cursor that reads off time and value. Goals read when a run started with `lab.loggerStart()`.
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

// ---------------------------------------------------------------------------------------------------------------
// Panels: small worksheets beside the tasks. Auto panels fill themselves from the bench; answer panels hold what the
// learner submits. Goals read them with `lab.panel(id)`; solutions answer them with `{ do: "panel", id, value }`.

export type PanelConfig = PanelShow &
  (
  /** A continuity table: every pair of a part's legs in each switch position (or released and held), filled in as the meter probes them. */
  | { kind: "continuity"; id: string; part: string; title?: string }
  /**
   * A truth table: every combination of the inputs tried, with what the outputs did, logged once steady. Clears when
   * the wiring changes. Inputs are switches by position (`a`, `b`: the names of the two throws), buttons, switches or
   * DIP-switch positions by closed or open (`low`, `high`: names for 0 and 1), or nodes by logic level. Outputs are
   * LEDs (lit) or nodes (high). `mystery` keeps `name` (the gate) hidden until every row is filled.
   */
  | {
      kind: "truth-table";
      id: string;
      inputs: TruthInput[];
      /** The output (the single-output form). */
      output?: TruthOutput;
      /** Several outputs, each a column. */
      outputs?: TruthOutput[];
      mystery?: boolean;
      /** What the table turns out to be ("AND"), shown once it is complete (at once without `mystery`). */
      name?: string;
      title?: string;
    }
  /**
   * The chip x-ray: a 555's insides drawn live (the ladder, the 1/3 and 2/3 lines, the two watchers, the latch, the
   * output stage, the drain switch, the reset line), only the blocks of the `pins` the lessons have named so far; or,
   * for a gate chip, which gate is which, with each pin's level. Open, it turns `lab.view("xray:<part>")` on.
   */
  | { kind: "xray"; id: string; part: string; pins?: number[]; title?: string }
  /**
   * A timing diagram: up to 8 channels as high and low lines over the last `window` seconds (default 2), every edge
   * exact (node channels are watched). It keeps the latest burst of edges (a press's bounce, a counter's ripple: edges
   * closer together than `quiet` seconds, default 0.02) for a slow-motion replay, and marks states under 1 µs.
   * Goals read `lab.timing(id)`.
   */
  | { kind: "timing"; id: string; channels: TimingChannel[]; window?: number; quiet?: number; title?: string }
  /**
   * A histogram of dice rolls. Every roll of the `button` (pressed, let go, then `settle` seconds) is read from the
   * dice's pip LEDs (the face is the number of pips lit; two lists for two dice) or from `read`, and tallied. The
   * auto-roller presses it `rolls` times (default 100) with human-like holds (`hold`, default 0.15 to 0.6 s); a band
   * shows where a fair die's counts fall. Goals read `lab.rolls(id)`.
   */
  | {
      kind: "histogram";
      id: string;
      button: string;
      dice: string[][];
      read?: (lab: LabView) => number[] | null;
      rolls?: number;
      hold?: [number, number];
      settle?: number;
      title?: string;
    }
  /**
   * Keys for buttons: each pushbutton gets a big on-screen key and a keyboard key (`key`, as KeyboardEvent.key: "a",
   * "l", " "), held while pressed, so two players can share one keyboard. A key can also be held down by a tap (a pin
   * marks it), for touch screens. The keyboard keys work all through the lab, shown or not.
   */
  | { kind: "keys"; id: string; buttons: { part: string; key: string; label: string }[]; title?: string }
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

/** A truth table input: a switch by its throw, a button (or switch, or DIP position) by closed, or a node by level. */
export type TruthInput =
  | { part: string; label: string; a: string; b: string }
  | { part: string; label: string; low?: string; high?: string }
  | { node: string; label: string; low?: string; high?: string };

/** A truth table output: an LED (lit is 1) or a node (high is 1). */
export type TruthOutput = { part: string; label?: string } | { node: string; label?: string };

/**
 * A timing diagram channel: a node (watched for exact edges; `level` volts, else half its chip's supply), or a part
 * (an LED lit, a button or switch closed) sampled with the snapshots. `burst: false` leaves a free-running clock out
 * of burst finding.
 */
export type TimingChannel = { label: string; burst?: boolean } & ({ node: string; level?: number } | { part: string });

/** A node to watch for exact edges between snapshots: an attach point or named node, at `level` volts if given. */
export type WatchConfig = string | { node: string; level?: number };

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
 * Readouts drawn over parts on the bench: "stress" is a bar of an LED's current as a share of its maximum (green,
 * amber past half, red past 90%); "heat" a part's temperature with a touch-feel word (cool, warm, hot, ouch).
 * `parts` lists part ids or kinds ("D1", "resistor"), so parts dragged in from the tray get one too.
 */
export type InspectConfig = { kind: "inspect"; show: "stress" | "heat"; parts: string[] };

export type InstrumentConfig =
  | "meter"
  | "scope"
  | MeterConfig
  | ScopeConfig
  | InspectConfig
  | LoggerConfig
  | StopwatchConfig
  | TapperConfig;

type ControlCommon = {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  /** "log" for values that span decades. */
  scale?: "linear" | "log";
  /** How to show the value: a unit such as "Ω", "%" or "×". */
  unit?: string;
};

/**
 * A slider. Bound to a simulator input of a part (light on a phototransistor, a fingertip's resistance, a trimmer's
 * knob; `part: "*"` drives every part that takes the input, all the phototransistors), to the simulation's speed
 * (`key: "speed"`, 1 is real time, up to 3600 for a time-lapse), or to the room lights (`key: "room"`, 1 bright down
 * to 0.1, so faint glows show). Goals read it with `lab.control(id)`.
 */
export type ControlConfig =
  | (ControlCommon & { part: string; key: Extract<InputKey, "light" | "ohms" | "position" | "proximity"> })
  | (ControlCommon & { key: "speed" | "room"; part?: undefined });

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
  /** Nodes to watch for exact edges between snapshots (`lab.edges(node)`, exact `lab.widths`). Timing diagram channels are watched anyway. */
  watch?: WatchConfig[];
  /**
   * Teaching overlays over the bench (docs/BENCH-VIEWS.md, "Overlays"): flow dots riding every lead and part
   * ("current", plus to minus, or "electrons", minus to plus and slower), push hatching with a hill by each battery
   * and sealed box, what is on at the start, and which toggles the lab's panel offers the learner.
   */
  overlays?: { flow?: "current" | "electrons"; push?: boolean; offer?: OverlayName[] };
  /** The code drawer of a microcontroller board (Unit 5): `tool: code` in a lesson, beside `serial` and `millis`. */
  code?: CodeConfig;
};

/**
 * The code drawer (Unit 5, docs/LABS.md "Code"): the board it uploads to, the program it starts with (a draft in the
 * drawer until the learner presses Upload), the blocks its palette offers and whether it offers the text view.
 */
export type CodeConfig = {
  /** The microcontroller board's part id ("U1"). */
  board: string;
  /** The program in the drawer at the start (bench C). Default: the program on the board, else an empty setup and loop. */
  source?: string;
  /**
   * The blocks the palette offers outside a lesson: a block's name ("delay", "digitalWrite", "every", "if") or steps
   * written in bench C ("digitalWrite(13, LOW);"). In a bench lesson each beat offers its own (`palette` on the beat;
   * a beat without one offers none). Default: none (the learner edits what is there).
   */
  palette?: string[];
  /** Offer the text view beside the blocks (default true; lessons before the text view leave it out). */
  text?: boolean;
};

/** The overlays a learner can switch: flow dots, the dots as electrons, the push view. */
export type OverlayName = "flow" | "electrons" | "push";

/**
 * Views a panel or tool turns on while it is open, for `lab.view(name)`: a chip's x-ray ("xray:U1"), the code
 * drawer's text view ("code:text"), a board's millis readout ("millis:U1") and its serial monitor ("serial:U1").
 */
export type PanelViewName = `xray:${string}` | "code:text" | `millis:${string}` | `serial:${string}`;

/** Whether a view name belongs to a panel or tool rather than an overlay on the bench. */
export const isPanelView = (name: string): name is PanelViewName => /^(xray|millis|serial):./.test(name) || name === "code:text";

/** The views and overlays that are on, as `lab.view(name)` reads them. */
export type LabViews = { flow: "off" | "current" | "electrons"; push: boolean; xray: boolean; trace: string | null };

/** What the loop tracer found, from a terminal: whether it closed, where it stopped, what it went through. */
export type TraceResult = { closed: boolean; gap: string | null; parts: string[]; leads: string[] };

/** A schematic card: complete once every torn piece sits in its gap the right way round. */
export type DrawingState = { complete: boolean; pieces: { id: string; seated: boolean; turn: number; right: boolean }[] };

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
  /**
   * Bench lessons (docs/LESSONS.md): actions applied when this task's beat begins, on top of the bench the solution
   * reaches at the previous check. Parts coming into play, or a fix-it round's broken circuit. The solution must
   * start this task's steps with the same actions (spread one const into both), so replays and "Show me" agree.
   */
  setup?: SolutionStep[];
  /**
   * Bench lessons: gentle lines for typical mistakes, checked while this task is current. The first whose `when`
   * holds is said once the bench has shown it for a moment ("Dark? Turn the LED around.").
   */
  nudges?: Nudge[];
};

/** A short robot line for a mistake the bench is showing right now. `when` is pure, like a goal. */
export type Nudge = { when: (lab: LabView) => boolean; say: string };

// ---------------------------------------------------------------------------------------------------------------
// Solutions: bench actions as data. A test replays them headlessly; "Show me" plays them on the bench.

export type SolutionStep =
  | { do: "place"; part: string; kind: BenchPartKind; at: Spot; params?: Record<string, unknown>; rot?: number }
  | { do: "move"; part: string; at: Spot; rot?: number; holes?: undefined }
  /**
   * Move only these flying leads into these holes (null takes one out), keeping the others where they are: the
   * logic probe's tip from hole to hole, its supply leads left on the rails.
   */
  | { do: "move"; part: string; holes: Record<string, Spot | null>; at?: undefined; rot?: undefined }
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
  /** Change a part's settings as the learner would from its selection bar (moisture, a test load, a pencil line). */
  | { do: "param"; part: string; params: Record<string, string | number | boolean> }
  /** A part's one-shot action from its selection bar (the pencil card's "erase"). */
  | { do: "action"; part: string; action: string }
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
  /** Let a histogram's auto-roller roll `times` (default its `rolls`); the next step waits for it. */
  | { do: "roll"; id: string; times?: number }
  /**
   * Switch an overlay or view on or off, as its toggle would: flow dots, electrons, push, the board's x-ray, a chip's
   * x-ray panel ("xray:U1"), the code drawer's text view ("code:text"), a board's millis readout ("millis:U1") or
   * serial monitor ("serial:U1").
   */
  | { do: "view"; name: OverlayName | "xray" | PanelViewName; on: boolean }
  /**
   * The code drawer (Unit 5): write this program for the board and press Upload. A program with a mistake is refused,
   * as the drawer refuses it (the board keeps what it had; `lab.code(part).errorsSeen` notes the mistake); one that
   * compiles goes to the board, which restarts, even when it is the same program again.
   */
  | { do: "code"; part: string; source: string }
  /** Run the loop tracer from a terminal ("B1.neg"), as tapping it would; null clears the ink. */
  | { do: "trace"; from: Attach | null }
  /** The static toy: rub a balloon, comb or spoon back and forth on the scarf, `strokes` times (default 6). */
  | { do: "rub"; part: string; on: string; strokes?: number }
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
  /**
   * Worksheets beside the tasks: continuity and truth tables, pin maps, tags, a hole hunt, a symbol builder, the chip
   * x-ray, a timing diagram, a dice histogram and keys for two players.
   */
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
    /** Parts the board refused to seat in this visit (a surface-mount chip dropped on holes), by id. */
    readonly rejected: readonly string[];
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
  /**
   * The parts (two leads each) are linked end to end in one open chain, in any order, with nothing else on the links
   * between them. `ends` are the two free leads, the first where the chain's majority direction starts (a stack of
   * cells: its plus end); `flipped` lists parts turned against that direction (a reversed cell). Null otherwise.
   */
  chain(ids: readonly string[]): { ends: [Attach, Attach]; flipped: string[] } | null;
  /** Both parts' two leads sit on the same pair of nodes (side by side). */
  parallel(a: string, b: string): boolean;
  /** The red probe touches `a` (or metal joined to it) and the black probe `b`; "rev" the other way, "either" both. */
  probed(a: Attach, b: Attach, dir?: "rev" | "either"): boolean;
  /** The part ids in a holder's seats (resistor clips, a test station, a lemon's slots, a bin). */
  holds(holderId: string): string[];
  /** The holder a part sits in, or null. */
  heldBy(partId: string): string | null;
  /** Desk distance between two parts' positions, in millimetres (Infinity when one is missing). */
  distance(a: string, b: string): number;
  /** When a task in this lab was done in this visit: the time and the meter as it read then. */
  doneAt(taskId: string): { t: number; meter: MeterView | null } | undefined;
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
  /**
   * Recent samples of "glow:D1", "i:R1", "v:R1", "volts:<node>", "temp:R1", "closed:S1" (1 closed, 0 open),
   * "count:U2" (a counter's count), "logic:<node>" (1 high, 0 low) or "extra:U1.<key>" over the last `seconds`
   * (default 10).
   */
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

  // Start here: gates, sealed boxes, overlays, tags, drawings, the tracer.
  /** The current through the lead a gate is clipped on, in amps (its size), 0 when it is on no lead. */
  gate(gateId: string): number;
  /** The unit a gate in number mode shows ("A" or "mA"), or null when it is not a gate. */
  gateUnit(gateId: string): "A" | "mA" | null;
  /** Dots a gate has counted since the lab started (the ticks on its flag). */
  gateTicks(gateId: string): number;
  /** A sealed box's (or the cabinet's) lid is open. */
  lidOpen(boxId: string): boolean;
  /**
   * A view or overlay is on: "push", "flow" (dots, either way), "electrons", "xray" (the board's), "xray:XA" (that AA
   * cell cut open, or a chip's x-ray panel open: "xray:U1"), "trace" (the tracer's ink).
   */
  view(name: string): boolean;
  /** What a value tag shows now ("10 kΩ", or "10,000 Ω" once tapped open); a sealed box's tag too. Null otherwise. */
  tagShown(id: string): string | null;
  /** A schematic card's state: complete once its torn piece sits in the gap the right way round. Null for other parts. */
  drawing(cardId: string): DrawingState | null;
  /** The loop tracer from a terminal ("B1.neg"), worked out on the bench as it is: closed, or the gap it stops at. */
  trace(from: Attach): TraceResult;
  /** A battery's state of charge, 0..1 (its `charge` param starts it), or null. */
  charge(batteryId: string): number | null;
  /**
   * The static toy (its own small model, not the circuit simulator): a thing's static charge in marks, negative for
   * minus marks (a balloon rubbed on the scarf), positive for plus marks (the scarf). 0 for anything uncharged.
   */
  static(id: string): number;
  /** A balloon is stuck to a wall (charged, against its face). */
  stuck(balloonId: string): boolean;
  /** What is pulling a heap of paper bits up (a charged balloon or comb close by), or null. */
  lifted(paperId: string): string | null;
  /** Centre to centre distance between two balloons, in mm (two charged ones keep apart). */
  apart(a: string, b: string): number;

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
  /** Soldering, perfboard, wire and wall adapters (Unit 3): the iron, joints, tugs, clips, strips, tubes, boards, plans. */
  readonly solder: SolderLab;

  /** A chip's pin by number or name (`lab.pin("U1", 6)`, `lab.pin("U1", "threshold")`): its node, volts and level. */
  pin(chip: string, pin: number | string): ChipPin | null;
  /** How a chip sits on the board (straddling the channel, which way its notch points), or null when it is not on it. */
  chipSeat(id: string): ChipSeat | null;
  /**
   * A node's logic level: a logic chip's pin as the chip reads it (`L`, `H`, `X` undefined, `Z` unpowered), any other
   * node by 30% and 70% of the supply of a chip on it (or of the highest voltage on the bench).
   */
  logic(node: string): Level;
  /**
   * The lengths of a source's complete high stretches, oldest first, crossing `level` (default halfway): exact from
   * the edge log when the node is watched ("volts:U1.3" with U1.3 in `watch`), else from the snapshots.
   */
  widths(source: string, level?: number, seconds?: number): number[];
  /** High time, low time, period and duty (share of the period spent high) of the latest whole cycles, or null. */
  duty(source: string, level?: number, seconds?: number): Duty | null;
  /** The values a source went through, repeats removed ("count:U2": the counts in order), over `seconds` (default 10). */
  values(source: string, seconds?: number): number[];
  /** A button's or switch's presses (closed spells) over the last `seconds` (default 10); the last may still be on. */
  presses(id: string, seconds?: number): Spell[];
  /** Crossings of a watched node over the last `seconds` (default all kept): counts, times and whether they are exact. */
  edges(node: string, seconds?: number): EdgeCount;
  /** A timing diagram's state: its latest burst, how often the learner replayed it. */
  timing(id: string): TimingView;
  /** A histogram's rolls and tallies. */
  rolls(id: string): RollsView;
  /** The scope's last single-shot capture (times in seconds from the trigger), or null. */
  capture(): CaptureView | null;

  // Unit 5: the microcontroller board and its code drawer (docs/LABS.md, "Code").
  /** A microcontroller board: power, the program on it and its state, its clock, uploads. Null for anything else. */
  board(id: string): BoardView | null;
  /** Uploads to a board since the lab started: the drawer's Upload, a solution's code step, a setup's program. */
  uploads(board: string): number;
  /** What a board printed to the serial monitor since its last upload. */
  serial(board: string): SerialView;
  /** A board's `millis()` now (a 32-bit count of milliseconds), or null when it is not a board. */
  millis(board: string): number | null;
  /** The code drawer of a board: the view open, the program in it, the mistake Upload last refused, every kind met. */
  code(board: string): CodeView;
};

/**
 * A chip pin as `lab.pin` reads it. A microcontroller board's pin (`lab.pin("U1", 13)`, `lab.pin("U1", "A0")`) also
 * says how the program drives it (`mode`), the current out of it in mA and whether it burned out.
 */
export type ChipPin = {
  n: number;
  name: string;
  node: NodeId | null;
  volts: number | undefined;
  level: Level;
  mode?: "INPUT" | "INPUT_PULLUP" | "OUTPUT" | "PWM";
  mA?: number;
  dead?: boolean;
};

/** A microcontroller board as `lab.board(id)` reads it. */
export type BoardView = {
  power: "usb" | "jack" | "off";
  powered: boolean;
  /** "none" (nothing uploaded), "running", "error" (does not compile), "stopped" (stopped while running), "off". */
  program: "none" | "running" | "error" | "stopped" | "off";
  /** The program on the board (its last upload), or null. */
  source: string | null;
  /** Why the program is not running: "line:col sentence", or what stopped it. Null while it runs. */
  error: string | null;
  /** The line of the program running now, or null. */
  line: number | null;
  /** `millis()` now. */
  millis: number;
  uploads: number;
  /** Times `millis()` rolled over from 4,294,967,295 to 0 since the last upload (the day-49 jump). */
  wraps: number;
};

/** What a board printed since its last upload: the finished lines (with when each ended) and the text so far. */
export type SerialView = {
  lines: string[];
  /** Simulated seconds at which each line in `lines` finished. */
  times: number[];
  /** The line still being printed (`Serial.print` without a line end yet), or "". */
  partial: string;
  /** Every line and the one still being printed, as the monitor shows them. */
  text: string;
};

/** The code drawer as `lab.code(board)` reads it. */
export type CodeView = {
  /** The view the drawer shows: the blocks, or the text. */
  view: "blocks" | "text";
  /** The program in the drawer now, uploaded or not. */
  source: string;
  /** The mistake the last Upload was refused for, or null once a program went up. */
  error: { line: number; col: number; kind: string; message: string } | null;
  /** Kinds of mistakes Upload refused in this visit ("case", "semicolon" ...), oldest first, each once. */
  errorsSeen: string[];
  /** Upload presses in this visit, refused ones too. */
  attempts: number;
};

/** Crossings of a node. `exact` is false when the node is not watched (counted from the snapshots, which miss fast edges). */
export type EdgeCount = { rises: number; falls: number; times: [number, 0 | 1][]; exact: boolean; high: boolean };

export type TimingView = {
  /** The latest burst of edges (null before any), with its glitches and the channels' combined states. */
  burst: Burst | null;
  /** How many slow-motion replays the learner started, and the start time of the burst replayed last. */
  replays: number;
  replayed: number | null;
};

export type RollsView = {
  /** Every roll, oldest first: one face per die (0 a blank face). */
  list: number[][];
  tally: Tally;
  /** The auto-roller is rolling. */
  rolling: boolean;
  /** Rolls drawn from a recorded lap (the fast roller) rather than pressed one by one. */
  sampled: number;
};

export type CaptureView = { at: number; series: { label: string; points: [number, number][] }[] };

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
    if (p.kind === "timing" && (!p.channels.length || p.channels.length > 8)) fail(`timing panel "${p.id}" needs 1 to 8 channels`);
    if (p.kind === "histogram" && (!p.dice.length || p.dice.length > 2 || p.dice.some((d) => !d.length))) fail(`histogram "${p.id}" needs one or two dice, each with its pip LEDs`);
    if (p.kind === "keys" && new Set(p.buttons.map((b) => b.key.toLowerCase())).size !== p.buttons.length) fail(`keys panel "${p.id}" binds one key twice`);
    if (p.kind === "truth-table" && !p.output && !p.outputs?.length) fail(`truth table "${p.id}" has no output`);
  }
  for (const s of def.solution) if (s.do === "roll" && !def.panels?.some((p) => p.id === s.id && p.kind === "histogram")) fail(`solution rolls unknown histogram "${s.id}"`);
  for (const s of def.solution) if (s.do === "panel" && !panels.has(s.id)) fail(`solution answers unknown panel "${s.id}"`);
  const code = def.bench.code;
  if (code && !def.bench.parts.some((p) => p.id === code.board && p.kind === "mcu-board")) fail(`the code drawer's board "${code.board}" is not a microcontroller board on the bench`);
  return def;
}

/** Whether a task is optional (the `optional` and `bonus` flags mean the same). */
export const isOptional = (t: Pick<LabTask, "optional" | "bonus">): boolean => !!(t.optional || t.bonus);
