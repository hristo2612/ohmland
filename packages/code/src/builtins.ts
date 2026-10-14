// The board API: built-in functions and named constants, with the names an Uno-style board uses, so everything
// written in bench C runs unchanged on a real board.

import type { Ty } from "./ast";

export type ParamTy = Ty | "any" | "printable";

export type Builtin = {
  /** Name as written: "digitalWrite", "Serial.println". */
  name: string;
  /** Opcode used by the interpreter. */
  code: number;
  /** Parameters (names are used by blocks and by error messages). */
  params: { name: string; ty: ParamTy }[];
  /** Fewest values the call accepts (the rest are optional). Default: all of them. */
  minArgs?: number;
  /** "same": the common type of the values (min, max, abs, constrain). */
  ret: Ty | "same";
  /** Microseconds of board time the call takes, on top of the 1 µs every step costs. */
  cost: number;
  /** What the values are, for "needs 2 values: ..." messages. */
  hint: string;
};

/** Opcodes of the built-ins (stable: saved runs refer to them). */
export const B = {
  pinMode: 0,
  digitalWrite: 1,
  digitalRead: 2,
  analogRead: 3,
  analogWrite: 4,
  delay: 5,
  delayMicroseconds: 6,
  millis: 7,
  micros: 8,
  random: 9,
  randomSeed: 10,
  serialBegin: 11,
  serialPrint: 12,
  serialPrintln: 13,
  map: 14,
  constrain: 15,
  min: 16,
  max: 17,
  abs: 18,
} as const;

/** A pin call (pinMode, digitalWrite, digitalRead, analogWrite) takes 4 µs in all; analogRead about 112 µs. */
export const PIN_CALL_US = 3;
export const ANALOG_READ_US = 111;

export const BUILTINS: readonly Builtin[] = [
  { name: "pinMode", code: B.pinMode, params: [{ name: "pin", ty: "byte" }, { name: "mode", ty: "byte" }], ret: "void", cost: PIN_CALL_US, hint: "a pin and INPUT, OUTPUT or INPUT_PULLUP" },
  { name: "digitalWrite", code: B.digitalWrite, params: [{ name: "pin", ty: "byte" }, { name: "value", ty: "byte" }], ret: "void", cost: PIN_CALL_US, hint: "a pin and HIGH or LOW" },
  { name: "digitalRead", code: B.digitalRead, params: [{ name: "pin", ty: "byte" }], ret: "int", cost: PIN_CALL_US, hint: "a pin" },
  { name: "analogRead", code: B.analogRead, params: [{ name: "pin", ty: "byte" }], ret: "int", cost: ANALOG_READ_US, hint: "an analog pin, A0 to A5" },
  { name: "analogWrite", code: B.analogWrite, params: [{ name: "pin", ty: "byte" }, { name: "value", ty: "int" }], ret: "void", cost: PIN_CALL_US, hint: "a pin and a level from 0 to 255" },
  { name: "delay", code: B.delay, params: [{ name: "ms", ty: "ulong" }], ret: "void", cost: 0, hint: "a number of milliseconds" },
  { name: "delayMicroseconds", code: B.delayMicroseconds, params: [{ name: "us", ty: "uint" }], ret: "void", cost: 0, hint: "a number of microseconds" },
  { name: "millis", code: B.millis, params: [], ret: "ulong", cost: 0, hint: "nothing" },
  { name: "micros", code: B.micros, params: [], ret: "ulong", cost: 0, hint: "nothing" },
  { name: "random", code: B.random, params: [{ name: "min", ty: "long" }, { name: "max", ty: "long" }], minArgs: 1, ret: "long", cost: 0, hint: "a top number, or a bottom and a top number" },
  { name: "randomSeed", code: B.randomSeed, params: [{ name: "seed", ty: "ulong" }], ret: "void", cost: 0, hint: "a starting number" },
  { name: "Serial.begin", code: B.serialBegin, params: [{ name: "baud", ty: "ulong" }], ret: "void", cost: 0, hint: "a speed such as 9600" },
  { name: "Serial.print", code: B.serialPrint, params: [{ name: "value", ty: "printable" }, { name: "base", ty: "int" }], minArgs: 1, ret: "void", cost: 0, hint: "a value or text in quotes" },
  { name: "Serial.println", code: B.serialPrintln, params: [{ name: "value", ty: "printable" }, { name: "base", ty: "int" }], minArgs: 0, ret: "void", cost: 0, hint: "a value or text in quotes, or nothing" },
  { name: "map", code: B.map, params: ["value", "fromLow", "fromHigh", "toLow", "toHigh"].map((name) => ({ name, ty: "long" as const })), ret: "long", cost: 0, hint: "a value and four range ends" },
  { name: "constrain", code: B.constrain, params: [{ name: "value", ty: "any" }, { name: "low", ty: "any" }, { name: "high", ty: "any" }], ret: "same", cost: 0, hint: "a value, a lowest and a highest" },
  { name: "min", code: B.min, params: [{ name: "a", ty: "any" }, { name: "b", ty: "any" }], ret: "same", cost: 0, hint: "two values" },
  { name: "max", code: B.max, params: [{ name: "a", ty: "any" }, { name: "b", ty: "any" }], ret: "same", cost: 0, hint: "two values" },
  { name: "abs", code: B.abs, params: [{ name: "value", ty: "any" }], ret: "same", cost: 0, hint: "a value" },
];

export const BUILTIN_BY_NAME: ReadonlyMap<string, Builtin> = new Map(BUILTINS.map((b) => [b.name, b]));

/** Named constants of the board (all int, as the real board's #defines are). */
export const CONSTANTS: Readonly<Record<string, number>> = {
  HIGH: 1,
  LOW: 0,
  INPUT: 0,
  OUTPUT: 1,
  INPUT_PULLUP: 2,
  LED_BUILTIN: 13,
  A0: 14,
  A1: 15,
  A2: 16,
  A3: 17,
  A4: 18,
  A5: 19,
  DEC: 10,
  HEX: 16,
  OCT: 8,
  BIN: 2,
};

/** Type keywords and what they mean (Arduino and stdint spellings included). */
export const TYPE_NAMES: Readonly<Record<string, Ty>> = {
  int: "int",
  "unsigned int": "uint",
  unsigned: "uint",
  word: "uint",
  long: "long",
  "long int": "long",
  "unsigned long": "ulong",
  "unsigned long int": "ulong",
  bool: "bool",
  boolean: "bool",
  byte: "byte",
  void: "void",
  int16_t: "int",
  uint16_t: "uint",
  int32_t: "long",
  uint32_t: "ulong",
  uint8_t: "byte",
};

/** Every name the board knows, for "did you mean" (functions, constants, keywords). */
export const KNOWN_WORDS: readonly string[] = [
  ...BUILTINS.map((b) => b.name),
  ...Object.keys(CONSTANTS),
  "setup",
  "loop",
  "Serial",
  "if",
  "else",
  "while",
  "for",
  "do",
  "return",
  "break",
  "continue",
  "true",
  "false",
  "const",
  "static",
  "unsigned",
  ...Object.keys(TYPE_NAMES).filter((k) => !k.includes(" ")),
];

/** Pins with PWM (analogWrite) on an Uno-style board, and their frequencies (Hz). */
export const PWM_PINS: Readonly<Record<number, number>> = { 3: 490.196, 5: 976.5625, 6: 976.5625, 9: 490.196, 10: 490.196, 11: 490.196 };

/** The board's pins: digital 0 to 13, then A0 to A5 as 14 to 19. */
export const PIN_COUNT = 20;

/** "D7", "A2". */
export function pinName(pin: number): string {
  return pin >= 14 && pin < 20 ? `A${pin - 14}` : `D${pin}`;
}
