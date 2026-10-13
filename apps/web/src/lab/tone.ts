/**
 * Pitch of the speaker sound from the simulator's audio stream: counts rising zero crossings (with a little
 * hysteresis). Pure; used by the runtime and the replay for `lab.toneHz()` and `lab.toneHistory()`.
 *
 * `push` returns a steady estimate: over the last quarter second for tones, or over up to 1.5 s for slow click
 * trains (a flasher ticking ten times a second). `quick()` is the pitch over the last 60 ms, so a siren's glide shows.
 */
export function createToneMeter(windowSeconds = 0.25) {
  let crossings: number[] = [];
  let t = 0;
  let armed = false;
  let level = 0;
  const KEEP = 1.6;
  const over = (from: number): number | null => {
    let i = crossings.length - 1;
    while (i > 0 && crossings[i - 1]! >= from) i--;
    const n = crossings.length - i;
    if (n < 3) return null;
    const span = crossings[crossings.length - 1]! - crossings[i]!;
    return span > 0 ? (n - 1) / span : null;
  };
  // Silent when nothing has crossed for a while (slow click trains go quiet between clicks, so not by level).
  const silent = () => !crossings.length || crossings[crossings.length - 1]! < t - 0.6;
  return {
    /** Feed a chunk; returns the current estimate in Hz, or null when silent. */
    push(samples: Float32Array, rate: number): number | null {
      let peak = 0;
      for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]!));
      level = level * 0.7 + peak * 0.3;
      const hyst = Math.max(0.01, level * 0.2);
      for (let i = 0; i < samples.length; i++) {
        const x = samples[i]!;
        if (x < -hyst) armed = true;
        else if (armed && x > hyst) {
          armed = false;
          crossings.push(t + i / rate);
        }
      }
      t += samples.length / rate;
      if (crossings.length && crossings[0]! < t - KEEP) crossings = crossings.filter((c) => c >= t - KEEP);
      if (silent()) return null;
      const recent = crossings.filter((c) => c >= t - windowSeconds).length;
      // Plenty of cycles lately: a tone. Otherwise a slow train of clicks: look further back.
      return recent >= 6 ? over(t - windowSeconds) : over(t - 1.5);
    },
    /** Pitch over the last 60 ms (null when silent or below about 50 Hz). */
    quick(): number | null {
      if (silent()) return null;
      return over(t - 0.06);
    },
  };
}
