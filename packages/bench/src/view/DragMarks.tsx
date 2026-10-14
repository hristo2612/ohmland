// Where a drag would land, drawn over either view in screen space (view/drag.ts computes it): the drop points glow
// in blue ink (a part's legs as ghost marks on their holes, the terminal a clip would bite), other drop points near
// the dragged tip glow faintly, a quiet graphite cross marks a spot where a drop would not take, and the target's name
// is written in ink beside it. The loupe shows the same marks in its lens on touch. No three.js here.

import { useSyncExternalStore } from "react";
import type { DragMarksState, Feed, Pt } from "./drag";
import { LOUPE } from "./Loupe";

const CSS = `
.ohl-marks{position:absolute;inset:0;width:100%;height:100%;z-index:5;pointer-events:none;overflow:visible}
.ohl-marks .g-halo{fill:var(--blue,#2B4FB8);opacity:.16}
.ohl-marks .g-ring{fill:none;stroke:var(--blue,#2B4FB8);stroke-width:2}
.ohl-marks .g-dot{fill:var(--blue,#2B4FB8)}
.ohl-marks .n-ring{fill:none;stroke:var(--blue,#2B4FB8);stroke-width:1.5;opacity:.38}
.ohl-marks .x-mark{fill:none;stroke:var(--ink-2,#57524A);stroke-width:1.75;stroke-linecap:round;opacity:.6}
.ohl-dname{position:absolute;z-index:5;pointer-events:none;transform:translate(-50%,-100%);white-space:nowrap;font-family:var(--font-hand,"Kalam",cursive);font-size:17px;line-height:1.1;color:var(--blue,#2B4FB8);background:var(--paper,#F6F2E9);padding:0 6px;border-radius:4px}
@media (prefers-reduced-motion:no-preference){.ohl-marks g,.ohl-dname{animation:ohl-in .12s ease-out}}
@keyframes ohl-in{from{opacity:0}}
`;

function Marks({ s, map, k = 1 }: { s: DragMarksState; map: (p: Pt) => Pt; k?: number }) {
  const r = s.r * k;
  return (
    <>
      {s.near.map((p0, i) => {
        const p = map(p0);
        return <circle key={`n${i}`} cx={p.x} cy={p.y} r={r * 0.85} className="n-ring" />;
      })}
      {s.ghosts.map((p0, i) => {
        const p = map(p0);
        return (
          <g key={`g${i}`} data-drag-ghost="">
            <circle cx={p.x} cy={p.y} r={r * 1.7} className="g-halo" />
            <circle cx={p.x} cy={p.y} r={r} className="g-ring" />
            <circle cx={p.x} cy={p.y} r={Math.max(1.4, r * 0.26)} className="g-dot" />
          </g>
        );
      })}
      {s.cross &&
        (() => {
          const p = map(s.cross);
          return (
            <g data-drag-cross="">
              <path d={`M${p.x - 6} ${p.y - 6}L${p.x + 6} ${p.y + 6}M${p.x + 6} ${p.y - 6}L${p.x - 6} ${p.y + 6}`} className="x-mark" />
            </g>
          );
        })()}
    </>
  );
}

/** The marks over the bench, with the target's name beside it (a finger's drag leaves the name to the loupe). */
export function DragMarks({ feed }: { feed: Feed<DragMarksState> }) {
  const s = useSyncExternalStore(feed.subscribe, feed.get, feed.get);
  if (!s) return null;
  const id = (p: Pt) => p;
  return (
    <>
      <style>{CSS}</style>
      <svg className="ohl-marks" data-drag-marks="" aria-hidden="true">
        <Marks s={s} map={id} />
      </svg>
      {s.name && (
        <span className="ohl-dname" data-drag-name="" style={{ left: s.name.at.x, top: s.name.at.y - s.r * 1.7 - 2 }}>
          {s.name.text}
        </span>
      )}
    </>
  );
}

/** The same marks inside the loupe's lens, which shows the bench round (x, y) `LOUPE.zoom` times larger. */
export function LensMarks({ feed, x, y, d }: { feed: Feed<DragMarksState>; x: number; y: number; d: number }) {
  const s = useSyncExternalStore(feed.subscribe, feed.get, feed.get);
  if (!s) return null;
  const map = (p: Pt): Pt => ({ x: d / 2 + (p.x - x) * LOUPE.zoom, y: d / 2 + (p.y - y) * LOUPE.zoom });
  return (
    <svg className="ohl-marks" viewBox={`0 0 ${d} ${d}`} aria-hidden="true">
      <Marks s={{ ...s, near: [] }} map={map} k={LOUPE.zoom} />
    </svg>
  );
}
