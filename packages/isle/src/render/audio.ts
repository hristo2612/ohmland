/**
 * The reveal's sound, synthesised in WebAudio (nothing downloaded, nothing licensed): a rising charge-up whine, a relay
 * click as the part lands, then a bright arpeggio of soft square blips. A big reveal holds a longer arpeggio and a
 * sparkle on top.
 */
import { isleAudio } from "../audio";

type Ctx = BaseAudioContext;

function noise(ctx: Ctx, dur: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = b.getChannelData(0);
  let x = 7;
  for (let i = 0; i < d.length; i++) {
    x = (x * 16807) % 2147483647;
    d[i] = (x / 2147483647) * 2 - 1;
  }
  return b;
}

function tone(ctx: Ctx, out: AudioNode, f: number, at: number, dur: number, type: OscillatorType, vol: number, glideTo?: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur * 0.85);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** The reveal: the whine starts at t, the part lands (the click) at t + 0.4 s. */
export function revealSound(ctx: Ctx, t: number, big: boolean, out: AudioNode = ctx.destination): void {
  const master = ctx.createGain();
  master.gain.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 5200;
  master.connect(lp).connect(out);
  // charge-up
  tone(ctx, master, 180, t, 0.42, "sine", 0.22, 1300);
  tone(ctx, master, 360, t + 0.05, 0.36, "triangle", 0.06, 2400);
  // relay click: a short bright noise tick and a low thump
  const land = t + 0.4;
  const n = ctx.createBufferSource();
  n.buffer = noise(ctx, 0.05);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.5, land);
  ng.gain.exponentialRampToValueAtTime(0.0001, land + 0.045);
  n.connect(hp).connect(ng).connect(master);
  n.start(land);
  tone(ctx, master, 140, land, 0.22, "sine", 0.6, 60);
  // the blips: C major, a little higher for a big reveal
  const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone(ctx, master, f, land + 0.09 + i * 0.075, 0.32 - i * 0.02, "square", 0.05));
  notes.forEach((f, i) => tone(ctx, master, f, land + 0.09 + i * 0.075, 0.6, "triangle", 0.14));
  if (big) [2093, 2637, 3136, 4186].forEach((f, i) => tone(ctx, master, f, land + 0.55 + i * 0.055, 0.22, "sine", 0.05));
}

/** Plays on `ctx`, else on the page's shared isle context (../audio.ts, unlocked by primeAudio() in a tap). */
export function play(big: boolean, delay = 0, ctx: AudioContext | null = isleAudio()): void {
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    revealSound(ctx, ctx.currentTime + delay, big);
  } catch {
    // no audio: the reveal still plays
  }
}
