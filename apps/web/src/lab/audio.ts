/**
 * Lab sound: short synthesised cues (task done, bonus, fried, click) and the speaker stream from the simulator,
 * played through an AudioWorklet (or a ScriptProcessor where worklets are missing). The context is created inside the
 * learner's first tap or click on the lab, as browsers require. Muting stops everything.
 */
export type Cue = "success" | "bonus" | "fried" | "click";

const WORKLET = `
class OhmSpeaker extends AudioWorkletProcessor {
  constructor() {
    super();
    this.q = [];
    this.off = 0;
    this.port.onmessage = (e) => {
      if (e.data === "flush") { this.q = []; this.off = 0; return; }
      this.q.push(e.data);
      if (this.q.length > 16) this.q.splice(0, this.q.length - 6);
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      const b = this.q[0];
      if (!b) { out[i] = 0; continue; }
      out[i] = b[this.off++] * 0.55;
      if (this.off >= b.length) { this.q.shift(); this.off = 0; }
    }
    return true;
  }
}
registerProcessor("ohm-speaker", OhmSpeaker);
`;

export class LabAudio {
  private ctx: AudioContext | null = null;
  private speaker: AudioWorkletNode | ScriptProcessorNode | null = null;
  private queue: Float32Array[] = [];
  private starting = false;
  muted: () => boolean;

  constructor(muted: () => boolean) {
    this.muted = muted;
  }

  /** Call from a pointer or key event: creates or resumes the audio context. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx({ sampleRate: 44100 });
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  cue(kind: Cue): void {
    const ctx = this.ctx;
    if (!ctx || this.muted() || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.01;
    const out = ctx.createGain();
    out.gain.value = 0.35;
    out.connect(ctx.destination);
    const tone = (f: number, at: number, dur: number, type: OscillatorType, vol: number, glide?: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, at);
      if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur * 0.9);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + dur + 0.05);
    };
    switch (kind) {
      case "success":
        // A bright two-note "ding-ding" with a soft triangle body.
        [659.25, 987.77].forEach((f, i) => {
          tone(f, t + i * 0.09, 0.42, "triangle", 0.32);
          tone(f * 2, t + i * 0.09, 0.16, "sine", 0.06);
        });
        break;
      case "bonus":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.07, 0.3, "triangle", 0.26));
        break;
      case "fried": {
        // A little "pfft": filtered noise and a falling blip.
        const len = Math.floor(ctx.sampleRate * 0.25);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let x = 9;
        for (let i = 0; i < len; i++) {
          x = (x * 16807) % 2147483647;
          d[i] = ((x / 2147483647) * 2 - 1) * (1 - i / len);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1800;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        src.connect(bp).connect(g).connect(out);
        src.start(t);
        tone(420, t, 0.3, "sine", 0.18, 120);
        break;
      }
      case "click":
        tone(2400, t, 0.03, "square", 0.05);
        break;
    }
  }

  private clickEnd = 0;

  /**
   * Relay contacts moving: `count` clicks in the last snapshot (about 33 ms), spread evenly so a relay switching
   * itself 80 times a second buzzes. A pull-in is a firmer, lower clack than a release.
   */
  relay(count: number, pull: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.muted() || ctx.state !== "running" || count <= 0) return;
    const n = Math.min(count, 12);
    const span = 1 / 30;
    const rate = ctx.sampleRate;
    const len = Math.ceil(rate * (span + 0.012));
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    let x = 1234567 + count * 7;
    for (let k = 0; k < n; k++) {
      const start = Math.floor(((k + 0.5) / n) * span * rate);
      const vol = (pull && k % 2 === 0) || n === 1 ? 0.55 : 0.32;
      const f = pull ? 1700 : 2600;
      const dur = Math.floor(rate * 0.006);
      for (let i = 0; i < dur && start + i < len; i++) {
        x = (x * 16807) % 2147483647;
        const env = Math.exp(-i / (rate * 0.0011));
        d[start + i]! += vol * env * (0.6 * Math.sin((2 * Math.PI * f * i) / rate) + 0.4 * ((x / 2147483647) * 2 - 1));
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.3;
    src.connect(g).connect(ctx.destination);
    // Back to back with the previous snapshot's clicks, so a buzz stays continuous.
    const at = Math.max(ctx.currentTime + 0.005, Math.min(this.clickEnd, ctx.currentTime + 0.1));
    src.start(at);
    this.clickEnd = at + span;
  }

  /** Speaker samples from the simulator (44.1 kHz chunks). */
  play(samples: Float32Array): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    if (this.muted()) {
      this.queue = [];
      return;
    }
    if (!this.speaker) {
      void this.startSpeaker();
      this.queue.push(samples);
      if (this.queue.length > 16) this.queue.splice(0, this.queue.length - 6);
      return;
    }
    if ("port" in this.speaker) this.speaker.port.postMessage(samples);
    else {
      this.queue.push(samples);
      if (this.queue.length > 16) this.queue.splice(0, this.queue.length - 6);
    }
  }

  private async startSpeaker(): Promise<void> {
    if (this.starting || !this.ctx) return;
    this.starting = true;
    const ctx = this.ctx;
    try {
      if (ctx.audioWorklet) {
        const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        const node = new AudioWorkletNode(ctx, "ohm-speaker", { numberOfInputs: 0, outputChannelCount: [1] });
        node.connect(ctx.destination);
        for (const q of this.queue.splice(0)) node.port.postMessage(q);
        this.speaker = node;
        return;
      }
    } catch {
      // Fall back below.
    }
    // ScriptProcessor fallback: pull from the queue on the main thread.
    const node = ctx.createScriptProcessor(1024, 0, 1);
    let off = 0;
    node.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < out.length; i++) {
        const b = this.queue[0];
        if (!b) {
          out[i] = 0;
          continue;
        }
        out[i] = b[off++]! * 0.55;
        if (off >= b.length) {
          this.queue.shift();
          off = 0;
        }
      }
    };
    node.connect(ctx.destination);
    this.speaker = node;
  }

  dispose(): void {
    try {
      this.speaker?.disconnect();
      void this.ctx?.close();
    } catch {
      // Already closed.
    }
    this.ctx = null;
    this.speaker = null;
  }
}
