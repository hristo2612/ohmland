/**
 * The isle's audio context, shared by every view on the page. Tiny and free of three.js, so a page can import it (as
 * `@ohmland/isle/audio`) without loading the renderer.
 *
 * Browsers start audio only from a user gesture, and Safari holds that against the context itself: a context created
 * or resumed outside a tap stays silent. primeAudio() is meant for the learner's tap (on "Finish lesson", say): it
 * creates the shared context there and resumes it, so a reveal that plays a moment later is heard.
 */
let shared: AudioContext | null = null;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** The page's isle audio context, created on first use; null where WebAudio is missing. */
export function isleAudio(): AudioContext | null {
  if (shared && shared.state !== "closed") return shared;
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    shared = AC ? new AC() : null;
  } catch {
    shared = null;
  }
  return shared;
}

/**
 * Call inside a user gesture: creates and resumes the shared context and plays one silent sample, which unlocks it
 * in Safari. Best effort: without it the reveal may simply be silent.
 */
export function primeAudio(): void {
  const ctx = isleAudio();
  if (!ctx) return;
  try {
    void ctx.resume().catch(() => undefined);
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(ctx.destination);
    src.start();
  } catch {
    // no audio here: the reveal stays silent
  }
}
