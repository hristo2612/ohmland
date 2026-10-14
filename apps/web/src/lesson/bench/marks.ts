/**
 * Ink marks the lesson draws over the bench (Annotations.tsx renders them through BenchController.project, so they
 * look the same over the 3D and the ink view). Pure helpers: anchor resolution and hole judging for tap checks.
 */
import { boardGeometry, hiddenParts, type BenchState } from "@ohmland/bench/core";
import { resolveAttach } from "../../lab/anchors";

export type MarkKind =
  /** A short line of ink with an arrow to the anchor: a discovery. Fades to a dot when the lesson moves on. */
  | "note"
  /** A part's name, written onto it (the three-period lesson's first period). */
  | "label"
  /** A tick written at the anchor. */
  | "tick"
  /** A pencil ring around the anchor (a marked hole, a wrong tap). */
  | "ring"
  /** An outline around a breadboard hole's whole strip (x-ray finds). */
  | "strip";

export type Mark = {
  id: string;
  kind: MarkKind;
  /** Lab shorthand or a raw anchor. */
  at: string;
  text?: string;
  tone: "ink" | "blue" | "red";
  /** Faded: a note that has had its moment shows as a small dot. */
  faded?: boolean;
};

/**
 * A raw bench anchor for lab shorthand: "D1" -> "part:D1", "D1.anode" -> "pin:D1.anode", "e12" -> "hole:e12". Raw anchors
 * and marks ("part:M1/dial") pass through.
 */
export function resolveAnchor(bench: BenchState, s: string): string | null {
  if (/^(pin|hole|wire|lead|probe|socket|part|spot):/.test(s)) return s;
  if (bench.parts.some((p) => p.id === s) || bench.meter?.id === s) return `part:${s}`;
  if (bench.wires.some((w) => w.id === s)) return `wire:${s}.b`;
  if (bench.leads.some((l) => l.id === s)) return `lead:${s}.a`;
  return resolveAttach(bench, s);
}

export type HoleVerdict = "right" | "self" | "across" | "other-strip" | "rail-for-strip" | "strip-for-rail" | "other-rail";

/** Judges a tapped hole against "a hole joined to `marker`" on the bench's board. */
export function judgeJoined(bench: BenchState, marker: string, tapped: string): HoleVerdict {
  if (!bench.board) return "other-strip";
  const g = boardGeometry(bench.board);
  const a = g.holes.get(marker.replace(/^hole:/, ""));
  const b = g.holes.get(tapped.replace(/^hole:/, ""));
  if (!a || !b) return "other-strip";
  if (a.id === b.id) return "self";
  if (a.strip === b.strip) return "right";
  if (a.rail && b.rail) return "other-rail";
  if (a.rail) return "strip-for-rail";
  if (b.rail) return "rail-for-strip";
  return a.col === b.col ? "across" : "other-strip";
}

/** The holes of the strip a hole belongs to (for the x-ray outline). */
export function stripHoles(bench: BenchState, hole: string): string[] {
  if (!bench.board) return [];
  const g = boardGeometry(bench.board);
  const h = g.holes.get(hole.replace(/^hole:/, ""));
  return h ? (g.strips.get(h.strip)?.holes ?? []) : [];
}

/** Every hole id on the bench's board. */
export function allHoles(bench: BenchState): string[] {
  return bench.board ? [...boardGeometry(bench.board).holes.keys()] : [];
}

/** Words that name a kind of part at the end of a label ("1 kΩ resistor", "9 V battery"): either half names it. */
const KIND_WORDS = new Set(["resistor", "battery", "switch", "led", "lamp", "fuse", "capacitor", "transistor", "relay", "diode", "button", "pushbutton", "cell", "chip", "probe", "trimmer", "speaker", "box"]);

/**
 * The parts on the bench a robot line names: by id ("R1"), by label ("Lamp", "Switch"), or by either half of a label
 * that ends in a kind ("the 1.5 kΩ", "the battery's snap").
 */
export function namedParts(line: string, bench: BenchState, labels: Record<string, string>): string[] {
  const text = ` ${line
    .toLowerCase()
    .replace(/['’]s\b/g, " ")
    .replace(/[,!?;:()"]|\.(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")} `;
  const hidden = new Set(hiddenParts(bench));
  return bench.parts
    .filter((p) => !hidden.has(p.id))
    .filter((p) => {
      const label = (labels[p.id] ?? "").toLowerCase().trim();
      const names = new Set<string>([p.id.toLowerCase()]);
      if (label.length >= 3) names.add(label);
      const words = label.split(/\s+/);
      const last = words[words.length - 1] ?? "";
      if (words.length > 1 && KIND_WORDS.has(last)) {
        names.add(last);
        // A value names one part ("the 1.5 kΩ"); a colour ("red") is not a name, it is how a line describes things.
        const value = words.slice(0, -1).join(" ");
        if (/\d/.test(value)) names.add(value);
      }
      return [...names].some((n) => n.length >= 2 && text.includes(` ${n} `));
    })
    .map((p) => p.id);
}

/**
 * Lab shorthand as framing targets, each taken whole: a lead named by its id with the parts its clips bite, a jumper
 * named by its id, and a part's lead or terminal with the part it belongs to (a battery's snap brings the battery).
 */
export function wholeTargets(bench: BenchState, list: readonly string[] | undefined): string[] {
  const partOf = (anchor: string | null) => {
    const m = anchor ? /^pin:([^.]+)\./.exec(anchor) : null;
    return m && bench.parts.some((p) => p.id === m[1]) ? [`part:${m[1]}`] : [];
  };
  return (list ?? []).flatMap((s) => {
    const lead = bench.leads.find((l) => l.id === s);
    if (lead) return [`lead:${s}`, ...partOf(lead.a.to), ...partOf(lead.b.to)];
    if (bench.wires.some((x) => x.id === s)) return [`wire:${s}`];
    const a = resolveAnchor(bench, s);
    if (!a) return [];
    return [a, ...partOf(a)];
  });
}
