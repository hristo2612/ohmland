// Strings only the ink view needs, on top of the shared BenchLabels. Hosts translate them through the same `labels`
// prop (unknown keys are ignored by the 3D view).

import { mergeLabels, type BenchLabels } from "../labels";

export type InkLabelsExtra = {
  /** Accessible name of the ink drawing. */
  inkCanvas: string;
  fit: string;
  zoomIn: string;
  zoomOut: string;
  /** The keyboard cursor's name. */
  cursor: string;
  keyDropped: string;
  keyLoose: string;
  keyInHoles: string;
  keyPicked: string;
  keyHelp: string;
};

export type InkLabels = BenchLabels & InkLabelsExtra;

export const INK_LABELS: InkLabelsExtra = {
  inkCanvas: "Workbench drawing. Tab to a part, a clip or a probe; Enter picks a clip, probe or plug up and puts it down; arrow keys walk between holes.",
  fit: "Show everything",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  cursor: "Connection point cursor",
  keyDropped: "Clipped to",
  keyLoose: "Left on the desk",
  keyInHoles: "in holes",
  keyPicked: "Picked up. Arrow keys choose where, Enter puts it down, Escape cancels.",
  keyHelp: "Arrow keys walk between holes and leads. Enter acts, Escape cancels.",
};

export function mergeInkLabels(over?: Partial<InkLabels>): InkLabels {
  const base = mergeLabels(over);
  const extra: InkLabelsExtra = { ...INK_LABELS };
  if (over) for (const k of Object.keys(INK_LABELS) as (keyof InkLabelsExtra)[]) if (typeof over[k] === "string") extra[k] = over[k] as string;
  return { ...base, ...extra };
}
