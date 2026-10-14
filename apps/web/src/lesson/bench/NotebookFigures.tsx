/**
 * What a lab's panels write onto the lesson's signed-off notebook page: one small ink figure each, at most, in panel
 * order. A panel offers a figure here by its kind (figureOf); the 555's x-ray offers the 555 map, its pins named so
 * far, so the map grows lesson by lesson. Signed-off only, so it never names a pin before the lesson does. Its own
 * chunk: the chip drawings stay out of a lesson's first load.
 */
import type { ReactNode } from "react";
import { m } from "../../i18n";
import { chipInfo } from "../../lab/chips";
import type { LabDefinition, PanelConfig, PanelState } from "../../lab/define";
import { Chip555Map } from "../../lab/xray";

/** What the bench has recorded so far (the lab session's notes and panel states), for figures that show readings. */
export type NotebookSession = { notes: Record<string, number | null>; panels: Record<string, PanelState> };

type Figure = { id: string; title: string; body: ReactNode };

function figureOf(lab: LabDefinition, panel: PanelConfig, _session: NotebookSession | null): Figure | null {
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
