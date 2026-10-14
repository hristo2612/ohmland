// Small ink drawings the solder overlay uses in screen space (the same in both views): the iron and the solder wire
// in the learner's hand, a joint seen side on under the magnifier, and heat hatching.

import type { ReactNode } from "react";
import type { JointLook } from "../joint";

const f = (n: number) => Math.round(n * 100) / 100;

/** The iron as held: tip at (0, 0), the handle up and to the right, `len` px long. */
export function HeldIron({ len = 150, angle = -38 }: { len?: number; angle?: number }) {
  const L = len;
  return (
    <g transform={`rotate(${angle})`} className="ohs-iron">
      {/* tip, shaft, grip, cord */}
      <path d={`M0 0L${f(L * 0.12)} -2.4L${f(L * 0.12)} 2.4Z`} className="ohs-tip" />
      <rect x={f(L * 0.12)} y={-2.6} width={f(L * 0.3)} height={5.2} rx={1.2} className="ohs-shaft" />
      <rect x={f(L * 0.4)} y={-5.5} width={f(L * 0.08)} height={11} rx={2} className="ohs-collar" />
      <rect x={f(L * 0.47)} y={-6.5} width={f(L * 0.45)} height={13} rx={6} className="ohs-grip" />
      <path d={`M${f(L * 0.53)} -6.5v13M${f(L * 0.6)} -6.5v13M${f(L * 0.67)} -6.5v13`} className="ohs-ln-soft" />
      <path d={`M${f(L * 0.92)} 0C${f(L * 1.05)} 0 ${f(L * 1.1)} 10 ${f(L * 1.2)} 18`} className="ohs-cord" />
    </g>
  );
}

/** A length of solder wire from the spool's end `a` to the learner's hand `b` (screen px). */
export function SolderWire({ a, b }: { a: [number, number]; b: [number, number] }) {
  const mx = (a[0] + b[0]) / 2;
  const my = Math.max(a[1], b[1]) + 18;
  return (
    <g className="ohs-wire">
      <path d={`M${f(a[0])} ${f(a[1])}Q${f(mx)} ${f(my)} ${f(b[0])} ${f(b[1])}`} className="ohs-solder-edge" />
      <path d={`M${f(a[0])} ${f(a[1])}Q${f(mx)} ${f(my)} ${f(b[0])} ${f(b[1])}`} className="ohs-solder" />
      <circle cx={f(b[0])} cy={f(b[1])} r={3} className="ohs-solder-end" />
    </g>
  );
}

/**
 * A joint seen side on, drawn big: the pad on the board, the lead coming through, and the solder's shape. 200 x 130
 * units, the pad's top at y 90.
 */
export function JointSide({ look, lead = true }: { look: JointLook | null; lead?: boolean }) {
  const y = 90;
  const v = Math.min(3, look?.volume ?? 0);
  const shape = look?.shape ?? "none";
  const fin = look?.finish ?? "bright";
  const fill = fin === "dark" ? "ohs-solder-dark" : fin === "dull" ? "ohs-solder-dull" : fin === "liquid" ? "ohs-solder-liquid" : "ohs-solder-fill";
  const lift = look?.lifted ? 7 : 0;
  const parts: ReactNode[] = [];
  // Board and pad.
  parts.push(<rect key="board" x={10} y={y} width={180} height={14} className="ohs-board" />);
  parts.push(<rect key="pad" x={66} y={y - 3 - lift} width={68} height={4} className="ohs-pad" />);
  if (shape === "bridge") parts.push(<rect key="pad2" x={146} y={y - 3} width={40} height={4} className="ohs-pad" />);
  // The lead through the hole.
  if (lead) parts.push(<rect key="lead" x={96} y={14} width={8} height={y + 14 - 14} className="ohs-lead" />);
  const top = y - 3 - lift;
  let d = "";
  switch (shape) {
    case "volcano": {
      const h = 22 + 10 * Math.min(1, v);
      d = `M68 ${top}C82 ${top} 92 ${top - h * 0.45} 96 ${top - h}L104 ${top - h}C108 ${top - h * 0.45} 118 ${top} 132 ${top}Z`;
      break;
    }
    case "ball": {
      const r = 26 + 6 * Math.min(1, v - 1.8);
      d = `M70 ${top}C62 ${top - r * 1.4} 138 ${top - r * 1.4} 130 ${top}Z`;
      break;
    }
    case "ring":
      d = `M68 ${top}L88 ${top}C92 ${top - 4} 94 ${top - 5} 95 ${top - 5}L95 ${top}ZM105 ${top}L105 ${top - 5}C106 ${top - 5} 108 ${top - 4} 112 ${top}L132 ${top}Z`;
      break;
    case "lump":
      d = `M74 ${top}C70 ${top - 20} 84 ${top - 34} 100 ${top - 32}C118 ${top - 34} 128 ${top - 18} 124 ${top}Z`;
      break;
    case "frosty": {
      const h = 26;
      d = `M68 ${top}C82 ${top} 92 ${top - h * 0.45} 96 ${top - h}L104 ${top - h}C108 ${top - h * 0.45} 118 ${top} 132 ${top}Z`;
      break;
    }
    case "bridge":
      d = `M68 ${top}C80 ${top - 4} 90 ${top - 30} 100 ${top - 30}C114 ${top - 30} 128 ${top - 16} 150 ${top - 10}C164 ${top - 8} 176 ${top - 4} 184 ${y - 3}Z`;
      break;
    case "burnt": {
      const h = 24;
      d = `M68 ${top}C82 ${top} 92 ${top - h * 0.45} 96 ${top - h}L104 ${top - h}C108 ${top - h * 0.45} 118 ${top} 132 ${top}Z`;
      break;
    }
    default:
      d = "";
  }
  if (d) {
    parts.push(<path key="s" d={d} className={fill} />);
    if (shape === "lump" && look?.gap) parts.push(<path key="gap" d={`M96 ${top - 28}L96 ${top}`} className="ohs-gap" />);
    if (shape === "frosty") parts.push(<path key="cr" d={`M82 ${top - 6}l6 -5l4 3M110 ${top - 12}l5 4l6 -3M98 ${top - 20}l3 6`} className="ohs-crack" />);
    if (shape === "burnt") parts.push(<path key="bf" d={`M60 ${top + 1}c6 -6 14 -6 18 -2M124 ${top}c6 -5 12 -5 18 0`} className="ohs-burn" />);
    if (fin === "bright" || fin === "liquid") parts.push(<path key="hi" d={`M84 ${top - 6}C90 ${top - 10} 92 ${top - 16} 94 ${top - 22}`} className="ohs-sheen" />);
    if (fin === "satin") parts.push(<path key="hi" d={`M84 ${top - 6}C90 ${top - 10} 92 ${top - 16} 94 ${top - 22}`} className="ohs-sheen ohs-sheen-satin" />);
    if (fin === "dull") parts.push(<path key="st" d={`M82 ${top - 8}h0M90 ${top - 16}h0M106 ${top - 18}h0M114 ${top - 9}h0M100 ${top - 10}h0`} className="ohs-stipple" />);
    parts.push(<path key="o" d={d} className="ohs-ln" />);
  }
  if (lead) parts.push(<rect key="leado" x={96} y={14} width={8} height={y - 14 - (d ? 6 : 0)} className="ohs-ln" fill="none" />);
  parts.push(<rect key="bo" x={10} y={y} width={180} height={14} className="ohs-ln" fill="none" />);
  return (
    <svg viewBox="0 0 200 120" className="ohs-side" aria-hidden="true">
      {parts}
    </svg>
  );
}

/** Ink hatching for the heat view: denser is hotter (bands from warm to very hot). */
export function heatBand(c: number): 0 | 1 | 2 | 3 | 4 {
  if (c < 45) return 0;
  if (c < 90) return 1;
  if (c < 160) return 2;
  if (c < 260) return 3;
  return 4;
}

export function HatchDefs({ id }: { id: string }) {
  const bands = [
    { k: 1, gap: 9 },
    { k: 2, gap: 6 },
    { k: 3, gap: 4 },
    { k: 4, gap: 2.6 },
  ];
  return (
    <defs>
      {bands.map((b) => (
        <pattern key={b.k} id={`${id}-h${b.k}`} width={b.gap} height={b.gap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={b.gap} className="ohs-hatch" />
        </pattern>
      ))}
    </defs>
  );
}
