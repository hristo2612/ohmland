/**
 * The island piece ids a lesson's `unlocks.isle` may name. This mirrors PIECES in packages/isle/src/catalog.ts, kept
 * here so the build-time loader does not pull the island package into the web app. Pieces are kinds: many lessons
 * place the same kind, so a piece id may appear any number of times across the course. isle-pieces.test.ts fails if
 * this list drifts from the island catalog.
 */
export const ISLE_PIECES = [
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

const PIECE_SET = new Set<string>(ISLE_PIECES);
export const isIslePiece = (id: string): boolean => PIECE_SET.has(id);
