/**
 * The mascot's poses. The robot itself is an ink line drawing in Mascot.tsx: a boxy head with hatched side faces, a
 * graphite visor with two amber eyes, an antenna with a red pencil tip, and a body with a copper chest plate.
 * Expressions live in the eyes only.
 */
export type MascotPose = "idle" | "happy" | "thinking" | "oops" | "celebrate";
export const POSES: readonly MascotPose[] = ["idle", "happy", "thinking", "oops", "celebrate"];
