// The ink registry: one entry per bench part kind. A kind without an entry still works: it is drawn as a labelled
// slip with its leads, can be picked, moved and clipped, until someone draws it properly.

import type { ReactNode } from "react";
import { useLabels } from "../../labels";
import type { BenchPartKind, PlacedPart, Vec2 } from "../../types";
import { INK, toWorld } from "../frame";
import type { PartInk } from "../model";
import { AXIAL } from "./axial";
import { HoleDot, Upright, localLegs, n3 } from "./common";
import { CONTROLS } from "./controls";
import { POWER } from "./power";
import { PROPS } from "./props";
import { RADIAL } from "./radial";
import { START } from "./start";
import type { DrawProps, InkKind, InkRegistry } from "./types";

export const INK_KINDS: InkRegistry = { ...AXIAL, ...RADIAL, ...CONTROLS, ...POWER, ...PROPS, ...START };

function Fallback({ pi }: DrawProps) {
  const labels = useLabels();
  const L = localLegs(pi);
  const name = labels.partName[pi.part.kind as BenchPartKind] ?? pi.part.kind;
  return (
    <g>
      {Object.values(L).map((p, i) => (
        <g key={i}>
          <path d={`M0 0L${n3(p[0])} ${n3(p[1])}`} className="lead" />
          <HoleDot at={p} />
        </g>
      ))}
      <rect x={-11} y={-6} width={22} height={12} rx={1.4} className="f-slip" />
      <rect x={-11} y={-6} width={22} height={12} rx={1.4} className="ln" strokeDasharray="2 1.6" />
      <Upright x={0} z={0} rot={pi.f.rot} fontSize={2.6} textAnchor="middle" dominantBaseline="central" className="print">
        {name}
      </Upright>
    </g>
  );
}

const FALLBACK: InkKind = { box: () => [-11, -6, 11, 6], Draw: Fallback };

/** The ink definition of a kind (or the labelled slip for kinds not drawn yet). */
export function inkKind(kind: string): InkKind {
  return (INK_KINDS[kind as BenchPartKind] as InkKind | undefined) ?? FALLBACK;
}

export function hasInkKind(kind: string): boolean {
  return kind in INK_KINDS;
}

/** One part's drawing, in its frame. */
export function PartDrawing(p: DrawProps): ReactNode {
  const Draw = inkKind(p.pi.part.kind).Draw as (q: DrawProps) => ReactNode;
  return <Draw {...p} />;
}

/** The flexible leads of desk parts (battery snap, speaker wires), in desk coordinates. */
export function FlyingLeads({ pi }: { pi: PartInk }) {
  if (!pi.ends) return null;
  const exits: Record<string, { at: Vec2; dir: Vec2; color: string }> =
    pi.part.kind === "battery"
      ? { pos: { at: [-1.6, -3.4], dir: [0, -1], color: "red" }, neg: { at: [1.6, -3.4], dir: [0, -1], color: "black" } }
      : (() => {
          const R = ((pi.part.params as { size?: number }).size ?? 40) / 2;
          return { a: { at: [-2.6, R + 2.4], dir: [0, 1], color: "red" }, b: { at: [2.6, R + 2.4], dir: [0, 1], color: "black" } };
        })();
  const out: ReactNode[] = [];
  for (const [leg, e] of Object.entries(pi.ends)) {
    const ex = exits[leg];
    if (!ex) continue;
    const a = toWorld(pi.f, ex.at[0], ex.at[1]);
    const d0 = toWorld({ ox: 0, oz: 0, rot: pi.f.rot }, ex.dir[0], ex.dir[1]);
    const b = e.pos;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.min(40, Math.max(6, len * 0.4));
    // Arrive at the hole (or lie on the desk) heading away from the part; the last few mm are bare, tinned wire.
    const back: Vec2 = len > 0.01 ? [(a[0] - b[0]) / len, (a[1] - b[1]) / len] : [0, -1];
    const strip = 2.6;
    const s: Vec2 = [b[0] + back[0] * strip, b[1] + back[1] * strip];
    const c1: Vec2 = [a[0] + d0[0] * k, a[1] + d0[1] * k];
    const c2: Vec2 = [s[0] + back[0] * k * 0.6, s[1] + back[1] * k * 0.6 + (e.inHole ? 0 : 2)];
    const path = `M${n3(a[0])} ${n3(a[1])}C${n3(c1[0])} ${n3(c1[1])} ${n3(c2[0])} ${n3(c2[1])} ${n3(s[0])} ${n3(s[1])}`;
    out.push(
      <g key={leg}>
        <path d={path} className="edge" style={{ ["--w" as string]: `${INK.snapW}px` }} />
        <path d={path} className="core" style={{ ["--w" as string]: `${INK.snapW}px`, stroke: `var(--k-w-${ex.color})` }} />
        <path d={`M${n3(s[0])} ${n3(s[1])}L${n3(b[0])} ${n3(b[1])}`} className="lead" />
        {e.inHole ? <HoleDot at={b} /> : <circle cx={n3(b[0])} cy={n3(b[1])} r={0.5} className="f-metal ln-thin" />}
      </g>,
    );
  }
  return <g>{out}</g>;
}

export type { PlacedPart };
