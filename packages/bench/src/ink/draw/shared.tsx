// Shared bits for the ink layers: SVG defs, and live simulator state per part.

import { createContext, useContext, useMemo } from "react";
import { useStore } from "zustand";
import type { PartState } from "@ohmland/sim";
import type { BenchStore } from "../../store";

export { n3 } from "../frame";

/** Prefix for this bench's SVG ids (several benches can share a page). */
export const DefsContext = createContext("ohi");

export function useDefs(): string {
  return useContext(DefsContext);
}

export const LED_COLORS = ["red", "green", "yellow", "blue", "white", "orange"] as const;

/** What a part's look depends on, as a string: health, glow (2% steps), contacts, display, armature, blown, beep. */
export function visualKey(p: PartState | undefined): string {
  if (!p) return "";
  const arm = typeof p.extra?.["armature"] === "number" ? Math.round((p.extra["armature"] as number) * 20) : "";
  const blown = p.extra?.["blown"] === true ? 1 : 0;
  const beep = p.extra?.["beep"] === true ? 1 : 0;
  return `${p.health}|${Math.round((p.glow ?? 0) * 50)}|${p.closed ? 1 : 0}|${p.display ?? ""}|${p.unit ?? ""}|${arm}|${blown}|${beep}`;
}

/** A part's simulator state, re-rendering only when something visible changes (not 30 times a second). */
export function useLive(store: BenchStore, id: string): PartState | null {
  const key = useStore(store, (s) => visualKey(s.snapshot?.parts[id]));
  return useMemo(() => (store.getState().snapshot?.parts[id] as PartState | undefined) ?? null, [store, id, key]);
}

/** Patterns and gradients, once per bench. */
export function InkDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-hatch`} patternUnits="userSpaceOnUse" width="1.6" height="1.6" patternTransform="rotate(45)">
        <path d="M0 0V1.6" style={{ stroke: "var(--k-ink)", strokeWidth: 0.28, opacity: 0.45 }} />
      </pattern>
      <pattern id={`${id}-hatch-big`} patternUnits="userSpaceOnUse" width="3.2" height="3.2" patternTransform="rotate(45)">
        <path d="M0 0V3.2" style={{ stroke: "var(--k-ink)", strokeWidth: 0.35, opacity: 0.3 }} />
      </pattern>
      <pattern id={`${id}-push`} patternUnits="userSpaceOnUse" width="2.2" height="2.2" patternTransform="rotate(-35)">
        <path d="M0 0V2.2" style={{ stroke: "var(--k-red)", strokeWidth: 0.4, opacity: 0.75 }} />
      </pattern>
      <pattern id={`${id}-speckle`} patternUnits="userSpaceOnUse" width="5" height="5">
        <path d="M0.6 0.8h0.4M3.1 2.2h0.4M1.8 3.9h0.4M4.2 4.4h0.3" style={{ stroke: "var(--k-ink-3)", strokeWidth: 0.35, opacity: 0.5 }} />
      </pattern>
      {LED_COLORS.map((c) => (
        <radialGradient key={c} id={`${id}-glow-${c}`}>
          <stop offset="0" style={{ stopColor: "var(--k-glow-core)", stopOpacity: 0.95 }} />
          <stop offset="0.18" style={{ stopColor: `var(--k-glow-${c})`, stopOpacity: 0.85 }} />
          <stop offset="0.55" style={{ stopColor: `var(--k-glow-${c})`, stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: `var(--k-glow-${c})`, stopOpacity: 0 }} />
        </radialGradient>
      ))}
      <radialGradient id={`${id}-smudge`}>
        <stop offset="0" style={{ stopColor: "var(--k-scorch)", stopOpacity: 0.85 }} />
        <stop offset="1" style={{ stopColor: "var(--k-scorch)", stopOpacity: 0 }} />
      </radialGradient>
    </defs>
  );
}
