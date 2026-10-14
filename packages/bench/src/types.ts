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
  | "touch-pads"
  // Lab props (Unit 1): holders, material samples, the pencil card, the fruit cell kit and desk furniture.
  | "holder"
  | "station"
  | "fruit"
  | "electrode"
  | "skin"
  | "sample"
  | "card"
  | "tag"
  | "bin"
  | "chart"
  | "clock"
  | "showcase"
  // Start here: a clip-on flow counter, sealed boxes and the parts cabinet, a drawing with a torn piece, and the static
  // toy (a balloon, a wool scarf, paper bits, a comb, a spoon, a wall).
  | "gate"
  | "box"
  | "schematic"
  | "piece"
  | "balloon"
  | "scarf"
  | "paper"
  | "comb"
  | "wall"
  // Unit 5: an Uno-style microcontroller board (desk part with header sockets).
  | "mcu-board";

export type WaterKind = "distilled" | "tap" | "salty";

/** Which part sits in each seat of a holder (resistor clips, a lemon's electrode slots, a battery test station). */
export type Held = Partial<Record<string, string>>;

export type BatterySize = "9v" | "aa" | "coin";

/**
 * What a material sample is: a bare copper wire and a plastic ruler (Unit 1), and the junk drawer's everyday objects
 * (Start here): a key, a coin, a foil strip, a pencil lead, a plastic spoon, a rubber eraser, a glass marble, a dry
 * wooden stick, a piece of string, a plastic-coated paper clip (bare only at its cut ends), and a metal spoon (the
 * static toy's).
 */
export type SampleMaterial = "copper" | "plastic" | "key" | "coin" | "foil" | "pencil" | "spoon" | "metal-spoon" | "eraser" | "marble" | "wood" | "string" | "clip";

/** Symbols drawn in ink: on a drawer's face, a schematic card, a torn piece of one. */
export type SymbolKind = "battery" | "cell" | "resistor" | "led" | "switch" | "lamp";

/** One symbol on a schematic card's loop, with the bench part it stands for (tapping it spotlights that part). */
export type SchematicSymbol = { kind: SymbolKind; part?: string; text?: string };
export type Moisture = "dry" | "damp" | "wet" | "salty";

/**
 * Desk modules: a part mounted on a small wooden block with brass screw terminals along its front edge, easy to clip
 * test leads to. `base: true` on a pushbutton, slide switch, toggle switch, trimmer or relay; the DPDT switch always
 * has one. Base parts never go into the board.
 */
type Base = {
  base?: boolean;
  /** A short name printed on the block ("S1", "K1"), so a desk full of blocks can be told apart. */
  tag?: string;
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
  battery: {
    snap?: boolean;
    emf?: number;
    internalOhms?: number;
    mAh?: number;
    /** "9v" (default) stands upright with snap terminals; "aa" lies in a little cradle; "coin" sits in a holder. */
    size?: BatterySize;
    /** Chemistry printed on the wrap: alkaline (default), rechargeable NiMH or lithium. */
    chem?: "alkaline" | "nimh" | "lithium";
    /** A scuffed, used-looking battery. */
    worn?: boolean;
    /** State of charge it starts at, 0..1 (default full): a tired battery for a time-lapse. */
    charge?: number;
    /**
     * A cutaway (AA): the can cut open to show the two chemicals and the separator. When it is set (true or false) a
     * tap on the cell toggles it; left out, the cell is a plain battery.
     */
    xray?: boolean;
  };
  pushbutton: { cap?: "black" | "red" | "blue" | "yellow" | "white"; /** Connected until pressed. */ normallyClosed?: boolean } & Base;
  "slide-switch": { to: "a" | "b" } & Base;
  "toggle-switch": {
    to: "a" | "b";
    /** Mounted on a small wooden block with screw terminals: a big, easy switch for desk circuits. Desk only. */
    base?: boolean;
    /** A short name printed on the block ("S1"). */
    tag?: string;
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
  cup: {
    water: WaterKind;
    /** overrides the default resistance for the water kind */
    ohms?: number;
    /** pinches of salt stirred in (the "Add salt" action): each one adds its own path for the flow */
    salt?: number;
  };
  lemon: { emf?: number; internalOhms?: number };
  /** Two slide-switch poles on one slider (desk block, six terminals). */
  "dpdt-switch": { to: "a" | "b"; /** A short name printed on the block. */ tag?: string } & Mystery;
  /** A pair of copper touch pads: a fingertip across them is a resistance (100 kΩ firm and damp to 2 MΩ light and dry). */
  "touch-pads": { ohms?: number };
  /** Two spring clips that hold a resistor (or diode) above a small block, with a screw terminal at each end. */
  holder: { held?: Held };
  /** A battery test station: a bay for any battery, + and − terminals, and a switchable test load. */
  station: { held?: Held; load: boolean; loadOhms?: number };
  /**
   * Half a lemon with two electrode slots. Copper and zinc apart make a cell (about 0.92 V, copper is plus), the same
   * metal twice almost nothing, and electrodes pushed together short it out.
   */
  fruit: { held?: Held; touching?: boolean; emf?: number; internalOhms?: number };
  /** A copper-plated coin or a galvanised (zinc) strip, for the fruit cell. */
  electrode: { metal: "copper" | "zinc" };
  /**
   * A patch of skin with probe marks 1 cm apart (legs m0 to m4). Resistance between two marks is two contact
   * resistances plus the bulk per centimetre, both set by moisture and probe pressure.
   */
  skin: { moisture: Moisture; pressure: "light" | "firm" };
  /**
   * A material sample with a clip point at each end (`a`, `b`): a bare copper wire, a plastic ruler or an everyday
   * object. The coated paper clip also has `coat`, a spot on its plastic coating that joins nothing.
   */
  sample: { material: SampleMaterial; /** overrides the material's resistance */ ohms?: number; /** static charge in marks (see static.ts) */ charge?: number };
  /**
   * A white card with a pencil line drawn from its 0 mark: `length` in cm (0 to 10, 0.5 cm steps), `layers` of
   * graphite (0 to 4), narrow or wide. Probe points every 0.5 cm along the line (legs p0 to p20).
   */
  card: { length: number; layers: number; wide?: boolean };
  /**
   * A paper value label to drag next to a part. Tapping it toggles `alt`, which writes the value without its prefix
   * ("10 kΩ" becomes "10,000 Ω", "20 mA" becomes "0.02 A"): see `expandPrefix`.
   */
  tag: { text: string; alt?: boolean };
  /**
   * A small reject bin; parts dropped in it sit in its seats. `style: "tray"` is a big sorting tray (the junk drawer's
   * objects lie in it), `style: "drawer"` a parts drawer with a symbol `face` instead of a word. `accepts` limits the
   * bench kinds that drop in: anything else stays out on the desk (a wrong part will not go into the drawer).
   */
  bin: { held?: Held; label?: string; style?: "bin" | "tray" | "drawer"; face?: SymbolKind; accepts?: BenchPartKind[] };
  /** The resistor colour code on a card. */
  chart: { bands?: 4 | 5 };
  /** A desk clock that shows simulated time (for time-lapse runs). */
  clock: { from?: number };
  /** A glass display case with a phone battery pack and a car battery: look, don't touch. */
  showcase: Record<string, never>;
  /**
   * A counting gate: a ring that clips round a clip lead (`on`, its id; `at`, how far along it, 0..1) and ticks once for
   * every flow dot that passes, with a rate bar. `mode: "number"` shows the current instead ("0.0075 A"); tapping the
   * unit switches between A and mA. Off a lead it lies on the desk and reads nothing.
   */
  gate: { on?: string; at?: number; mode?: "ticks" | "number"; unit?: "A" | "mA" };
  /**
   * A sealed box: parts sit inside (seats `s1` to `s4`) under a lid, and only its two terminals (`t1` on the left,
   * `t2` on the right) or a knob show. `wiring` joins the held parts' leads to the terminals and to each other inside:
   * "<seat>.<lead>" -> "t1", "t2" or a junction "j1" to "j4". While the lid is shut the parts inside cannot be seen,
   * picked or clipped. `marks: "plain"` makes the two terminals identical brass posts (which is plus?). `knob` puts a
   * knob on the front that follows the trimmer inside. `style: "cabinet"` is the parts cabinet: no terminals, room for
   * a handful of parts, and a three-wheel padlock (`lock`) when it is locked.
   */
  box: {
    held?: Held;
    /** The lid is open. */
    lid?: boolean;
    wiring?: Record<string, string>;
    marks?: "pm" | "plain";
    knob?: boolean;
    /** A big name on the lid ("A", "B"). */
    label?: string;
    /** A value tag tied to the box ("10 kΩ"); tapping it toggles `tagAlt` (written out without the prefix). */
    tag?: string;
    tagAlt?: boolean;
    style?: "box" | "cabinet";
    /** The cabinet's padlock: one wheel per answer, each showing its answer once `set`. Gone once the lid is open. */
    lock?: { wheels: string[]; set: boolean[] };
  };
  /**
   * A schematic drawn in ink on a card: the symbols round one loop, the first on the left (a battery, plus at the top),
   * the rest clockwise. `torn` is the index of a symbol torn off; its place is a seat for a `piece`.
   */
  schematic: { symbols: SchematicSymbol[]; torn?: number; held?: Held; title?: string };
  /** A torn-off piece of a schematic card with one symbol, turned by `turn` degrees (tap it to turn it a quarter). */
  piece: { symbol: SymbolKind; turn?: number; text?: string };
  /**
   * The static toy (docs/curriculum/start-here.md, SH3): a balloon on a string. `charge` is its static charge in marks
   * (negative: minus marks), which rubbing it on the scarf builds up (see static.ts).
   */
  balloon: { color?: "red" | "blue" | "yellow"; charge?: number };
  /** A wool scarf to rub things on (it keeps the plus marks it gives away). */
  scarf: { charge?: number };
  /** A little heap of paper bits. */
  paper: Record<string, never>;
  /** A plastic comb. */
  comb: { charge?: number };
  /** A strip of wall (wallpaper) a charged balloon can stick to. */
  wall: Record<string, never>;
  /**
   * An Uno-style microcontroller board (our own layout): header sockets for pins 0 to 13 (0 and 1 are RX and TX),
   * A0 to A5, 5V, two GND and VIN; a USB socket, a barrel jack, a reset button and the L and ON lamps.
   */
  "mcu-board": {
    /** The uploaded program (bench C source). */
    program?: string;
    /** Upload count: bump it (with or without a new program) to reset the board and run the program again. */
    upload?: number;
    /** "usb" (default), "jack" (a 9 V battery in the barrel jack) or "off". */
    power?: "usb" | "jack" | "off";
    /** millis() at reset, ms (a lab can start the clock just before it wraps). */
    clockStart?: number;
    /** The random generator's state at reset (default 1, as on a real board). */
    seed?: number;
  };
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
