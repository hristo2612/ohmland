/**
 * The bench-view adapter (docs/BENCH-VIEWS.md). Lessons reach the bench only through this module: the view choice
 * (3D or 2D ink, remembered per device), the BenchController contract the lesson's ink overlay draws with, and the lazy
 * chunk that renders the bench.
 *
 * Today the chunk (BenchSurface.tsx) renders the existing 3D <Bench> and implements BenchController itself, and the ink
 * view is the 3D bench seen from straight above. When packages/bench ships <BenchView view> and its controller,
 * BenchSurface renders that instead: the one place to change. Light on purpose (no three.js): the lesson shell imports
 * it on first load.
 */
import { preloadable } from "./prefetch";
import type { BenchSurfaceProps } from "./BenchSurface";

export type BenchViewKind = "3d" | "ink";
export type BenchViewPref = "auto" | BenchViewKind;

/** CSS px relative to the bench element. `visible` is false when the point is off the bench or behind the camera. */
export type ScreenPoint = { x: number; y: number; visible: boolean };

export interface BenchController {
  /** Where an anchor ("pin:R1.a", "part:D1", "hole:e12", "wire:W1.b", "lead:TL1.a") is on screen right now. */
  project(anchor: string): ScreenPoint | null;
  /** Calls back after camera, layout or bench changes, so overlays can follow. Returns an unsubscribe. */
  onViewChange(cb: () => void): () => void;
  /** Frames these parts or anchors (smooth unless reduced motion). Empty: frame the whole work area. */
  focus(targets: string[], opts?: { padding?: number; instant?: boolean }): void;
  /** Emphasises parts or anchors for a while; null clears it. */
  spotlight(targets: string[] | null): void;
}

/**
 * Whether packages/bench has its 2D ink renderer yet. Until it does, "ink" draws the 3D bench from straight above,
 * so the toggle, the remembered choice and every overlay already work in both positions.
 */
export const INK_RENDERER = false;

const KEY = "ohmland:bench-view";

export function readViewPref(): BenchViewPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "3d" || v === "ink" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function storeViewPref(pref: BenchViewPref): void {
  try {
    if (pref === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Not remembered; it still applies now.
  }
}

/** The default: ink on phones and small screens, 3D on desktops. */
export function autoView(): BenchViewKind {
  if (typeof matchMedia !== "function") return "3d";
  return matchMedia("(max-width: 720px), (pointer: coarse) and (max-width: 1024px)").matches ? "ink" : "3d";
}

export const resolveView = (pref: BenchViewPref): BenchViewKind => (pref === "auto" ? autoView() : pref);

/** The bench itself: a lazy chunk (it pulls in three.js), preloadable so a warmed bench renders at once. */
export const BenchSurfaceChunk = preloadable<BenchSurfaceProps, typeof import("./BenchSurface")>(() => import("./BenchSurface"));
