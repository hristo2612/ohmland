/**
 * The island as an ink sketch in the notebook: a floating chunk of circuit board drawn in isometric, graphite outlines,
 * hatched shadow sides and copper traces. A unit's landmarks stand on it: drawn and labelled in pencil once built,
 * dashed while they are still to come. It costs no JavaScript (plain SVG) and stands in for the live 3D island
 * (packages/isle) on the course map, in the finale and wherever 3D is unavailable.
 */
import { useId, type ReactNode } from "react";
import "./isle-art.css";

const U = 22; // pixels per tile edge
const OX = 400; // screen origin
const OY = 92;
const W = 10; // board tiles
const D = 8;

type V3 = [number, number, number];
const P = ([x, y, z]: V3): [number, number] => [OX + (x - y) * U, OY + ((x + y) * U) / 2 - z * U];
const pts = (list: V3[]) => list.map((v) => P(v).map((n) => n.toFixed(1)).join(",")).join(" ");

/** An isometric box: its top, its lit left face and its hatched right face. */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hatch: string, key?: string): ReactNode {
  return (
    <g key={key}>
      <polygon className="ia-face" points={pts([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]])} />
      <polygon className="ia-face ia-side" points={pts([[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]])} />
      <polygon className="ia-face ia-shade" points={pts([[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]])} style={{ fill: hatch }} />
      <polygon className="ia-face" points={pts([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])} />
    </g>
  );
}

type Shape = "tower" | "hall" | "lighthouse" | "observatory" | "station" | "grove";
const SHAPES: Shape[] = ["tower", "hall", "lighthouse", "observatory", "station", "grove"];

/** Where each landmark stands (tile x, y), in module order. */
const SLOTS: { x: number; y: number }[] = [
  { x: 6.6, y: 0.9 },
  { x: 1.2, y: 1.6 },
  { x: 7.4, y: 4.2 },
  { x: 3.7, y: 3.2 },
  { x: 1.5, y: 5.3 },
  { x: 4.6, y: 6.0 },
];

/** Draws one landmark at (x, y); returns the drawing and the point its label line ends at. */
function landmark(shape: Shape, x: number, y: number, hatch: string, lit: boolean): { node: ReactNode; top: [number, number] } {
  switch (shape) {
    case "tower": {
      const [ax, ay] = P([x + 0.5, y + 0.5, 3.1]);
      const [wx, wy] = P([x + 0.5, y + 1, 2.2]);
      return {
        node: (
          <>
            {box(x, y, 0, x + 1, y + 1, 2.6, hatch)}
            <circle className="ia-face" cx={wx - 11} cy={wy - 4} r={3.5} />
            <path className="ia-line" d={`M${ax} ${ay + 11}V${ay - 6}`} />
            <circle className="ia-dot" cx={ax} cy={ay - 8} r={2.6} />
          </>
        ),
        top: [ax, ay - 12],
      };
    }
    case "hall": {
      const bands = [0.45, 0.85, 1.25].map((t) => {
        const [x0, y0] = P([x + t, y, 0.9]);
        const [x1, y1] = P([x + t, y + 1, 0.9]);
        return <path key={t} className="ia-copper" d={`M${x0} ${y0}L${x1} ${y1}`} />;
      });
      return { node: <>{box(x, y, 0, x + 2.2, y + 1, 0.9, hatch)}{bands}</>, top: P([x + 1.1, y + 0.5, 1.1]) };
    }
    case "lighthouse": {
      const [lx, ly] = P([x + 0.4, y + 0.4, 2.85]);
      return {
        node: (
          <>
            {box(x, y, 0, x + 0.8, y + 0.8, 2.4, hatch)}
            {lit && <circle className="ia-glow" cx={lx} cy={ly} r={18} />}
            {box(x + 0.1, y + 0.1, 2.4, x + 0.7, y + 0.7, 2.85, hatch)}
            <circle className={lit ? "ia-lamp ia-lamp--lit" : "ia-lamp"} cx={lx} cy={ly - 1} r={4} />
          </>
        ),
        top: [lx, ly - 10],
      };
    }
    case "observatory": {
      const [cx, cy] = P([x + 0.7, y + 0.7, 1]);
      return {
        node: (
          <>
            {box(x, y, 0, x + 1.4, y + 1.4, 1, hatch)}
            <path className="ia-face" d={`M${cx - 15} ${cy}a15 15 0 0 1 30 0z`} />
            <path className="ia-line" d={`M${cx + 2} ${cy - 10}l10 -10`} />
          </>
        ),
        top: [cx, cy - 16],
      };
    }
    case "station": {
      const [sx, sy] = P([x + 1.25, y + 0.25, 2.1]);
      return {
        node: (
          <>
            {box(x, y, 0, x + 1.6, y + 1.2, 1.1, hatch)}
            {box(x + 1.05, y + 0.05, 1.1, x + 1.45, y + 0.45, 2.1, hatch)}
            <path className="ia-smoke" d={`M${sx} ${sy - 4}c-6 -6 6 -10 0 -18`} />
          </>
        ),
        top: [sx, sy - 24],
      };
    }
    case "grove": {
      const trees = [
        [x + 0.3, y + 0.3],
        [x + 1.1, y + 0.2],
        [x + 0.7, y + 0.9],
      ].map(([tx, ty], i) => {
        const [bx, by] = P([tx!, ty!, 0]);
        return (
          <g key={i}>
            <path className="ia-line" d={`M${bx} ${by}v-16`} />
            <circle className="ia-face" cx={bx} cy={by - 22} r={9} />
            <circle className="ia-fruit" cx={bx + 3} cy={by - 24} r={2.2} />
          </g>
        );
      });
      return { node: <>{trees}</>, top: P([x + 0.7, y + 0.5, 1.6]) };
    }
  }
}

/** A blue handwritten note above a landmark, with a short pencil arrow down to it. */
function IsleNote({ at, text }: { at: [number, number]; text: string }) {
  const x = Math.max(300, Math.min(544, at[0]));
  const y = Math.max(52, at[1] - 34);
  return (
    <g className="ia-you">
      <text className="ia-you__text" x={x} y={y} textAnchor="middle">
        {text}
      </text>
      <path className="ia-you__arrow" d={`M${x + 4} ${y + 7}Q${at[0] + 6} ${y + 14} ${at[0]} ${at[1] - 4}M${at[0] - 5} ${at[1] - 11}L${at[0]} ${at[1] - 4}L${at[0] + 6} ${at[1] - 10}`} />
    </g>
  );
}

export type IsleArtLandmark = { name: string; built: boolean; current?: boolean };

/**
 * `landmarks` (up to six, in module order) stand on the island, built or still pencilled in. `note`, when given, is
 * written in blue beside the current one (what you are building now).
 */
export function IsleArt({ label, className, landmarks, note }: { label?: string; className?: string; landmarks?: IsleArtLandmark[]; note?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hatch = `url(#ia-hatch-${id})`;
  const light = `url(#ia-light-${id})`;
  const marks = landmarks ?? [];
  const showLabels = marks.length > 0; // a unit's own island; otherwise a generic one

  const items: { depth: number; node: ReactNode }[] = [];
  let noteAt: [number, number] | null = null;
  marks.slice(0, SLOTS.length).forEach((lm, i) => {
    // a landmark appears once it is built; the one you are building now is pencilled in
    if (!lm.built && !lm.current) return;
    const slot = SLOTS[i]!;
    const { node, top } = landmark(SHAPES[i % SHAPES.length]!, slot.x, slot.y, hatch, lm.built);
    items.push({ depth: slot.x + slot.y, node: <g key={`lm-${i}`} className={lm.built ? "ia-mark" : "ia-mark ia-plan"}>{node}</g> });
    if (lm.current) noteAt = top;
  });
  // A few small pieces, so the board is never bare.
  const pieces: [number, number][] = showLabels ? [[4.9, 1.6], [8.6, 6.6], [2.9, 6.9]] : [[2, 2], [5.2, 1.5], [7.4, 4.6], [3.5, 5.6], [6, 6.2]];
  pieces.forEach(([px, py], i) => items.push({ depth: px + py, node: box(px, py, 0, px + 0.5, py + 0.5, 0.35, hatch, `p-${i}`) }));
  if (!showLabels) {
    items.push({ depth: 2.6, node: <g key="t">{landmark("tower", 1.1, 1.2, hatch, false).node}</g> });
    items.push({ depth: 9.4, node: <g key="h">{landmark("hall", 4.6, 3.6, hatch, false).node}</g> });
  }
  items.sort((a, b) => a.depth - b.depth);

  const trace = (path: [number, number][], key: string) => (
    <path key={key} className="ia-trace" d={path.map(([x, y], i) => `${i ? "L" : "M"}${P([x, y, 0]).join(" ")}`).join(" ")} />
  );
  const [shx, shy] = P([8, 6, -6.4]);
  // Depth of the torn underside below each front edge (fraction along the edge, tiles down), meeting at a tip.
  const LEFT: [number, number][] = [[0, 0], [0.16, 0.7], [0.28, 0.55], [0.46, 1.3], [0.6, 1.15], [0.78, 2.1], [0.9, 1.9], [1, 3]];
  const RIGHT: [number, number][] = [[0, 3], [0.14, 2], [0.3, 2.2], [0.5, 1.25], [0.66, 1.4], [0.84, 0.6], [1, 0]];
  const underLeft = pts([...LEFT.map(([t, d]): V3 => [t * W, D, -0.4 - d]), [W, D, -0.4]]);
  const underRight = pts([[W, D, -0.4], ...RIGHT.map(([t, d]): V3 => [W, D - t * D, -0.4 - d])]);

  return (
    <svg
      className={className ? `isle-art ${className}` : "isle-art"}
      viewBox="196 30 452 360"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    >
      <defs>
        <pattern id={`ia-hatch-${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V5" className="ia-hatch" />
        </pattern>
        <pattern id={`ia-light-${id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V7" className="ia-hatch ia-hatch--light" />
        </pattern>
      </defs>
      <ellipse className="ia-shadow" cx={shx} cy={shy} rx={70} ry={7} />
      {/* The underside: torn board layers hanging under the front edges, lit on the left, in shadow on the right. */}
      <polygon className="ia-under" points={underLeft} />
      <polygon className="ia-under ia-under--hatch" style={{ fill: light }} points={underLeft} />
      <polygon className="ia-under" points={underRight} />
      <polygon className="ia-under ia-under--hatch" style={{ fill: hatch }} points={underRight} />
      {box(0, 0, -0.4, W, D, 0, hatch)}
      {trace([[0.6, 4.2], [3.4, 4.2], [3.4, 2.4], [6.2, 2.4]], "t1")}
      {trace([[9.4, 3.2], [6.6, 3.2], [6.6, 7.4]], "t2")}
      {trace([[1, 7.4], [1, 6.6], [3.2, 6.6]], "t3")}
      {[[0.6, 4.2], [6.2, 2.4], [9.4, 3.2], [6.6, 7.4], [3.2, 6.6]].map(([x, y], i) => {
        const [cx, cy] = P([x!, y!, 0]);
        return <ellipse key={`v${i}`} className="ia-via" cx={cx} cy={cy} rx={4.5} ry={2.4} />;
      })}
      {items.map((it) => it.node)}
      {note && noteAt && <IsleNote at={noteAt} text={note} />}
    </svg>
  );
}
