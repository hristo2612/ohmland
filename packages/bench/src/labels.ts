// User-facing strings. English defaults; the web app passes translated strings through the `labels` prop.

import { createContext, useContext } from "react";
import type { BenchPartKind, LeadColor, MeterMode, WaterKind, WireColor } from "./types";

export type BenchLabels = {
  select: string;
  wire: string;
  xray: string;
  undo: string;
  redo: string;
  rotate: string;
  delete: string;
  toggle: string;
  press: string;
  topView: string;
  resetView: string;
  cancel: string;
  tray: string;
  trayHint: string;
  wireHint: string;
  wireColor: string;
  leadColor: string;
  meter: string;
  testLead: string;
  hole: (id: string) => string;
  partName: Record<BenchPartKind, string>;
  colors: Record<WireColor | LeadColor, string>;
  water: Record<WaterKind, string>;
  /** Names of the meter dial positions (selection bar and screen readers). */
  meterModes: Record<MeterMode, string>;
  /** The meter's RANGE key, and its automatic setting (screen readers). */
  meterRange: string;
  meterAuto: string;
  /** Accessible name of the 3D view. */
  canvas: string;
  /** Part settings on the selection bar, by "<kind>.<key>": a label, value names, and a unit for numbers. */
  settings: Record<string, { label: string; values?: Record<string, string>; unit?: string }>;
  /** One-shot part actions on the selection bar, by "<kind>.<action>". */
  actions: Record<string, string>;
  /** Touch-feel words for the heat readout. */
  heat: { cool: string; warm: string; hot: string; ouch: string };
  /** The solder station's overlay, spots and joints (Unit 3). */
  solder: SolderLabels;
  /** Words printed on lab props. */
  print: {
    rejects: string;
    tester: string;
    load: string;
    on: string;
    off: string;
    cm: string;
    start: string;
    chart: string;
    digit: string;
    multiplier: string;
    tolerance: string;
    bands: Record<string, string>;
    time: string;
    showcase: string;
    phonePack: string;
    carBattery: string;
    used: string;
    /** The junk drawer's two trays, before the words "conductor" and "insulator" are earned (labs relabel them). */
    conductors: string;
    insulators: string;
    /** On the parts cabinet's front. */
    cabinet: string;
    /** The logic probe's lamps. */
    hi?: string;
    lo?: string;
    pulse?: string;
  };
};

export type SolderLabels = {
  /** A spot's spoken name: "Pad B4", "D1 anode lead", "Splice HW1 b", "Stand". */
  spot: (id: string) => string;
  iron: string;
  solder: string;
  braid: string;
  /** The heat view and quick mode toggles, the tip readout. */
  heatView: string;
  quick: string;
  tip: string;
  degrees: string;
  magnifier: string;
  close: string;
  /** Spoken hints for the tools. */
  ironHint: string;
  feedHint: string;
  quickHint: string;
  /** A joint's phase, shape and finish, and what a tug finds. */
  phase: { bare: string; molten: string; set: string };
  shape: { none: string; volcano: string; ball: string; ring: string; lump: string; frosty: string; bridge: string; burnt: string };
  finish: { liquid: string; bright: string; satin: string; dull: string; dark: string };
  tug: { held: string; loose: string; pulled: string };
  /** Words printed on the station and the spools. */
  station: string;
  spool: { leaded: string; "lead-free": string; acid: string };
  /** Tools on the dock: bend a leg, add an underside link. */
  bend: string;
  link: string;
  /** Said when a tool cannot be used yet. */
  flipFirst: string;
};

export const DEFAULT_SOLDER_LABELS: SolderLabels = {
  spot: (id) => {
    const dot = id.lastIndexOf(".");
    const owner = dot > 0 ? id.slice(0, dot) : id;
    const sub = dot > 0 ? id.slice(dot + 1) : "";
    if (sub === "stand") return "Iron stand";
    if (sub === "wool") return "Brass wool";
    if (sub === "sponge") return "Sponge";
    if (/^[A-Z]\d{1,2}$/.test(sub)) return `Pad ${sub}`;
    return `${owner} ${sub}`;
  },
  iron: "Soldering iron",
  solder: "Solder",
  braid: "Braid",
  heatView: "Heat",
  quick: "Quick",
  tip: "Tip",
  degrees: "°C",
  magnifier: "Magnifier",
  close: "Close",
  ironHint: "Drag the iron onto a joint. It rests there.",
  feedHint: "Hold the solder on the hot joint.",
  quickHint: "Press and hold a joint to solder it.",
  phase: { bare: "no solder", molten: "molten", set: "set" },
  shape: {
    none: "bare metal",
    volcano: "a smooth little volcano",
    ball: "a round ball hiding the lead",
    ring: "a thin ring, the hole showing",
    lump: "a dull, grainy lump with a gap",
    frosty: "a frosty, cracked surface",
    bridge: "a neck of solder to the next pad",
    burnt: "dark, burnt flux",
  },
  finish: { liquid: "liquid", bright: "bright", satin: "satin", dull: "dull", dark: "dark" },
  tug: { held: "It holds.", loose: "It rocks.", pulled: "It pulls free." },
  station: "SOLDER STATION",
  spool: { leaded: "Sn63 Pb37, rosin core, 0.8 mm", "lead-free": "Sn96.5 Ag3.0 Cu0.5, lead-free, rosin core, 0.8 mm", acid: "acid core, for sheet metal and plumbing" },
  bend: "Bend",
  link: "Link",
  flipFirst: "Flip the board to reach the copper.",
};

export const DEFAULT_LABELS: BenchLabels = {
  select: "Select",
  wire: "Wire",
  xray: "X-ray",
  undo: "Undo",
  redo: "Redo",
  rotate: "Rotate",
  delete: "Delete",
  toggle: "Flip",
  press: "Press",
  topView: "Top view",
  resetView: "Reset view",
  cancel: "Cancel",
  tray: "Parts",
  trayHint: "Drag a part onto the bench, or tap it and then tap where it should go.",
  wireHint: "Click a hole, then another hole, to add a wire.",
  wireColor: "Wire colour",
  leadColor: "Lead colour",
  meter: "Multimeter",
  meterRange: "Range",
  meterAuto: "auto",
  testLead: "Test lead",
  hole: (id) => `Hole ${id.toUpperCase()}`,
  partName: {
    resistor: "Resistor",
    led: "LED",
    battery: "9 V battery",
    pushbutton: "Pushbutton",
    "slide-switch": "Slide switch",
    "toggle-switch": "Toggle switch",
    fuse: "Fuse",
    "ceramic-cap": "Ceramic capacitor",
    "electrolytic-cap": "Electrolytic capacitor",
    trimmer: "Trimmer",
    relay: "Relay",
    npn: "NPN transistor",
    phototransistor: "Phototransistor",
    diode: "Diode",
    speaker: "Speaker",
    cup: "Cup of water",
    lemon: "Lemon cell",
    "dpdt-switch": "DPDT switch",
    "touch-pads": "Touch pads",
    holder: "Resistor holder",
    station: "Battery tester",
    fruit: "Lemon half",
    electrode: "Electrode",
    skin: "Skin patch",
    sample: "Sample",
    card: "Pencil card",
    tag: "Value label",
    bin: "Reject bin",
    chart: "Colour chart",
    clock: "Clock",
    showcase: "Display case",
    "solder-station": "Solder station",
    "solder-spool": "Solder",
    "solder-braid": "Desoldering braid",
    perfboard: "Perfboard",
    "plan-card": "Plan card",
    "heat-sink-clip": "Heat sink",
    "hookup-wire": "Hookup wire",
    "wire-stripper": "Wire stripper",
    "heat-shrink": "Heat-shrink",
    "heat-gun": "Heat gun",
    "barrel-jack": "Barrel jack",
    "wall-adapter": "Wall adapter",
    gate: "Gate",
    box: "Sealed box",
    schematic: "Drawing",
    piece: "Torn piece",
    balloon: "Balloon",
    scarf: "Wool scarf",
    paper: "Paper bits",
    comb: "Comb",
    wall: "Wall",
    "mcu-board": "Microcontroller board",
    chip: "Chip",
    sevenseg: "7-segment display",
    regulator7805: "5 V regulator",
    "ic-socket": "Chip socket",
    "dip-switch": "DIP switch",
    "logic-probe": "Logic probe",
    "battery-pack": "Battery pack",
    "bench-supply": "Bench supply",
  },
  colors: {
    red: "Red",
    black: "Black",
    blue: "Blue",
    green: "Green",
    yellow: "Yellow",
    orange: "Orange",
    white: "White",
    purple: "Purple",
  },
  water: { distilled: "DISTILLED", tap: "TAP", salty: "SALT" },
  meterModes: {
    off: "Off",
    dcv: "DC volts",
    acv: "AC volts",
    ohm: "Ohms",
    continuity: "Continuity",
    diode: "Diode test",
    "dca-10a": "DC amps (10 A)",
    "dca-ma": "DC milliamps",
  },
  canvas: "Workbench. Use the arrow keys to move the selected part, R to rotate, Delete to remove.",
  settings: {
    "skin.moisture": { label: "Skin", values: { dry: "Dry", damp: "Damp", wet: "Wet", salty: "Salty" } },
    "skin.pressure": { label: "Probe pressure", values: { light: "Light", firm: "Firm" } },
    "station.load": { label: "Test load", values: { false: "Off", true: "On" } },
    "fruit.touching": { label: "Metals", values: { false: "Apart", true: "Touching" } },
    "card.length": { label: "Line", unit: "cm" },
    "card.layers": { label: "Layers" },
    "card.wide": { label: "Width", values: { false: "Narrow", true: "Wide" } },
    "solder-station.on": { label: "Power", values: { false: "Off", true: "On" } },
    "solder-station.setC": { label: "Tip", unit: "°C" },
    "perfboard.flipped": { label: "Side", values: { false: "Top", true: "Copper" } },
    "perfboard.flexed": { label: "Board", values: { false: "Resting", true: "Pressed" } },
    "heat-sink-clip.metal": { label: "Metal", values: { copper: "Copper", steel: "Steel" } },
    "wire-stripper.notch": { label: "Notch", unit: "AWG" },
    "wire-stripper.scale": { label: "Scale", values: { solid: "Solid", stranded: "Stranded" } },
    "heat-shrink.size": { label: "Size", unit: "mm" },
    "heat-gun.on": { label: "Heat gun", values: { false: "Off", true: "On" } },
    "gate.mode": { label: "Gate", values: { ticks: "Ticks", number: "Number" } },
    "gate.unit": { label: "Unit", values: { A: "A", mA: "mA" } },
    "box.lid": { label: "Lid", values: { false: "Shut", true: "Open" } },
    "pushbutton.bounce": { label: "Bounce", values: { false: "Off", true: "On" } },
    "slide-switch.bounce": { label: "Bounce", values: { false: "Off", true: "On" } },
    "toggle-switch.bounce": { label: "Bounce", values: { false: "Off", true: "On" } },
    "dpdt-switch.bounce": { label: "Bounce", values: { false: "Off", true: "On" } },
    "regulator7805.heatsink": { label: "Heat sink", values: { false: "Off", true: "On" } },
  },
  actions: {
    "card.erase": "Erase",
    "cup.salt": "Add salt",
    "solder-braid.snip": "Snip used end",
    "wire-stripper.strip": "Strip",
    "hookup-wire.twist": "Twist",
    "hookup-wire.snip-a": "Snip end A",
    "hookup-wire.snip-b": "Snip end B",
  },
  solder: DEFAULT_SOLDER_LABELS,
  heat: { cool: "cool", warm: "warm", hot: "hot", ouch: "ouch" },
  print: {
    rejects: "REJECTS",
    tester: "BATTERY TESTER",
    load: "LOAD 100 Ω",
    on: "ON",
    off: "OFF",
    cm: "cm",
    start: "START",
    chart: "Resistor colour code",
    digit: "Digit",
    multiplier: "Multiplier",
    tolerance: "Tolerance",
    bands: {
      black: "Black",
      brown: "Brown",
      red: "Red",
      orange: "Orange",
      yellow: "Yellow",
      green: "Green",
      blue: "Blue",
      violet: "Violet",
      grey: "Grey",
      white: "White",
      gold: "Gold",
      silver: "Silver",
    },
    time: "TIME",
    showcase: "LOOK, DON'T TOUCH",
    phonePack: "Phone Li-ion pack. Never puncture, crush or short it.",
    carBattery: "Car battery, 12 V. Hundreds of amps into a short.",
    used: "USED",
    conductors: "LETS FLOW THROUGH",
    insulators: "STOPS FLOW",
    cabinet: "PARTS",
    hi: "HI",
    lo: "LO",
    pulse: "PULSE",
  },
};

export function mergeLabels(over?: Partial<BenchLabels>): BenchLabels {
  if (!over) return DEFAULT_LABELS;
  return {
    ...DEFAULT_LABELS,
    ...over,
    partName: { ...DEFAULT_LABELS.partName, ...(over.partName ?? {}) },
    colors: { ...DEFAULT_LABELS.colors, ...(over.colors ?? {}) },
    water: { ...DEFAULT_LABELS.water, ...(over.water ?? {}) },
    meterModes: { ...DEFAULT_LABELS.meterModes, ...(over.meterModes ?? {}) },
    settings: { ...DEFAULT_LABELS.settings, ...(over.settings ?? {}) },
    actions: { ...DEFAULT_LABELS.actions, ...(over.actions ?? {}) },
    heat: { ...DEFAULT_LABELS.heat, ...(over.heat ?? {}) },
    solder: { ...DEFAULT_LABELS.solder, ...(over.solder ?? {}) },
    print: { ...DEFAULT_LABELS.print, ...(over.print ?? {}), bands: { ...DEFAULT_LABELS.print.bands, ...(over.print?.bands ?? {}) } },
  };
}

export const LabelsContext = createContext<BenchLabels>(DEFAULT_LABELS);

export function useLabels(): BenchLabels {
  return useContext(LabelsContext);
}

/**
 * What the selection bar calls a part after its id: the words printed on it (a tag's text, a bin's or box's label), its
 * value (ohms, farads, a chip's number), the name the lab gave it ("AA cell"), else its kind ("9 V battery").
 */
export function partShownName(part: { id: string; kind: string; params: unknown }, detail: string | undefined, names: Readonly<Record<string, string>>, kindName: string | undefined): string {
  const p = part.params as { text?: unknown; label?: unknown };
  if (part.kind === "tag" && typeof p.text === "string" && p.text) return p.text;
  if (typeof p.label === "string" && p.label && part.kind !== "chip") return p.label;
  return detail ?? names[part.id] ?? kindName ?? part.kind;
}
