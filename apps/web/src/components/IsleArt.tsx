/**
 * A static isometric sketch of the progress island: a floating circuit board with capacitor towers, an IC factory,
 * a resistor row, LED street lamps, copper trace roads and voxel clouds. It is a placeholder for the live island
 * (packages/isle), drawn as plain SVG so it costs no JavaScript. Fills are design tokens.
 */
import type { ReactNode } from "react";

const U = 24; // pixels per tile edge
const OX = 300; // screen origin
const OY = 110;

type V3 = [number, number, number];
const P = ([x, y, z]: V3): [number, number] => [OX + (x - y) * U, OY + ((x + y) * U) / 2 - z * U];
const pts = (list: V3[]) => list.map((v) => P(v).map((n) => n.toFixed(1)).join(",")).join(" ");
const fill = (token: string) => ({ fill: `var(${token})` });

type Shade = { top: string; left: string; right: string };
type Item = { depth: number; node: ReactNode };

function box(key: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, s: Shade, extra?: ReactNode): ReactNode {
  return (
    <g key={key}>
      <polygon points={pts([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]])} style={fill(s.left)} />
      <polygon points={pts([[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]])} style={fill(s.right)} />
      <polygon points={pts([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])} style={fill(s.top)} />
      {extra}
    </g>
  );
}

function cylinder(key: string, cx: number, cy: number, z0: number, r: number, h: number, side: string, sideHi: string, top: string, extra?: ReactNode): ReactNode {
  const [bx, by] = P([cx, cy, z0]);
  const [tx, ty] = P([cx, cy, z0 + h]);
  const rx = Math.SQRT2 * r * U;
  const ry = rx / 2;
  return (
    <g key={key}>
      <path d={`M${bx - rx} ${by} A${rx} ${ry} 0 0 0 ${bx + rx} ${by} L${tx + rx} ${ty} L${tx - rx} ${ty} Z`} style={fill(side)} />
      <path d={`M${bx - rx} ${by} A${rx} ${ry} 0 0 0 ${bx - rx * 0.1} ${by + ry * 0.995} L${tx - rx * 0.1} ${ty + ry * 0.995} L${tx - rx} ${ty} Z`} style={fill(sideHi)} opacity={0.5} />
      {extra}
      <ellipse cx={tx} cy={ty} rx={rx} ry={ry} style={fill(top)} />
    </g>
  );
}

const MASK: Shade = { top: "--pcb", left: "--pcb-lo", right: "--pcb-lo" };
const FR4: Shade = { top: "--pcb-edge", left: "--pcb-edge", right: "--pcb-edge-lo" };
const CORE: Shade = { top: "--pcb-core", left: "--pcb-edge-lo", right: "--pcb-core" };
const CHIP: Shade = { top: "--chip-hi", left: "--chip", right: "--chip-lo" };
const CLOUD: Shade = { top: "--cloud", left: "--cloud", right: "--cloud-lo" };
const RES: Shade = { top: "--resistor-body-hi", left: "--resistor-body", right: "--resistor-body-lo" };
const PIN: Shade = { top: "--solder", left: "--solder", right: "--solder-lo" };
const POLE: Shade = { top: "--solder", left: "--solder-lo", right: "--chip-hi" };
const COPPER: Shade = { top: "--trace-hi", left: "--trace", right: "--trace" };

function tracePath(key: string, path: [number, number][], width = 4.5): ReactNode {
  const d = path.map(([x, y], i) => `${i ? "L" : "M"}${P([x, y, 0]).join(" ")}`).join(" ");
  return <path key={key} d={d} fill="none" style={{ stroke: "var(--trace)" }} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" />;
}

function via(key: string, x: number, y: number): ReactNode {
  const [cx, cy] = P([x, y, 0]);
  return (
    <g key={key}>
      <ellipse cx={cx} cy={cy} rx={7} ry={3.5} style={fill("--trace-hi")} />
      <ellipse cx={cx} cy={cy} rx={2.8} ry={1.4} style={fill("--pcb-lo")} />
    </g>
  );
}

function silk(key: string, x0: number, y0: number, x1: number, y1: number): ReactNode {
  return <polygon key={key} points={pts([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]])} fill="none" style={{ stroke: "var(--silk)" }} strokeWidth={1.3} opacity={0.8} />;
}

function glow(key: string, x: number, y: number, z: number, r: number): ReactNode {
  const [gx, gy] = P([x, y, z]);
  return <circle key={key} cx={gx} cy={gy} r={r} fill="url(#isle-glow)" />;
}

function resistor(key: string, x: number, y: number, bands: string[]): Item {
  const len = 1.2;
  const out: ReactNode[] = [];
  out.push(tracePath(`${key}-l`, [[x - 0.35, y + 0.15], [x + len + 0.35, y + 0.15]], 2.4));
  out.push(box(`${key}-b`, x, y, 0.1, x + len, y + 0.32, 0.44, RES));
  bands.forEach((b, i) => {
    const bx = x + 0.2 + i * 0.24;
    out.push(box(`${key}-band${i}`, bx, y - 0.01, 0.095, bx + 0.1, y + 0.33, 0.445, { top: b, left: b, right: b }));
  });
  return { depth: x + y + 0.5, node: <g key={key}>{out}</g> };
}

function lamp(key: string, x: number, y: number, led: string, ledHi: string): Item {
  const [gx, gy] = P([x, y, 1.72]);
  return {
    depth: x + y,
    node: (
      <g key={key}>
        {box(`${key}-base`, x - 0.16, y - 0.16, 0, x + 0.16, y + 0.16, 0.12, PIN)}
        {box(`${key}-pole`, x - 0.06, y - 0.06, 0.12, x + 0.06, y + 0.06, 1.45, POLE)}
        {cylinder(`${key}-led`, x, y, 1.45, 0.2, 0.24, led, ledHi, ledHi)}
        <circle cx={gx} cy={gy} r={4.5} style={fill(ledHi)} />
      </g>
    ),
  };
}

function cloud(key: string, x: number, y: number, z: number, big = true): ReactNode {
  return (
    <g key={key} className="isle-art__cloud">
      {box(`${key}-a`, x, y, z, x + 1.8, y + 1, z + 0.5, CLOUD)}
      {big && box(`${key}-b`, x + 0.4, y + 0.1, z + 0.5, x + 1.3, y + 0.9, z + 0.95, CLOUD)}
      {box(`${key}-c`, x + 1.5, y + 0.2, z, x + 2.4, y + 0.9, z + 0.35, CLOUD)}
    </g>
  );
}

function root(key: string, from: V3, dx: number, dy: number, color: string, width = 2.6): ReactNode {
  const [x0, y0] = P(from);
  return (
    <g key={key}>
      <path
        d={`M${x0} ${y0} C${x0 + dx * 0.1} ${y0 + dy * 0.5}, ${x0 + dx * 0.9} ${y0 + dy * 0.45}, ${x0 + dx} ${y0 + dy}`}
        fill="none"
        style={{ stroke: `var(${color})` }}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <rect x={x0 + dx - 2} y={y0 + dy - 1} width={4} height={7} rx={1.5} style={fill("--solder")} />
    </g>
  );
}

export function IsleArt({ label, className }: { label?: string; className?: string }) {
  const W = 10;
  const D = 8;
  const back: ReactNode[] = [];
  const items: Item[] = [];

  // Clouds behind the island.
  back.push(cloud("cl1", -3.2, 5.6, 2.2));

  // Underside: stepped FR4 chunks, an inner copper layer, and dangling wire roots.
  back.push(root("r1", [3.2, 7, -2.1], -10, 52, "--trace"));
  back.push(root("r2", [5.2, 6.5, -3.2], 4, 50, "--wire-red"));
  back.push(root("r3", [7.6, 4.2, -2.1], 14, 40, "--wire-black"));
  back.push(root("r4", [8.8, 2.5, -1.2], 20, 34, "--trace"));
  back.push(box("c4", 4.2, 3.6, -3.2, 6.6, 6.5, -2.1, CORE));
  back.push(box("c3", 2.2, 2.2, -2.1, 7.6, 7, -1.2, CORE));
  back.push(box("c2", 1, 0.8, -1.2, 8.8, 7.6, -0.5, FR4));
  back.push(box("cu", 0.25, 0.2, -0.5, 9.75, 7.85, -0.42, COPPER));
  back.push(box("c1", 0.25, 0.2, -0.42, 9.75, 7.85, -0.16, FR4));
  // Board with the green solder mask on top.
  back.push(box("board", 0, 0, -0.16, W, D, 0, MASK));

  // Surface: copper trace roads, vias, silkscreen and the light pooling under the lamps.
  back.push(tracePath("t1", [[0.6, 4.4], [5.2, 4.4], [5.2, 6.8], [9.4, 6.8]]));
  back.push(tracePath("t2", [[4.6, 0.6], [4.6, 2.2], [6.2, 3.7], [9.4, 3.7]]));
  back.push(tracePath("t3", [[1.2, 7.4], [1.2, 5.4], [3, 5.4]], 3.2));
  back.push(tracePath("t4", [[7.6, 0.5], [7.6, 1.5], [9.4, 1.5]], 3.2));
  back.push(via("v1", 9.4, 6.8), via("v2", 9.4, 3.7), via("v3", 0.6, 4.4), via("v4", 4.6, 0.6), via("v5", 1.2, 7.4), via("v6", 9.4, 1.5));
  back.push(silk("s1", 0.9, 0.9, 4.3, 3.6), silk("s2", 0.9, 5.85, 4.9, 7.45), silk("s3", 5.6, 0.6, 8.9, 3.2));
  back.push(glow("g1", 5.8, 4.9, 0, 46), glow("g2", 8, 6.2, 0, 40), glow("g3", 9.1, 4.4, 0, 36));
  // A soft shadow where the mascot hovers.
  const [sx, sy] = P([5.3, 2.5, 0]);
  back.push(<ellipse key="shadow" cx={sx} cy={sy} rx={26} ry={11} style={fill("--chip")} opacity={0.12} />);

  // IC factory: a chip with pins, a second storey, lit windows and a chimney.
  const pins: ReactNode[] = [];
  for (let i = 0; i < 5; i++) pins.push(box(`pa${i}`, 1.45 + i * 0.55, 3.15, 0, 1.65 + i * 0.55, 3.42, 0.16, PIN));
  for (let i = 0; i < 4; i++) pins.push(box(`pb${i}`, 3.95, 1.4 + i * 0.5, 0, 4.22, 1.6 + i * 0.5, 0.16, PIN));
  const windows: ReactNode[] = [0, 1, 2].map((i) => {
    const x = 2.05 + i * 0.42;
    return <polygon key={`w${i}`} points={pts([[x, 2.66, 1.02], [x + 0.22, 2.66, 1.02], [x + 0.22, 2.66, 0.78], [x, 2.66, 0.78]])} style={fill("--led-amber")} />;
  });
  const [dotx, doty] = P([1.65, 1.6, 0.56]);
  items.push({
    depth: 4,
    node: (
      <g key="factory">
        {pins}
        {box("chip", 1.3, 1.25, 0, 3.95, 3.15, 0.55, CHIP)}
        <ellipse cx={dotx} cy={doty} rx={4} ry={2} style={fill("--silk")} opacity={0.8} />
        {box("chip2", 1.9, 1.7, 0.55, 3.35, 2.65, 1.3, CHIP, windows)}
        {box("chimney", 2.85, 1.85, 1.3, 3.2, 2.2, 1.95, { top: "--chip-hi", left: "--chip-lo", right: "--chip" })}
      </g>
    ),
  });

  // Resistor row.
  items.push(resistor("res1", 1.4, 6.15, ["--band-yellow", "--band-violet", "--band-brown", "--band-gold"]));
  items.push(resistor("res2", 1.4, 6.85, ["--band-brown", "--band-black", "--band-red", "--band-gold"]));
  items.push(resistor("res3", 3.3, 6.15, ["--band-red", "--band-red", "--band-brown", "--band-gold"]));

  // Capacitor towers with their polarity stripe and vent.
  const capTower = (key: string, cx: number, cy: number, r: number, h: number): Item => {
    const [x, y] = P([cx, cy, 0]);
    const rx = Math.SQRT2 * r * U;
    const [tx, ty] = P([cx, cy, h]);
    const stripe = <rect x={x + rx * 0.35} y={y - h * U + rx * 0.2} width={rx * 0.3} height={h * U - rx * 0.1} style={fill("--silk")} opacity={0.7} />;
    return {
      depth: cx + cy,
      node: (
        <g key={key}>
          {cylinder(key, cx, cy, 0, r, h, "--cap-blue", "--cap-blue-hi", "--solder", stripe)}
          <path d={`M${tx - rx * 0.45} ${ty}h${rx * 0.9}M${tx} ${ty - rx * 0.22}v${rx * 0.44}`} style={{ stroke: "var(--solder-lo)" }} strokeWidth={1.4} />
        </g>
      ),
    };
  };
  items.push(capTower("cap1", 6.7, 1.7, 0.66, 2));
  items.push(capTower("cap2", 8.3, 2.6, 0.46, 1.3));

  // LED street lamps along the trace road.
  items.push(lamp("l1", 5.8, 4.9, "--led-amber", "--led-amber-hi"));
  items.push(lamp("l2", 8, 6.2, "--led-red", "--led-red-hi"));
  items.push(lamp("l3", 9.1, 4.4, "--led-amber", "--led-amber-hi"));

  items.sort((a, b) => a.depth - b.depth);

  return (
    <svg className={className ? `isle-art ${className}` : "isle-art"} viewBox="70 10 480 420" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      <defs>
        <radialGradient id="isle-glow">
          <stop offset="0%" style={{ stopColor: "var(--glow)", stopOpacity: 0.6 }} />
          <stop offset="100%" style={{ stopColor: "var(--glow)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      {back}
      {items.map((i) => i.node)}
      {cloud("cl2", 4.6, -2.4, 3.4, false)}
      {cloud("cl3", 10.6, 7.2, -1.2)}
    </svg>
  );
}
