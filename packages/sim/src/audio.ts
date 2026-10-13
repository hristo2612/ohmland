// Resamples the speaker voltage (taken at every accepted solver step) to a fixed 44.1 kHz stream.
// A 20 Hz high-pass removes DC (a speaker cannot reproduce it) and a tanh soft limiter keeps it in -1..1.

export const SAMPLE_RATE = 44100;
const CHUNK = 1024;
/** Volts across the speaker that map to full scale before the limiter. */
const FULL_SCALE_V = 1;

export class AudioStream {
  private buf = new Float32Array(CHUNK);
  private fill = 0;
  private nextT = 0;
  private lastT = 0;
  private lastV = 0;
  private hpIn = 0;
  private hpOut = 0;
  private readonly a: number;
  private started = false;

  constructor(private readonly emit: (samples: Float32Array) => void) {
    const rc = 1 / (2 * Math.PI * 20);
    const dt = 1 / SAMPLE_RATE;
    this.a = rc / (rc + dt);
  }

  /** Feeds the voltage at simulated time t (non-decreasing). */
  push(t: number, v: number): void {
    if (!this.started) {
      this.started = true;
      this.lastT = t;
      this.lastV = v;
      this.nextT = Math.ceil(t * SAMPLE_RATE) / SAMPLE_RATE;
      this.hpIn = v;
      return;
    }
    if (t <= this.lastT) {
      this.lastV = v;
      return;
    }
    const t0 = this.lastT;
    const v0 = this.lastV;
    const span = t - t0;
    while (this.nextT <= t) {
      const f = (this.nextT - t0) / span;
      const x = v0 + (v - v0) * (f < 0 ? 0 : f);
      // One-pole high-pass.
      const y = this.a * (this.hpOut + x - this.hpIn);
      this.hpIn = x;
      this.hpOut = y;
      this.buf[this.fill++] = Math.tanh(y / FULL_SCALE_V);
      if (this.fill === CHUNK) this.flush();
      this.nextT += 1 / SAMPLE_RATE;
    }
    this.lastT = t;
    this.lastV = v;
  }

  /** Emits whatever is buffered. */
  flush(): void {
    if (this.fill === 0) return;
    const out = this.buf.slice(0, this.fill);
    this.fill = 0;
    this.emit(out);
  }

  /** Restarts the stream (after a rebuild or a jump in time). */
  reset(): void {
    this.started = false;
    this.fill = 0;
  }
}
