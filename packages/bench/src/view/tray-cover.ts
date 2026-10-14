// How much of the view each renderer's parts tray covers, so a page can keep its own panels and framing clear of it.
// No React, no three.js. The sizes follow the trays' styles (scene/Overlay.tsx .ohb-tray, ink/styles.ts .ohi-tray).

import type { BenchViewKind } from "./controller";

/** Below this view width (CSS px) both renderers lay the tray out as a strip along the bottom. */
export const COMPACT_WIDTH = 640;
/** More than this many tray items get two columns in the 3D tray. */
export const NARROW_TRAY = 7;

/**
 * CSS px of the view the tray covers: a strip along the bottom (`bottom`, its top edge from the view's bottom) on a
 * narrow view, else a column on the left (`left`, its right edge from the view's left). Nothing without items.
 */
export function trayCoverOf(view: BenchViewKind, items: number, width: number): { left: number; bottom: number } {
  if (items === 0) return { left: 0, bottom: 0 };
  const compact = width > 0 && width < COMPACT_WIDTH;
  if (view === "ink") return compact ? { left: 0, bottom: 8 + 86 } : { left: 10 + 176, bottom: 0 };
  return compact ? { left: 0, bottom: 8 + 76 } : { left: items > NARROW_TRAY ? 220 : 124, bottom: 0 };
}
