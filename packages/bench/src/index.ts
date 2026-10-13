// @ohmland/bench: the 3D lab workbench. See README.md.

export { Bench, type BenchProps, type BenchController } from "./scene/Bench";
export { PartPreview, type PartPreviewProps, type PreviewKind } from "./preview/PartPreview";
export { PartGallery, DEFAULT_GALLERY, type GalleryItem, type PartGalleryProps } from "./preview/Gallery";

export { benchToNetlist, connectivity, type BenchNetlist, type BenchNetlistOptions, type Connectivity } from "./netlist";
export { createBenchStore, useBench, useBenchStore, BenchStoreContext, type BenchStore, type BenchStoreState, type BenchUi, type BenchMode } from "./store";
export * as benchOps from "./ops";
export { emptyBench, defaultMeter } from "./ops";

export { holeAnchor, pinAnchor, wireAnchor, leadAnchor, probeAnchor, socketAnchor, parseAnchor, type ParsedAnchor } from "./anchors";
export { PITCH, boardGeometry, parseHole, holeWorld, nearestHole, type BoardGeometry, type HoleInfo, type StripInfo } from "./board";
export { PART_KINDS, partDef, partLegs, defaultParams, footprintOf, isThrowSwitch, mysteryOrder, physicalLeg, wiredAs, terminalNumber, shuffleFor, type PartDef, type FootprintLeg } from "./parts";
export { partPose, anchorPosition, clipTargets, METER, DIAL_MODES, type PartPose, type ClipTarget } from "./layout";
export { resistorBands, bandsToOhms, formatOhms, formatFarads, ceramicCode, isPreferredValue, BAND_HEX, type BandColor } from "./colorCode";
export { DEFAULT_LABELS, mergeLabels, type BenchLabels } from "./labels";

// Model components, for custom scenes inside an R3F <Canvas>.
export { PartModel, type PartModelProps } from "./models/PartModel";
export { MultimeterModel } from "./models/Multimeter";
export { Breadboard } from "./models/Breadboard";
export { AlligatorClip, BananaPlug, Probe, JumperWire } from "./models/Leads";
export { StudioEnvironment, StudioLights, Desk, prepareBench } from "./scene/Studio";
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
} from "./types";
