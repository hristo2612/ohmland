// The logic probe's reading and what both bench views need to draw live Unit 4 parts. No three.js: shared by the 3D
// and ink views.
//
// The probe draws no current, so the simulator has no part for it: its lamps read the node voltages of the latest
// snapshot at the nodes its tip and its two supply leads are on (worked out with the same mapping as the netlist).

import { useMemo, useRef } from "react";
import { useStore } from "zustand";
import type { PartState } from "@ohmland/sim";
import { SEGMENTS } from "./chips";
import { benchToNetlist } from "./netlist";
import type { BenchStore } from "./store";
import type { BenchState } from "./types";

export type ProbeLevel = "H" | "L" | null;

export type ProbeReading = {
  /** Its supply leads see at least 3 V between them. */
  powered: boolean;
  /** HIGH above 70% of its supply, LOW below 30%; null between, floating or unpowered. */
  level: ProbeLevel;
  /** Volts at the tip (null when the tip touches nothing the circuit drives). */
  volts: number | null;
  /** Volts between its red and black leads. */
  supply: number;
};

const nodeOfCache = new WeakMap<BenchState, (anchor: string) => string>();

function nodeOfFor(bench: BenchState): (anchor: string) => string {
  let f = nodeOfCache.get(bench);
  if (!f) {
    f = benchToNetlist(bench).nodeOf;
    nodeOfCache.set(bench, f);
  }
  return f;
}

/** What logic probe `id` reads from these node voltages (a snapshot's `nodes`). */
export function logicProbeReading(bench: BenchState, nodes: Record<string, number> | null | undefined, id: string): ProbeReading {
  const nodeOf = nodeOfFor(bench);
  const at = (leg: string): number | null => {
    const n = nodeOf(`pin:${id}.${leg}`);
    const v = nodes?.[n];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const vcc = at("vcc");
  const gnd = at("gnd");
  const tip = at("tip");
  const supply = vcc !== null && gnd !== null ? vcc - gnd : 0;
  const powered = supply >= 3;
  if (!powered || tip === null || gnd === null) return { powered, level: null, volts: tip, supply };
  const f = (tip - gnd) / supply;
  return { powered, level: f > 0.7 ? "H" : f < 0.3 ? "L" : null, volts: tip, supply };
}

/** How long the PULSE lamp stays lit after the level changes (simulated seconds). */
export const PULSE_HOLD = 0.1;

/**
 * Live state of a logic probe, shaped like a simulator part state (`extra.powered`, `extra.level` "H" / "L" / "",
 * `extra.pulse`), for the probe's model. Re-renders only when a lamp changes. `active` false returns null at no cost
 * (call it for every part; only probes use it).
 */
export function useProbeState(store: BenchStore, id: string, active: boolean): PartState | null {
  const mem = useRef<{ t: number; level: ProbeLevel; powered: boolean; edge: number }>({ t: -1, level: null, powered: false, edge: -Infinity });
  const key = useStore(store, (s) => {
    if (!active) return "";
    const snap = s.snapshot;
    if (!snap) return "0||0";
    const m = mem.current;
    if (snap.t !== m.t) {
      const r = logicProbeReading(s.bench, snap.nodes, id);
      if (m.t >= 0 && r.powered && m.powered && r.level !== m.level) m.edge = snap.t;
      m.t = snap.t;
      m.level = r.level;
      m.powered = r.powered;
    }
    const pulse = m.powered && snap.t - m.edge < PULSE_HOLD && snap.t >= m.edge;
    return `${m.powered ? 1 : 0}|${m.level ?? ""}|${pulse ? 1 : 0}`;
  });
  return useMemo(() => {
    if (!active) return null;
    const [powered, level, pulse] = key.split("|");
    return { i: 0, v: 0, p: 0, temp: 25, health: "ok", extra: { powered: powered === "1", level: level ?? "", pulse: pulse === "1" } };
  }, [key, active]);
}

/**
 * The part of a live look that lives in `extra`: the 7-segment display's glow per segment (4% steps) and its dead
 * segments, and a chip's or regulator's warmth (8 degree steps). Both views add it to their visual keys.
 */
export function extraLookKey(p: PartState): string {
  const x = p.extra;
  if (!x) return "";
  let out = "";
  if (typeof x["lit"] === "string") {
    for (const s of SEGMENTS) out += Math.round(Math.max(0, Math.min(1, (x[s] as number) ?? 0)) * 25).toString(36);
    out += `|${x["dead"] ?? ""}`;
  }
  if ("powered" in x || "caseTemp" in x) out += `|t${Math.round((p.temp ?? 25) / 8)}`;
  return out;
}
