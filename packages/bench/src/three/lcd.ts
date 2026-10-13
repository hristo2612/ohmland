// A 3 1/2 digit seven-segment LCD drawn on a canvas: digits, decimal points, minus sign and annunciators.

import type { MeterMode } from "@ohmland/sim";
import { FONT } from "./canvas";

type Seg = "a" | "b" | "c" | "d" | "e" | "f" | "g";

const GLYPHS: Record<string, Seg[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  O: ["a", "b", "c", "d", "e", "f"],
  o: ["g", "c", "d", "e"],
  L: ["f", "e", "d"],
  E: ["a", "f", "g", "e", "d"],
  r: ["e", "g"],
  n: ["e", "g", "c"],
  H: ["f", "e", "g", "b", "c"],
  h: ["f", "e", "g", "c"],
  P: ["a", "b", "f", "g", "e"],
  A: ["a", "b", "c", "e", "f", "g"],
  F: ["a", "f", "g", "e"],
  C: ["a", "f", "e", "d"],
  c: ["g", "e", "d"],
  d: ["b", "c", "d", "e", "g"],
  b: ["f", "e", "d", "c", "g"],
  u: ["e", "d", "c"],
  U: ["f", "e", "d", "c", "b"],
  t: ["f", "g", "e", "d"],
  S: ["a", "f", "g", "c", "d"],
  "-": ["g"],
  _: ["d"],
  " ": [],
};

type Cell = { ch: string; dp: boolean };

/** Split display text into right-aligned digit cells, with a separate leading minus. */
export function parseDisplay(text: string, cells = 4): { minus: boolean; cells: Cell[] } {
  let t = text ?? "";
  let minus = false;
  if (t.startsWith("-")) {
    minus = true;
    t = t.slice(1);
  }
  const out: Cell[] = [];
  for (const ch of t) {
    if (ch === "." || ch === ",") {
      if (out.length === 0) out.push({ ch: " ", dp: true });
      else out[out.length - 1]!.dp = true;
    } else out.push({ ch, dp: false });
  }
  while (out.length < cells) out.unshift({ ch: " ", dp: false });
  return { minus, cells: out.slice(-cells) };
}

/** Segment polygons for one digit of height h at (x, y) (top-left), slanted. */
function segmentPaths(x: number, y: number, h: number, slant: number): Record<Seg, [number, number][]> {
  const w = h * 0.52;
  const t = h * 0.105;
  const g = t * 0.22;
  const sk = (px: number, py: number): [number, number] => [x + px + (h - py) * slant, y + py];
  const hseg = (cy: number): [number, number][] => [
    sk(t * 0.5 + g, cy),
    sk(t + g, cy - t / 2),
    sk(w - t - g, cy - t / 2),
    sk(w - t * 0.5 - g, cy),
    sk(w - t - g, cy + t / 2),
    sk(t + g, cy + t / 2),
  ];
  const vseg = (cx: number, y0: number, y1: number): [number, number][] => [
    sk(cx, y0 + g),
    sk(cx + t / 2, y0 + t / 2 + g),
    sk(cx + t / 2, y1 - t / 2 - g),
    sk(cx, y1 - g),
    sk(cx - t / 2, y1 - t / 2 - g),
    sk(cx - t / 2, y0 + t / 2 + g),
  ];
  const mid = h / 2;
  return {
    a: hseg(t / 2),
    g: hseg(mid),
    d: hseg(h - t / 2),
    f: vseg(t / 2, t / 2, mid),
    b: vseg(w - t / 2, t / 2, mid),
    e: vseg(t / 2, mid, h - t / 2),
    c: vseg(w - t / 2, mid, h - t / 2),
  };
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
}

export type LcdContent = { text: string; unit?: string; mode: MeterMode; on: boolean };

const ON = "#1c221f";
const GHOST = "rgba(40,52,44,0.045)";

/** Draw the LCD. The canvas aspect is about 2:1. */
export function drawLcd(ctx: CanvasRenderingContext2D, w: number, h: number, c: LcdContent) {
  // Reflective LCD background with a soft vignette.
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#c9d1bb");
  bg.addColorStop(1, "#b7c0a7");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
  vg.addColorStop(0, "rgba(255,255,255,0.06)");
  vg.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  const dh = h * 0.6;
  const dy = h * 0.22;
  const slant = 0.09;
  const pitch = dh * 0.66;
  const x0 = w * 0.17;
  const { minus, cells } = parseDisplay(c.on ? c.text : "", 4);

  for (let i = 0; i < 4; i++) {
    const x = x0 + i * pitch;
    const segs = segmentPaths(x, dy, dh, slant);
    const cell = cells[i]!;
    const lit = new Set(c.on ? GLYPHS[cell.ch] ?? GLYPHS[cell.ch.toUpperCase()] ?? [] : []);
    // The leading half digit only has segments b and c.
    const avail: Seg[] = i === 0 ? ["b", "c"] : ["a", "b", "c", "d", "e", "f", "g"];
    for (const s of avail) {
      ctx.fillStyle = lit.has(s) ? ON : GHOST;
      fillPoly(ctx, segs[s]);
    }
    // Decimal point after this digit.
    if (i < 3) {
      ctx.fillStyle = c.on && cell.dp ? ON : GHOST;
      const px = x + dh * 0.56;
      const py = dy + dh - dh * 0.05;
      ctx.beginPath();
      ctx.rect(px, py - dh * 0.05, dh * 0.085, dh * 0.085);
      ctx.fill();
    }
  }
  // Minus sign to the left of the half digit.
  ctx.fillStyle = c.on && minus ? ON : GHOST;
  ctx.fillRect(w * 0.05, dy + dh / 2 - dh * 0.05, dh * 0.3, dh * 0.1);

  // Annunciators.
  const ann = (text: string, x: number, y: number, active: boolean, size = h * 0.11, align: CanvasTextAlign = "left") => {
    ctx.fillStyle = active ? ON : GHOST;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  };
  const on = c.on;
  const mode = c.mode;
  ann("DC", w * 0.05, h * 0.11, on && (mode === "dcv" || mode === "dca-ma" || mode === "dca-10a"));
  ann("AC", w * 0.15, h * 0.11, on && mode === "acv");
  // Continuity and diode icons along the top.
  ctx.strokeStyle = on && mode === "continuity" ? ON : GHOST;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = h * 0.018;
  const cx = w * 0.32;
  const cy = h * 0.11;
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.015, 0, Math.PI * 2);
  ctx.fill();
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.022 * k + h * 0.01, -0.7, 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = on && mode === "diode" ? ON : GHOST;
  ctx.strokeStyle = ctx.fillStyle;
  const ix = w * 0.43;
  ctx.beginPath();
  ctx.moveTo(ix, cy - h * 0.045);
  ctx.lineTo(ix + h * 0.07, cy);
  ctx.lineTo(ix, cy + h * 0.045);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(ix + h * 0.07, cy - h * 0.045, h * 0.016, h * 0.09);
  ctx.fillRect(ix - h * 0.04, cy - h * 0.008, h * 0.13, h * 0.016);

  // Unit annunciators on the right, the active one dark.
  const unit = on ? (c.unit ?? defaultUnit(mode)) : "";
  const units = ["mV", "V", "mA", "A", "Ω", "kΩ", "MΩ"];
  const ux = w * 0.955;
  const lines: [string, number][] = [
    ["mV", 0.3],
    ["V", 0.3],
    ["mA", 0.5],
    ["A", 0.5],
    ["kΩ", 0.72],
    ["MΩ", 0.72],
    ["Ω", 0.9],
  ];
  // Two columns: prefixed units left, bare units right.
  for (const [u, y] of lines) {
    const bare = u === "V" || u === "A" || u === "Ω";
    ann(u, bare ? ux : ux - w * 0.09, h * y, on && unit === u, h * 0.12, "right");
  }
  void units;
  if (on && unit && !lines.some(([u]) => u === unit)) ann(unit, ux, h * 0.9, true, h * 0.12, "right");
}

export function defaultUnit(mode: MeterMode): string {
  switch (mode) {
    case "dcv":
    case "acv":
    case "diode":
      return "V";
    case "dca-ma":
      return "mA";
    case "dca-10a":
      return "A";
    case "ohm":
    case "continuity":
      return "Ω";
    default:
      return "";
  }
}
