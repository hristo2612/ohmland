/** Friendly names for parts, for the Hall of Fried Parts when a lab gives none. */
import { formatFarads, formatOhms, type BenchState } from "@ohmland/bench/core";
import { m } from "../i18n";
import type { FriedRecord } from "./session";

export function friedLabel(rec: Pick<FriedRecord, "partId" | "kind">, bench: BenchState): string {
  if (rec.kind === "meter-fuse") return m.lab.partLabel.meterFuse;
  const p = bench.parts.find((x) => x.id === rec.partId);
  if (!p) return rec.partId;
  switch (p.kind) {
    case "led":
      return m.lab.partLabel.led(m.lab.colors[p.params.color] ?? p.params.color);
    case "resistor":
      return m.lab.partLabel.resistor(formatOhms(p.params.ohms));
    case "fuse":
      return m.lab.partLabel.fuse(String(p.params.amps));
    case "battery":
      return m.lab.partLabel.battery;
    case "ceramic-cap":
    case "electrolytic-cap":
      return m.lab.partLabel.cap(formatFarads(p.params.farads));
    default:
      return m.benchUi.partName?.[p.kind] ?? p.kind;
  }
}
