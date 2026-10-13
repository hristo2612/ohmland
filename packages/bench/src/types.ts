// Bench data model. Everything in BenchState is plain JSON: it is saved for sandbox builds and lab checkpoints.
// Units: millimetres on the desk plane. x grows to the right, z grows toward the viewer, y is up.

import type { InputKey, LedColor, MeterMode, NodeId, Netlist } from "@ohmland/sim";

export type { InputKey, LedColor, MeterMode, NodeId, Netlist };

/** A point on the desk plane: [x, z] in millimetres. */
export type Vec2 = [number, number];
/** A point in the scene: [x, y, z] in millimetres. */
export type Vec3 = [number, number, number];

export type BoardKind = "bb830" | "bb400";

export type BoardSpec = {
  kind: BoardKind;
  /** Power rails broken in the middle (some full-size boards are made this way). 830-point boards only. */
  splitRails?: boolean;
  /** Board centre on the desk. Defaults to [0, 0]. */
  pos?: Vec2;
};

/**
 * A breadboard hole. Terminal holes are a row letter plus a column number ("a1" to "j63").
 * Rail holes use the column number they line up with: "tp3" (top/far plus rail), "tn3" (top minus),
 * "bp3" (bottom/near plus), "bn3" (bottom minus).
 */
export type HoleId = string;

export type BenchPartKind =
  | "resistor"
  | "led"
  | "battery"
  | "pushbutton"
  | "slide-switch"
  | "toggle-switch"
  | "fuse"
  | "ceramic-cap"
  | "electrolytic-cap"
  | "trimmer"
  | "relay"
  | "npn"
  | "phototransistor"
  | "diode"
  | "speaker"
  | "cup"
  | "lemon"
  | "dpdt-switch"
  | "touch-pads";

export type WaterKind = "distilled" | "tap" | "salty";

/**
 * Desk modules: a part mounted on a small wooden block with brass screw terminals along its front edge, easy to clip
 * test leads to. `base: true` on a pushbutton, slide switch, toggle switch, trimmer or relay; the DPDT switch always
 * has one. Base parts never go into the board.
 */
type Base = {
  base?: boolean;
};

/**
 * A part whose legs are shuffled and unlabelled (a puzzle for the meter): the terminals show only numbers 1 to n, and
 * terminal i is wired inside as leg `legs[Number(mystery[i])]` (a permutation written as digits, in leg order).
 * `peek` shows the inside (a clear cover, the wiring printed on the plate).
 */
type Mystery = {
  mystery?: string;
  peek?: boolean;
};

export type PartParamsMap = {
  resistor: {
    /** Nominal value: what the colour bands show. */
    ohms: number;
    bands?: 4 | 5;
    watts?: number;
    /** percent, 5 = gold, 10 = silver, 1 = brown */
    tolerance?: number;
    /** The part's real value within its tolerance, used by the simulator (labs seed it). Defaults to `ohms`. */
    actualOhms?: number;
  };
  led: { color: LedColor; size?: 3 | 5; lens?: "diffused" | "clear"; maxmA?: number };
  battery: { snap?: boolean; emf?: number; internalOhms?: number; mAh?: number };
  pushbutton: { cap?: "black" | "red" | "blue" | "yellow" | "white"; /** Connected until pressed. */ normallyClosed?: boolean } & Base;
  "slide-switch": { to: "a" | "b" } & Base;
  "toggle-switch": {
    to: "a" | "b";
    /** Mounted on a small wooden block with screw terminals: a big, easy switch for desk circuits. Desk only. */
    base?: boolean;
    /** 1: an on/off switch with only the com and b terminals (SPST). Default 2 (SPDT). */
    throws?: 1 | 2;
  };
  fuse: { amps: number };
  "ceramic-cap": { farads: number; volts?: number; /** The real value, for an out-of-spec part (labs). */ actualFarads?: number };
  "electrolytic-cap": { farads: number; volts?: number; /** The real value, for an out-of-spec part (labs). */ actualFarads?: number };
  trimmer: { ohms: number; /** wiper position 0..1 from pin a to pin b */ position: number } & Base;
  relay: {
    coilVolts?: number;
    coilOhms?: number;
    pullIn?: number;
    dropOut?: number;
    /** 1: a single changeover contact, five legs (coil1 coil2 com1 nc1 no1). Default 2 (DPDT, eight legs). */
    poles?: 1 | 2;
    /** Coil inductance in henries (simulator default 0.1). */
    coilHenries?: number;
  } & Base &
    Mystery;
  npn: { model?: "2N3904" };
  phototransistor: { size?: 3 | 5 };
  diode: { model?: "1N4001" | "1N4148" };
  speaker: { ohms?: number; /** cone diameter in mm */ size?: number };
  cup: { water: WaterKind; /** overrides the default resistance for the water kind */ ohms?: number };
  lemon: { emf?: number; internalOhms?: number };
  /** Two slide-switch poles on one slider (desk block, six terminals). */
  "dpdt-switch": { to: "a" | "b" } & Mystery;
  /** A pair of copper touch pads: a fingertip across them is a resistance (100 kΩ firm and damp to 2 MΩ light and dry). */
  "touch-pads": { ohms?: number };
};

type PartOf<K extends BenchPartKind> = {
  /** Reference designator, unique on the bench: "R1", "D2", "B1". Letters, digits, "_" and "-" only. */
  id: string;
  kind: K;
  params: PartParamsMap[K];
  /** Body origin on the desk when the part is not on the board (for board parts it is derived and kept in sync). */
  pos: Vec2;
  /** Rotation around the vertical axis in degrees (multiples of 90 on the board). */
  rot: number;
  /** Leads seated in breadboard holes, by lead name. When set for all footprint leads the part is on the board. */
  holes?: Partial<Record<string, HoleId>>;
  /** Free ends of flexible leads lying on the desk (battery snap, speaker wires), by lead name. */
  ends?: Partial<Record<string, Vec2>>;
};

export type PlacedPart = { [K in BenchPartKind]: PartOf<K> }[BenchPartKind];
export type PlacedPartOf<K extends BenchPartKind> = PartOf<K>;

export type WireColor = "red" | "black" | "blue" | "green" | "yellow" | "orange" | "white" | "purple";

/** A solid-core jumper wire from hole to hole. */
export type Wire = { id: string; a: HoleId; b: HoleId; color: WireColor };

/**
 * Anything a lead, probe or clip can connect to, as a string:
 * "hole:a12", "pin:R1.a" (a part lead), "wire:W1.a" (a jumper end), "lead:L1.b" (a test lead clip),
 * "probe:red" (a meter probe tip), "socket:com" (a meter socket).
 */
export type Anchor = string;

export type LeadEnd = {
  /** What the clip or probe tip is attached to, or null when it lies free on the desk. */
  to: Anchor | null;
  /** Where it lies on the desk when free (kept as the last free position when attached). */
  pos: Vec2;
};

export type LeadColor = "red" | "black" | "green" | "yellow" | "blue" | "white";

/** An alligator test lead: a flexible wire with a crocodile clip at each end. */
export type TestLead = { id: string; color: LeadColor; a: LeadEnd; b: LeadEnd };

export type MeterSocket = "com" | "vohm" | "ma" | "a10";

export type ProbeColor = "red" | "black";

export type MeterProbe = {
  /** Socket the banana plug is in, or null when it is unplugged. */
  socket: MeterSocket | null;
  /** Where the unplugged banana plug lies on the desk. */
  plugPos: Vec2;
  /** The probe tip. */
  tip: LeadEnd;
};

export type MeterState = {
  /** Part id used in the netlist and snapshot. Defaults to "M1". */
  id: string;
  pos: Vec2;
  rot: number;
  mode: MeterMode;
  /** "auto" or a manual range label such as "20V". */
  range?: string;
  probes: Record<ProbeColor, MeterProbe>;
};

export type BenchState = {
  v: 1;
  board: BoardSpec | null;
  parts: PlacedPart[];
  wires: Wire[];
  leads: TestLead[];
  meter: MeterState | null;
};

/** An item that can be dragged from the tray onto the bench. */
export type TrayItem =
  | {
      kind: BenchPartKind;
      params?: Record<string, unknown>;
      label?: string;
      /** how many may be placed; unlimited when absent */
      count?: number;
      /** Id for the placed part when it is free ("R2"); otherwise the next free id for the kind. */
      id?: string;
    }
  | { kind: "lead"; params?: { color?: LeadColor }; label?: string; count?: number; id?: string };

export type TrayKind = TrayItem["kind"];

export type Selection =
  | { type: "part"; id: string }
  | { type: "wire"; id: string }
  | { type: "lead"; id: string }
  | { type: "meter"; id: string };

/** Events reported through the `onAction` prop. "input" events are meant to be forwarded to `sim.setInput`. */
export type BenchAction =
  | { type: "part:add"; partId: string; kind: BenchPartKind }
  | { type: "part:move"; partId: string }
  | { type: "part:rotate"; partId: string }
  | { type: "part:remove"; partId: string }
  | { type: "wire:add"; wireId: string }
  | { type: "wire:remove"; wireId: string }
  | { type: "lead:add"; leadId: string }
  | { type: "lead:remove"; leadId: string }
  | { type: "lead:clip"; leadId: string; end: "a" | "b"; to: Anchor | null }
  | { type: "meter:mode"; mode: MeterMode }
  | { type: "meter:plug"; probe: ProbeColor; socket: MeterSocket | null }
  | { type: "meter:probe"; probe: ProbeColor; to: Anchor | null }
  | { type: "input"; partId: string; key: InputKey; value: number | boolean | string }
  | { type: "select"; selection: Selection | null }
  | { type: "undo" }
  | { type: "redo" };

export type Quality = "high" | "low";
