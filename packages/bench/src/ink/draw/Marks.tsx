// Marks drawn over the bench: your selection (blue ink), hints and spotlights (red pencil), snap targets, the
// connected points of an x-rayed hole, the wire being drawn and the keyboard cursor.

import { memo } from "react";
import { holeWorld } from "../../board";
import type { BenchUi } from "../../store";
import type { Anchor, Vec2 } from "../../types";
import { rectOfPoints, type Rect } from "../camera";
import { INK, boxCorners, frameTransform, n3 } from "../frame";
import { METER, anchorInk, partBounds, targetRect, type InkModel, type PartInk } from "../model";

function Brackets({ x0, z0, x1, z1, className }: { x0: number; z0: number; x1: number; z1: number; className: string }) {
  const L = Math.min(x1 - x0, z1 - z0) * 0.28 + 1.2;
  const d = [
    `M${n3(x0)} ${n3(z0 + L)}V${n3(z0)}H${n3(x0 + L)}`,
    `M${n3(x1 - L)} ${n3(z0)}H${n3(x1)}V${n3(z0 + L)}`,
    `M${n3(x1)} ${n3(z1 - L)}V${n3(z1)}H${n3(x1 - L)}`,
    `M${n3(x0 + L)} ${n3(z1)}H${n3(x0)}V${n3(z1 - L)}`,
  ].join("");
  return <path d={d} className={className} />;
}

function PartBrackets({ pi, className }: { pi: PartInk; className: string }) {
  const pad = 1.4;
  const [x0, z0, x1, z1] = pi.box;
  return (
    <g transform={frameTransform(pi.f)}>
      <Brackets x0={x0 - pad} z0={z0 - pad} x1={x1 + pad} z1={z1 + pad} className={className} />
    </g>
  );
}

/** A loose pencil ring round a desk rectangle. */
function Ring({ r, className, pad = 2.6 }: { r: Rect; className: string; pad?: number }) {
  const cx = (r[0] + r[2]) / 2;
  const cz = (r[1] + r[3]) / 2;
  const rx = (r[2] - r[0]) / 2 + pad;
  const rz = (r[3] - r[1]) / 2 + pad;
  const k = Math.SQRT2 * 0.82;
  return <ellipse cx={n3(cx)} cy={n3(cz)} rx={n3(Math.max(2.4, rx * k))} ry={n3(Math.max(2.4, rz * k))} className={className} />;
}

export type MarksProps = {
  model: InkModel;
  ui: Pick<BenchUi, "selection" | "wireDraft" | "snapTarget" | "dragging">;
  hintParts: readonly string[];
  hintAnchors: readonly Anchor[];
  spot: readonly string[] | null;
  /** Points joined to the hovered hole or lead (x-ray). */
  litPins: readonly Anchor[];
  /** What keyboard focus is on, as a target ("part:R1", "lead:TL1.a", "probe:red", "part:M1/dial"). */
  focus: string | null;
};

export const Marks = memo(function Marks({ model, ui, hintParts, hintAnchors, spot, litPins, focus }: MarksProps) {
  const sel = ui.selection;
  const out: React.ReactNode[] = [];
  // Joined leads and jumper ends of the hovered point.
  for (const a of litPins) {
    const p = anchorInk(model, a);
    if (p) out.push(<circle key={`x:${a}`} cx={n3(p[0])} cy={n3(p[1])} r={1.25} className="pin-lit" />);
  }
  if (sel?.type === "part" && !ui.dragging) {
    const pi = model.parts.get(sel.id);
    if (pi) out.push(<PartBrackets key="sel" pi={pi} className="sel" />);
  } else if (sel?.type === "wire") {
    const wi = model.wires.get(sel.id);
    if (wi) out.push(<path key="sel" d={`M${n3(wi.a[0])} ${n3(wi.a[1])}Q${n3(wi.ctrl[0])} ${n3(wi.ctrl[1])} ${n3(wi.b[0])} ${n3(wi.b[1])}`} className="core" style={{ ["--w" as string]: `${INK.jumperW * 2.6}px`, stroke: "var(--k-blue)", opacity: 0.28 }} />);
  } else if (sel?.type === "lead") {
    const li = model.leads.get(sel.id);
    if (li) {
      out.push(<path key="sel" d={li.path} className="core" style={{ ["--w" as string]: `${INK.cableW * 2.4}px`, stroke: "var(--k-blue)", opacity: 0.22 }} />);
      for (const e of [li.a, li.b]) out.push(<circle key={`sel:${e.tip[0]}`} cx={n3(e.tip[0])} cy={n3(e.tip[1])} r={3} className="sel" />);
    }
  } else if (sel?.type === "meter" && model.meter) {
    out.push(
      <g key="sel" transform={frameTransform(model.meter.f)}>
        <Brackets x0={-METER.width / 2 - 2} z0={-METER.length / 2 - 2} x1={METER.width / 2 + 2} z1={METER.length / 2 + 2} className="sel" />
      </g>,
    );
  }
  for (const id of hintParts) {
    const r = targetRect(model, id);
    if (r) out.push(<Ring key={`h:${id}`} r={r} className="hint hint-pulse" />);
  }
  for (const a of hintAnchors) {
    const p = anchorInk(model, a);
    if (p) out.push(<circle key={`ha:${a}`} cx={n3(p[0])} cy={n3(p[1])} r={2.4} className="hint hint-pulse" />);
  }
  if (spot) {
    for (const t of spot) {
      const r = targetRect(model, t);
      if (r) out.push(<Ring key={`s:${t}`} r={r} className="spot spot-pulse" pad={t.includes(":") && !t.startsWith("part:") ? 1.2 : 3.4} />);
    }
  }
  if (focus) {
    const r = targetRect(model, focus);
    if (r) out.push(<Ring key="focus" r={r} className="focus-ring" pad={focus.includes(":") && !focus.startsWith("part:") ? 2.2 : 3} />);
  }
  if (ui.snapTarget) {
    const p = anchorInk(model, ui.snapTarget);
    if (p) out.push(<circle key="snap" cx={n3(p[0])} cy={n3(p[1])} r={1.9} className="snap" />);
  }
  const draft = ui.wireDraft;
  if (draft && model.bench.board) {
    const a = holeWorld(model.bench.board, draft.from);
    const b: Vec2 | null = draft.target ? holeWorld(model.bench.board, draft.target) : draft.to ? [draft.to[0], draft.to[2]] : null;
    if (a) {
      out.push(<circle key="d0" cx={n3(a[0])} cy={n3(a[1])} r={1.6} className="snap" />);
      if (b) out.push(<path key="d1" d={`M${n3(a[0])} ${n3(a[1])}L${n3(b[0])} ${n3(b[1])}`} className="draft" />);
      if (draft.target && b) out.push(<circle key="d2" cx={n3(b[0])} cy={n3(b[1])} r={1.6} className="snap" />);
    }
  }
  return <g>{out}</g>;
});

/** The rectangle a part takes up, for rings round several parts. */
export function partsRect(model: InkModel, ids: readonly string[]): Rect | null {
  const pts: Vec2[] = [];
  for (const id of ids) {
    const pi = model.parts.get(id);
    if (pi) {
      const r = partBounds(pi);
      pts.push([r[0], r[1]], [r[2], r[3]]);
    }
  }
  return rectOfPoints(pts);
}

export { boxCorners };
