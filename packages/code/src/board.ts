// A virtual board with ideal pins, for running programs without a circuit: golden tests, solution checks, and the
// traces a CI referee compares with a real chip's. The simulator's mcu device is the electrical version of this.

import { compile, type Compiled } from "./compile";
import type { Diagnostic } from "./errors";
import { Drive, Vm, type BoardHost, type DriveMode, type RunNote, type VmOptions } from "./vm";

/** A change of what a pin does, at a board time in µs. */
export type PinEvent = { t: number; pin: number; mode: DriveMode; duty: number; hz: number };
/** A line printed on the serial line, finished (its newline sent) at board time t in µs. */
export type SerialLine = { t: number; text: string };

export type VirtualBoardOptions = VmOptions & {
  /**
   * What an input pin reads at board time t (µs), given how the pin is set up. Default: a pin with its pull-up
   * reads HIGH, a bare input reads LOW (on a real board it would float), an output reads its own level.
   */
  input?: (pin: number, t: number, mode: DriveMode) => number | undefined;
  /** The ADC reading 0..1023 of an analog pin (14 to 19) at time t. Default 0. */
  analog?: (pin: number, t: number) => number;
};

export class VirtualBoard implements BoardHost {
  readonly modes: DriveMode[] = new Array<DriveMode>(20).fill(Drive.INPUT);
  readonly duty: number[] = new Array<number>(20).fill(0);
  readonly events: PinEvent[] = [];
  readonly lines: SerialLine[] = [];
  /** Everything sent on the serial line. */
  serial = "";
  baud = 0;
  private line = "";

  constructor(private readonly opts: VirtualBoardOptions = {}) {}

  drive(pin: number, mode: DriveMode, t: number, duty: number, hz: number): void {
    if (this.modes[pin] === mode && this.duty[pin] === duty) return;
    this.modes[pin] = mode;
    this.duty[pin] = duty;
    this.events.push({ t, pin, mode, duty, hz });
  }
  digitalRead(pin: number, t: number): number {
    const mode = this.modes[pin]!;
    const v = this.opts.input?.(pin, t, mode);
    if (v !== undefined) return v ? 1 : 0;
    if (mode === Drive.HIGH) return 1;
    if (mode === Drive.LOW || mode === Drive.INPUT) return 0;
    if (mode === Drive.PWM) return 0;
    return 1;
  }
  analogRead(pin: number, t: number): number {
    return this.opts.analog?.(pin, t) ?? 0;
  }
  serialBegin(baud: number): void {
    this.baud = baud;
  }
  serialChar(ch: string, t: number): void {
    this.serial += ch;
    if (ch === "\n") {
      this.lines.push({ t, text: this.line.replace(/\r$/, "") });
      this.line = "";
    } else this.line += ch;
  }

  /** Is the pin driven HIGH at board time t (µs)? PWM counts as its duty above one half. */
  levelAt(pin: number, t: number): 0 | 1 {
    let mode: DriveMode = Drive.INPUT;
    let duty = 0;
    for (const e of this.events) {
      if (e.t > t) break;
      if (e.pin === pin) {
        mode = e.mode;
        duty = e.duty;
      }
    }
    return mode === Drive.HIGH || (mode === Drive.PWM && duty > 0.5) ? 1 : 0;
  }
  /** Times (µs) at which the pin's output level changed, with the new level. */
  edges(pin: number): { t: number; level: 0 | 1 }[] {
    const out: { t: number; level: 0 | 1 }[] = [];
    let last = -1;
    for (const e of this.events) {
      if (e.pin !== pin) continue;
      const lvl = e.mode === Drive.HIGH ? 1 : e.mode === Drive.LOW ? 0 : -1;
      if (lvl < 0 || lvl === last) continue;
      last = lvl;
      out.push({ t: e.t, level: lvl as 0 | 1 });
    }
    return out;
  }
}

export type RunResult = {
  ok: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  board: VirtualBoard;
  vm: Vm | null;
  /** Runtime notes (printing before Serial.begin, dividing by zero, a pin the board lacks). */
  notes: RunNote[];
};

export type RunOptions = VirtualBoardOptions & {
  /** Board seconds to run. */
  seconds: number;
  /** Jumps of the millis() clock: at board time `at` (s), set millis() to `millis`. */
  clockJumps?: { at: number; millis: number }[];
  /** Reset the board (as the reset button) at these board times (s). */
  resets?: number[];
};

/** Compiles and runs a program on a virtual board for a while. Fails (ok false) on compile errors. */
export function runProgram(source: string | Compiled, opts: RunOptions): RunResult {
  let prog: Compiled;
  let warnings: Diagnostic[] = [];
  if (typeof source === "string") {
    const c = compile(source);
    if (!c.ok) return { ok: false, errors: c.errors, warnings: c.warnings, board: new VirtualBoard(opts), vm: null, notes: [] };
    prog = c.program;
    warnings = c.warnings;
  } else prog = source;
  const board = new VirtualBoard(opts);
  const vm = new Vm(prog, opts);
  // Board time restarts at a reset; keep an offset so `at` stays absolute. A program waiting in delay() is ahead
  // of `at`: a jump or a reset still happens at `at`.
  let base = 0;
  const stops = [
    ...(opts.clockJumps ?? []).map((j) => ({ at: j.at * 1e6, act: () => vm.setMillis(j.millis, j.at * 1e6 - base) })),
    ...(opts.resets ?? []).map((at) => ({
      at: at * 1e6,
      act: () => {
        vm.reset();
        base = at * 1e6;
      },
    })),
  ].sort((a, b) => a.at - b.at);
  const end = opts.seconds * 1e6;
  const host: BoardHost = {
    drive: (pin, mode, t, duty, hz) => board.drive(pin, mode, t + base, duty, hz),
    digitalRead: (pin, t) => board.digitalRead(pin, t + base),
    analogRead: (pin, t) => board.analogRead(pin, t + base),
    serialBegin: (baud, t) => board.serialBegin(baud),
    serialChar: (ch, t) => board.serialChar(ch, t + base),
  };
  for (const s of [...stops, { at: end, act: () => {} }]) {
    const r = vm.run(host, s.at - base);
    if (r === "error") break;
    s.act();
  }
  return { ok: true, errors: [], warnings, board, vm, notes: vm.notes };
}
