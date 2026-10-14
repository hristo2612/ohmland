// The 2D ink view of the workbench (docs/BENCH-VIEWS.md). No three.js anywhere under src/ink.

export { BenchInk, type BenchInkProps, type InkController } from "./BenchInk";
export { INK_LABELS, mergeInkLabels, type InkLabels, type InkLabelsExtra } from "./labels";
export { INK_KINDS, inkKind, hasInkKind } from "./kinds";
export type { InkKind, InkRegistry, DrawProps, ShapeCtx } from "./kinds/types";
export { buildModel, targetPoint, targetRect, type InkModel, type InkPick } from "./model";
export { hitTest } from "./hit";
export { inkClutter, inkScene } from "./clutter";
export type { BenchController, ScreenPoint } from "../view/controller";
