// An Uno-style microcontroller board: a 5 V chip with 20 I/O pins, running a bench C program (@ohmland/code) on
// simulated time.
//
// Electrically the analog solver sees what the pins really do: an output is the 5 V rail or ground behind about
// 25 Ω, an input is almost nothing (a floating one picks up hum, as on logic chips), INPUT_PULLUP adds about 35 kΩ to
// 5 V, every pin has protection diodes to both rails. The board makes its own 5 V from USB (5.0 V behind its fuse) or
// from a battery in the barrel jack through a diode and a 5 V regulator. Pin 0 sits on the USB serial chip through
// 1 kΩ, as on the real board. The L lamp follows pin 13 through a buffer (it does not load the pin); the ON lamp
// follows the 5 V rail. Both appear in the snapshot as parts `<id>:L` and `<id>:ON`.
//
// The program runs in lockstep with the solver. Each step costs board time (1 µs a statement, 4 µs a pin call), so
// the interpreter runs ahead of the solver: pin changes it makes are queued at their exact times (breakpoints), and
// a read may use the circuit as solved up to 100 µs earlier; a read further ahead, or one that follows a pin change
// the solver has not reached yet, waits until the solver gets there. A pin that toggles faster than the solver
// should follow (more than two changes in a millisecond, as in a loop with no delay) is replayed as one pulse
// per millisecond with the same share of time high: what LEDs, meters and eyes see is the same, at a hundredth
// of the cost.

import { compile, Drive, Vm, type BoardHost, type Compiled, type CompileResult, type DriveMode } from "@ohmland/code";
import type { InputKey, InputValue, McuPower, PartSpec, PartState } from "../types";
import { MCU_PINS } from "./mcuPins";
import { AMBIENT, Device, addA, baseState, clamp, finiteOr, num, stampBranch, stampG, stampI, volt, type Binder, type Ctx } from "../engine/device";
import { fmtA, fmtV } from "../util/format";
import { Pickup, clampIG, pickupG, withPins } from "./chips";
import { ledGlow } from "./semis";

type Spec = Extract<PartSpec, { kind: "mcuboard" }>;
const IO = 20;

/** Output resistance of a pin (about 25 Ω at 5 V), the pull-up, and USB's 5 V behind the polyfuse. */
export const MCU = {
  rOut: 25,
  rPullup: 35e3,
  vUsb: 5.0,
  rUsb: 0.3,
  /** The tripped polyfuse. */
  rUsbTripped: 60,
  /** What the board itself draws from 5 V (the chip, the USB serial chip, the ON lamp): about 45 mA. */
  rLoad: 110,
  /** Pin 0 sits on the USB serial chip's transmit line (idling high) through 1 kΩ. */
  rRx: 1000,
  /** Regulator: 5.0 V out, about 1.1 V dropout. Jack: a reverse-protection diode before VIN. */
  vReg: 5.0,
  dropout: 1.1,
  gReg: 10,
  rJack: 1.7,
  /** Brown-out: the chip runs above about 2.7 V. */
  vOn: 2.7,
  vOff: 2.5,
  /** Input thresholds (Schmitt) as a share of the supply: about 2.6 V rising, 2.2 V falling at 5 V. */
  up: 0.52,
  down: 0.44,
  /** Datasheet bands for the snapshot: LOW below 0.3, HIGH above 0.6 of the supply. */
  lo: 0.3,
  hi: 0.6,
  /** Per pin: made for 20 mA, survives about 40 mA. The chip: 200 mA in all, 6 V on its supply. */
  iPin: 0.02,
  iPinMax: 0.04,
  iChipMax: 0.2,
  vChipMax: 6,
};

/** How far a read may lag the program (the solver's last solution may be this old). */
const READ_LAG = 1e-4;
/** How far the program may run ahead of the solver in one go. */
const HORIZON = 2e-3;
/** Pins changing more often than twice in this window are replayed as one pulse per window. */
const WINDOW = 1e-3;
const EPS = 1e-12;
const o = { i: 0, g: 0 };

type Change = { t: number; pin: number; mode: DriveMode; duty: number; hz: number };

const DRIVE_CHAR = ["I", "U", "O", "O", "P"];

/** Compiled programs by source: a rebuild of the circuit does not compile the same program again. */
const CACHE = new Map<string, CompileResult>();
function compiled(source: string): CompileResult {
  let c = CACHE.get(source);
  if (!c) {
    c = compile(source);
    if (CACHE.size >= 16) CACHE.delete(CACHE.keys().next().value!);
    CACHE.set(source, c);
  }
  return c;
}

function programKey(s: Spec): string {
  return `${s.upload ?? 0}|${s.clockStart ?? 0}|${s.seed ?? 1}|${s.program ?? ""}`;
}

export class McuBoardDevice extends Device implements BoardHost {
  private readonly idx = new Int32Array(IO);
  private v5 = -1;
  private gnd = -1;
  private vin = -1;
  private jack = -1;
  power: McuPower;
  private readonly jackVolts: number;
  proximity = 0;

  // Program
  private prog: Compiled | null = null;
  private progError = "";
  private vm: Vm | null = null;
  private key: string;
  /** Simulated time at which the board clock read 0 (the last reset). */
  private tBoot = 0;
  /** When the program next needs to run (s), or Infinity. */
  private wake = Infinity;
  private runError = "";

  // Pins as the solver sees them
  readonly mode = new Uint8Array(IO); // DriveMode
  readonly level = new Uint8Array(IO); // the output level now (PWM: its current phase)
  private readonly duty = new Float64Array(IO);
  private readonly hz = new Float64Array(IO);
  private readonly pwmNext = new Float64Array(IO).fill(Infinity);
  readonly dead = new Uint8Array(IO);
  private readonly damage = new Float64Array(IO);
  private readonly overT = new Float64Array(IO);
  private readonly warned = new Uint8Array(IO);
  /** Changes waiting for the solver to reach their time, sorted. */
  private queue: Change[] = [];
  // Bursts of output changes the program makes, per pin, gathered per window (see drive() and close()).
  private readonly segW = new Float64Array(IO);
  private readonly segN = new Int32Array(IO);
  private readonly segFirst = new Float64Array(IO);
  private readonly segLastT = new Float64Array(IO);
  private readonly segLastHigh = new Uint8Array(IO);
  private readonly segHigh = new Float64Array(IO);
  private readonly segKeep: Change[][] = Array.from({ length: IO }, () => []);

  // What the inputs see (from the last accepted solution)
  private readonly pinV = new Float64Array(IO);
  readonly inLevel = new Uint8Array(IO);
  private supply = 0;
  private now = 0;
  private readonly pk: Pickup[];
  private pkT = -1;

  // Board state
  powered = false;
  chipDead = false;
  private chipDamage = 0;
  private chipSent = false;
  private usbHeat = 0;
  private usbTripped = false;
  private serialWarned = false;
  /** Eye-averaged current of the L and ON lamps. */
  private lAvg = 0;
  private onAvg = 0;
  /** Serial characters waiting to finish sending (time in s), the line being received, and a tail for the monitor. */
  private tx: { t: number; ch: string }[] = [];
  private line = "";
  private lines: string[] = [];
  serialTail = "";
  serialChars = 0;
  private notesSent = new Set<string>();

  constructor(spec: Spec) {
    super(withPins(spec, MCU_PINS));
    this.nonlinear = true;
    this.timed = true;
    this.power = spec.power === "jack" || spec.power === "off" ? spec.power : "usb";
    this.jackVolts = finiteOr(spec.jackVolts, 9);
    this.key = programKey(spec);
    this.pk = Array.from({ length: IO }, (_, k) => new Pickup(`pickup:${spec.id}:${MCU_PINS[k]}`));
    this.load(spec);
  }

  private get s(): Spec {
    return this.spec as Spec;
  }

  /** Compiles the spec's program (the run starts at the next power-up or reset). */
  private load(spec: Spec): void {
    this.prog = null;
    this.progError = "";
    this.vm = null;
    if (!spec.program || !spec.program.trim()) return;
    const c = compiled(spec.program);
    if (!c.ok) {
      const e = c.errors[0]!;
      this.progError = `${e.line}:${e.col} ${e.message}`;
      return;
    }
    this.prog = c.program;
    this.vm = new Vm(c.program, { clockStart: finiteOr(spec.clockStart, 0), seed: finiteOr(spec.seed, 1) });
  }

  bind(b: Binder): void {
    for (let k = 0; k < IO; k++) this.idx[k] = b.node(this.pin(MCU_PINS[k]!));
    this.v5 = b.node(this.pin("5v"));
    this.gnd = b.node(this.pin("gnd"));
    this.vin = b.node(this.pin("vin"));
    this.jack = b.internal(`${this.id}#jack`);
    for (let k = 0; k < IO; k++) b.group([this.idx[k]!, this.v5, this.gnd]);
    b.group([this.v5, this.gnd, this.vin, this.jack]);
  }

  // -- stamping ----------------------------------------------------------------------------------------------------

  private get gUsb(): number {
    return this.power !== "usb" ? 0 : 1 / (this.usbTripped ? MCU.rUsbTripped : MCU.rUsb);
  }

  /** Conductance from a pin to 5 V and to ground, as its drive is now. */
  private pinG(k: number): [number, number] {
    if (!this.powered || this.chipDead) return [0, 0];
    const m = this.mode[k]!;
    if (this.dead[k]) return [0, 0];
    if (m === Drive.PULLUP) return [1 / MCU.rPullup, 0];
    if (m === Drive.HIGH || (m === Drive.PWM && this.level[k])) return [1 / MCU.rOut, 0];
    if (m === Drive.LOW || (m === Drive.PWM && !this.level[k])) return [0, 1 / MCU.rOut];
    return [0, 0];
  }

  override stampLinear(A: Float64Array, n: number): void {
    const v5 = this.v5;
    const gnd = this.gnd;
    stampG(A, n, v5, gnd, 1 / MCU.rLoad + this.gUsb);
    stampG(A, n, this.idx[0]!, v5, 1 / MCU.rRx);
    if (this.power === "jack") stampG(A, n, this.jack, gnd, 1 / MCU.rJack);
    for (let k = 0; k < IO; k++) {
      const [gh, gl] = this.pinG(k);
      if (gh) stampG(A, n, this.idx[k]!, v5, gh);
      if (gl) stampG(A, n, this.idx[k]!, gnd, gl);
    }
  }

  override stampRhs(b: Float64Array, ctx: Ctx): void {
    const g = this.gUsb;
    if (g) stampI(b, this.gnd, this.v5, MCU.vUsb * g * ctx.sourceScale);
    if (this.power === "jack") stampI(b, this.gnd, this.jack, (this.jackVolts / MCU.rJack) * ctx.sourceScale);
  }

  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array, ctx: Ctx): void {
    const v5 = this.v5;
    const gnd = this.gnd;
    const vs = volt(x, v5);
    const vg = volt(x, gnd);
    // Floating inputs pick up hum (only bare inputs: a pull-up or an output swamps it).
    const gp = pickupG(this.proximity);
    const t = ctx.t + ctx.h;
    // The picked-up voltage depends on time only: work it out once per step, not once per Newton iteration.
    const fresh = t !== this.pkT;
    this.pkT = t;
    for (let k = 0; k < IO; k++) {
      if (this.mode[k] !== Drive.INPUT || k === 0) continue;
      const pk = this.pk[k]!;
      if (fresh) pk.f = pk.frac(t, this.proximity);
      pk.stamp(A, n, this.idx[k]!, v5, gnd, gp);
    }
    // Protection diodes to both rails.
    for (let k = 0; k < IO; k++) {
      const p = this.idx[k]!;
      const v = volt(x, p);
      const up = v - vs;
      if (up > 0.15) {
        clampIG(up, 20, o);
        stampBranch(A, b, n, p, v5, o.i, o.g, up);
      }
      const dn = vg - v;
      if (dn > 0.15) {
        clampIG(dn, 20, o);
        stampBranch(A, b, n, gnd, p, o.i, o.g, dn);
      }
    }
    // The jack's reverse-protection diode, then the regulator from VIN to 5 V.
    if (this.power === "jack") {
      const vd = volt(x, this.jack) - volt(x, this.vin);
      if (vd > 0.15) {
        clampIG(vd, 0.3, o);
        stampBranch(A, b, n, this.jack, this.vin, o.i, o.g, vd);
      }
    }
    this.regulator(A, b, n, x);
  }

  /** The 5 V regulator: sources current into 5 V to hold it at 5.0 V, while VIN is at least the dropout above. */
  private regulator(A: Float64Array, b: Float64Array, n: number, x: Float64Array): void {
    const vg = volt(x, this.gnd);
    const vi = volt(x, this.vin) - vg;
    const vo = volt(x, this.v5) - vg;
    const limited = vi - MCU.dropout < MCU.vReg;
    const target = limited ? vi - MCU.dropout : MCU.vReg;
    const d = target - vo;
    if (d <= 0 || vi < 1) return;
    const g = MCU.gReg;
    const i = g * d;
    // i = g (target - vo): flows from VIN into 5 V. Linearised in vo (and vi while dropout limits it).
    const dvi = limited ? g : 0;
    const ieq = i + g * vo - dvi * vi;
    // Row 5 V: current in = ieq - g vo + dvi vi.
    addA(A, n, this.v5, this.v5, g);
    addA(A, n, this.v5, this.vin, -dvi);
    addA(A, n, this.vin, this.v5, -g);
    addA(A, n, this.vin, this.vin, dvi);
    // Ground reference terms (the regulator's voltages are measured from GND).
    addA(A, n, this.v5, this.gnd, dvi - g);
    addA(A, n, this.vin, this.gnd, g - dvi);
    stampI(b, this.vin, this.v5, ieq);
  }

  /** Currents: regulator VIN to 5 V, jack diode, USB source into 5 V. */
  private supplyCurrents(x: Float64Array): { reg: number; jack: number; usb: number } {
    const vg = volt(x, this.gnd);
    const vi = volt(x, this.vin) - vg;
    const vo = volt(x, this.v5) - vg;
    const target = Math.min(MCU.vReg, vi - MCU.dropout);
    const reg = vi >= 1 && target > vo ? MCU.gReg * (target - vo) : 0;
    let jack = 0;
    if (this.power === "jack") {
      const vd = volt(x, this.jack) - volt(x, this.vin);
      if (vd > 0.15) {
        clampIG(vd, 0.3, o);
        jack = o.i;
      }
    }
    const usb = this.gUsb * (MCU.vUsb - vo);
    return { reg, jack, usb };
  }

  /** Current out of each I/O pin into the circuit (positive when the pin sources). */
  private pinOut(x: Float64Array, k: number): number {
    const p = this.idx[k]!;
    const v = volt(x, p);
    const vs = volt(x, this.v5);
    const vg = volt(x, this.gnd);
    const [gh, gl] = this.pinG(k);
    let i = gh * (vs - v) - gl * (v - vg);
    if (k === 0) i += (vs - v) / MCU.rRx;
    if (this.mode[k] === Drive.INPUT && k !== 0) i -= this.pk[k]!.amps(x, p, this.v5, this.gnd, pickupG(this.proximity));
    const up = v - vs;
    if (up > 0.15) {
      clampIG(up, 20, o);
      i -= o.i;
    }
    const dn = vg - v;
    if (dn > 0.15) {
      clampIG(dn, 20, o);
      i += o.i;
    }
    return i;
  }

  pinCurrents(x: Float64Array): number[] {
    const out = new Array<number>(MCU_PINS.length).fill(0);
    let i5 = 0;
    let ig = 0;
    const vs = volt(x, this.v5);
    const vg = volt(x, this.gnd);
    const gp = pickupG(this.proximity);
    for (let k = 0; k < IO; k++) {
      const p = this.idx[k]!;
      const v = volt(x, p);
      const [gh, gl] = this.pinG(k);
      const fromV5 = gh * (vs - v) + (k === 0 ? (vs - v) / MCU.rRx : 0);
      const toGnd = gl * (v - vg);
      let into = toGnd - fromV5;
      i5 += fromV5;
      ig -= toGnd;
      if (this.mode[k] === Drive.INPUT && k !== 0) {
        const ip = this.pk[k]!.amps(x, p, this.v5, this.gnd, gp);
        into += ip;
        ig -= ip;
      }
      const up = v - vs;
      if (up > 0.15) {
        clampIG(up, 20, o);
        into += o.i;
        i5 -= o.i;
      }
      const dn = vg - v;
      if (dn > 0.15) {
        clampIG(dn, 20, o);
        into -= o.i;
        ig += o.i;
      }
      out[k] = into;
    }
    const s = this.supplyCurrents(x);
    const load = (vs - vg) / MCU.rLoad;
    // Into the 5V pin: what the board's loads take, minus what USB and the regulator deliver.
    out[IO] = i5 + load - s.usb - s.reg;
    out[IO + 2] = s.reg - s.jack; // VIN: the regulator takes from it, the jack's diode feeds it
    out[IO + 1] = ig - load + s.usb + (this.power === "jack" ? s.jack : 0);
    return out;
  }

  // -- the program's board (BoardHost) -------------------------------------------------------------------------------

  private at(tUs: number): number {
    return this.tBoot + tUs * 1e-6;
  }

  /**
   * The program changed a pin. Output levels are gathered per pin and per window (a burst); input, pull-up and PWM
   * changes are queued as they are.
   */
  drive(pin: number, mode: DriveMode, tUs: number, duty: number, hz: number): void {
    const t = this.at(tUs);
    const simple = mode === Drive.HIGH || mode === Drive.LOW;
    const w = Math.floor(t / WINDOW + 1e-9);
    if (this.segN[pin]! > 0 && (!simple || w !== this.segW[pin])) this.close(pin, (this.segW[pin]! + 1) * WINDOW);
    if (!simple) {
      this.queue.push({ t, pin, mode, duty, hz });
      return;
    }
    if (this.segN[pin] === 0) {
      this.segW[pin] = w;
      this.segFirst[pin] = t;
      this.segHigh[pin] = 0;
    } else if (this.segLastHigh[pin]) this.segHigh[pin]! += t - this.segLastT[pin]!;
    this.segLastT[pin] = t;
    this.segLastHigh[pin] = mode === Drive.HIGH ? 1 : 0;
    this.segN[pin]!++;
    if (this.segN[pin]! <= 2) this.segKeep[pin]!.push({ t, pin, mode, duty, hz });
  }

  /**
   * Ends a pin's burst at `end`: two changes or fewer go to the queue exactly; more become one pulse that starts at
   * the first change, ends at the burst's last level, and is high for the same share of the time.
   */
  private close(pin: number, end: number): void {
    const n = this.segN[pin]!;
    if (!n) return;
    if (n <= 2) this.queue.push(...this.segKeep[pin]!);
    else {
      const t0 = this.segFirst[pin]!;
      const last = this.segLastT[pin]!;
      const stop = Math.max(end, last);
      const span = stop - t0;
      const endHigh = this.segLastHigh[pin] === 1;
      const high = this.segHigh[pin]! + (endHigh ? stop - last : 0);
      const f = span > 0 ? high / span : endHigh ? 1 : 0;
      const mk = (t: number, hi: boolean): Change => ({ t, pin, mode: hi ? Drive.HIGH : Drive.LOW, duty: hi ? 1 : 0, hz: 0 });
      this.queue.push(...(endHigh ? [mk(t0, false), mk(t0 + (1 - f) * span, true)] : [mk(t0, true), mk(t0 + f * span, false)]));
    }
    this.segN[pin] = 0;
    this.segKeep[pin]!.length = 0;
  }

  /** Can a read at board time tUs use the last solution? Not if it is too far ahead, or a change is still on its way. */
  private canRead(tUs: number): boolean {
    const t = this.at(tUs);
    if (t > this.now + READ_LAG + EPS) return false;
    if (this.queue.length && this.queue[0]!.t <= t + EPS) return false;
    for (let k = 0; k < IO; k++) if (this.segN[k]! > 0 && this.segFirst[k]! <= t + EPS) return false;
    return true;
  }

  digitalRead(pin: number, tUs: number): number {
    if (!this.canRead(tUs)) return -1;
    return this.inLevel[pin]!;
  }

  analogRead(pin: number, tUs: number): number {
    if (!this.canRead(tUs)) return -1;
    const vs = Math.max(0.1, this.supply);
    return clamp(Math.floor((1024 * this.pinV[pin]!) / vs), 0, 1023);
  }

  serialChar(ch: string, tUs: number): void {
    this.tx.push({ t: this.at(tUs), ch });
  }

  // -- time --------------------------------------------------------------------------------------------------------

  /** Back to the start of the program: every pin an input, the clock at zero. */
  private reset(t: number, ctx: Ctx): void {
    this.tBoot = t;
    this.vm?.reset();
    this.runError = "";
    this.queue = [];
    this.segN.fill(0);
    for (const s of this.segKeep) s.length = 0;
    for (let k = 0; k < IO; k++) {
      this.mode[k] = Drive.INPUT;
      this.level[k] = 0;
      this.pwmNext[k] = Infinity;
    }
    this.tx = [];
    this.line = "";
    this.wake = this.vm && this.powered && !this.chipDead ? t : Infinity;
    ctx.markDirty();
    ctx.markEdge();
  }

  /** Applies a pin change now. */
  private set(c: Change, ctx: Ctx): void {
    const k = c.pin;
    this.mode[k] = c.mode;
    this.duty[k] = c.duty;
    this.hz[k] = c.hz;
    if (c.mode === Drive.PWM) {
      this.level[k] = 1;
      this.pwmNext[k] = c.t + c.duty / c.hz;
    } else {
      this.level[k] = c.mode === Drive.HIGH ? 1 : 0;
      this.pwmNext[k] = Infinity;
    }
    ctx.markDirty();
    ctx.markEdge();
  }

  override beginStep(ctx: Ctx): void {
    const t = ctx.t;
    this.now = t;
    // Pin changes and PWM edges that are due.
    while (this.queue.length && this.queue[0]!.t <= t + EPS) this.set(this.queue.shift()!, ctx);
    for (let k = 0; k < IO; k++) {
      let nx = this.pwmNext[k]!;
      if (nx === Infinity) continue;
      if (nx <= t + EPS) {
        const period = 1 / this.hz[k]!;
        while (nx <= t + EPS) {
          this.level[k] = this.level[k] ? 0 : 1;
          nx += (this.level[k] ? this.duty[k]! : 1 - this.duty[k]!) * period;
        }
        this.pwmNext[k] = nx;
        ctx.markDirty();
        ctx.markEdge();
      }
      ctx.addBreakpoint(nx);
    }
    // The program.
    if (this.vm && this.powered && !this.chipDead && !this.runError && t >= this.wake - EPS) this.runProgram(ctx);
    if (this.queue.length) ctx.addBreakpoint(this.queue[0]!.t);
    if (this.wake !== Infinity) ctx.addBreakpoint(this.wake);
  }

  private runProgram(ctx: Ctx): void {
    const vm = this.vm!;
    const t = ctx.t;
    // Run to the end of a replay window at least HORIZON ahead (windows are on a fixed grid).
    const until = (Math.ceil((t + HORIZON) / WINDOW) * WINDOW - this.tBoot) * 1e6;
    const r = vm.run(this, until);
    const end = this.at(vm.t);
    this.flush(end);
    if (r === "error") {
      this.runError = vm.error ?? "The program stopped.";
      ctx.emit(this.id, "warning", `The board's program stopped: ${this.runError}`, { cause: "program" });
      this.wake = Infinity;
    } else this.wake = Math.max(end, t);
    for (const note of vm.notes) {
      if (this.notesSent.has(note.kind)) continue;
      this.notesSent.add(note.kind);
      ctx.emit(this.id, "warning", note.message, { cause: note.kind });
    }
    vm.notes = [];
    while (this.queue.length && this.queue[0]!.t <= t + EPS) this.set(this.queue.shift()!, ctx);
  }

  /** After a run: every open burst ends where the program stopped, and the queue is put in time order. */
  private flush(end: number): void {
    for (let k = 0; k < IO; k++) this.close(k, Math.min(end, (this.segW[k]! + 1) * WINDOW));
    if (this.queue.length > 1) this.queue.sort((a, b) => a.t - b.t);
  }

  override accept(x: Float64Array, ctx: Ctx): void {
    const vg = volt(x, this.gnd);
    const vs = volt(x, this.v5) - vg;
    this.supply = vs;
    this.now = ctx.t;
    for (let k = 0; k < IO; k++) {
      const v = volt(x, this.idx[k]!) - vg;
      this.pinV[k] = v;
      if (this.inLevel[k] ? v < MCU.down * vs : v > MCU.up * vs) this.inLevel[k] = this.inLevel[k] ? 0 : 1;
    }
    const h = ctx.h;
    // Lamps: L follows pin 13 through a buffer and 1 kΩ, ON follows 5 V. The eye averages over about 30 ms.
    const iL = this.powered ? Math.max(0, Math.min(this.pinV[13]!, vs) - 1.8) / 1000 : 0;
    const iOn = Math.max(0, vs - 2.0) / 1500;
    const a = 1 - Math.exp(-h / 0.015);
    this.lAvg += (iL - this.lAvg) * a;
    this.onAvg += (iOn - this.onAvg) * a;

    // Power: the chip runs above about 2.7 V; coming up, the program starts from the top.
    const on = !this.chipDead && (this.powered ? vs > MCU.vOff : vs > MCU.vOn);
    if (on !== this.powered) {
      this.powered = on;
      if (on) this.reset(ctx.t, ctx);
      else {
        this.wake = Infinity;
        this.queue = [];
        for (let k = 0; k < IO; k++) {
          this.mode[k] = Drive.INPUT;
          this.pwmNext[k] = Infinity;
        }
        ctx.markDirty();
        ctx.markEdge();
      }
    }
    this.serialOut(ctx);
    this.abuse(x, vs, ctx);
  }

  /** Characters fully sent by now go to the monitor; each finished line is an event. */
  private serialOut(ctx: Ctx): void {
    let n = 0;
    while (n < this.tx.length && this.tx[n]!.t <= ctx.t + EPS) n++;
    if (!n) return;
    const sent = this.tx.splice(0, n);
    for (const { ch } of sent) {
      this.serialChars++;
      if (ch === "\n") {
        this.lines.push(this.line.replace(/\r$/, ""));
        this.line = "";
      } else this.line += ch;
    }
    this.serialTail = (this.serialTail + sent.map((c) => c.ch).join("")).slice(-600);
    if (this.lines.length) {
      const text = this.lines.join("\n");
      ctx.emit(this.id, "serial", this.lines[this.lines.length - 1]!, { text, lines: this.lines.length });
      this.lines = [];
    }
  }

  private abuse(x: Float64Array, vs: number, ctx: Ctx): void {
    const h = ctx.h;
    let total = 0;
    for (let k = 0; k < IO; k++) {
      const i = this.pinOut(x, k);
      const a = Math.abs(i);
      total += a;
      const name = k >= 14 ? `A${k - 14}` : String(k);
      if (a > MCU.iPin && !this.dead[k] && this.powered) {
        this.overT[k]! += h;
        if (this.overT[k]! > 0.02 && !this.warned[k]) {
          this.warned[k] = 1;
          ctx.emit(this.id, "warning", `Pin ${name} is carrying ${fmtA(a)}. A pin is made for 20 mA and survives about 40 mA: add a resistor (about 220 Ω or more for an LED).`, {
            amps: a,
            pin: name,
            cause: "overload",
          });
        }
      } else this.overT[k] = 0;
      if (a > MCU.iPinMax && !this.dead[k]) {
        const r = a / MCU.iPinMax;
        this.damage[k]! += ((r * r - 1) / 2) * h;
        if (this.damage[k]! >= 1) {
          this.dead[k] = 1;
          ctx.markDirty();
          ctx.markBreak();
          ctx.emit(this.id, "died", `Pin ${name} of the board burned out: it carried ${fmtA(a)}, and a pin survives about 40 mA. The rest of the board still works. Put a resistor in series (220 Ω or more for an LED).`, {
            amps: a,
            pin: name,
            cause: "overcurrent",
          });
        }
      }
      if ((k === 0 || k === 1) && a > (k === 0 ? 1e-3 : 2e-3) && !this.serialWarned && this.powered) {
        this.serialWarned = true;
        ctx.emit(this.id, "warning", `Pins 0 and 1 carry the USB serial line (RX and TX), so pin ${k} is busy. Move what is wired there to pin 2 or above.`, {
          pin: String(k),
          cause: "serial-pins",
        });
      }
    }
    // USB fuse: a short on 5 V trips it (it resets when the overload goes).
    if (this.power === "usb") {
      const iUsb = Math.abs(this.gUsb * (MCU.vUsb - vs));
      this.usbHeat = Math.max(0, this.usbHeat + (iUsb > 0.5 ? (iUsb / 0.5) ** 2 - 1 : -0.5) * h);
      if (!this.usbTripped && this.usbHeat > 0.2) {
        this.usbTripped = true;
        ctx.markDirty();
        ctx.markBreak();
        const why = vs < MCU.vUsb ? "Something shorts 5V to GND." : "Something on the 5V pin pushes current back into USB.";
        ctx.emit(this.id, "warning", `The board's USB fuse tripped: ${fmtA(iUsb)} flowed through it. ${why} It resets once that is gone.`, {
          amps: iUsb,
          cause: "usb-fuse",
        });
      } else if (this.usbTripped && iUsb * (MCU.rUsbTripped / MCU.rUsb) < 0.3 && this.usbHeat === 0) {
        this.usbTripped = false;
        ctx.markDirty();
        ctx.markBreak();
      }
    }
    // The chip: 6 V on its supply at most, 200 mA through all its pins.
    if (this.chipDead) return;
    let rate = 0;
    let why = "";
    let cause = "";
    if (vs > MCU.vChipMax) {
      rate += 2 + 5 * (vs - MCU.vChipMax);
      cause = "overvoltage";
      why = `${fmtV(vs)} reached its 5V pin, and it is made for 5 V (6 V at most). A battery goes to VIN or the barrel jack, never to 5V.`;
    }
    if (total > MCU.iChipMax) {
      const r = total / MCU.iChipMax;
      rate += (r * r - 1) / 2;
      if (!cause) {
        cause = "overcurrent";
        why = `Its pins carried ${fmtA(total)} in all, and the chip survives about 200 mA.`;
      }
    }
    if (rate <= 0) return;
    this.chipDamage += rate * h;
    if (this.chipDamage >= 1) {
      this.chipDead = true;
      this.powered = false;
      this.wake = Infinity;
      ctx.markDirty();
      ctx.markBreak();
      if (!this.chipSent) {
        this.chipSent = true;
        ctx.emit(this.id, "died", `The board's chip is dead. ${why}`, { cause, volts: vs });
      }
    }
  }

  // -- inputs, state, rebuilds -------------------------------------------------------------------------------------

  override setInput(key: InputKey, value: InputValue, ctx: Ctx): boolean {
    switch (key) {
      case "proximity":
        this.proximity = clamp(num(value, this.proximity), 0, 1);
        return true;
      case "power": {
        const p = value === "jack" || value === "off" ? value : "usb";
        if (p === this.power) return true;
        this.power = p;
        return true;
      }
      case "reset":
        if (value !== false && this.powered) this.reset(ctx.t, ctx);
        return true;
      case "millis":
        if (this.vm) this.vm.setMillis(num(value, 0), (ctx.t - this.tBoot) * 1e6);
        return true;
    }
    return false;
  }

  override inputValue(key: InputKey): InputValue | undefined {
    if (key === "proximity") return this.proximity;
    if (key === "power") return this.power;
    return undefined;
  }

  /** millis() as the board reads it now. */
  millisNow(): number {
    return this.vm ? this.vm.millis((this.now - this.tBoot) * 1e6) : 0;
  }

  override save(): Record<string, unknown> {
    return {
      key: this.key,
      vm: this.vm,
      prog: this.prog,
      tBoot: this.tBoot,
      wake: this.wake,
      runError: this.runError,
      upload: this.s.upload ?? 0,
      mode: [...this.mode],
      level: [...this.level],
      duty: [...this.duty],
      hz: [...this.hz],
      pwmNext: [...this.pwmNext],
      dead: [...this.dead],
      damage: [...this.damage],
      queue: this.queue,
      inLevel: [...this.inLevel],
      powered: this.powered,
      chipDead: this.chipDead,
      chipDamage: this.chipDamage,
      usbTripped: this.usbTripped,
      usbHeat: this.usbHeat,
      lAvg: this.lAvg,
      onAvg: this.onAvg,
      tx: this.tx,
      line: this.line,
      serialTail: this.serialTail,
      serialChars: this.serialChars,
      notesSent: [...this.notesSent],
      supply: this.supply,
      now: this.now,
    };
  }

  override restore(s: Record<string, unknown>): void {
    const arr = (v: unknown) => (Array.isArray(v) ? (v as number[]) : []);
    arr(s.dead).forEach((v, k) => k < IO && (this.dead[k] = v ? 1 : 0));
    arr(s.damage).forEach((v, k) => k < IO && (this.damage[k] = finiteOr(v, 0)));
    this.chipDead = s.chipDead === true;
    this.chipDamage = finiteOr(s.chipDamage as number, 0);
    this.chipSent = this.chipDead;
    this.usbTripped = s.usbTripped === true;
    this.usbHeat = finiteOr(s.usbHeat as number, 0);
    this.lAvg = finiteOr(s.lAvg as number, 0);
    this.onAvg = finiteOr(s.onAvg as number, 0);
    this.serialTail = typeof s.serialTail === "string" ? s.serialTail : "";
    this.serialChars = finiteOr(s.serialChars as number, 0);
    this.supply = finiteOr(s.supply as number, 0);
    this.now = finiteOr(s.now as number, 0);
    this.powered = s.powered === true && !this.chipDead;
    arr(s.inLevel).forEach((v, k) => k < IO && (this.inLevel[k] = v ? 1 : 0));
    if (s.key === this.key && s.vm instanceof Vm) {
      // Same program, same upload: the board keeps running where it was.
      this.vm = s.vm;
      this.prog = s.prog as Compiled;
      this.tBoot = finiteOr(s.tBoot as number, 0);
      this.wake = typeof s.wake === "number" ? s.wake : Infinity;
      this.runError = typeof s.runError === "string" ? s.runError : "";
      arr(s.mode).forEach((v, k) => k < IO && (this.mode[k] = v));
      arr(s.level).forEach((v, k) => k < IO && (this.level[k] = v));
      arr(s.duty).forEach((v, k) => k < IO && (this.duty[k] = v));
      arr(s.hz).forEach((v, k) => k < IO && (this.hz[k] = v));
      arr(s.pwmNext).forEach((v, k) => k < IO && (this.pwmNext[k] = v ?? Infinity));
      this.queue = Array.isArray(s.queue) ? (s.queue as Change[]) : [];
      this.tx = Array.isArray(s.tx) ? (s.tx as { t: number; ch: string }[]) : [];
      this.line = typeof s.line === "string" ? s.line : "";
      this.notesSent = new Set(Array.isArray(s.notesSent) ? (s.notesSent as string[]) : []);
      return;
    }
    if (s.key !== this.key) {
      // A new upload: the board resets and runs the new program from the top.
      this.tBoot = this.now;
      this.wake = this.vm && this.powered ? this.now : Infinity;
      for (let k = 0; k < IO; k++) {
        this.mode[k] = Drive.INPUT;
        this.level[k] = 0;
        this.pwmNext[k] = Infinity;
      }
    }
  }

  override replace(ctx: Ctx): void {
    this.dead.fill(0);
    this.damage.fill(0);
    this.warned.fill(0);
    this.chipDead = false;
    this.chipDamage = 0;
    this.chipSent = false;
    this.usbTripped = false;
    this.usbHeat = 0;
    this.powered = false;
    this.load(this.s);
    ctx.markDirty();
  }

  private extra(x: Float64Array): Record<string, number | string | boolean> {
    const vs = this.supply;
    let modes = "";
    let levels = "";
    const volts: string[] = [];
    const mA: string[] = [];
    for (let k = 0; k < IO; k++) {
      modes += DRIVE_CHAR[this.mode[k]!] ?? "I";
      const v = volt(x, this.idx[k]!) - volt(x, this.gnd);
      levels += !this.powered ? "-" : v < MCU.lo * vs ? "L" : v > MCU.hi * vs ? "H" : this.inLevel[k] ? "h" : "l";
      volts.push(v.toFixed(3));
      mA.push((this.pinOut(x, k) * 1000).toFixed(2));
    }
    const vm = this.vm;
    const st = vm && vm.stmt >= 0 ? this.prog?.stmts[vm.stmt] : undefined;
    const e: Record<string, number | string | boolean> = {
      power: this.power,
      powered: this.powered,
      program: !this.s.program ? "none" : this.progError ? "error" : this.runError ? "stopped" : this.powered ? "running" : "off",
      millis: this.millisNow(),
      upload: this.s.upload ?? 0,
      modes,
      levels,
      volts: volts.join(","),
      mA: mA.join(","),
      L: ledGlow(this.lAvg),
      ON: ledGlow(this.onAvg),
      serial: this.serialTail,
      serialChars: this.serialChars,
      deadPins: [...this.dead].map((d, k) => (d ? (k >= 14 ? `A${k - 14}` : String(k)) : "")).filter(Boolean).join(","),
      usbFuse: this.usbTripped ? "tripped" : "ok",
    };
    if (st?.span) e.line = st.span.line;
    if (this.progError || this.runError) e.error = this.progError || this.runError;
    return e;
  }

  state(x: Float64Array): PartState {
    const s = this.supplyCurrents(x);
    const vs = volt(x, this.v5) - volt(x, this.gnd);
    const supplied = this.power === "usb" ? s.usb : this.power === "jack" ? s.jack : 0;
    const health = this.chipDead ? "dead" : this.dead.some((d) => d) ? "hot" : "ok";
    const st = baseState(supplied, vs, Math.max(0, supplied * vs), AMBIENT, health);
    st.extra = this.extra(x);
    return st;
  }

  /** The board's own lamps, as parts of their own: `<id>:L` (pin 13) and `<id>:ON` (power). */
  override subStates(): Record<string, PartState> {
    const lamp = (i: number): PartState => ({ i, v: i > 0 ? 1.9 : 0, p: i * 1.9, temp: AMBIENT, health: "ok", glow: ledGlow(i), extra: { color: "orange" } });
    const on = lamp(this.onAvg);
    on.extra = { color: "green" };
    return { [`${this.id}:L`]: lamp(this.lAvg), [`${this.id}:ON`]: on };
  }
}
