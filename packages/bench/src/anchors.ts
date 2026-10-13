// Anchor strings name every connectable point on the bench. See the Anchor type in types.ts.

import type { Anchor, HoleId, MeterSocket, ProbeColor } from "./types";

export const holeAnchor = (hole: HoleId): Anchor => `hole:${hole}`;
export const pinAnchor = (partId: string, leg: string): Anchor => `pin:${partId}.${leg}`;
export const wireAnchor = (wireId: string, end: "a" | "b"): Anchor => `wire:${wireId}.${end}`;
export const leadAnchor = (leadId: string, end: "a" | "b"): Anchor => `lead:${leadId}.${end}`;
export const probeAnchor = (color: ProbeColor): Anchor => `probe:${color}`;
export const socketAnchor = (socket: MeterSocket): Anchor => `socket:${socket}`;

export type ParsedAnchor =
  | { type: "hole"; hole: HoleId }
  | { type: "pin"; part: string; leg: string }
  | { type: "wire"; wire: string; end: "a" | "b" }
  | { type: "lead"; lead: string; end: "a" | "b" }
  | { type: "probe"; color: ProbeColor }
  | { type: "socket"; socket: MeterSocket };

export function parseAnchor(a: Anchor): ParsedAnchor | null {
  const i = a.indexOf(":");
  if (i < 0) return null;
  const type = a.slice(0, i);
  const rest = a.slice(i + 1);
  const dot = rest.lastIndexOf(".");
  switch (type) {
    case "hole":
      return { type, hole: rest };
    case "pin":
      return dot > 0 ? { type, part: rest.slice(0, dot), leg: rest.slice(dot + 1) } : null;
    case "wire":
    case "lead": {
      const end = rest.slice(dot + 1);
      if (dot <= 0 || (end !== "a" && end !== "b")) return null;
      return type === "wire" ? { type, wire: rest.slice(0, dot), end } : { type, lead: rest.slice(0, dot), end };
    }
    case "probe":
      return rest === "red" || rest === "black" ? { type, color: rest } : null;
    case "socket":
      return rest === "com" || rest === "vohm" || rest === "ma" || rest === "a10" ? { type, socket: rest } : null;
    default:
      return null;
  }
}
