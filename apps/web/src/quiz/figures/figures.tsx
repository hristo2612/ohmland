/**
 * Figures for hotspot items: a static drawing plus one hit shape per named region (regions.ts). The hotspot item
 * wraps each hit shape in a focusable radio, so every region works by tap, click and keyboard.
 */
import type { ReactNode } from "react";
import type { FigureId } from "./regions";

const f = (token: string) => ({ fill: `var(${token})` });
const st = (token: string, w: number) => ({ stroke: `var(${token})`, strokeWidth: w, fill: "none", strokeLinecap: "round" as const });

export type Figure = { viewBox: string; art: ReactNode; regions: Record<string, ReactNode> };

const meterText = { fontFamily: "var(--font-mono)", fontWeight: 500 };

const multimeter: Figure = {
  viewBox: "0 0 240 320",
  art: (
    <>
      <rect x="18" y="8" width="204" height="304" rx="26" style={f("--meter-body")} />
      <rect x="18" y="8" width="204" height="304" rx="26" style={st("--meter-body-lo", 3)} />
      <rect x="32" y="22" width="176" height="276" rx="16" style={f("--meter-face")} />
      <rect x="48" y="38" width="144" height="60" rx="8" style={f("--lcd")} />
      <text x="182" y="83" textAnchor="end" style={{ ...meterText, ...f("--lcd-ink"), fontSize: 36 }}>9.12</text>
      <text x="58" y="56" style={{ ...meterText, ...f("--lcd-ink"), fontSize: 11 }}>DC</text>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (-150 + i * 27) * (Math.PI / 180);
        const x1 = 120 + Math.sin(a) * 52;
        const y1 = 170 - Math.cos(a) * 52;
        const x2 = 120 + Math.sin(a) * 58;
        const y2 = 170 - Math.cos(a) * 58;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} style={st("--silk", 2)} opacity={0.7} />;
      })}
      <text x="62" y="128" style={{ ...meterText, ...f("--silk"), fontSize: 13 }}>V</text>
      <text x="170" y="128" style={{ ...meterText, ...f("--silk"), fontSize: 13 }}>A</text>
      <text x="114" y="114" style={{ ...meterText, ...f("--silk"), fontSize: 13 }}>Ω</text>
      <text x="56" y="214" style={{ ...meterText, ...f("--silk"), fontSize: 12 }}>OFF</text>
      <circle cx="120" cy="170" r="44" style={f("--chip-hi")} />
      <circle cx="120" cy="170" r="34" style={f("--chip")} />
      <rect x="114" y="132" width="12" height="40" rx="6" style={f("--chip-hi")} transform="rotate(-35 120 170)" />
      <rect x="117" y="134" width="6" height="16" rx="3" style={f("--glow")} transform="rotate(-35 120 170)" />
      {[
        { x: 62, ring: "--wire-red", label: "10A" },
        { x: 120, ring: "--solder", label: "COM" },
        { x: 178, ring: "--wire-red", label: "VΩmA" },
      ].map((s) => (
        <g key={s.label}>
          <circle cx={s.x} cy={256} r={14} style={f(s.ring)} />
          <circle cx={s.x} cy={256} r={9} style={f("--chip-lo")} />
          <circle cx={s.x} cy={256} r={4} style={f("--solder-lo")} />
          <text x={s.x} y={234} textAnchor="middle" style={{ ...meterText, ...f("--silk"), fontSize: 12 }}>
            {s.label}
          </text>
        </g>
      ))}
    </>
  ),
  regions: {
    display: <rect x="42" y="32" width="156" height="72" rx="10" />,
    dial: <circle cx="120" cy="170" r="50" />,
    a10: <rect x="38" y="218" width="48" height="60" rx="12" />,
    com: <rect x="96" y="218" width="48" height="60" rx="12" />,
    vohm: <rect x="152" y="218" width="54" height="60" rx="12" />,
  },
};

const led: Figure = {
  viewBox: "0 0 240 320",
  art: (
    <>
      <path d="M100 196V304" style={st("--lead", 7)} />
      <path d="M140 196V262" style={st("--lead", 7)} />
      <path d="M98 196V304" style={st("--lead-hi", 2)} />
      <path d="M72 196V96a48 48 0 0 1 96 0v100z" style={f("--led-red")} opacity={0.92} />
      <path d="M86 186v-38h22l6 8v30z" style={f("--char")} opacity={0.35} />
      <path d="M128 186v-44h14v44z" style={f("--char")} opacity={0.35} />
      <path d="M86 98a34 34 0 0 1 26-34" style={st("--led-red-hi", 8)} opacity={0.8} />
      <path d="M62 190h108v18H62z" style={f("--led-red")} />
      <path d="M170 190h8v18h-8z" style={f("--led-red")} opacity={0.35} />
      <path d="M62 190h108" style={st("--led-red-hi", 2)} opacity={0.6} />
    </>
  ),
  regions: {
    lens: <path d="M66 210V96a54 54 0 0 1 108 0v114z" />,
    anode: <rect x="84" y="214" width="32" height="96" rx="10" />,
    cathode: <rect x="124" y="214" width="32" height="60" rx="10" />,
  },
};

const holes = (x0: number, y0: number, cols: number, rows: number, gap = 18) =>
  Array.from({ length: cols * rows }, (_, i) => (
    <rect key={`${x0}-${y0}-${i}`} x={x0 + (i % cols) * gap - 3} y={y0 + Math.floor(i / cols) * gap - 3} width="6" height="6" rx="1.5" style={f("--chip-hi")} />
  ));

const breadboard: Figure = {
  viewBox: "0 0 320 250",
  art: (
    <>
      <rect x="6" y="6" width="308" height="238" rx="12" style={f("--plastic")} />
      <rect x="6" y="6" width="308" height="238" rx="12" style={st("--plastic-lo", 2)} />
      <path d="M22 22H298" style={st("--wire-red", 2)} />
      <path d="M22 54H298" style={st("--led-blue", 2)} />
      <text x="12" y="27" style={{ ...meterText, ...f("--wire-red"), fontSize: 12 }}>+</text>
      <text x="12" y="59" style={{ ...meterText, ...f("--led-blue"), fontSize: 13 }}>−</text>
      {holes(30, 34, 15, 1)}
      {holes(30, 44, 15, 1)}
      {holes(30, 82, 15, 5)}
      <rect x="10" y="164" width="300" height="8" style={f("--plastic-lo")} />
      {holes(30, 186, 15, 3)}
    </>
  ),
  regions: {
    "rail-plus": <rect x="20" y="26" width="282" height="16" rx="6" />,
    "rail-minus": <rect x="20" y="40" width="282" height="12" rx="6" />,
    strip: <rect x="138" y="72" width="22" height="92" rx="8" />,
    gap: <rect x="14" y="160" width="292" height="16" rx="6" />,
  },
};

export const FIGURES: Record<FigureId, Figure> = { multimeter, led, breadboard };
