// A 3.5 digit (1999 count) multimeter with four sockets: COM, VΩ, mA (fused at 200 mA) and 10 A (unfused).
//
// The sockets are always physically there, whatever the dial says: the mA socket is a few ohms to COM through the
// internal fuse, the 10 A socket is 0.01 Ω to COM. So a red lead left in the mA socket while measuring volts
// shorts the source and can blow the fuse, as on a real meter.

import type { InputKey, InputValue, MeterMode, PartSpec, PartState } from "../types";
import { Device, G_OPEN, R_OFF, baseState, bool, stampG, stampI, volt, type Binder, type Ctx } from "../engine/device";
import { FuseElement } from "./basic";
import { fmtA } from "../util/format";

type Spec = Extract<PartSpec, { kind: "multimeter" }>;

type RangeDef = { label: string; fs: number; dec: number; scale: number; unit: string; src?: number; shunt?: number };

const DCV: RangeDef[] = [
  { label: "200mV", fs: 0.2, dec: 1, scale: 1e3, unit: "mV" },
  { label: "2V", fs: 2, dec: 3, scale: 1, unit: "V" },
  { label: "20V", fs: 20, dec: 2, scale: 1, unit: "V" },
  { label: "200V", fs: 200, dec: 1, scale: 1, unit: "V" },
  { label: "600V", fs: 600, dec: 0, scale: 1, unit: "V" },
];
const ACV: RangeDef[] = DCV.slice(1);
const OHM: RangeDef[] = [
  { label: "200", fs: 200, dec: 1, scale: 1, unit: "Ω", src: 1e3 },
  { label: "2k", fs: 2e3, dec: 3, scale: 1e-3, unit: "kΩ", src: 1e4 },
  { label: "20k", fs: 2e4, dec: 2, scale: 1e-3, unit: "kΩ", src: 1e5 },
  { label: "200k", fs: 2e5, dec: 1, scale: 1e-3, unit: "kΩ", src: 1e6 },
  { label: "2M", fs: 2e6, dec: 3, scale: 1e-6, unit: "MΩ", src: 1e7 },
  { label: "20M", fs: 2e7, dec: 2, scale: 1e-6, unit: "MΩ", src: 1e8 },
];
const MA: RangeDef[] = [
  { label: "200uA", fs: 2e-4, dec: 1, scale: 1e6, unit: "µA", shunt: 1000 },
  { label: "2mA", fs: 2e-3, dec: 3, scale: 1e3, unit: "mA", shunt: 100 },
  { label: "20mA", fs: 0.02, dec: 2, scale: 1e3, unit: "mA", shunt: 10 },
  { label: "200mA", fs: 0.2, dec: 1, scale: 1e3, unit: "mA", shunt: 2 },
];
const A10: RangeDef[] = [{ label: "10A", fs: 20, dec: 2, scale: 1, unit: "A" }];
const CONT: RangeDef[] = [{ label: "200", fs: 200, dec: 1, scale: 1, unit: "Ω", src: 1e3 }];
const DIODE: RangeDef[] = [{ label: "2V", fs: 2, dec: 3, scale: 1, unit: "V", src: 2200 }];

const TABLE: Record<MeterMode, RangeDef[]> = {
  off: [],
  dcv: DCV,
  acv: ACV,
  "dca-ma": MA,
  "dca-10a": A10,
  ohm: OHM,
  continuity: CONT,
  diode: DIODE,
};
const AUTO_START: Record<MeterMode, number> = { off: 0, dcv: 2, acv: 1, "dca-ma": 3, "dca-10a": 0, ohm: 1, continuity: 0, diode: 0 };
const MODES = Object.keys(TABLE) as MeterMode[];

export const METER = {
  inputOhms: 10e6,
  ohmVoc: 2.8,
  diodeVoc: 3.0,
  maFuseAmps: 0.2,
  maFuseOhms: 0.5,
  idleShunt: 2,
  a10Ohms: 0.01,
  beepOhms: 50,
  update: 0.1,
};

const COUNTS = 0.9995; // 1999 counts: anything at or above 1999.5 counts is over range

function norm(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/µ/g, "u")
    .replace(/ω|ohms?|Ω/gi, "");
}

export function formatReading(value: number, r: RangeDef): string {
  if (!Number.isFinite(value) || Math.abs(value) > r.fs * COUNTS) return "OL";
  let s = (value * r.scale).toFixed(r.dec);
  if (Number(s) === 0) s = s.replace("-", "");
  return s;
}

export class MultimeterDevice extends Device {
  com = -1;
  vohm = -1;
  ma = -1;
  a10 = -1;
  mode: MeterMode;
  rangeInput: string;
  manual = false;
  ri = 0;
  fuse = new FuseElement(METER.maFuseAmps);
  display = "";
  unit = "";
  beep = false;
  value = 0;
  private acc = { t: 0, v: 0, v2: 0, ima: 0, i10: 0 };

  constructor(spec: Spec) {
    super(spec);
    this.mode = MODES.includes(spec.mode) ? spec.mode : "off";
    this.rangeInput = typeof spec.range === "string" ? spec.range : "auto";
    this.applyRange();
  }
  bind(b: Binder): void {
    this.com = b.node(this.pin("com"));
    this.vohm = b.node(this.pin("vohm"));
    this.ma = b.node(this.pin("ma"));
    this.a10 = b.node(this.pin("a10"));
  }
  private get ranges(): RangeDef[] {
    return TABLE[this.mode];
  }
  private get range(): RangeDef | undefined {
    return this.ranges[this.ri];
  }
  private applyRange(): void {
    const list = this.ranges;
    const want = norm(this.rangeInput);
    const k = want === "auto" || want === "" ? -1 : list.findIndex((r) => norm(r.label) === want);
    this.manual = k >= 0;
    this.ri = k >= 0 ? k : Math.min(AUTO_START[this.mode], Math.max(0, list.length - 1));
    this.resetAcc();
    this.display = "";
    this.unit = this.range?.unit ?? "";
    this.beep = false;
  }
  private resetAcc(): void {
    this.acc.t = this.acc.v = this.acc.v2 = this.acc.ima = this.acc.i10 = 0;
  }
  private get isSourceMode(): boolean {
    return this.mode === "ohm" || this.mode === "continuity" || this.mode === "diode";
  }
  private get voc(): number {
    return this.mode === "diode" ? METER.diodeVoc : METER.ohmVoc;
  }
  private get gV(): number {
    if (this.mode === "off") return 1 / R_OFF;
    if (this.isSourceMode) return 1 / (this.range?.src ?? 1e3);
    return 1 / METER.inputOhms;
  }
  private get gMa(): number {
    if (this.fuse.blown) return G_OPEN;
    const shunt = this.mode === "dca-ma" ? (this.range?.shunt ?? METER.idleShunt) : METER.idleShunt;
    return 1 / (shunt + METER.maFuseOhms);
  }
  override stampLinear(A: Float64Array, n: number): void {
    stampG(A, n, this.vohm, this.com, this.gV);
    stampG(A, n, this.ma, this.com, this.gMa);
    stampG(A, n, this.a10, this.com, 1 / METER.a10Ohms);
  }
  override stampRhs(b: Float64Array, ctx: Ctx): void {
    // Ohms, continuity and diode test: a Thevenin source (Voc behind the range resistor) drives out of VΩ.
    if (this.isSourceMode) stampI(b, this.com, this.vohm, this.voc * this.gV * ctx.sourceScale);
  }
  private currents(x: Float64Array): { iv: number; ima: number; i10: number } {
    const vc = volt(x, this.com);
    const vv = volt(x, this.vohm) - vc;
    const iv = this.isSourceMode ? (vv - this.voc) * this.gV : vv * this.gV;
    const ima = (volt(x, this.ma) - vc) * this.gMa;
    const i10 = (volt(x, this.a10) - vc) / METER.a10Ohms;
    return { iv, ima, i10 };
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    const h = ctx.h;
    const { ima, i10 } = this.currents(x);
    if (!this.fuse.blown && this.fuse.update(ima, h)) {
      ctx.markDirty();
      ctx.markBreak();
      const peak = Math.max(this.fuse.peak, Math.abs(ima));
      const hint =
        this.mode === "dca-ma"
          ? "An ammeter goes in series with a part, never straight across a battery or a part. For currents over 200 mA use the 10 A socket."
          : "The red lead was in the mA socket. In that socket the meter is nearly a short circuit, so for volts and ohms the red lead belongs in the VΩ socket.";
      ctx.emit(
        this.id,
        "meter-fuse",
        `The meter's internal 200 mA fuse blew: about ${fmtA(peak)} went through the mA socket. ${hint} Fit a new fuse before using the mA range again.`,
        { amps: peak, rating: METER.maFuseAmps },
      );
    }
    const vv = volt(x, this.vohm) - volt(x, this.com);
    const a = this.acc;
    a.t += h;
    a.v += vv * h;
    a.v2 += vv * vv * h;
    a.ima += ima * h;
    a.i10 += i10 * h;
    if (a.t >= METER.update - 1e-12) this.updateDisplay(ctx);
  }
  /** Picks the range for a value: keeps the current one while it fits comfortably, else the smallest that fits. */
  private pickRange(value: number): number {
    const list = this.ranges;
    const cur = list[this.ri];
    const av = Math.abs(value);
    if (cur && av <= cur.fs * COUNTS && (av >= cur.fs * 0.08 || this.ri === 0)) return this.ri;
    for (let k = 0; k < list.length; k++) if (av <= list[k]!.fs * COUNTS * 0.95) return k;
    return list.length - 1;
  }
  private updateDisplay(ctx: Ctx): void {
    const a = this.acc;
    const T = a.t;
    const mean = a.v / T;
    const ima = a.ima / T;
    const i10 = a.i10 / T;
    this.resetAcc();
    this.beep = false;
    let value = 0;
    switch (this.mode) {
      case "off":
        this.display = "";
        this.unit = "";
        this.value = 0;
        return;
      case "dcv":
        value = mean;
        break;
      case "acv":
        value = Math.sqrt(Math.max(0, a.v2 / T - mean * mean));
        break;
      case "dca-ma":
        value = ima;
        break;
      case "dca-10a":
        value = i10;
        break;
      case "ohm":
      case "continuity": {
        const src = this.range?.src ?? 1e3;
        const d = this.voc - mean;
        value = d <= this.voc * 1e-9 ? Infinity : (src * mean) / d;
        if (this.mode === "continuity") this.beep = value >= -5 && value < METER.beepOhms;
        break;
      }
      case "diode":
        value = mean;
        break;
    }
    this.value = value;
    if (!this.manual) {
      const k = this.pickRange(value);
      if (k !== this.ri) {
        this.ri = k;
        // Ohms and current ranges change the meter's own circuit (source resistor, shunt).
        if (this.mode === "ohm" || this.mode === "dca-ma") {
          ctx.markDirty();
          ctx.markBreak();
        }
      }
    }
    const r = this.range!;
    this.unit = r.unit;
    this.display = formatReading(value, r);
  }
  pinCurrents(x: Float64Array): number[] {
    const { iv, ima, i10 } = this.currents(x);
    return [-(iv + ima + i10), iv, ima, i10];
  }
  state(x: Float64Array): PartState {
    const { iv, ima, i10 } = this.currents(x);
    const vc = volt(x, this.com);
    const vv = volt(x, this.vohm) - vc;
    const vma = volt(x, this.ma) - vc;
    const v10 = volt(x, this.a10) - vc;
    const socket = this.mode === "dca-ma" ? "ma" : this.mode === "dca-10a" ? "a10" : "vohm";
    const i = socket === "ma" ? ima : socket === "a10" ? i10 : iv;
    const v = socket === "ma" ? vma : socket === "a10" ? v10 : vv;
    const p = Math.max(0, vma * ima) + Math.max(0, v10 * i10) + (this.isSourceMode ? 0 : vv * iv);
    const s = baseState(i, v, p);
    s.display = this.display;
    s.unit = this.unit;
    s.extra = {
      mode: this.mode,
      range: this.range?.label ?? "",
      auto: !this.manual,
      fuse: this.fuse.blown ? "blown" : "ok",
      beep: this.beep,
      value: Number.isFinite(this.value) ? this.value : 1e99,
      socket,
    };
    return s;
  }
  override setInput(key: InputKey, value: InputValue, ctx: Ctx): boolean {
    if (key === "mode") {
      if (typeof value !== "string" || !MODES.includes(value as MeterMode)) return false;
      if (value === this.mode) return true;
      this.mode = value as MeterMode;
      this.applyRange();
      return true;
    }
    if (key === "range") {
      const next = typeof value === "string" ? value : "auto";
      if (norm(next) === norm(this.rangeInput)) return true;
      this.rangeInput = next;
      this.applyRange();
      return true;
    }
    if (key === "replaceFuse") {
      if (bool(value, true)) this.fuse.reset();
      ctx.markDirty();
      return true;
    }
    return false;
  }
  override inputValue(key: InputKey): InputValue | undefined {
    return key === "mode" ? this.mode : key === "range" ? this.rangeInput : undefined;
  }
  override save(): Record<string, unknown> {
    return {
      fuseBlown: this.fuse.blown,
      te: this.fuse.te,
      tb: this.fuse.tb,
      mode: this.mode,
      rangeInput: this.rangeInput,
      ri: this.ri,
      display: this.display,
      unit: this.unit,
      value: this.value,
      beep: this.beep,
    };
  }
  override restore(s: Record<string, unknown>): void {
    this.fuse.blown = s.fuseBlown === true;
    this.fuse.te = typeof s.te === "number" ? s.te : 0;
    this.fuse.tb = typeof s.tb === "number" ? s.tb : 0;
    // Keep the reading on screen across a rebuild when the dial is where it was.
    if (s.mode === this.mode && typeof s.rangeInput === "string" && norm(s.rangeInput) === norm(this.rangeInput)) {
      if (typeof s.ri === "number" && s.ri >= 0 && s.ri < this.ranges.length) this.ri = s.ri;
      if (typeof s.display === "string") this.display = s.display;
      if (typeof s.unit === "string") this.unit = s.unit;
      if (typeof s.value === "number") this.value = s.value;
      this.beep = s.beep === true;
    }
  }
  override replace(): void {
    this.fuse.reset();
  }
}
