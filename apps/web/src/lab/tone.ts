/**
 * Pitch of the speaker sound from the simulator's audio stream: counts rising zero crossings (with a little
 * hysteresis) over the last quarter second. Pure; used by the runtime and the replay for `lab.toneHz()`.
 */
export function createToneMeter(windowSeconds = 0.25) {
  let crossings: number[] = [];
  let t = 0;
  let armed = false;
  let level = 0;
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
      crossings = crossings.filter((c) => c >= t - windowSeconds);
      if (level < 0.01 || crossings.length < 3) return null;
      return (crossings.length - 1) / (crossings[crossings.length - 1]! - crossings[0]!);
    },
  };
}
