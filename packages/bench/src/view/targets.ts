// Targets the controller understands (project, focus, spotlight), parsed and placed without a renderer.
// Pure: shared by the 3D and ink views.

import { parseAnchor } from "../anchors";
import { METER, anchorPosition, meterLocalToWorld, partPose, socketWorld } from "../layout";
import type { Anchor, BenchState, MeterSocket, Vec3 } from "../types";

/**
 * - `part:D1`: a whole part (or the meter, `part:M1`).
 * - `part:M1/display`, `part:M1/dial`, `part:M1/com` (any socket): spots on the meter.
 * - `lead:TL1`, `wire:W1`: a whole test lead or jumper wire.
 * - Any bench anchor: `hole:e12`, `pin:R1.a`, `wire:W1.a`, `lead:TL1.b`, `probe:red`, `socket:com`.
 */
export type ParsedTarget =
  | { type: "part"; id: string; sub: string | null }
  | { type: "lead"; id: string }
  | { type: "wire"; id: string }
  | { type: "anchor"; anchor: Anchor };

export const METER_SPOTS = ["display", "dial", "com", "vohm", "ma", "a10"] as const;

export function parseTarget(target: string): ParsedTarget | null {
  if (target.startsWith("part:")) {
    const rest = target.slice(5);
    const slash = rest.indexOf("/");
    const id = slash < 0 ? rest : rest.slice(0, slash);
    if (!id) return null;
    return { type: "part", id, sub: slash < 0 ? null : rest.slice(slash + 1) || null };
  }
  if (target.startsWith("lead:") && !target.includes(".")) return { type: "lead", id: target.slice(5) };
  if (target.startsWith("wire:") && !target.includes(".")) return { type: "wire", id: target.slice(5) };
  return parseAnchor(target) ? { type: "anchor", anchor: target } : null;
}

/** A spot on the meter in world coordinates (millimetres), or null for an unknown spot. */
export function meterSpot(bench: BenchState, sub: string): Vec3 | null {
  const m = bench.meter;
  if (!m) return null;
  if (sub === "display") {
    const { x0, x1, z0, z1 } = METER.lcd;
    return meterLocalToWorld(m, [(x0 + x1) / 2, METER.face + 0.6, (z0 + z1) / 2]);
  }
  if (sub === "dial") return meterLocalToWorld(m, [0, METER.face + 4, METER.dial.z]);
  if (sub in METER.sockets.xs) return socketWorld(m, sub as MeterSocket);
  return null;
}

/**
 * A representative world point for a target without looking at any model: the anchor itself, the middle of a
 * part's leads (a little above them), the middle of a lead or wire, or a meter spot.
 */
export function targetPoint(bench: BenchState, target: string): Vec3 | null {
  const t = parseTarget(target);
  if (!t) return null;
  switch (t.type) {
    case "anchor":
      return anchorPosition(bench, t.anchor);
    case "lead":
    case "wire": {
      const a = anchorPosition(bench, `${t.type}:${t.id}.a`);
      const b = anchorPosition(bench, `${t.type}:${t.id}.b`);
      if (!a || !b) return a ?? b;
      return [(a[0] + b[0]) / 2, Math.max(a[1], b[1]), (a[2] + b[2]) / 2];
    }
    case "part": {
      if (bench.meter && t.id === bench.meter.id) {
        if (t.sub) return meterSpot(bench, t.sub);
        return [bench.meter.pos[0], METER.height / 2, bench.meter.pos[1]];
      }
      const part = bench.parts.find((p) => p.id === t.id);
      if (!part) return null;
      const legs = Object.values(partPose(bench, part).legs);
      if (!legs.length) return [part.pos[0], 4, part.pos[1]];
      const n = legs.length;
      const c = legs.reduce<Vec3>((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n, s[2] + p[2] / n], [0, 0, 0]);
      return [c[0], c[1] + 2, c[2]];
    }
  }
}
