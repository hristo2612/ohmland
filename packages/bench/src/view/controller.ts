// The controller every bench view implements (docs/BENCH-VIEWS.md). No React, no three.js.

/** CSS px relative to the bench element. `visible` is false when the point is off screen or behind the camera. */
export type ScreenPoint = { x: number; y: number; visible: boolean };

/** CSS px of the view covered at each edge (a panel docked over the bench). */
export type Inset = { top?: number; right?: number; bottom?: number; left?: number };

/**
 * `padding`: room round the targets (px). `instant`: no glide. `inset`: the part of the view a docked panel covers; the
 * targets (or the home view) are framed in what is left, the selection bar keeps clear of it, and it holds (a resize,
 * reset view) until the next focus. `read`: hands-on work, framed no closer than this many CSS px between neighbouring
 * holes (2.54 mm); targets that do not fit at that scale are fitted, and the touch loupe does the aiming.
 */
export type FocusOptions = { padding?: number; instant?: boolean; inset?: Inset; read?: number };

/**
 * `pins: false`: the spotlit chips and displays print no pin numbers, not even up close (a check that asks for a pin,
 * which the numbers would answer).
 */
export type SpotlightOptions = { pins?: boolean };

export interface BenchController {
  /** Where an anchor ("pin:R1.a", "part:D1", "hole:e12", "probe:red", "part:M1/display") is on screen right now. */
  project(anchor: string): ScreenPoint | null;
  /** Subscribe to camera or layout changes so overlays can reposition. Returns an unsubscribe. */
  onViewChange(cb: () => void): () => void;
  /** Frame these parts or anchors nicely (smooth unless reduced motion). Empty array: frame the whole work area. */
  focus(targets: string[], opts?: FocusOptions): void;
  /** Temporarily emphasise parts (glow ring, dim the rest). */
  spotlight(targets: string[] | null, opts?: SpotlightOptions): void;
}

/** Which renderer draws the bench. */
export type BenchViewKind = "3d" | "ink";

/**
 * A controller that stays the same object while the view behind it changes. Overlays subscribe once; when a new
 * renderer attaches, subscribers hear a view change and the last focus and spotlight are applied to it.
 */
export type BenchControllerHub = BenchController & {
  /** Point the hub at the active renderer's controller (null while none is mounted). */
  attach(inner: BenchController | null): void;
  /** The renderer's own controller, with any view-specific extras. */
  inner(): BenchController | null;
  /** Frame the last focus again, smoothly (the room round the bench changed: the tray came or went). */
  refocus(): void;
};

export function createControllerHub(): BenchControllerHub {
  const listeners = new Set<() => void>();
  let inner: BenchController | null = null;
  let unsub: (() => void) | null = null;
  let lastFocus: { targets: string[]; opts?: FocusOptions } | null = null;
  let lastSpot: string[] | null = null;
  let lastSpotOpts: SpotlightOptions | undefined;
  const notify = () => {
    for (const cb of [...listeners]) {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    }
  };
  return {
    project: (anchor) => inner?.project(anchor) ?? null,
    onViewChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    focus: (targets, opts) => {
      lastFocus = { targets: [...targets], opts };
      inner?.focus(targets, opts);
    },
    spotlight: (targets, opts) => {
      lastSpot = targets ? [...targets] : null;
      lastSpotOpts = opts;
      inner?.spotlight(targets, opts);
    },
    attach: (next) => {
      if (next === inner) return;
      unsub?.();
      unsub = null;
      inner = next;
      if (next) {
        unsub = next.onViewChange(notify);
        if (lastSpot) next.spotlight(lastSpot, lastSpotOpts);
        if (lastFocus) next.focus(lastFocus.targets, { ...lastFocus.opts, instant: true });
      }
      notify();
    },
    inner: () => inner,
    refocus: () => inner?.focus(lastFocus?.targets ?? [], { ...lastFocus?.opts, instant: false }),
  };
}
