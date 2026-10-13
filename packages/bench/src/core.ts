// @ohmland/bench/core: the pure half of the bench (no React, no three.js). BenchState operations, snapping,
// layout maths and bench-to-netlist, for lab runtimes, headless solution replays and tests.

export { benchToNetlist, connectivity, type BenchNetlist, type BenchNetlistOptions, type Connectivity } from "./netlist";
export * as benchOps from "./ops";
export { emptyBench, defaultMeter, type Placement } from "./ops";
export { holeAnchor, pinAnchor, wireAnchor, leadAnchor, probeAnchor, socketAnchor, parseAnchor, type ParsedAnchor } from "./anchors";
export { PITCH, boardGeometry, parseHole, holeWorld, nearestHole, type BoardGeometry, type HoleInfo, type StripInfo } from "./board";
export { PART_KINDS, partDef, defaultParams, footprintOf, isFlying, canMountOnBoard, type PartDef, type FootprintLeg } from "./parts";
export { partPose, anchorPosition, benchBounds, fitCamera, isOnBoard, METER, DIAL_MODES, type PartPose } from "./layout";
export { resistorBands, formatOhms, formatFarads } from "./colorCode";
// The store needs React and zustand but not three.js, so a host can own it before the 3D view loads.
export { createBenchStore, type BenchStore, type BenchStoreState, type BenchUi } from "./store";
export { DEFAULT_LABELS, type BenchLabels } from "./labels";

export type {
  Anchor,
  BenchAction,
  BenchPartKind,
  BenchState,
  BoardKind,
  BoardSpec,
  HoleId,
  LeadColor,
  LeadEnd,
  MeterMode,
  MeterProbe,
  MeterSocket,
  MeterState,
  PartParamsMap,
  PlacedPart,
  PlacedPartOf,
  ProbeColor,
  Quality,
  Selection,
  TestLead,
  TrayItem,
  Vec2,
  Vec3,
  WaterKind,
  Wire,
  WireColor,
} from "./types";
