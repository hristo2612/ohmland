/** The 2D part drawings available to the parts bin, hooks and the finale (PartIcon.tsx draws each one). */
export const PART_ICONS = [
  "battery",
  "cell",
  "resistor",
  "led",
  "multimeter",
  "test-leads",
  "breadboard",
  "jumper-wire",
  "pushbutton",
  "switch",
  "fuse",
  "capacitor",
  "pot",
  "relay",
  "transistor",
  "phototransistor",
  "diode",
  "speaker",
] as const;
export type PartIconKind = (typeof PART_ICONS)[number];
