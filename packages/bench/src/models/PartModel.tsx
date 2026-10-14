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
import { AaCutawayModel, BalloonModel, BoxModel, CombModel, DrawerModel, EverydayModel, GateModel, PaperBitsModel, PieceModel, ScarfModel, SchematicModel, TrayModel, WallModel } from "./StartProps";
import { McuBoardModel } from "./McuBoard";
import { ChipModel, DipSwitchModel, LogicProbeModel, PackModel, RegulatorModel, SevenSegModel, SocketModel, SupplyModel, packExits, probeExits } from "./Chips";
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
  /** The part's id (a gate reads its count from the bench store by it). */
  id?: string;
  /** Lying on top of the board because it will not seat (a surface mount chip). */
  perched?: boolean;
  /** The logic probe's tip is in a hole (the pen leans back from it). */
  probing?: boolean;
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
      if ((props.params as { size?: string; xray?: boolean }).size === "aa" && (props.params as { xray?: boolean }).xray) return <AaCutawayModel />;
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
    case "sample": {
      const m = (props.params as { material: string }).material;
      if (m !== "copper" && m !== "plastic") return <EverydayModel material={m as never} quality={props.quality} />;
      return <SampleModel {...p} />;
    }
    case "card":
      return <CardModel {...p} />;
    case "tag":
      return <TagModel {...p} />;
    case "bin": {
      const b = props.params as { style?: string; face?: never; label?: string };
      if (b.style === "tray") return <TrayModel label={b.label ?? ""} />;
      if (b.style === "drawer") return <DrawerModel face={b.face} label={b.label ?? ""} />;
      return <BinModel {...p} />;
    }
    case "chart":
      return <ChartModel />;
    case "clock":
      return <ClockModel minutes={props.minutes} />;
    case "showcase":
      return <ShowcaseModel quality={props.quality} />;
    case "gate":
      return <GateModel id={props.id ?? ""} params={props.params as never} />;
    case "box":
      return <BoxModel params={props.params as never} />;
    case "schematic":
      return <SchematicModel params={props.params as never} />;
    case "piece":
      return <PieceModel params={props.params as never} />;
    case "balloon":
      return <BalloonModel params={props.params as never} id={props.id} />;
    case "scarf":
      return <ScarfModel params={props.params as never} />;
    case "paper":
      return <PaperBitsModel id={props.id} />;
    case "comb":
      return <CombModel params={props.params as never} />;
    case "wall":
      return <WallModel />;
    case "mcu-board":
      return <McuBoardModel {...p} />;
    case "chip":
      return <ChipModel {...p} held={props.held} perched={props.perched} />;
    case "sevenseg":
      return <SevenSegModel {...p} />;
    case "regulator7805":
      return <RegulatorModel {...p} />;
    case "ic-socket":
      return <SocketModel {...p} />;
    case "dip-switch":
      return <DipSwitchModel {...p} />;
    case "logic-probe":
      return <LogicProbeModel {...p} probing={props.probing} />;
    case "battery-pack":
      return <PackModel {...p} />;
    case "bench-supply":
      return <SupplyModel {...p} />;
  }
}

/** Flexible leads of desk parts: where each wire leaves the body (local), its colour, radius and length. */
export function flyingLeads(
  kind: BenchPartKind,
  params: Record<string, unknown>,
  /** The logic probe's tip is in a hole (its leads leave the raised tail). */
  probing = false,
): Record<string, { pos: Vec3; dir: Vec3; color: string; radius: number; length: number }> | null {
  if (kind === "logic-probe") {
    const ex = probeExits(probing);
    return { vcc: { ...ex.vcc, color: "red", radius: 0.6, length: 220 }, gnd: { ...ex.gnd, color: "black", radius: 0.6, length: 220 } };
  }
  if (kind === "battery-pack") {
    const ex = packExits((params.cells as number) ?? 3);
    return { pos: { ...ex.pos, color: "red", radius: 0.6, length: 170 }, neg: { ...ex.neg, color: "black", radius: 0.6, length: 170 } };
  }
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
