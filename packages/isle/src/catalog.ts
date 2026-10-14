/**
 * What the isle can hold. Content refers to these ids: a lesson's `unlocks.isle` names a piece, a module's landmark
 * names a landmark. Pure data, no three.js.
 */

/**
 * Units in course order, by the id of their folder in content/units. Each is its own island; the first one the learner
 * reaches is the main island.
 */
export const UNITS = ["start-here", "basics", "switching", "permanent", "chips", "beyond"] as const;
export type UnitId = (typeof UNITS)[number];

/**
 * Other ids a unit has gone by. content/course.yaml lists Unit 3 among its upcoming units as `making-it-permanent`,
 * while its blueprint (docs/curriculum/unit-3.md, IC1) and this catalog call it `permanent`: either id builds the same
 * island.
 */
const UNIT_ALIASES: Record<string, UnitId> = { "making-it-permanent": "permanent" };
/** The catalog's id for a unit id: an alias resolves to its unit, any other id stays as it is. */
export const unitOf = (u: string): string => UNIT_ALIASES[u] ?? u;

/** Pieces: one per finished lesson. */
export const PIECES = [
  "resistor",
  "led-lamp",
  "battery",
  "meter-kiosk",
  "fuse",
  "test-lead-arch",
  "cell-jar",
  "switch",
  "pushbutton",
  "relay",
  "breadboard-patch",
  "jumper-arch",
  "capacitor",
  "ceramic-cap",
  "pot",
  "transistor",
  "phototransistor",
  "speaker",
  "diode",
  "wire-spool",
  "heatsink",
  "header-fence",
  "moss",
  "tuft",
  "lemon-tree",
  // Making it permanent
  "iron-stand",
  "solder-spool",
  "regulator",
  // Chips
  "chip-block",
  "reed-gate",
  "seven-seg",
  "logic-chip",
  "dice-block",
  // Beyond
  "coil-bolt",
  "magnet",
  "antenna",
  "mcu-board",
] as const;
export type PieceId = (typeof PIECES)[number];

/** Landmarks: one per finished module, grouped by the unit whose island they suit, in the order its modules build them. */
export const LANDMARKS_BY_UNIT: Record<UnitId, readonly string[]> = {
  "start-here": ["spark-gap", "pump-house", "meter-tower"],
  basics: ["resistor-hall", "lighthouse", "observatory", "power-station", "lemon-grove"],
  switching: ["switchyard", "relay-clocktower", "breadboard-plaza", "capacitor-water-tower", "transistor-gatehouse", "siren-tower"],
  permanent: ["solder-forge", "cable-pylon", "perfboard-pier"],
  chips: ["timer-factory", "alarm-lighthouse", "counter-billboard", "logic-castle", "dice-arcade"],
  beyond: ["coil-windmill", "radio-mast", "microcontroller-hq", "led-sundial"],
};
export const LANDMARKS = Object.values(LANDMARKS_BY_UNIT).flat();

/**
 * What a module whose landmark id is unknown builds: the next landmark of its unit in this rotation (Basics' for an
 * unknown unit). Frozen: an isle must not change when the catalog grows, so a new landmark is never added here and a
 * landmark that moves to another unit keeps its place. A unit that is not here rotates through its own landmarks.
 */
const FALLBACK: Record<string, readonly string[]> = {
  basics: ["meter-tower", "resistor-hall", "lighthouse", "observatory", "power-station", "lemon-grove"],
  switching: ["switchyard", "relay-clocktower", "breadboard-plaza", "capacitor-water-tower", "transistor-gatehouse", "siren-tower"],
  permanent: ["solder-forge", "perfboard-pier"],
  chips: ["timer-factory", "logic-castle", "counter-billboard", "dice-arcade"],
  beyond: ["coil-windmill", "radio-mast", "microcontroller-hq"],
};
export type LandmarkId = string;

/** Kinds the planner places on its own. */
export const DOCK = "dock";

/** Footprint radius in cells: the planner keeps this disc clear of roads and other things. */
const PIECE_FOOT: Record<PieceId, number> = {
  resistor: 0.9,
  "led-lamp": 0.4,
  battery: 0.9,
  "meter-kiosk": 0.9,
  fuse: 0.9,
  "test-lead-arch": 0.9,
  "cell-jar": 0.9,
  switch: 0.9,
  pushbutton: 0.4,
  relay: 0.9,
  "breadboard-patch": 1.4,
  "jumper-arch": 0.9,
  capacitor: 0.9,
  "ceramic-cap": 0.4,
  pot: 0.9,
  transistor: 0.4,
  phototransistor: 0.4,
  speaker: 0.9,
  diode: 0.9,
  "wire-spool": 0.9,
  heatsink: 0.9,
  "header-fence": 0.9,
  moss: 0.4,
  tuft: 0.4,
  "lemon-tree": 0.9,
  "iron-stand": 0.9,
  "solder-spool": 0.9,
  regulator: 0.9,
  "chip-block": 0.9,
  "reed-gate": 0.9,
  "seven-seg": 0.9,
  "logic-chip": 0.9,
  "dice-block": 0.9,
  "coil-bolt": 0.9,
  magnet: 0.9,
  antenna: 0.9,
  "mcu-board": 1.4,
};

/** Landmark footprint radius and how many visual tiers it has (it rises a tier with later modules on its island). */
const LANDMARK_SPEC: Record<string, { foot: number; tiers: number }> = {
  "spark-gap": { foot: 2.3, tiers: 2 },
  "pump-house": { foot: 2.6, tiers: 2 },
  "meter-tower": { foot: 2.3, tiers: 3 },
  "resistor-hall": { foot: 2.8, tiers: 2 },
  lighthouse: { foot: 2.3, tiers: 3 },
  observatory: { foot: 2.6, tiers: 2 },
  "power-station": { foot: 2.9, tiers: 3 },
  "lemon-grove": { foot: 2.6, tiers: 2 },
  switchyard: { foot: 2.9, tiers: 2 },
  "relay-clocktower": { foot: 2.3, tiers: 2 },
  "breadboard-plaza": { foot: 2.9, tiers: 2 },
  "capacitor-water-tower": { foot: 2.3, tiers: 2 },
  "transistor-gatehouse": { foot: 2.6, tiers: 2 },
  "siren-tower": { foot: 2.3, tiers: 2 },
  "solder-forge": { foot: 2.6, tiers: 3 },
  "cable-pylon": { foot: 2.3, tiers: 2 },
  "perfboard-pier": { foot: 2.6, tiers: 2 },
  "timer-factory": { foot: 2.9, tiers: 2 },
  "alarm-lighthouse": { foot: 2.3, tiers: 3 },
  "counter-billboard": { foot: 2.3, tiers: 2 },
  "logic-castle": { foot: 2.9, tiers: 3 },
  "dice-arcade": { foot: 2.3, tiers: 2 },
  "coil-windmill": { foot: 2.3, tiers: 2 },
  "radio-mast": { foot: 2.3, tiers: 3 },
  "microcontroller-hq": { foot: 2.9, tiers: 2 },
  "led-sundial": { foot: 2.6, tiers: 2 },
};

/** How many looks a piece has (colour of an LED, bands of a resistor...), picked by the island's generator. */
const VARIANTS: Partial<Record<string, number>> = {
  resistor: 4,
  "led-lamp": 5,
  battery: 3,
  "cell-jar": 3,
  switch: 2,
  pushbutton: 4,
  "jumper-arch": 3,
  capacitor: 3,
  "ceramic-cap": 2,
  pot: 2,
  speaker: 2,
  "wire-spool": 4,
  heatsink: 2,
  moss: 3,
  tuft: 3,
  "lemon-tree": 2,
  "solder-spool": 2,
  "chip-block": 2,
  "seven-seg": 3,
  "logic-chip": 3,
  "dice-block": 3,
  magnet: 2,
  "mcu-board": 2,
};

/**
 * The fallback deck for a lesson without a known piece: weight per piece. Never the same piece twice in a row. Frozen
 * like the landmark rotation: a new piece is never dealt from here.
 */
export const DECK: { kind: PieceId; w: number }[] = [
  { kind: "resistor", w: 3 },
  { kind: "led-lamp", w: 3 },
  { kind: "capacitor", w: 2.4 },
  { kind: "ceramic-cap", w: 1.6 },
  { kind: "diode", w: 1.4 },
  { kind: "transistor", w: 1.6 },
  { kind: "battery", w: 1.2 },
  { kind: "pushbutton", w: 1.2 },
  { kind: "switch", w: 1 },
  { kind: "pot", w: 1 },
  { kind: "fuse", w: 0.8 },
  { kind: "relay", w: 0.8 },
  { kind: "header-fence", w: 1 },
  { kind: "jumper-arch", w: 0.8 },
  { kind: "wire-spool", w: 0.6 },
  { kind: "heatsink", w: 0.8 },
  { kind: "speaker", w: 0.6 },
  { kind: "phototransistor", w: 0.6 },
  { kind: "breadboard-patch", w: 0.5 },
  { kind: "meter-kiosk", w: 0.4 },
  { kind: "test-lead-arch", w: 0.4 },
  { kind: "cell-jar", w: 0.4 },
  { kind: "tuft", w: 1.2 },
  { kind: "moss", w: 0.9 },
  { kind: "lemon-tree", w: 0.7 },
];

/** Silkscreen reference designator prefixes, printed next to each part (R1, D2, C3...). */
export const REF: Partial<Record<string, string>> = {
  resistor: "R",
  "led-lamp": "D",
  battery: "BT",
  "meter-kiosk": "M",
  fuse: "F",
  "test-lead-arch": "TP",
  "cell-jar": "BT",
  switch: "SW",
  pushbutton: "SW",
  relay: "K",
  "breadboard-patch": "BB",
  "jumper-arch": "J",
  capacitor: "C",
  "ceramic-cap": "C",
  pot: "RV",
  transistor: "Q",
  phototransistor: "Q",
  speaker: "LS",
  diode: "D",
  "wire-spool": "W",
  heatsink: "HS",
  "header-fence": "J",
  regulator: "VR",
  "chip-block": "IC",
  "reed-gate": "SW",
  "seven-seg": "DS",
  "logic-chip": "IC",
  "dice-block": "DS",
  "coil-bolt": "L",
  antenna: "ANT",
  "mcu-board": "A",
};

const PIECE_SET = new Set<string>(PIECES);
const LANDMARK_SET = new Set<string>(LANDMARKS);
export const isPiece = (k: string): k is PieceId => PIECE_SET.has(k);
export const isLandmark = (k: string): boolean => LANDMARK_SET.has(k);
export const isUnit = (u: string): u is UnitId => (UNITS as readonly string[]).includes(u);
export const DECOR = new Set<string>(["moss", "tuft", "lemon-tree"]);

export function footOf(kind: string): number {
  if (isPiece(kind)) return PIECE_FOOT[kind];
  if (kind === DOCK) return 0.9;
  return LANDMARK_SPEC[kind]?.foot ?? 2.3;
}
export const tiersOf = (kind: string): number => LANDMARK_SPEC[kind]?.tiers ?? 1;
export const variantsOf = (kind: string): number => VARIANTS[kind] ?? 1;

/** The landmark a module builds: its own id when known, else the unit's next landmark in turn (see FALLBACK). */
export function landmarkFor(unit: string, id: string, n: number): string {
  if (isLandmark(id)) return id;
  const u = unitOf(unit);
  const list = FALLBACK[u] ?? (isUnit(u) ? LANDMARKS_BY_UNIT[u] : FALLBACK.basics!);
  return list[n % list.length]!;
}
