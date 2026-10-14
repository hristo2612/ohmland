// Seven-segment digits for the meter LCD and the desk clock.

import { n3 } from "../frame";

const SEGS: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg",
  "9": "abcdfg", "-": "g", O: "abcdef", o: "cdeg", L: "fed", E: "afged", r: "eg", n: "ceg", F: "afge", U: "bcdef", u: "cde",
  P: "abefg", A: "abcefg", C: "adef", c: "deg", d: "bcdeg", b: "cdefg", H: "bcefg", h: "cefg", t: "defg", S: "afgcd", " ": "",
};

/** Polygons for the lit segments of one character, in a cell w wide and h tall with its top-left at the origin. */
export function segments(ch: string, w: number, h: number, t: number): string {
  const on = SEGS[ch] ?? SEGS[ch.toUpperCase()] ?? "";
  const k = 0.1; // italic slant
  const X = (x: number, y: number) => `${n3(x + (h - y) * k)} ${n3(y)}`;
  const g = t * 0.5;
  const m = h / 2;
  const hor = (y: number) => `M${X(g + t * 0.2, y)}L${X(g + t * 0.7, y - g)}L${X(w - g - t * 0.7, y - g)}L${X(w - g - t * 0.2, y)}L${X(w - g - t * 0.7, y + g)}L${X(g + t * 0.7, y + g)}Z`;
  const ver = (x: number, y0: number, y1: number) => `M${X(x, y0 + t * 0.2)}L${X(x + g, y0 + t * 0.7)}L${X(x + g, y1 - t * 0.7)}L${X(x, y1 - t * 0.2)}L${X(x - g, y1 - t * 0.7)}L${X(x - g, y0 + t * 0.7)}Z`;
  const paths: Record<string, string> = {
    a: hor(g),
    g: hor(m),
    d: hor(h - g),
    f: ver(g, g, m),
    b: ver(w - g, g, m),
    e: ver(g, m, h - g),
    c: ver(w - g, m, h - g),
  };
  let d = "";
  for (const s of on) d += paths[s] ?? "";
  return d;
}

/** Split display text into cells: each a character and whether a decimal point follows it. */
export function lcdCells(text: string): { ch: string; dot: boolean }[] {
  const cells: { ch: string; dot: boolean }[] = [];
  for (const ch of text) {
    if (ch === "." || ch === ",") {
      if (cells.length && !cells[cells.length - 1]!.dot) cells[cells.length - 1]!.dot = true;
      else cells.push({ ch: " ", dot: true });
    } else cells.push({ ch, dot: false });
  }
  return cells;
}

