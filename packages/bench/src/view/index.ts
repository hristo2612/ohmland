// @ohmland/bench/view: the view switcher and the controller contract, without three.js or the ink renderer.
// Both renderers load on demand from here. See docs/BENCH-VIEWS.md.

export { BenchView, preloadBenchView, type BenchViewProps } from "./BenchView";
export { createControllerHub, type BenchController, type BenchControllerHub, type BenchViewKind, type FocusOptions, type SpotlightOptions, type Inset, type ScreenPoint } from "./controller";
export { parseTarget, targetPoint, meterSpot, METER_SPOTS, type ParsedTarget } from "./targets";
export type { BenchRendererProps } from "./types";
export { DrawingSlip } from "./DrawingSlip";
export { COMPACT_WIDTH, trayCoverOf } from "./tray-cover";
