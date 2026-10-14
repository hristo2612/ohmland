// Lead colours by convention: the lead on a supply's plus is red, the one on its minus black, and the leads in between
// take the other colours in the box, so red and black always mean plus and minus. Pure.

import { parseAnchor } from "../anchors";
import type { BenchState, LeadColor, TestLead } from "../types";

/** Supply kinds and their plus and minus terminals. */
const SUPPLY: Record<string, { plus: string; minus: string }> = {
  battery: { plus: "pos", minus: "neg" },
  lemon: { plus: "pos", minus: "neg" },
  "battery-pack": { plus: "pos", minus: "neg" },
  "bench-supply": { plus: "pos", minus: "neg" },
  station: { plus: "a", minus: "b" },
};

const OTHERS: LeadColor[] = ["green", "yellow", "blue", "white"];

function pole(bench: BenchState, lead: TestLead): "plus" | "minus" | null {
  let found: "plus" | "minus" | null = null;
  for (const e of [lead.a, lead.b]) {
    const a = e.to ? parseAnchor(e.to) : null;
    if (a?.type !== "pin") continue;
    const part = bench.parts.find((p) => p.id === a.part);
    const s = part ? SUPPLY[part.kind] : undefined;
    if (!s) continue;
    const here = a.leg === s.plus ? "plus" : a.leg === s.minus ? "minus" : null;
    if (!here) continue;
    // A lead straight across a supply is neither.
    if (found && found !== here) return null;
    found = here;
  }
  return found;
}

/**
 * Recolours the leads in `auto` (those that took the next colour in the box because the lab did not choose one): red
 * on a supply's plus, black on its minus, green, yellow, blue and white for the rest in order. Connections never
 * change.
 */
export function conventionColours(bench: BenchState, auto: ReadonlySet<string>): BenchState {
  let k = 0;
  let changed = false;
  const leads = bench.leads.map((l) => {
    if (!auto.has(l.id)) return l;
    const p = pole(bench, l);
    const color: LeadColor = p === "plus" ? "red" : p === "minus" ? "black" : OTHERS[k++ % OTHERS.length]!;
    if (color === l.color) return l;
    changed = true;
    return { ...l, color };
  });
  return changed ? { ...bench, leads } : bench;
}
