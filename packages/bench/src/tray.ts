import type { BenchState, TrayItem } from "./types";

/**
 * How many more of a tray item the learner may place, or undefined when the item is unlimited. A placed thing counts
 * against an item only when it matches it: test leads by colour (when the item names one), parts by kind and by every
 * param the item sets (so a 470 Ω resistor does not use up the 1 kΩ item).
 */
export function trayLeft(item: TrayItem, bench: BenchState): number | undefined {
  if (item.count === undefined) return undefined;
  return Math.max(0, item.count - trayUsed(item, bench));
}

/** How many placed things count against a tray item. Shared by both bench views. */
export function trayUsed(item: TrayItem, bench: BenchState): number {
  if (item.kind === "lead") {
    const color = item.params?.color;
    return bench.leads.filter((l) => !color || l.color === color).length;
  }
  const want = Object.entries(item.params ?? {});
  return bench.parts.filter((p) => {
    if (p.kind !== item.kind) return false;
    const have = p.params as Record<string, unknown>;
    return want.every(([k, v]) => have[k] === v);
  }).length;
}
