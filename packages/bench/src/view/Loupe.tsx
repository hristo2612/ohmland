// The touch loupe both views show while a finger drags something on the bench: a lens twice life size held above the
// finger (which hides what it touches), with the point a drop would land on ringed in it and named in blue ink before
// the finger lifts. The views feed it (where the finger is, what it would land on) and draw the lens's picture: ink
// clones its drawing, 3D copies its canvas. No three.js here.

import { useSyncExternalStore, type ReactNode } from "react";
import { parseAnchor } from "../anchors";
import type { BenchLabels } from "../labels";
import type { Anchor, BenchState } from "../types";

/** CSS px relative to the bench element: the finger (`x`, `y`) and what a drop would land on, named. */
export type LoupeState = { x: number; y: number; name: string | null };

export type LoupeFeed = {
  get(): LoupeState | null;
  set(state: LoupeState | null): void;
  subscribe(cb: () => void): () => void;
};

export function createLoupeFeed(): LoupeFeed {
  let state: LoupeState | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      if (next === state || (next && state && next.x === state.x && next.y === state.y && next.name === state.name)) return;
      state = next;
      for (const cb of [...listeners]) cb();
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/** How near (CSS px) a finger must bring a clip or probe tip to a drop point for it to snap there. */
export const TOUCH_SNAP = 22;

/**
 * What a drag would land on, named for the loupe: a clip's or probe's snap point, the holes a part or a lead sits in.
 * `drag` is the views' own drag record (its `kind` and ids).
 */
export function dragName(bench: BenchState, drag: { kind: string; id?: string; leg?: string; end?: "a" | "b" }, snap: Anchor | null, labels: BenchLabels): string | null {
  if (drag.kind === "clip" || drag.kind === "probe") return snap ? loupeName(bench, snap, labels) : null;
  if (drag.kind === "part") return spanName(bench.parts.find((p) => p.id === drag.id)?.holes, labels);
  if (drag.kind === "leg") {
    const h = bench.parts.find((p) => p.id === drag.id)?.holes?.[drag.leg ?? ""];
    return h ? holeShort(h) : null;
  }
  if (drag.kind === "wireEnd") {
    const w = bench.wires.find((x) => x.id === drag.id);
    return w && drag.end ? holeShort(w[drag.end]) : null;
  }
  return null;
}

/** The lens: its size (CSS px), how much it magnifies, and how far above the finger it floats. */
export const LOUPE = { size: 128, zoom: 2, lift: 36 };

/** Where the lens sits for a finger at (x, y) in a bench of size w x h: above it, or beside it near the top edge. */
export function loupeBox(x: number, y: number, w: number, h: number): { left: number; top: number } {
  const d = LOUPE.size;
  const m = 6;
  let top = y - LOUPE.lift - d;
  let left = x - d / 2;
  if (top < m) {
    top = Math.min(Math.max(m, y - d / 2), h - d - m);
    left = x + LOUPE.lift + d < w - m ? x + LOUPE.lift : x - LOUPE.lift - d;
  }
  return { left: Math.min(Math.max(m, left), Math.max(m, w - d - m)), top: Math.max(m, top) };
}

/** A short name for a drop point: a hole ("a14", "+12"), a lead ("D1 long leg"), a clip, a probe tip. */
export function loupeName(bench: BenchState, anchor: Anchor, labels: BenchLabels): string {
  const p = parseAnchor(anchor);
  if (!p) return anchor;
  switch (p.type) {
    case "hole":
      return holeShort(p.hole);
    case "pin": {
      const leg = labels.loupe.legs[p.leg] ?? p.leg;
      return bench.parts.some((x) => x.id === p.part) ? `${p.part} ${leg}` : leg;
    }
    case "wire":
      return `${labels.wire} ${p.wire}`;
    case "lead":
      return `${labels.testLead} ${p.lead}`;
    case "probe":
      return labels.loupe.probe(labels.colors[p.color] ?? p.color);
    case "socket":
      return p.socket.toUpperCase();
    case "spot":
      return labels.solder.spot(p.spot);
  }
}

/** "c7" stays "c7"; rail holes read as "+21" or "-21". */
export function holeShort(id: string): string {
  const m = /^(tp|tn|bp|bn)(\d+)$/.exec(id);
  return m ? `${m[1]!.endsWith("p") ? "+" : "-"}${m[2]}` : id;
}

/** The holes a dragged part's leads sit in, as a name ("e10 to e11"), or null when it is not in the board. */
export function spanName(holes: Record<string, string | undefined> | undefined, labels: BenchLabels): string | null {
  const list = [...new Set(Object.values(holes ?? {}).filter((h): h is string => !!h))].map(holeShort);
  if (!list.length) return null;
  return list.length === 1 ? list[0]! : labels.loupe.span(list[0]!, list[list.length - 1]!);
}

const CSS = `
.ohl-loupe{position:absolute;z-index:6;border-radius:50%;overflow:visible;pointer-events:none}
.ohl-lens{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:var(--paper,#F6F2E9);border:2px solid var(--ink,#24221E);box-shadow:3px 3px 0 var(--shadow-ink,#E1D9CA)}
.ohl-lens>svg,.ohl-lens>canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.ohl-cross{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border:1.5px solid var(--blue,#2B4FB8);border-radius:50%}
.ohl-name{position:absolute;left:50%;top:-6px;transform:translate(-50%,-100%);white-space:nowrap;font-family:var(--font-hand,"Kalam",cursive);font-size:18px;line-height:1.1;color:var(--blue,#2B4FB8);background:var(--paper,#F6F2E9);padding:0 6px;border-radius:4px}
`;

/**
 * The lens, while a finger drags (the feed is set) and nothing else: `lens(state, size)` draws its picture, the bench as
 * it is under the finger, centred and `LOUPE.zoom` times larger. `size` is the bench element's size in CSS px.
 */
export function Loupe({ feed, size, lens }: { feed: LoupeFeed; size: { w: number; h: number }; lens: (state: LoupeState, d: number) => ReactNode }) {
  const state = useSyncExternalStore(feed.subscribe, feed.get, feed.get);
  if (!state) return null;
  const d = LOUPE.size;
  const { left, top } = loupeBox(state.x, state.y, size.w, size.h);
  return (
    <div className="ohl-loupe" data-loupe="" style={{ left, top, width: d, height: d }} aria-hidden="true">
      <style>{CSS}</style>
      <div className="ohl-lens">{lens(state, d)}</div>
      <span className="ohl-cross" />
      {state.name && (
        <span className="ohl-name" data-loupe-name="">
          {state.name}
        </span>
      )}
    </div>
  );
}
