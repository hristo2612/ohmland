// @ohmland/bench: the 3D lab workbench. See README.md.

export { Bench, type BenchProps, type Bench3DController } from "./scene/Bench";
export { BenchView, preloadBenchView, type BenchViewProps } from "./view/BenchView";
export { createControllerHub, type BenchController, type BenchControllerHub, type BenchViewKind, type FocusOptions, type ScreenPoint } from "./view/controller";
export { parseTarget, targetPoint, meterSpot, METER_SPOTS, type ParsedTarget } from "./view/targets";
export type { BenchRendererProps } from "./view/types";
export { PartPreview, type PartPreviewProps, type PreviewKind } from "./preview/PartPreview";
export { PartGallery, DEFAULT_GALLERY, type GalleryItem, type PartGalleryProps } from "./preview/Gallery";

export { benchToNetlist, connectivity, type BenchNetlist, type BenchNetlistOptions, type Connectivity } from "./netlist";
export { createBenchStore, useBench, useBenchStore, BenchStoreContext, type BenchStore, type BenchStoreState, type BenchUi, type BenchMode, type InspectSpec, type BenchOverlay } from "./store";
export { dotSpeed, dotRate, flowMap, gateAmps, advanceGates, formatGate, expandPrefix, tagText, pushMap, traceLoop, boxNets, type FlowMap, type GateCounts, type PushMap, type Trace, type TraceStep } from "./flow";
export { symbolInk, slotTurn, tornOutline, type SymbolInk } from "./symbols";
export { hiddenParts } from "./seats";
export { seatsOf, heldOf, holderOf, seatNear, SEAT_REACH } from "./seats";
export * as benchOps from "./ops";
export { emptyBench, defaultMeter } from "./ops";

export { holeAnchor, pinAnchor, wireAnchor, leadAnchor, probeAnchor, socketAnchor, parseAnchor, type ParsedAnchor } from "./anchors";
export { PITCH, boardGeometry, parseHole, holeWorld, nearestHole, type BoardGeometry, type HoleInfo, type StripInfo } from "./board";
export { PART_KINDS, partDef, partLegs, defaultParams, footprintOf, isThrowSwitch, mysteryOrder, physicalLeg, wiredAs, terminalNumber, shuffleFor, skinOhms, pencilOhms, type PartDef, type FootprintLeg, type SeatDef, type SettingDef, type Hotspot } from "./parts";
export { partPose, anchorPosition, clipTargets, METER, DIAL_MODES, type PartPose, type ClipTarget } from "./layout";
export { resistorBands, bandsToOhms, formatOhms, formatFarads, ceramicCode, isPreferredValue, BAND_HEX, type BandColor } from "./colorCode";
export { DEFAULT_LABELS, mergeLabels, type BenchLabels } from "./labels";

// Model components, for custom scenes inside an R3F <Canvas>.
export { PartModel, type PartModelProps } from "./models/PartModel";
export { MultimeterModel } from "./models/Multimeter";
export { Breadboard } from "./models/Breadboard";
export { AlligatorClip, BananaPlug, Probe, JumperWire } from "./models/Leads";
export { StudioEnvironment, StudioLights, Desk, prepareBench } from "./scene/Studio";
export { PAPER_LIGHT, PAPER_DARK, GRID_MM, type PaperPalette } from "./three/paper";
export type { Mount } from "./models/common";

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
} from "./types";
