/**
 * The free-build bench's tray, from the learner's parts bin: each parts.yaml id unlocks one or more bench parts in
 * useful values. Ids with no bench part yet (pencil lines, AA and coin cells, the logger) add nothing.
 */
import { benchOps, type BenchState, type TrayItem } from "@ohmland/bench/core";
import { m } from "../i18n";

const LEADS: TrayItem[] = (["red", "black", "green", "yellow", "blue"] as const).map((color) => ({ kind: "lead", params: { color } }));

const BY_PART: Record<string, TrayItem[]> = {
  "battery-9v": [{ kind: "battery" }, { kind: "battery", params: { snap: true }, label: m.bench.snapBattery }],
  "alligator-clips": LEADS,
  resistor: [150, 470, 1000, 1500, 4700, 10_000].map((ohms) => ({ kind: "resistor", params: { ohms } })),
  "resistor-power": [{ kind: "resistor", params: { ohms: 15, watts: 5 }, label: m.bench.powerResistor }],
  "led-red": [{ kind: "led", params: { color: "red" } }],
  "led-color": (["green", "yellow", "blue"] as const).map((color) => ({ kind: "led", params: { color } })),
  fuse: [{ kind: "fuse", params: { amps: 1 } }],
  "fruit-cell": [{ kind: "lemon" }],
  "toggle-switch": [{ kind: "toggle-switch", params: { base: true }, label: m.bench.blockSwitch }, { kind: "toggle-switch" }],
  "slide-switch": [{ kind: "slide-switch" }],
  pushbutton: [{ kind: "pushbutton" }],
  relay: [{ kind: "relay" }],
  potentiometer: [{ kind: "trimmer", params: { ohms: 10_000 } }],
  trimmer: [{ kind: "trimmer", params: { ohms: 10_000 } }],
  "diode-1n4001": [{ kind: "diode", params: { model: "1N4001" } }],
  "electrolytic-capacitor": [100e-6, 1000e-6].map((farads) => ({ kind: "electrolytic-cap", params: { farads } })),
  "ceramic-capacitor": [{ kind: "ceramic-cap", params: { farads: 100e-9 } }],
  "npn-transistor": [{ kind: "npn" }],
  phototransistor: [{ kind: "phototransistor" }],
  speaker: [{ kind: "speaker" }],
  "touch-pads": [{ kind: "cup", params: { water: "salty" } }],
};

/** Everyone starts with a battery and a few clip leads, so an empty bin still has something to try. */
const STARTER: TrayItem[] = [{ kind: "battery" }, ...LEADS.slice(0, 3)];

/**
 * A new learner's desk (an empty bin): the starter battery and its three clip leads already out, side by side and ready
 * to clip, instead of an empty desk and a tray.
 */
export function starterDesk(bench: BenchState): BenchState {
  let [b] = benchOps.addPart(bench, "battery", undefined, { pos: [-56, 0] });
  (["red", "black", "green"] as const).forEach((color, i) => {
    [b] = benchOps.addLead(b, color, [44, -36 + i * 36]);
  });
  return b;
}

export type SandboxKit = { tray: TrayItem[]; meter: boolean; board: boolean; scope: boolean; empty: boolean };

export function sandboxKit(bin: readonly string[]): SandboxKit {
  const owned = new Set(bin);
  const seen = new Set<string>();
  const tray: TrayItem[] = [];
  const add = (items: TrayItem[]) => {
    for (const t of items) {
      const key = JSON.stringify(t);
      if (seen.has(key)) continue;
      seen.add(key);
      tray.push(t);
    }
  };
  add(STARTER);
  for (const id of bin) add(BY_PART[id] ?? []);
  return {
    tray,
    meter: owned.has("multimeter") || owned.has("test-leads"),
    board: owned.has("breadboard") || owned.has("jumper-wires"),
    scope: owned.has("scope"),
    empty: !bin.some((id) => BY_PART[id]),
  };
}
