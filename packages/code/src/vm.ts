// The interpreter: runs compiled bench C on VIRTUAL time. The board's clock is a number of microseconds since
// reset that only the program moves: each statement costs 1 µs, a pin call 4 µs, analogRead about 112 µs, and
// delay(ms) adds exactly ms x 1000 µs. Nothing here waits for real time, so the program can run in lockstep with
// the circuit simulator (or faster, slower, paused), and the same program gives the same trace every time.
//
// `run(host, until)` executes until the board clock reaches `until`, then returns, ready to continue. A read the
// host cannot answer yet (the circuit has not been solved up to that instant) returns -1: the run stops before that
// read and does it when called again. millis() can be jumped (the day-49 rollover lesson) without running 49 days.

import { B, PIN_COUNT, PWM_PINS } from "./builtins";
import { PRINT_SIGNED, type Compiled } from "./compile";


/** What a pin does electrically. */
export const Drive = { INPUT: 0, PULLUP: 1, LOW: 2, HIGH: 3, PWM: 4 } as const;
export type DriveMode = (typeof Drive)[keyof typeof Drive];

/** The board around the program: pins, ADC and the serial line. Times are µs since reset. */
export interface BoardHost {
  /**
   * A pin's drive changed at time t: input, input with pull-up, output low or high, or PWM with a duty (0..1) and a
   * frequency in Hz.
   */
  drive(pin: number, mode: DriveMode, t: number, duty: number, hz: number): void;
  /** What the pin's input buffer reads at time t: 0 or 1, or -1 when the host cannot tell yet (the run waits). */
  digitalRead(pin: number, t: number): number;
  /** The ADC reading 0..1023 at time t, or -1 when the host cannot tell yet. */
  analogRead(pin: number, t: number): number;
  /** Serial.begin(baud) ran at time t. */
  serialBegin?(baud: number, t: number): void;
  /** One character has been fully sent on the serial line by time t. */
  serialChar?(ch: string, t: number): void;
}

export type RunStop =
  /** The board clock reached `until`. */
  | "time"
  /** Waiting for the host to answer a read (call run again once it can). */
  | "wait"
  /** The step budget ran out (only with a budget). */
  | "budget"
  /** One statement done (step mode). */
  | "step"
  /** Stopped for good: a runtime error. */
  | "error";

export type VmOptions = {
  /** millis() at reset (the lab can start the clock just before it wraps). Default 0. */
  clockStart?: number;
  /** The random generator's start state, as after randomSeed(seed) (the real board starts at 1). */
  seed?: number;
  /** Keep the last N statements run, as [t, statement index] pairs (trace mode). */
  trace?: number;
};

const MAX_DEPTH = 64;
const STACK = 512;
const U32 = 4294967296;

/** A runtime problem worth telling the learner (not an error: the program keeps going, as on the board). */
export type RunNote = { kind: "serial" | "divide" | "pin"; message: string };

export class Vm {
  readonly prog: Compiled;
  /** Board clock: µs since reset. */
  t = 0;
  pc = 0;
  private sp = 0;
  private readonly stack = new Float64Array(STACK);
  private readonly mem: Float64Array;
  private fp: number;
  private memTop: number;
  private readonly calls: number[] = [];
  /** Index (into prog.stmts) of the statement running now, or -1. */
  stmt = -1;
  error: string | null = null;
  /** Runtime notes raised since the last read of `notes` (each kind once per reset). */
  notes: RunNote[] = [];
  private noted = new Set<string>();
  /** millis() offset in ms (clockStart, plus jumps). */
  private msOffset = 0;
  private rng = 1;
  // Port state per pin, as the chip's registers hold it.
  readonly ddr = new Uint8Array(PIN_COUNT);
  readonly port = new Uint8Array(PIN_COUNT);
  /** PWM level 1..254 while a pin runs PWM, else 0. */
  readonly pwm = new Uint8Array(PIN_COUNT);
  serialBaud = 0;
  private txBusy = 0;
  /** Statements executed since reset. */
  steps = 0;
  readonly trace: Float64Array | null;
  private traceAt = 0;
  private readonly opts: VmOptions;

  constructor(prog: Compiled, opts: VmOptions = {}) {
    this.prog = prog;
    this.opts = opts;
    this.trace = opts.trace ? new Float64Array(opts.trace * 2).fill(-1) : null;
    const frame = Math.max(1, ...prog.funcs.map((f) => f.frameSize));
    this.mem = new Float64Array(prog.globals + (MAX_DEPTH + 1) * frame + 16);
    this.fp = prog.globals;
    this.memTop = prog.globals;
    this.reset();
  }

  /** Back to the start, as the reset button does: setup() runs again, pins are inputs, the clock restarts. */
  reset(): void {
    this.t = 0;
    this.pc = this.prog.entry;
    this.sp = 0;
    this.mem.fill(0);
    this.fp = this.prog.globals;
    this.memTop = this.prog.globals;
    this.calls.length = 0;
    this.stmt = -1;
    this.error = null;
    this.notes = [];
    this.noted.clear();
    this.msOffset = this.opts.clockStart ?? 0;
    this.rng = (this.opts.seed ?? 1) >>> 0;
    this.ddr.fill(0);
    this.port.fill(0);
    this.pwm.fill(0);
    this.serialBaud = 0;
    this.txBusy = 0;
    this.steps = 0;
    this.trace?.fill(-1);
    this.traceAt = 0;
  }

  /**
   * millis() at board time `at` µs (default: where the program is now; a program waiting in delay() is ahead of
   * the circuit, so a host passes its own time): milliseconds since reset plus any jump, 32-bit unsigned.
   */
  millis(at = this.t): number {
    return mod32(Math.floor(at / 1000) + this.msOffset);
  }
  micros(at = this.t): number {
    return mod32(Math.floor(at / 4) * 4 + this.msOffset * 1000);
  }
  /** Sets the clock so millis() reads `ms` at board time `at` (for example 2^32 - 9000: nine seconds before the wrap). */
  setMillis(ms: number, at = this.t): void {
    this.msOffset = ms - Math.floor(at / 1000);
  }

  /** The statements run most recently, oldest first, as { t, stmt } (trace mode only). */
  traced(): { t: number; stmt: number }[] {
    const tr = this.trace;
    if (!tr) return [];
    const n = tr.length / 2;
    const out: { t: number; stmt: number }[] = [];
    for (let k = 0; k < n; k++) {
      const j = ((this.traceAt + k) % n) * 2;
      if (tr[j]! >= 0) out.push({ t: tr[j]!, stmt: tr[j + 1]! });
    }
    return out;
  }

  private note(kind: RunNote["kind"], message: string): void {
    if (this.noted.has(kind)) return;
    this.noted.add(kind);
    this.notes.push({ kind, message });
  }

  /** The value of a global variable by slot (for watch views). */
  global(slot: number): number {
    return this.mem[slot] ?? 0;
  }

  /** Runs one statement and stops before the next (step mode). */
  step(host: BoardHost): RunStop {
    return this.run(host, Infinity, Infinity, true);
  }

  /**
   * Runs until the board clock reaches `until` µs (stopping before the first statement at or after it), the host
   * asks it to wait, the budget of statements runs out, or (step mode) one statement is done.
   */
  run(host: BoardHost, until: number, budget = Infinity, stepOne = false): RunStop {
    if (this.error) return "error";
    const code = this.prog.code;
    const stack = this.stack;
    const mem = this.mem;
    const trace = this.trace;
    let pc = this.pc;
    let sp = this.sp;
    let t = this.t;
    let fp = this.fp;
    let left = budget;
    let stepped = false;
    let steps = 0;
    let stop: RunStop = "time";
    let a = 0;
    let b = 0;
    // Opcodes are written as numbers (see Op in compile.ts) so the switch compiles to a jump table.
    loop: for (;;) {
      switch (code[pc]) {
        case 35: {
          // STMT
          if (t >= until) {
            stop = "time";
            break loop;
          }
          if (stepOne && stepped) {
            stop = "step";
            break loop;
          }
          if (left <= 0) {
            stop = "budget";
            break loop;
          }
          left--;
          stepped = true;
          steps++;
          if (trace !== null) {
            const n = trace.length / 2;
            trace[this.traceAt * 2] = t;
            trace[this.traceAt * 2 + 1] = code[pc + 1]!;
            this.traceAt = (this.traceAt + 1) % n;
          }
          this.stmt = code[pc + 1]!;
          t += 1;
          pc += 2;
          break;
        }
        case 1: // CONST
          stack[sp++] = code[pc + 1]!;
          pc += 2;
          break;
        case 2: // LOADG
          stack[sp++] = mem[code[pc + 1]!]!;
          pc += 2;
          break;
        case 3: // STOREG
          mem[code[pc + 1]!] = stack[sp - 1]!;
          pc += 2;
          break;
        case 4: // LOADL
          stack[sp++] = mem[fp + code[pc + 1]!]!;
          pc += 2;
          break;
        case 5: // STOREL
          mem[fp + code[pc + 1]!] = stack[sp - 1]!;
          pc += 2;
          break;
        case 6: // POP
          sp--;
          pc += 1;
          break;
        case 7: // DUP
          stack[sp] = stack[sp - 1]!;
          sp++;
          pc += 1;
          break;
        case 8: // ADD
          sp--;
          stack[sp - 1] = stack[sp - 1]! + stack[sp]!;
          pc += 1;
          break;
        case 9: // SUB
          sp--;
          stack[sp - 1] = stack[sp - 1]! - stack[sp]!;
          pc += 1;
          break;
        case 10: // MUL
          sp--;
          stack[sp - 1] = stack[sp - 1]! * stack[sp]!;
          pc += 1;
          break;
        case 11: // MUL32
          sp--;
          stack[sp - 1] = Math.imul(stack[sp - 1]!, stack[sp]!);
          pc += 1;
          break;
        case 12: // DIV (operand: signed)
          sp--;
          a = stack[sp - 1]!;
          b = stack[sp]!;
          // The board's division routine gives all ones (-1) for x / 0 (1 for a negative x when signed).
          if (b === 0) {
            stack[sp - 1] = code[pc + 1] && a < 0 ? 1 : -1;
            this.note("divide", DIVIDE_NOTE);
          } else stack[sp - 1] = Math.trunc(a / b);
          pc += 2;
          break;
        case 13: // MOD
          sp--;
          b = stack[sp]!;
          if (b === 0) this.note("divide", DIVIDE_NOTE);
          else stack[sp - 1] = stack[sp - 1]! % b;
          pc += 2;
          break;
        case 14: // NEG
          stack[sp - 1] = -stack[sp - 1]!;
          pc += 1;
          break;
        case 15: // AND
          sp--;
          stack[sp - 1] = stack[sp - 1]! & stack[sp]!;
          pc += 1;
          break;
        case 16: // OR
          sp--;
          stack[sp - 1] = stack[sp - 1]! | stack[sp]!;
          pc += 1;
          break;
        case 17: // XOR
          sp--;
          stack[sp - 1] = stack[sp - 1]! ^ stack[sp]!;
          pc += 1;
          break;
        case 18: // BNOT
          stack[sp - 1] = ~stack[sp - 1]!;
          pc += 1;
          break;
        case 19: // SHL
          sp--;
          b = stack[sp]!;
          stack[sp - 1] = b < 0 || b >= 32 ? 0 : stack[sp - 1]! << b;
          pc += 1;
          break;
        case 20: // SHR (operand: unsigned)
          sp--;
          a = stack[sp - 1]!;
          b = stack[sp]!;
          if (code[pc + 1]) stack[sp - 1] = b < 0 || b >= 32 ? 0 : a >>> b;
          else stack[sp - 1] = b < 0 || b >= 32 ? (a < 0 ? -1 : 0) : a >> b;
          pc += 2;
          break;
        case 21: // LT
          sp--;
          stack[sp - 1] = stack[sp - 1]! < stack[sp]! ? 1 : 0;
          pc += 1;
          break;
        case 22: // LE
          sp--;
          stack[sp - 1] = stack[sp - 1]! <= stack[sp]! ? 1 : 0;
          pc += 1;
          break;
        case 23: // GT
          sp--;
          stack[sp - 1] = stack[sp - 1]! > stack[sp]! ? 1 : 0;
          pc += 1;
          break;
        case 24: // GE
          sp--;
          stack[sp - 1] = stack[sp - 1]! >= stack[sp]! ? 1 : 0;
          pc += 1;
          break;
        case 25: // EQ
          sp--;
          stack[sp - 1] = stack[sp - 1]! === stack[sp]! ? 1 : 0;
          pc += 1;
          break;
        case 26: // NE
          sp--;
          stack[sp - 1] = stack[sp - 1]! !== stack[sp]! ? 1 : 0;
          pc += 1;
          break;
        case 27: // NOT
          stack[sp - 1] = stack[sp - 1]! === 0 ? 1 : 0;
          pc += 1;
          break;
        case 28: {
          // WRAP
          const v = stack[sp - 1]!;
          switch (code[pc + 1]) {
            case 0:
              stack[sp - 1] = (v << 16) >> 16;
              break;
            case 1:
              stack[sp - 1] = v & 0xffff;
              break;
            case 2:
              stack[sp - 1] = v | 0;
              break;
            case 3:
              stack[sp - 1] = v >>> 0;
              break;
            case 4:
              stack[sp - 1] = v !== 0 ? 1 : 0;
              break;
            case 5:
              stack[sp - 1] = v & 0xff;
              break;
          }
          pc += 2;
          break;
        }
        case 29: // JMP
          pc = code[pc + 1]!;
          break;
        case 30: // JZ
          sp--;
          pc = stack[sp] === 0 ? code[pc + 1]! : pc + 2;
          break;
        case 31: // JNZ
          sp--;
          pc = stack[sp] !== 0 ? code[pc + 1]! : pc + 2;
          break;
        case 32: {
          // CALL
          const f = this.prog.funcs[code[pc + 1]!]!;
          if (this.calls.length >= MAX_DEPTH * 3) {
            this.error = "The program called functions inside functions too deep and ran out of memory.";
            stop = "error";
            break loop;
          }
          this.calls.push(pc + 2, fp, this.memTop);
          const base = this.memTop;
          for (let k = 0; k < f.frameSize; k++) mem[base + k] = 0;
          for (let k = f.params - 1; k >= 0; k--) mem[base + k] = stack[--sp]!;
          fp = base;
          this.memTop = base + f.frameSize;
          pc = f.entry;
          break;
        }
        case 33: {
          // RET
          const c = this.calls;
          const top = c.length;
          this.memTop = c[top - 1]!;
          fp = c[top - 2]!;
          pc = c[top - 3]!;
          c.length = top - 3;
          break;
        }
        case 36: {
          // PRINTSTR
          let text = this.prog.strings[code[pc + 1]!]!;
          if (code[pc + 2]) text += "\r\n";
          t = this.serial(host, text, t);
          stack[sp++] = 0;
          pc += 3;
          break;
        }
        case 34: {
          // BUILTIN id argc extra
          const argc = code[pc + 2]!;
          const r = this.builtin(host, code[pc + 1]!, argc, code[pc + 3]!, sp - argc, t);
          if (r < 0) {
            stop = "wait";
            break loop;
          }
          sp -= argc;
          stack[sp++] = this.ret;
          t = r;
          pc += 4;
          break;
        }
        case 0: // HALT
          this.error = "The program stopped.";
          stop = "error";
          break loop;
        default:
          this.error = `The interpreter met a bad instruction at ${pc}.`;
          stop = "error";
          break loop;
      }
    }
    this.pc = pc;
    this.sp = sp;
    this.t = t;
    this.fp = fp;
    this.steps += steps;
    return stop;
  }

  /** Return value of the last builtin. */
  private ret = 0;

  /** Runs a built-in at time t; returns the time after it, or -1 to wait. Arguments are stack[base ..]. */
  private builtin(host: BoardHost, id: number, argc: number, extra: number, base: number, t: number): number {
    const s = this.stack;
    const a0 = s[base]!;
    const a1 = s[base + 1]!;
    this.ret = 0;
    switch (id) {
      case B.pinMode: {
        const pin = a0;
        if (!validPin(pin)) {
          this.badPin(pin);
          return t + 3;
        }
        if (a1 === 1) this.ddr[pin] = 1;
        else {
          this.ddr[pin] = 0;
          this.port[pin] = a1 === 2 ? 1 : 0;
        }
        this.apply(host, pin, t + 3);
        return t + 3;
      }
      case B.digitalWrite: {
        const pin = a0;
        if (!validPin(pin)) {
          this.badPin(pin);
          return t + 3;
        }
        const level = a1 !== 0 ? 1 : 0;
        if (this.port[pin] === level && this.pwm[pin] === 0) return t + 3;
        this.pwm[pin] = 0;
        this.port[pin] = level;
        this.apply(host, pin, t + 3);
        return t + 3;
      }
      case B.digitalRead: {
        const pin = a0;
        if (!validPin(pin)) {
          this.badPin(pin);
          return t + 3;
        }
        if (this.pwm[pin]) {
          // The board's digitalRead switches PWM off on that pin.
          this.pwm[pin] = 0;
          this.apply(host, pin, t);
        }
        const v = host.digitalRead(pin, t);
        if (v < 0) return -1;
        this.ret = v ? 1 : 0;
        return t + 3;
      }
      case B.analogRead: {
        let pin = a0;
        if (pin < 14) pin += 14;
        if (pin < 14 || pin > 19) {
          this.badPin(pin);
          return t + 111;
        }
        const v = host.analogRead(pin, t);
        if (v < 0) return -1;
        this.ret = Math.max(0, Math.min(1023, Math.floor(v)));
        return t + 111;
      }
      case B.analogWrite: {
        const pin = a0;
        const v = a1;
        if (!validPin(pin)) {
          this.badPin(pin);
          return t + 3;
        }
        this.ddr[pin] = 1;
        if (v === 0) {
          this.pwm[pin] = 0;
          this.port[pin] = 0;
        } else if (v === 255) {
          this.pwm[pin] = 0;
          this.port[pin] = 1;
        } else if (PWM_PINS[pin]) {
          const duty = v & 0xff;
          this.pwm[pin] = duty;
          if (duty === 0) this.port[pin] = 0;
        } else {
          this.pwm[pin] = 0;
          this.port[pin] = v < 128 ? 0 : 1;
        }
        this.apply(host, pin, t + 3);
        return t + 3;
      }
      case B.delay:
        return t + a0 * 1000;
      case B.delayMicroseconds:
        return t + a0;
      case B.millis:
        this.ret = mod32(Math.floor(t / 1000) + this.msOffset);
        return t;
      case B.micros:
        this.ret = mod32(Math.floor(t / 4) * 4 + this.msOffset * 1000);
        return t;
      case B.random:
        if (argc === 1) this.ret = this.randomBelow(a0);
        else this.ret = a0 >= a1 ? a0 : (this.randomBelow((a1 - a0) | 0) + a0) | 0;
        return t;
      case B.randomSeed:
        if (a0 !== 0) this.rng = a0 >>> 0;
        return t;
      case B.serialBegin:
        this.serialBaud = Math.max(300, a0);
        host.serialBegin?.(this.serialBaud, t);
        // The serial port takes pins 0 (RX, an input) and 1 (TX, idling high).
        this.apply(host, 0, t);
        this.apply(host, 1, t);
        return t;
      case B.serialPrint:
      case B.serialPrintln: {
        let text = argc >= 1 ? formatNumber(a0, a1, (extra & 1) === PRINT_SIGNED) : "";
        if (id === B.serialPrintln) text += "\r\n";
        return this.serial(host, text, t);
      }
      case B.map: {
        const p = Math.imul((a0 - a1) | 0, (s[base + 4]! - s[base + 3]!) | 0);
        const d = (s[base + 2]! - a1) | 0;
        const q = d === 0 ? (p < 0 ? 1 : -1) : Math.trunc(p / d);
        this.ret = (q + s[base + 3]!) | 0;
        return t;
      }
      case B.constrain: {
        const hi = s[base + 2]!;
        this.ret = a0 < a1 ? a1 : a0 > hi ? hi : a0;
        return t;
      }
      case B.min:
        this.ret = a0 < a1 ? a0 : a1;
        return t;
      case B.max:
        this.ret = a0 > a1 ? a0 : a1;
        return t;
      case B.abs:
        this.ret = a0 > 0 ? a0 : -a0;
        return t;
    }
    return t;
  }

  private badPin(pin: number): void {
    this.note("pin", `The program used pin ${pin}, which the board does not have. Pins are 0 to 13 and A0 to A5.`);
  }

  /** Tells the host what a pin does now (the serial port overrides pins 0 and 1 once begun). */
  private apply(host: BoardHost, pin: number, t: number): void {
    if (this.serialBaud && pin === 1) {
      host.drive(1, Drive.HIGH, t, 1, 0);
      return;
    }
    if (this.serialBaud && pin === 0) {
      host.drive(0, this.port[0] ? Drive.PULLUP : Drive.INPUT, t, 0, 0);
      return;
    }
    const pwm = this.pwm[pin]!;
    if (this.ddr[pin]) {
      if (pwm) {
        const hz = PWM_PINS[pin] ?? 490.196;
        // Pins 5 and 6 run fast PWM ((v + 1) / 256), the others phase-correct PWM (v / 255).
        const duty = hz > 900 ? (pwm + 1) / 256 : pwm / 255;
        host.drive(pin, Drive.PWM, t, duty, hz);
      } else host.drive(pin, this.port[pin] ? Drive.HIGH : Drive.LOW, t, this.port[pin] ? 1 : 0, 0);
    } else host.drive(pin, this.port[pin] ? Drive.PULLUP : Drive.INPUT, t, 0, 0);
  }

  /**
   * Sends text: each character takes 10 bits at the baud rate. The board keeps up to 64 characters waiting; when
   * that buffer is full the program waits, as Serial.print does on the real board.
   */
  private serial(host: BoardHost, text: string, t: number): number {
    if (!this.serialBaud) {
      if (text.length) this.note("serial", "The program prints, but Serial.begin never ran, so nothing reaches the serial monitor.");
      return t;
    }
    const charUs = 10e6 / this.serialBaud;
    for (const ch of text) {
      if (this.txBusy - t > 64 * charUs) t = this.txBusy - 64 * charUs;
      this.txBusy = Math.max(t, this.txBusy) + charUs;
      host.serialChar?.(ch, this.txBusy);
      t += 1;
    }
    return t;
  }

  /** avr-libc's random(): the Park and Miller minimal standard generator, as the real board uses. */
  private nextRandom(): number {
    let x = this.rng | 0;
    if (x === 0) x = 123459876;
    const hi = Math.trunc(x / 127773);
    const lo = x % 127773;
    x = 16807 * lo - 2836 * hi;
    if (x < 0) x += 0x7fffffff;
    this.rng = x >>> 0;
    return (x >>> 0) % 0x80000000;
  }
  private randomBelow(howbig: number): number {
    if (howbig === 0) return 0;
    return this.nextRandom() % howbig;
  }
}

const DIVIDE_NOTE = "The program divided by zero. On the board that gives a strange number, not an error.";

function validPin(pin: number): boolean {
  return pin >= 0 && pin < PIN_COUNT && Number.isInteger(pin);
}

function mod32(v: number): number {
  const r = v % U32;
  return r < 0 ? r + U32 : r;
}

/** Serial.print of a number: decimal with a sign, or another base as a 32-bit unsigned value (as the board does). */
export function formatNumber(v: number, base: number, signed: boolean): string {
  const b = base === 2 || base === 8 || base === 16 ? base : 10;
  if (b === 10) return signed && v < 0 ? `-${Math.abs(v)}` : String(v < 0 ? v >>> 0 : v);
  return (v >>> 0).toString(b).toUpperCase();
}
