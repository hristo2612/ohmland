/**
 * The four columns of the cable variants page: the same bench as each approach would start it. Current and the two
 * path styles (drape, taped) only change how the cables are drawn; tidy also lays the parts and loose clips out
 * again (src/cables/tidy.ts in the bench package). Drape also colours the leads by convention: plus red, minus black,
 * where the lab did not choose.
 */
import { conventionColours, tidyBench, type BenchState, type CableStyle } from "@ohmland/bench/core";
import { buildModel, inkClutter, inkKind } from "@ohmland/bench/ink";
import type { LabDefinition } from "../../lab/define";
import { autoColoured, caseBench } from "./cases";

export type Variant = { bench: BenchState; cableStyle: CableStyle; frame: [number, number, number, number] | null; locked: string[] };

/** A part's outline as the ink view draws it on the desk: what the tidy pass keeps clear. */
const inkFootprint = (part: BenchState["parts"][number]) => inkKind(part.kind).box(part as never, { mount: "desk", held: false });

export function variantBench(style: CableStyle, lab: LabDefinition, task: string | null): Variant {
  const { bench, built } = caseBench(lab, task);
  const base = { cableStyle: style, frame: built.frame, locked: built.locked };
  if (style === "drape") return { ...base, bench: conventionColours(bench, autoColoured(lab, built)) };
  if (style === "tidy") {
    const judge = (b: BenchState) => inkClutter(buildModel(b, "tidy"), built.frame).raw;
    return { ...base, bench: tidyBench(bench, { fixed: built.fixed ?? [], frame: built.frame, footprint: inkFootprint, judge }) };
  }
  return { ...base, bench };
}
