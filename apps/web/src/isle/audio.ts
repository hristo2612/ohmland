/**
 * Browsers start audio only after a user gesture. primeAudio() runs inside the learner's tap on "Finish lesson": it
 * starts an audio context and plays one silent sample, which marks the page as allowed to play sound, so the reveal's
 * chime a moment later may start. Best effort: without it the reveal is simply silent.
 */
let ctx: AudioContext | null = null;
let closeTimer = 0;

/** How long the primed context is kept before it is closed again. */
const KEEP_MS = 15000;

export function primeAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    void ctx.resume().catch(() => undefined);
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(ctx.destination);
    src.start();
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    }, KEEP_MS);
  } catch {
    // no audio here: the reveal stays silent
  }
}
