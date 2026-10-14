// Whether the teaching overlays' motion (flow, the tracer's run) should stand still: the learner's reduced-motion
// setting, or a preview of it that a try-out page can switch on. Read when an overlay mounts. No React here.

let preview: boolean | null = null;

/** Show the overlays as they look under reduced motion (true), as they move (false), or follow the setting (null). */
export function previewStill(on: boolean | null): void {
  preview = on;
}

export function stillMotion(): boolean {
  if (preview !== null) return preview;
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
