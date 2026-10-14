// 7-segment LED display: eight LEDs (segments a to g and the decimal point) sharing a common cathode or a common
// anode. Each segment is the same fitted LED model as a lone LED (glow from averaged current, damage above its
// rating), so one shared resistor in the common lead really does make a "1" brighter than an "8".

import type { Health, LedColor, PartSpec, PartState, SimEventType } from "../types";
import { Device, R_ON, baseState, stampG, volt, type Binder, type Ctx, type Method } from "../engine/device";
import { LedDevice, LED_FITS } from "./semis";
import { withPins } from "./chips";
import { digitOf } from "./pinouts";

type Spec = Extract<PartSpec, { kind: "sevenseg" }>;

const SEGMENTS = ["a", "b", "c", "d", "e", "f", "g", "dp"] as const;
const PIN_ORDER = [...SEGMENTS, "com", "com2"] as const;
/** Glow above which a segment counts as lit for `extra.lit` and `extra.digit`. */
const LIT = 0.3;

/** Forwards everything to the engine but reports events as the display's, naming the segment. */
class SegmentCtx implements Ctx {
  base!: Ctx;
  constructor(
    private readonly owner: string,
    private readonly seg: string,
  ) {}
  get t(): number {
    return this.base.t;
  }
  get h(): number {
    return this.base.h;
  }
  get method(): Method {
    return this.base.method;
  }
  get sourceScale(): number {
    return this.base.sourceScale;
  }
  get restoring(): boolean {
    return this.base.restoring;
  }
  get noncon(): boolean {
    return this.base.noncon;
  }
  set noncon(v: boolean) {
    this.base.noncon = v;
  }
  emit(_id: string, type: SimEventType, message: string, data?: Record<string, number | string>): void {
    const text = message.replace(/^The LED/, `Segment ${this.seg} of the display`);
    this.base.emit(this.owner, type, text, { ...(data ?? {}), segment: this.seg });
  }
  markDirty(): void {
    this.base.markDirty();
  }
  markBreak(): void {
    this.base.markBreak();
  }
  markEdge(): void {
    this.base.markEdge();
  }
  drivingOhms(i: number, j: number): number {
    return this.base.drivingOhms?.(i, j) ?? Infinity;
  }
  addBreakpoint(t: number): void {
    this.base.addBreakpoint(t);
  }
}

export class SevenSegDevice extends Device {
  readonly common: "cathode" | "anode";
  readonly color: LedColor;
  readonly leds: LedDevice[];
  private readonly ctxs: SegmentCtx[];
  com = -1;
  com2 = -1;

  constructor(spec: Spec) {
    const full = withPins(spec, PIN_ORDER);
    super(full);
    this.common = spec.common === "anode" ? "anode" : "cathode";
    this.color = spec.color && LED_FITS[spec.color] ? spec.color : "red";
    const maxmA = typeof spec.maxmA === "number" && spec.maxmA > 0 ? spec.maxmA : 25;
    const com = this.pin("com");
    this.leds = SEGMENTS.map((s) => {
      const seg = this.pin(s);
      const pins = this.common === "cathode" ? { anode: seg, cathode: com } : { anode: com, cathode: seg };
      return new LedDevice({ id: `${spec.id}.${s}`, kind: "led", pins, color: this.color, maxmA });
    });
    this.ctxs = SEGMENTS.map((s) => new SegmentCtx(spec.id, s));
    this.nonlinear = true;
  }
  bind(b: Binder): void {
    this.com = b.node(this.pin("com"));
    this.com2 = b.node(this.pin("com2"));
    for (const d of this.leds) {
      d.bind(b);
      b.group([d.an, d.mid, d.ca]);
    }
    b.group([this.com, this.com2]);
  }
  override stampLinear(A: Float64Array, n: number): void {
    // The two common pins are joined inside the display.
    stampG(A, n, this.com, this.com2, 1 / R_ON);
    for (const d of this.leds) d.stampLinear(A, n);
  }
  override initIter(x: Float64Array): void {
    for (const d of this.leds) d.initIter(x);
  }
  override stampNonlinear(A: Float64Array, b: Float64Array, n: number, x: Float64Array, ctx: Ctx): void {
    for (const d of this.leds) d.stampNonlinear(A, b, n, x, ctx);
  }
  override accept(x: Float64Array, ctx: Ctx): void {
    this.leds.forEach((d, k) => {
      const c = this.ctxs[k]!;
      c.base = ctx;
      d.accept(x, c);
    });
  }
  pinCurrents(x: Float64Array): number[] {
    const link = (volt(x, this.com2) - volt(x, this.com)) / R_ON;
    const sign = this.common === "cathode" ? 1 : -1;
    let total = 0;
    const out: number[] = this.leds.map((d) => {
      const i = d.current(x);
      total += i;
      return sign * i;
    });
    // com: the LED currents leave (cathode) or enter (anode) here, plus what comes through com2.
    out.push(-sign * total - link, link);
    return out;
  }
  state(x: Float64Array): PartState {
    const segs = this.leds.map((d) => d.state(x));
    let total = 0;
    let vMax = 0;
    let glow = 0;
    let p = 0;
    let temp = 25;
    let lit = "";
    let worst: Health = "ok";
    let dead = 0;
    const rank: Record<Health, number> = { ok: 0, hot: 1, smoking: 2, dead: 3 };
    const extra: Record<string, number | string | boolean> = { common: this.common, color: this.color };
    segs.forEach((s, k) => {
      const name = SEGMENTS[k]!;
      const g = s.glow ?? 0;
      extra[name] = g;
      total += s.i;
      vMax = Math.max(vMax, s.v);
      glow = Math.max(glow, g);
      p += s.p;
      temp = Math.max(temp, s.temp);
      if (g > LIT) lit += name;
      if (s.health === "dead") dead++;
      else if (rank[s.health] > rank[worst]) worst = s.health;
    });
    const health: Health = dead === this.leds.length ? "dead" : worst;
    const s = baseState(total, vMax, p, temp, health);
    s.glow = glow;
    extra.lit = lit;
    extra.digit = digitOf(lit);
    extra.dp = segs[7]!.glow ?? 0;
    if (dead > 0) extra.dead = this.leds.filter((d) => d.dead).map((d) => d.id.slice(this.id.length + 1)).join("");
    s.extra = extra;
    return s;
  }
  override save(): Record<string, unknown> {
    return { leds: this.leds.map((d) => d.save()) };
  }
  override restore(s: Record<string, unknown>): void {
    const leds = Array.isArray(s.leds) ? (s.leds as Record<string, unknown>[]) : [];
    this.leds.forEach((d, k) => {
      if (leds[k]) d.restore(leds[k]!);
    });
  }
  override replace(): void {
    for (const d of this.leds) d.replace();
  }
}
