// The ink drawing as a clutter scene (src/cables/clutter.ts): cables, clips, probes and part outlines, as drawn. Pure.

import { parseAnchor } from "../anchors";
import { METER } from "../layout";
import { clutter, type Clutter, type ClutterBody, type ClutterCable, type ClutterEnd, type ClutterScene } from "../cables/clutter";
import { frameWithParts } from "../view/framing";
import type { Anchor } from "../types";
import { rectOfPoints, type Rect } from "./camera";
import { boxCorners } from "./frame";
import { partBounds, type InkModel } from "./model";

/** The bodies an anchor belongs to: the part it bites and that part's holder, the board, or the meter. */
function ownersOf(model: InkModel, to: Anchor | null, depth = 0): string[] {
  if (!to || depth > 3) return [];
  const a = parseAnchor(to);
  if (!a) return [];
  if (a.type === "pin") {
    const pi = model.parts.get(a.part);
    return pi?.pose.heldBy ? [a.part, pi.pose.heldBy] : [a.part];
  }
  if (a.type === "hole" || a.type === "wire") return ["board"];
  if (a.type === "probe" || a.type === "socket") return model.meter ? [model.meter.meter.id] : [];
  if (a.type === "lead") {
    const l = model.bench.leads.find((x) => x.id === a.lead);
    return l ? ownersOf(model, l[a.end].to, depth + 1) : [];
  }
  return [];
}

export function inkScene(model: InkModel, labFrame: Rect | null = null): ClutterScene {
  const bodies: ClutterBody[] = [];
  for (const pi of model.parts.values()) {
    if (pi.pose.under || pi.part.kind === "gate") continue;
    const held = (pi.part.params as { held?: Record<string, string | undefined> }).held;
    const family = [...(pi.pose.heldBy ? [pi.pose.heldBy] : []), ...(held ? (Object.values(held).filter(Boolean) as string[]) : [])];
    bodies.push({ id: pi.part.id, poly: boxCorners(pi.f, pi.box), solid: pi.mount === "desk" && !pi.pose.heldBy, family });
  }
  if (model.meter) {
    const m = model.meter;
    bodies.push({ id: m.meter.id, poly: boxCorners(m.f, [-METER.width / 2, -METER.length / 2, METER.width / 2, METER.length / 2]), solid: true, family: [] });
  }
  const cables: ClutterCable[] = [];
  for (const li of model.leads.values()) {
    const end = (e: typeof li.a, to: Anchor | null): ClutterEnd => ({ tip: e.tip, tail: e.tail, attached: e.attached, owners: ownersOf(model, to) });
    cables.push({ id: li.lead.id, a: end(li.a, li.lead.a.to), b: end(li.b, li.lead.b.to), cable: li.cable });
  }
  if (model.meter) {
    for (const c of ["red", "black"] as const) {
      const pr = model.meter.probes[c];
      const owners = ownersOf(model, model.bench.meter!.probes[c].tip.to);
      cables.push({
        id: `probe:${c}`,
        a: { tip: pr.tip, tail: pr.back, attached: pr.attached, owners },
        b: { tip: pr.plug.at, tail: pr.plug.top, attached: pr.plug.inSocket, owners: [model.meter.meter.id] },
        cable: pr.cablePts,
      });
    }
  }
  // The frame the view opens on (BenchInk's home): a lab's frame with the parts that poke out of it, else everything.
  const f = labFrame;
  let frame: Rect;
  if (f) {
    const boxes = [...model.parts.values()].map(partBounds);
    if (model.meter) boxes.push(rectOfPoints(boxCorners(model.meter.f, [-METER.width / 2, -METER.length / 2, METER.width / 2, METER.length / 2]))!);
    frame = frameWithParts(f, boxes);
  } else frame = model.bounds;
  return { cables, bodies, frame: [frame[0] - 4, frame[1] - 4, frame[2] + 4, frame[3] + 4] };
}

/** Clutter of the ink drawing. `frame`: the lab's frame (the desk rectangle the view opens on), if it has one. */
export function inkClutter(model: InkModel, frame: Rect | null = null): Clutter {
  return clutter(inkScene(model, frame));
}
