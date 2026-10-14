// @ohmland/bench/core: the pure half of the bench (no React, no three.js). BenchState operations, snapping,
// layout maths and bench-to-netlist, for lab runtimes, headless solution replays and tests.

export { benchToNetlist, connectivity, type BenchNetlist, type BenchNetlistOptions, type Connectivity } from "./netlist";
export * as benchOps from "./ops";
export { emptyBench, defaultMeter, type Placement } from "./ops";
export { holeAnchor, pinAnchor, wireAnchor, leadAnchor, probeAnchor, socketAnchor, parseAnchor, type ParsedAnchor } from "./anchors";
export { PITCH, boardGeometry, parseHole, holeWorld, nearestHole, type BoardGeometry, type HoleInfo, type StripInfo } from "./board";
export {
  PART_KINDS,
  partDef,
  partLegs,
  PRINTED_KINDS,
  UPRIGHT_KINDS,
  defaultParams,
  footprintOf,
  isFlying,
  canMountOnBoard,
  isThrowSwitch,
  mysteryOrder,
  physicalLeg,
  wiredAs,
  terminalNumber,
  shuffleFor,
  skinOhms,
  pencilOhms,
  type PartDef,
  type FootprintLeg,
  type SeatDef,
  type SettingDef,
  type ActionDef,
  type Hotspot,
  type NetContext,
} from "./parts";
export { seatsOf, heldOf, holderOf, seatNear, SEAT_REACH } from "./seats";
export { trayLeft, trayUsed } from "./tray";
export { partPose, anchorPosition, benchBounds, fitCamera, isOnBoard, rejectedParts, METER, DIAL_MODES, type PartPose } from "./layout";
// Unit 4: chips and friends.
export {
  CHIP_MODELS,
  CHIP_PINOUTS,
  CHIP_PRINT,
  SEVENSEG_LEGS,
  SEGMENTS,
  chipLeg,
  chipDetail,
  chipPinName,
  chipPinCount,
  dipFootprint,
  dipSwitchPins,
  socketPinFor,
  supplyVolts,
  packDefaults,
  type Segment,
} from "./chips";
export { resolveLeg, canonicalAnchor, perches } from "./parts";
export { logicProbeReading, useProbeState, PULSE_HOLD, type ProbeLevel, type ProbeReading } from "./probe";
export { resistorBands, formatOhms, formatFarads } from "./colorCode";
export {
  DOT_SPACING,
  dotSpeed,
  dotRate,
  flowMap,
  gateAmps,
  advanceGates,
  formatGate,
  expandPrefix,
  tagText,
  pushMap,
  hatchSpacing,
  traceLoop,
  boxNets,
  type FlowMap,
  type GateCounts,
  type PushMap,
  type Trace,
  type TraceStep,
} from "./flow";
export { symbolInk, slotTurn, tornOutline, type SymbolInk } from "./symbols";
export { hiddenParts } from "./seats";
export { materialOhms, conducts, schematicSlot, partSpots, partMarks, CLIP_PATH } from "./parts";
export { gateSpot } from "./layout";
export { chargeable, charge as staticCharge, stuckTo, lifting, apart, MAX_MARKS, PULL_MARKS, APART_MM } from "./static";
// The store needs React and zustand but not three.js, so a host can own it before the 3D view loads.
export { createBenchStore, type BenchStore, type BenchStoreState, type BenchUi, type InspectSpec, type BenchOverlay } from "./store";
export { DEFAULT_LABELS, type BenchLabels } from "./labels";
// Unit 3: the solder station engine, joints, perfboard, wire and heat-shrink (src/solder).
export * from "./solder";
export { spotAnchor } from "./anchors";

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
  Held,
  BatterySize,
  Moisture,
  SampleMaterial,
  SymbolKind,
  SchematicSymbol,
  ChipKind,
  ChipModel,
  ChipParamsMap,
  DipKey,
} from "./types";
export { COMPACT_WIDTH, trayCoverOf } from "./view/tray-cover";
