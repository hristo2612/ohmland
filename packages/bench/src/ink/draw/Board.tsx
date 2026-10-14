// The breadboard, top down: plastic body, centre channel, printed rail lines, holes and labels (static, drawn once),
// and the x-ray layer of metal clips under the plastic (redrawn only when x-ray or the hovered group changes).

import { memo, useMemo } from "react";
import { BOARD_PRINT, PITCH, ROWS, boardGeometry, boardOrigin, rowZ } from "../../board";
import type { BoardSpec } from "../../types";

const HOLE = 1.1;
const HOLE_IN = 0.5;

function f(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** One path of little squares: the cheapest way to draw 830 holes. */
function squares(points: [number, number][], size: number): string {
  const h = size / 2;
  let d = "";
  for (const [x, z] of points) d += `M${f(x - h)} ${f(z - h)}h${size}v${size}h${-size}z`;
  return d;
}

export const BoardBase = memo(function BoardBase({ spec }: { spec: BoardSpec }) {
  const g = boardGeometry(spec);
  const [ox, oz] = boardOrigin(spec);
  const w = g.width;
  const d = g.depth;
  const railX0 = (g.railCols[0]! - (g.cols + 1) / 2) * PITCH - 2.2;
  const railX1 = (g.railCols[g.railCols.length - 1]! - (g.cols + 1) / 2) * PITCH + 2.2;
  const midX = ((g.railCols[24] ?? 0) + (g.railCols[25] ?? 0)) / 2;
  const splitX = (midX - (g.cols + 1) / 2) * PITCH;
  const lines: { z: number; pos: boolean }[] = [
    { z: BOARD_PRINT.farRed, pos: true },
    { z: BOARD_PRINT.farBlue, pos: false },
    { z: BOARD_PRINT.nearRed, pos: true },
    { z: BOARD_PRINT.nearBlue, pos: false },
  ];
  const segs = g.splitRails
    ? [
        [railX0, splitX - 2.4],
        [splitX + 2.4, railX1],
      ]
    : [[railX0, railX1]];
  return (
    <g transform={`translate(${ox} ${oz})`} data-own="board">
      <rect x={-w / 2 + 1.1} y={-d / 2 + 1.3} width={w} height={d} rx={1.2} className="f-shade" />
      <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={1.2} className="f-board" />
      <rect x={-w / 2 + 2.6} y={-BOARD_PRINT.channelHalfWidth} width={w - 5.2} height={BOARD_PRINT.channelHalfWidth * 2} className="f-channel" />
      <path d={`M${-w / 2 + 2.6} ${-BOARD_PRINT.channelHalfWidth}H${w / 2 - 2.6}M${-w / 2 + 2.6} ${BOARD_PRINT.channelHalfWidth}H${w / 2 - 2.6}`} className="ln-thin" />
      {lines.map((l) =>
        segs.map(([a, b], i) => <path key={`${l.z}:${i}`} d={`M${f(a!)} ${f(l.z)}H${f(b!)}`} className={l.pos ? "s-rail-pos" : "s-rail-neg"} strokeWidth={0.42} strokeLinecap="round" />),
      )}
      <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={1.2} className="ln" />
    </g>
  );
});

export const BoardHoles = memo(function BoardHoles({ spec }: { spec: BoardSpec }) {
  const g = boardGeometry(spec);
  const [ox, oz] = boardOrigin(spec);
  const { outer, inner } = useMemo(() => {
    const pts: [number, number][] = [];
    for (const h of g.holes.values()) pts.push([h.x, h.z]);
    return { outer: squares(pts, HOLE), inner: squares(pts, HOLE_IN) };
  }, [g]);
  const mid = (g.cols + 1) / 2;
  const numbers: number[] = [1];
  for (let c = 5; c <= g.cols; c += 5) numbers.push(c);
  const railEndX = [(g.railCols[0]! - mid) * PITCH - 3.4, (g.railCols[g.railCols.length - 1]! - mid) * PITCH + 3.4];
  const signs: { z: number; t: string; pos: boolean }[] = [
    { z: rowZ("tp"), t: "+", pos: true },
    { z: rowZ("tn"), t: "−", pos: false },
    { z: rowZ("bp"), t: "+", pos: true },
    { z: rowZ("bn"), t: "−", pos: false },
  ];
  return (
    <g transform={`translate(${ox} ${oz})`} data-own="board">
      <path d={outer} className="f-hole" />
      <path d={inner} className="f-hole-in lod1" />
      <g className="lod1" fontSize={1.75} textAnchor="middle">
        {numbers.map((c) => (
          <g key={c}>
            <text x={f((c - mid) * PITCH)} y={f(BOARD_PRINT.farNumbers + 0.6)} className="print">
              {c}
            </text>
            <text x={f((c - mid) * PITCH)} y={f(BOARD_PRINT.nearNumbers + 0.6)} className="print">
              {c}
            </text>
          </g>
        ))}
        {ROWS.map((r) => (
          <g key={r}>
            <text x={f(-g.width / 2 + 2.1)} y={f(rowZ(r) + 0.6)} className="print">
              {r}
            </text>
            <text x={f(g.width / 2 - 2.1)} y={f(rowZ(r) + 0.6)} className="print">
              {r}
            </text>
          </g>
        ))}
        {signs.map((s) =>
          railEndX.map((x, i) => (
            <text key={`${s.z}:${i}`} x={f(x)} y={f(s.z + 0.85)} fontSize={2.6} fontWeight={700} className={s.pos ? "t-rail-pos" : "t-rail-neg"}>
              {s.t}
            </text>
          )),
        )}
      </g>
    </g>
  );
});

/** The metal clips under the board: all of them in x-ray mode, plus the group joined to the hovered point. */
export const BoardXray = memo(function BoardXray({ spec, all, lit }: { spec: BoardSpec; all: boolean; lit: ReadonlySet<string> | null }) {
  const g = boardGeometry(spec);
  const [ox, oz] = boardOrigin(spec);
  if (!all && (!lit || !lit.size)) return null;
  const r = 0.95;
  const strips = [...g.strips.values()].filter((s) => all || lit?.has(s.id));
  return (
    <g transform={`translate(${ox} ${oz})`} data-own="board">
      {strips.map((s) => (
        <rect
          key={s.id}
          x={f(s.x0 - r)}
          y={f(s.z0 - r)}
          width={f(s.x1 - s.x0 + r * 2)}
          height={f(s.z1 - s.z0 + r * 2)}
          rx={r}
          className={lit?.has(s.id) ? "strip lit" : "strip"}
        />
      ))}
    </g>
  );
});
