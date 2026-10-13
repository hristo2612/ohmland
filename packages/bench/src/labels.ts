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
  };
}

export const LabelsContext = createContext<BenchLabels>(DEFAULT_LABELS);

export function useLabels(): BenchLabels {
  return useContext(LabelsContext);
}
