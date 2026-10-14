// The solder station, perfboard and Unit 3 tools: the public, renderer-free API (re-exported by @ohmland/bench/core).

export { ALLOYS, FEED_RATE, alloyOf, type Alloy, type AlloySpec } from "./alloys";
export { IRON, feedTip, fluxBurn, freshIron, stepIron, tinFactor, wipeTip, type IronState, type Tinning, type TipLoad } from "./iron";
export {
  WORK,
  GOOD_OHMS,
  contactOhms,
  judge,
  jointElectric,
  jointLook,
  newJoint,
  stepJoint,
  tugResult,
  verdictOf,
  type Joint,
  type JointEnv,
  type JointLook,
  type JointShape,
  type TugResult,
  type Verdict,
  type WorkKind,
} from "./joint";
export { BODIES, CLIP_METAL, LeadHeat, type HeatClip, type HeatMetal, type HeatSource } from "./leadheat";
export {
  PERF,
  crossings,
  fitOnPerf,
  ghostsFilled,
  hasPad,
  joinedPads,
  padLocal,
  padMetal,
  padName,
  padNeighbours,
  padWorld,
  padsOf,
  parsePad,
  parsePerfHole,
  perfContacts,
  perfHole,
  perfMount,
  perfSize,
  type JointRecord,
  type PerfLink,
  type PlanGhost,
} from "./perfboard";
export { GEOM, adapterSpec } from "./parts";
export { GUN, TUBE_SIZES, freshTube, gunAirC, stepTube, tubeGrips, tubeMm, type TubeSize, type TubeState } from "./shrink";
export { NOTCHES, awgMm, copperMm, endIsSound, jacketMm, notchMm, stripWire, type StripEnd, type StripScale, type StripTry } from "./strip";
export { LEAD_SPOT_MM, clipPose, ironPose, jackSocket, jointRecordAt, leadLine, splices, spotById, spotPosition, stationSpots, tubePose, type IronPose, type Spot, type SpotKind } from "./spots";
export {
  createStation,
  feedAt,
  holdIron,
  jointRecord,
  layBraid,
  magnify,
  meltC,
  placeIron,
  quickPress,
  readJoint,
  spoolOf,
  stationOf,
  stepStation,
  tug,
  wipe,
  type JointReading,
  type SimInput,
  type StationAct,
  type StationState,
  type StationStep,
} from "./station";
export { addLink, bendLeg, removeLink, snipEnd, stripEnd, stripNearest, twistEnds, wireCaptive } from "./ops";
