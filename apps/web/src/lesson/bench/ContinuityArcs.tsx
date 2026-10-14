/**
 * A continuity table drawn as arcs between a part's legs (docs/LESSONS.md, `tool`): one arc per pair tested, solid ink
 * labelled with the positions it beeped in, or dashed with a small cross when it never beeped. Shared by the bench
 * (ToolInk.tsx, placed with BenchController.project) and the signed-off notebook page (ContinuityFigure, a still copy).
 */
import { partLegs, terminalNumber, type PlacedPart } from "@ohmland/bench/core";
import { m } from "../../i18n";
import type { ContinuityArc } from "../../lab/panels";
import "./tool-ink.css";

type Pt = { x: number; y: number; visible: boolean };

/** A leg's name: its number on a mystery part, else where it sits on its block (left, middle, right). */
export function legLabel(part: PlacedPart, leg: string): string {
  const n = terminalNumber(part, leg);
  if (n !== null) return String(n);
  const legs = partLegs(part);
  return m.lab.terminalAt[legs.length]?.[legs.indexOf(leg)] ?? leg;
}

/** A side's label on an arc: the slider's A or B, a one-way toggle's on or off, a button at rest or held. */
export function sideLabel(part: PlacedPart, side: string): string {
  if (part.kind === "toggle-switch" && (part.params as { throws?: number }).throws === 1) return m.lessonBench.arcs.sides[side === "b" ? "on" : "off"]!;
  return m.lessonBench.arcs.sides[side] ?? side;
}

/** What a screen reader hears for a pair. */
export function pairSaid(part: PlacedPart, a: ContinuityArc): string {
  const silent = a.tested.filter((s) => !a.beeps.includes(s));
  return m.lessonBench.arcs.pair(legLabel(part, a.a), legLabel(part, a.b), a.beeps.map((s) => sideLabel(part, s)), silent.map((s) => sideLabel(part, s)));
}

type Drawn = ContinuityArc & { d: string; apex: { x: number; y: number }; label: { x: number; y: number } };

/**
 * Where every arc goes: a bow between the two legs, bulging off the row of legs toward the front of the part, silent
 * pairs first so the ones that beeped are drawn over them.
 */
export function arcLayout(part: PlacedPart, arcs: ContinuityArc[], at: (leg: string) => Pt | null): Drawn[] {
  const legs = partLegs(part);
  const pts = legs.map((l) => at(l));
  const shown = pts.filter((p): p is Pt => !!p && p.visible);
  if (shown.length < 2) return [];
  const cx = shown.reduce((s, p) => s + p.x, 0) / shown.length;
  const cy = shown.reduce((s, p) => s + p.y, 0) / shown.length;
  const out: Drawn[] = [];
  for (const arc of arcs) {
    const p = pts[legs.indexOf(arc.a)];
    const q = pts[legs.indexOf(arc.b)];
    if (!p?.visible || !q?.visible) continue;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // Legs in a row (a block's screws, left to right): the front of the part is to the right of the row on screen.
    // Off the row (a square of legs), bulge away from the middle of them.
    let n = { x: -dy / len, y: dx / len };
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    if ((mx - cx) * n.x + (my - cy) * n.y < -2) n = { x: -n.x, y: -n.y };
    const h = Math.min(80, Math.max(16, len * 0.34));
    const apex = { x: mx + n.x * h, y: my + n.y * h };
    out.push({
      ...arc,
      d: `M${p.x},${p.y} Q${mx + n.x * h * 2},${my + n.y * h * 2} ${q.x},${q.y}`,
      apex,
      label: { x: apex.x + n.x * 13, y: apex.y + n.y * 13 },
    });
  }
  return out.sort((x, y) => Math.sign(x.beeps.length) - Math.sign(y.beeps.length));
}

/** The arcs as SVG marks (inside an <svg>). */
export function ArcMarks({ part, drawn }: { part: PlacedPart; drawn: Drawn[] }) {
  const k = 3.8;
  return (
    <>
      {drawn.map((a) => {
        const beep = a.beeps.length > 0;
        return (
          <g
            key={`${a.a}|${a.b}|${a.beeps.join("")}`}
            className={`ti-arc${beep ? " ti-arc--beep" : " ti-arc--open"}${a.now ? "" : " ti-arc--faint"}`}
            data-arc={`${a.a}-${a.b}`}
            data-beeps={a.beeps.join(",")}
            data-tested={a.tested.join(",")}
          >
            <path className="ti-arc__line" pathLength={beep ? 1 : undefined} d={a.d} />
            {beep ? (
              <text className="ti-arc__label" x={a.label.x} y={a.label.y} textAnchor="middle" dominantBaseline="central">
                {a.beeps.map((s) => sideLabel(part, s)).join(" ")}
              </text>
            ) : (
              <path className="ti-arc__cross" d={`M${a.apex.x - k},${a.apex.y - k} L${a.apex.x + k},${a.apex.y + k} M${a.apex.x + k},${a.apex.y - k} L${a.apex.x - k},${a.apex.y + k}`} />
            )}
          </g>
        );
      })}
    </>
  );
}

/** The arcs as the notebook keeps them: the legs in a row, named, with every pair the learner tested. */
export function ContinuityFigure({ part, arcs }: { part: PlacedPart; arcs: ContinuityArc[] }) {
  const legs = partLegs(part);
  const gap = legs.length > 3 ? 48 : 76;
  const x0 = 24;
  const y0 = 26;
  const at = (leg: string): Pt => ({ x: x0 + legs.indexOf(leg) * gap, y: y0, visible: true });
  const drawn = arcLayout(part, arcs.map((a) => ({ ...a, now: true })), at);
  const w = x0 * 2 + (legs.length - 1) * gap;
  const h = Math.max(y0 + 16, ...drawn.map((a) => (a.beeps.length ? a.label.y : a.apex.y))) + 16;
  return (
    <figure className="ti-fig">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={arcs.map((a) => pairSaid(part, a)).join(". ")}>
        <ArcMarks part={part} drawn={drawn} />
        {legs.map((leg) => {
          const p = at(leg);
          return (
            <g key={leg} className="ti-fig__lug">
              <circle cx={p.x} cy={p.y} r={5} />
              <text x={p.x} y={p.y - 11} textAnchor="middle">
                {legLabel(part, leg)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
