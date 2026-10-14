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
  /** Accessible name of the 3D view. */
  canvas: string;
  /** Part settings on the selection bar, by "<kind>.<key>": a label, value names, and a unit for numbers. */
  settings: Record<string, { label: string; values?: Record<string, string>; unit?: string }>;
  /** One-shot part actions on the selection bar, by "<kind>.<action>". */
  actions: Record<string, string>;
  /** Touch-feel words for the heat readout. */
  heat: { cool: string; warm: string; hot: string; ouch: string };
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
  };
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
    "gate.mode": { label: "Gate", values: { ticks: "Ticks", number: "Number" } },
    "gate.unit": { label: "Unit", values: { A: "A", mA: "mA" } },
    "box.lid": { label: "Lid", values: { false: "Shut", true: "Open" } },
  },
  actions: { "card.erase": "Erase", "cup.salt": "Add salt" },
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
    print: { ...DEFAULT_LABELS.print, ...(over.print ?? {}), bands: { ...DEFAULT_LABELS.print.bands, ...(over.print?.bands ?? {}) } },
  };
}

export const LabelsContext = createContext<BenchLabels>(DEFAULT_LABELS);

export function useLabels(): BenchLabels {
  return useContext(LabelsContext);
}
