/** The isle's words (labels and reveal captions) from the app's message set, so the island speaks the UI language. */
import type { IsleMessages } from "@ohmland/isle";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";

export function isleMessages(outline?: CourseOutline): IsleMessages {
  const units: Record<string, string> = { ...m.isleWorld.units };
  for (const u of outline?.units ?? []) units[u.id] = u.title;
  return { ...m.isleWorld, units };
}
