// Shared by the 3D and 2D ink bench views. See docs/BENCH-VIEWS.md.

export type ScreenPoint = { x: number; y: number; visible: boolean }; // CSS px relative to the bench element

export interface BenchController {
  /** Where an anchor ("pin:R1.a", "part:D1", "hole:e12", "probe:red", "part:M1/display") is on screen right now. */
  project(anchor: string): ScreenPoint | null;
  /** Subscribe to camera or layout changes so overlays can reposition. Returns an unsubscribe. */
  onViewChange(cb: () => void): () => void;
  /** Frame these parts or anchors nicely (smooth unless reduced motion). Empty array: frame the whole work area. */
  focus(targets: string[], opts?: { padding?: number; instant?: boolean }): void;
  /** Temporarily emphasise parts (glow ring, dim the rest). */
  spotlight(targets: string[] | null): void;
}
