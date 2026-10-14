// The microcontroller board's header pins, and how to read one pin out of a snapshot (for labs: lab.pin(board, n)).

import type { McuPin, PartState } from "../types";

/** Header pins in netlist order: D0 to D13, A0 to A5 (pins 14 to 19 in a program), then 5V, GND and VIN. */
export const MCU_PINS: readonly McuPin[] = [
  "d0",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "d10",
  "d11",
  "d12",
  "d13",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "5v",
  "gnd",
  "vin",
];

export type McuPinMode = "INPUT" | "INPUT_PULLUP" | "OUTPUT" | "PWM";

export type McuPinState = {
  mode: McuPinMode;
  /** What digitalRead gives now (the pin's voltage through the input thresholds); null while the board is off. */
  level: "HIGH" | "LOW" | null;
  volts: number;
  /** Current out of the pin into the circuit, mA (negative when the pin sinks). */
  mA: number;
  /** The pin burned out. */
  dead: boolean;
};

const MODES: Record<string, McuPinMode> = { I: "INPUT", U: "INPUT_PULLUP", O: "OUTPUT", P: "PWM" };

/** Pin n (0 to 19, or "A0" to "A5") of a board's PartState, or null when the state is not a board's. */
export function mcuPin(state: PartState | undefined, pin: number | string): McuPinState | null {
  const e = state?.extra;
  if (!e || typeof e.modes !== "string") return null;
  const k = typeof pin === "string" ? (/^A[0-5]$/i.test(pin) ? 14 + Number(pin.slice(1)) : Number(pin.replace(/^D/i, ""))) : pin;
  if (!(k >= 0 && k < 20)) return null;
  const lv = String(e.levels ?? "")[k] ?? "-";
  const volts = Number(String(e.volts ?? "").split(",")[k] ?? 0);
  const mA = Number(String(e.mA ?? "").split(",")[k] ?? 0);
  const name = k >= 14 ? `A${k - 14}` : String(k);
  return {
    mode: MODES[e.modes[k] ?? "I"] ?? "INPUT",
    level: lv === "-" ? null : lv === "H" || lv === "h" ? "HIGH" : "LOW",
    volts,
    mA,
    dead: String(e.deadPins ?? "").split(",").includes(name),
  };
}
