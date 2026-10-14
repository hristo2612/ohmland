/**
 * What a lab's panels write onto the lesson's signed-off notebook page: one small ink figure each, at most, in panel
 * order. A panel offers a figure here by its kind (figureOf); the 555's x-ray offers the 555 map, its pins named so
 * far, so the map grows lesson by lesson, and a continuity table its arcs, the pairs the learner probed. Signed-off only, so it never names a pin before the lesson does. Its own
 * chunk: the chip drawings stay out of a lesson's first load.
 */
import type { ReactNode } from "react";
import type { BenchState, PlacedPart } from "@ohmland/bench/core";
import { m } from "../../i18n";
import { chipInfo } from "../../lab/chips";
import type { LabDefinition, PanelConfig, PanelState } from "../../lab/define";
import { continuityArcs } from "../../lab/panels";
import { Chip555Map } from "../../lab/xray";
import { ContinuityFigure } from "./ContinuityArcs";

/** What the bench has recorded so far (the lab session's notes and panel states), for figures that show readings. */
export type NotebookSession = { notes: Record<string, number | null>; panels: Record<string, PanelState>; bench?: BenchState };

type Figure = { id: string; title: string; body: ReactNode };

function figureOf(lab: LabDefinition, panel: PanelConfig, session: NotebookSession | null): Figure | null {
  if (panel.kind === "continuity") {
    // The pairs the learner probed, drawn as on the bench (the table itself never docks beside a lesson's bench).
    // The part as the bench has it, else as the lab first laid it (a fix-it round may have cleared it away).
    const given = lab.bench.parts?.find((p) => p.id === panel.part);
    const laid = given && "params" in given ? ({ id: panel.part, kind: given.kind, params: given.params ?? {}, pos: [0, 0], rot: 0 } as PlacedPart) : undefined;
    const part = session?.bench?.parts.find((p) => p.id === panel.part) ?? laid;
    const arcs = part ? continuityArcs(part, session?.panels[panel.id]?.cells ?? {}, null) : [];
    if (!part || !arcs.length) return null;
    const name = panel.title ?? m.lab.panels.continuity(given?.label ?? panel.part);
    return { id: panel.id, title: name, body: <ContinuityFigure part={part} arcs={arcs} /> };
  }
  if (panel.kind === "xray") {
    // The chip is on the bench, or comes from the tray (a lesson that has the learner place it).
    const part = lab.bench.parts?.find((p) => p.id === panel.part) ?? lab.bench.tray?.find((t) => t.id === panel.part);
    const params = part && "params" in part ? (part.params as { model?: unknown } | undefined) : undefined;
    const info = chipInfo(params?.model);
    if (info?.sim !== "timer555") return null;
    // The pins named so far, as the x-ray shows them (all eight when the lab names none).
    return { id: panel.id, title: m.lab.chips.mapTitle, body: <Chip555Map pins={panel.pins ?? [1, 2, 3, 4, 5, 6, 7, 8]} /> };
  }
  return null;
}

export default function NotebookFigures({ lab, session }: { lab: LabDefinition; session: NotebookSession | null }) {
  const figures = (lab.panels ?? []).map((p) => figureOf(lab, p, session)).filter((f): f is Figure => !!f);
  return (
    <>
      {figures.map((f) => (
        <section key={f.id} className="bl-page__sec bl-page__figure">
          <h3 className="bl-kicker">{f.title}</h3>
          {f.body}
        </section>
      ))}
    </>
  );
}
