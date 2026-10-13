/**
 * The figures a hotspot item can point at, and the named regions of each. The content schema checks a hotspot's
 * answer against this list, and the figure components draw one tappable shape per region.
 */
export const FIGURE_REGIONS = {
  multimeter: ["display", "dial", "com", "vohm", "a10"],
  led: ["lens", "anode", "cathode"],
  breadboard: ["rail-plus", "rail-minus", "strip", "gap"],
} as const;

export type FigureId = keyof typeof FIGURE_REGIONS;
export type RegionId<F extends FigureId = FigureId> = (typeof FIGURE_REGIONS)[F][number];
export const FIGURE_IDS = Object.keys(FIGURE_REGIONS) as FigureId[];
