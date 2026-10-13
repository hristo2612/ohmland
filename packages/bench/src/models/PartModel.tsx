// One entry point for every part model.

import type { PartState } from "@ohmland/sim";
import type { BenchPartKind, PartParamsMap, Quality, Vec3 } from "../types";
import { DiodeModel, ResistorModel } from "./Axial";
import { BatteryModel, SNAP_EXITS } from "./Battery";
import { CeramicCapModel, ElectrolyticModel } from "./Capacitors";
import { LedModel, PhototransistorModel } from "./Led";
import { FuseModel, NpnModel, RelayModel, TrimmerModel } from "./Misc";
import { CupModel, LemonModel, SpeakerModel, speakerExits } from "./Props";
import { BinModel, CardModel, ChartModel, ClockModel, ElectrodeModel, FruitModel, HolderModel, SampleModel, ShowcaseModel, SkinModel, StationModel, TagModel } from "./LabProps";
import { PushbuttonModel, SlideSwitchModel, ToggleSwitchModel } from "./Switches";
import { ButtonBlock, DpdtBlock, KnobBlock, RelayBlock, SlideBlock } from "./Blocks";
import { TouchPadsModel } from "./Props";
import type { Mount } from "./common";

export type PartModelProps<K extends BenchPartKind = BenchPartKind> = {
  kind: K;
  params: PartParamsMap[K];
  mount: Mount;
  span?: number;
  state?: PartState | null;
  quality?: Quality;
  pressed?: boolean;
  /** Sitting in a holder's seat (an electrode stands up in its lemon slot). */
  held?: boolean;
  /** Simulated minutes since the lab started (the desk clock). */
  minutes?: number;
};

/** Renders any bench part in its local frame. See `Mount` for what the origin means. */
export function PartModel(props: PartModelProps) {
  const { kind } = props;
  const p = props as PartModelProps<never> & { params: never };
  switch (kind) {
    case "resistor":
      return <ResistorModel {...p} />;
    case "diode":
      return <DiodeModel {...p} />;
    case "led":
      return <LedModel {...p} />;
    case "phototransistor":
      return <PhototransistorModel {...p} />;
    case "battery":
      return <BatteryModel {...p} />;
    case "ceramic-cap":
      return <CeramicCapModel {...p} />;
    case "electrolytic-cap":
      return <ElectrolyticModel {...p} />;
    case "trimmer":
      if ((props.params as { base?: boolean }).base && props.mount !== "board") return <KnobBlock params={props.params as never} />;
      return <TrimmerModel {...p} />;
    case "relay":
      if ((props.params as { base?: boolean }).base && props.mount !== "board") return <RelayBlock params={props.params as never} closed={!!props.state?.closed} quality={props.quality ?? "high"} />;
      return <RelayModel {...p} />;
    case "npn":
      return <NpnModel {...p} />;
    case "fuse":
      return <FuseModel {...p} />;
    case "pushbutton":
      if ((props.params as { base?: boolean }).base && props.mount !== "board") return <ButtonBlock params={props.params as never} pressed={!!props.pressed} />;
      return <PushbuttonModel {...p} />;
    case "slide-switch":
      if ((props.params as { base?: boolean }).base && props.mount !== "board") return <SlideBlock params={props.params as never} />;
      return <SlideSwitchModel {...p} />;
    case "toggle-switch":
      return <ToggleSwitchModel {...p} />;
    case "speaker":
      return <SpeakerModel {...p} />;
    case "cup":
      return <CupModel {...p} />;
    case "lemon":
      return <LemonModel />;
    case "dpdt-switch":
      return <DpdtBlock params={props.params as never} />;
    case "touch-pads":
      return <TouchPadsModel {...p} />;
    case "holder":
      return <HolderModel />;
    case "station":
      return <StationModel {...p} />;
    case "fruit":
      return <FruitModel />;
    case "electrode":
      return <ElectrodeModel {...p} held={props.held} />;
    case "skin":
      return <SkinModel {...p} />;
    case "sample":
      return <SampleModel {...p} />;
    case "card":
      return <CardModel {...p} />;
    case "tag":
      return <TagModel {...p} />;
    case "bin":
      return <BinModel {...p} />;
    case "chart":
      return <ChartModel />;
    case "clock":
      return <ClockModel minutes={props.minutes} />;
    case "showcase":
      return <ShowcaseModel quality={props.quality} />;
  }
}

/** Flexible leads of desk parts: where each wire leaves the body (local), its colour, radius and length. */
export function flyingLeads(
  kind: BenchPartKind,
  params: Record<string, unknown>,
): Record<string, { pos: Vec3; dir: Vec3; color: string; radius: number; length: number }> | null {
  if (kind === "battery" && params.snap) {
    return {
      pos: { ...SNAP_EXITS.pos, color: "red", radius: 0.65, length: 160 },
      neg: { ...SNAP_EXITS.neg, color: "black", radius: 0.65, length: 160 },
    };
  }
  if (kind === "speaker") {
    const ex = speakerExits((params.size as number) ?? 40);
    return {
      a: { ...ex.a, color: "red", radius: 0.6, length: 130 },
      b: { ...ex.b, color: "black", radius: 0.6, length: 130 },
    };
  }
  return null;
}
