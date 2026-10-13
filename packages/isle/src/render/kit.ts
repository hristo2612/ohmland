/**
 * The voxel kit: every piece, landmark and the robot is written once in primitives (box, cylinder, disc, ball, cone,
 * window, pixel text), snapped to a 1/8 unit grid, and merged into one geometry for the body plus one for the parts
 * that glow at night. Each finished geometry is then drawn as instances, so the whole isle stays at a few dozen draw
 * calls.
 */
import * as THREE from "three";

/** The isle's colours. Builders use these keys (or a raw hex string). */
export const PAL = {
  // board
  mask: "#2E9A5E",
  mask2: "#2A925A",
  maskDark: "#1F7446",
  copper: "#E39A52",
  copperDark: "#B8743A",
  gold: "#F2C35A",
  silk: "#F4F2E8",
  hole: "#33302A",
  fr4: "#EADDB4",
  fr4b: "#D8C590",
  // nature
  moss: "#8CC43F",
  moss2: "#77B23A",
  leaf: "#5DB04A",
  leaf2: "#4C9C42",
  trunk: "#7A5234",
  lemon: "#F7D63A",
  lemonDark: "#E2B92A",
  // materials
  white: "#FBFAF5",
  cream: "#F4EFE6",
  beige: "#E5CDA3",
  tan: "#C9A878",
  black: "#2A2A2F",
  ink: "#1E2026",
  charcoal: "#3A3B42",
  grey: "#9BA0A8",
  silver: "#CDD2D8",
  steel: "#8E959E",
  alu: "#B8C4CF",
  glass: "#CBE7EF",
  glassDark: "#3B4A5E",
  red: "#E0453A",
  redDark: "#B3322B",
  orange: "#F08A2C",
  yellow: "#F4C430",
  green: "#3FAF5A",
  blue: "#2F6FD6",
  blueDark: "#244F9E",
  navy: "#273A72",
  violet: "#8A55C8",
  brown: "#7A4A2A",
  pink: "#F58FB0",
  lcd: "#A9C99A",
  lcdLit: "#C8F5B0",
  amber: "#FFB43A",
  warm: "#FFD98A",
  // light colours at night
  ledRed: "#FF5A48",
  ledGreen: "#6BFF7A",
  ledYellow: "#FFE14A",
  ledBlue: "#5AA8FF",
  ledWhite: "#F4FBFF",
} as const;
export type ColorKey = keyof typeof PAL;
export type Col = ColorKey | `#${string}`;

/** A glowing box: its colour is the lit (night) colour; `day` is how it looks by day (default: a dimmer version). */
export type BoxOpts = { glow?: boolean; day?: Col };

/** A point that gives off light at night: a soft halo is drawn there. */
export type Light = { x: number; y: number; z: number; color: string; size: number };

/** What a builder reports about the thing it made, in its own coordinates (front faces +z, standing on y = 0). */
export type Built = {
  /** Height of the top, for labels and the robot. */
  top: number;
  /** Halo lights at night. */
  lights: Light[];
  /** Smoke or steam outlets. */
  smoke: [number, number, number][];
  /** Copper pads printed on the board under its legs. */
  pads: [number, number][];
  /** The silkscreen outline drawn round it: half-width and half-depth, or null for none. */
  outline: [number, number] | null;
};

export const Q = 0.125;
const snap = (v: number, q: number) => Math.round(v / q) * q;
const tmpC = new THREE.Color();
const tmpD = new THREE.Color();

const colorOf = (c: Col): string => (c.startsWith("#") ? c : PAL[c as ColorKey]);

/** Pixel font, 3 x 5, rows top to bottom. */
const FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "011", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["110", "101", "101", "101", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "110", "011"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  "=": ["000", "111", "000", "111", "000"],
  "+": ["000", "010", "111", "010", "000"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["000", "000", "000", "000", "000"],
};
export const glyph = (ch: string): string[] => FONT[ch] ?? FONT[" "]!;

/** Pixel rows of a circle of radius n (in grid steps): the half-width of each row band, from the middle out. */
function circleRows(n: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < n; j++) out.push(Math.max(1, Math.round(Math.sqrt(n * n - (j + 0.5) * (j + 0.5)))));
  return out;
}

/** The rectangles (half-extents in grid steps) whose union is a pixel circle of radius n, without repeats. */
function circleRects(n: number): [number, number][] {
  const rows = circleRows(n);
  const seen = new Set<string>();
  const out: [number, number][] = [];
  const add = (a: number, b: number) => {
    const k = `${a}x${b}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([a, b]);
    }
  };
  let j = 0;
  while (j < n) {
    const hw = rows[j]!;
    let j1 = j;
    while (j1 < n && rows[j1] === hw) j1++;
    add(hw, j1);
    add(j1, hw);
    j = j1;
  }
  // drop rectangles inside another one
  return out.filter(([a, b]) => !out.some(([c, d]) => (c > a && d >= b) || (c >= a && d > b)));
}

/** Faces of many boxes in plain arrays, turned into one geometry at the end (no per-box geometry objects). */
class Buf {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  day: number[] = [];
  idx: number[] = [];
  v = 0;
  face(p: number[], nx: number, ny: number, nz: number, c: THREE.Color, d: THREE.Color | null): void {
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!);
      this.nor.push(nx, ny, nz);
      this.col.push(c.r, c.g, c.b);
      if (d) this.day.push(d.r, d.g, d.b);
    }
    this.idx.push(this.v, this.v + 1, this.v + 2, this.v, this.v + 2, this.v + 3);
    this.v += 4;
  }
  geometry(): THREE.BufferGeometry | null {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    if (this.day.length) g.setAttribute("dayColor", new THREE.Float32BufferAttribute(this.day, 3));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

export class Shape {
  private body = new Buf();
  private glowing = new Buf();
  lights: Light[] = [];
  smoke: [number, number, number][] = [];
  pads: [number, number][] = [];
  /** With bottoms, boxes keep their bottom faces (only the robot needs them: the isle is never seen from below). */
  constructor(private readonly opts: { bottoms?: boolean } = {}) {}

  private put(w: number, h: number, d: number, col: Col, x: number, y: number, z: number, o: BoxOpts): this {
    tmpC.set(colorOf(col));
    let day: THREE.Color | null = null;
    if (o.glow) {
      if (o.day) tmpD.set(colorOf(o.day));
      else {
        const hsl = { h: 0, s: 0, l: 0 };
        tmpC.getHSL(hsl);
        tmpD.setHSL(hsl.h, hsl.s * 0.85, hsl.l * 0.62);
      }
      day = tmpD;
    }
    const b = o.glow ? this.glowing : this.body;
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const y0 = y;
    const y1 = y + h;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    b.face([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], 1, 0, 0, tmpC, day);
    b.face([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], -1, 0, 0, tmpC, day);
    b.face([x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], 0, 1, 0, tmpC, day);
    b.face([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], 0, 0, 1, tmpC, day);
    b.face([x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], 0, 0, -1, tmpC, day);
    if (this.opts.bottoms) b.face([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], 0, -1, 0, tmpC, day);
    return this;
  }

  /** A box standing on y, centred on x and z; sizes snap to 1/8, positions to 1/16. */
  box(w: number, h: number, d: number, col: Col, x: number, y: number, z: number, o: BoxOpts = {}): this {
    w = Math.max(Q, snap(w, Q));
    h = Math.max(Q / 2, snap(h, Q / 2));
    d = Math.max(Q, snap(d, Q));
    return this.put(w, h, d, col, snap(x, Q / 2), snap(y, Q / 2), snap(z, Q / 2), o);
  }

  /** A thin flat box (paint, labels, a display) of any height down to 1/32. */
  slab(w: number, h: number, d: number, col: Col, x: number, y: number, z: number, o: BoxOpts = {}): this {
    return this.put(Math.max(Q / 2, snap(w, Q / 2)), Math.max(Q / 4, snap(h, Q / 4)), Math.max(Q / 2, snap(d, Q / 2)), col, snap(x, Q / 4), snap(y, Q / 4), snap(z, Q / 4), o);
  }

  /** A vertical cylinder of radius r standing on y: a pixel circle on the 1/8 grid. */
  cyl(r: number, h: number, col: Col, x: number, y: number, z: number, o: BoxOpts = {}): this {
    const n = Math.max(1, Math.round(r / Q));
    if (n === 1) return this.box(2 * Q, h, 2 * Q, col, x, y, z, o);
    for (const [a, b] of circleRects(n)) this.box(2 * a * Q, h, 2 * b * Q, col, x, y, z, o);
    return this;
  }

  /** A disc facing +z (a speaker cone, a clock face), centred at height yc. */
  vdisc(r: number, t: number, col: Col, x: number, yc: number, z: number, o: BoxOpts = {}): this {
    const n = Math.max(1, Math.round(r / Q));
    for (const [a, b] of circleRects(n)) this.box(2 * a * Q, 2 * b * Q, t, col, x, yc - b * Q, z, o);
    return this;
  }

  /** A disc facing +x, centred at height yc. */
  xdisc(r: number, t: number, col: Col, x: number, yc: number, z: number, o: BoxOpts = {}): this {
    const n = Math.max(1, Math.round(r / Q));
    for (const [a, b] of circleRects(n)) this.box(t, 2 * b * Q, 2 * a * Q, col, x, yc - b * Q, z, o);
    return this;
  }

  /** A ball of radius r centred at yc: stacked pixel discs. sy squashes it vertically. */
  ball(r: number, col: Col, x: number, yc: number, z: number, sy = 1, o: BoxOpts = {}): this {
    const n = Math.max(1, Math.round(r / Q));
    const rows = circleRows(n);
    const hs = Math.max(Q, snap((r * sy) / n, Q / 2));
    let j = 0;
    while (j < n) {
      const rr = rows[j]!;
      let j1 = j;
      while (j1 < n && rows[j1] === rr) j1++;
      // two slabs per band: the one above the middle and its mirror below
      this.cyl(rr * Q, (j1 - j) * hs, col, x, yc + j * hs, z, o);
      this.cyl(rr * Q, (j1 - j) * hs, col, x, yc - j1 * hs, z, o);
      j = j1;
    }
    return this;
  }

  /** A cone (or a frustum down to rt) standing on y, in `steps` pixel tiers. */
  cone(r: number, h: number, col: Col, x: number, y: number, z: number, steps = 3, rt = 0, o: BoxOpts = {}): this {
    for (let i = 0; i < steps; i++) {
      const rr = r - ((r - rt) * i) / steps;
      this.cyl(Math.max(Q, rr), h / steps, col, x, y + (h * i) / steps, z, o);
    }
    return this;
  }

  /** A stepped roof on a w x d base, its eaves at y. */
  roof(w: number, d: number, h: number, col: Col, x: number, y: number, z: number, steps = 3, top?: Col): this {
    for (let i = 0; i < steps; i++) {
      const k = (i / steps) * Math.min(w, d) * 0.9;
      this.box(w - k, h / steps, d - k, i === steps - 1 && top ? top : col, x, y + (h * i) / steps, z);
    }
    return this;
  }

  /** A window set into a wall facing +z (or +x with side), glowing warm at night. */
  window(w: number, h: number, x: number, y: number, z: number, side: 0 | 1 | -1 = 0, frame: Col = "charcoal"): this {
    if (side) {
      this.box(Q, h + Q, w + Q, frame, x, y - Q / 2, z);
      return this.box(Q, h, w, "warm", x + side * Q * 0.5, y, z, { glow: true, day: "glassDark" });
    }
    this.box(w + Q, h + Q, Q, frame, x, y - Q / 2, z);
    return this.box(w, h, Q, "warm", x, y, z + Q * 0.5, { glow: true, day: "glassDark" });
  }

  /** Pixel text on a wall facing +z: each pixel a 1/8 block (scale k), the text centred on x, its top row at y. */
  text(s: string, col: Col, x: number, y: number, z: number, k = 1, o: BoxOpts = {}): this {
    const p = Q * k;
    const width = s.length * 4 - 1;
    for (let i = 0; i < s.length; i++) {
      const g = glyph(s[i]!.toUpperCase());
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++)
          if (g[r]![c] === "1") this.box(p, p, Q / 2 + 0.01, col, x + (i * 4 + c - width / 2 + 0.5) * p, y - (r + 1) * p, z, o);
    }
    return this;
  }

  /** Pixel text lying flat on a roof at height y, reading along +x, top towards -z. */
  flatText(s: string, col: Col, x: number, y: number, z: number, k = 1, o: BoxOpts = {}): this {
    const p = Q * k;
    const width = s.length * 4 - 1;
    for (let i = 0; i < s.length; i++) {
      const g = glyph(s[i]!.toUpperCase());
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++)
          if (g[r]![c] === "1") this.slab(p, Q / 4, p, col, x + (i * 4 + c - width / 2 + 0.5) * p, y, z + (r - 2) * p, o);
    }
    return this;
  }

  light(x: number, y: number, z: number, color: Col, size = 1.4): this {
    this.lights.push({ x, y, z, color: colorOf(color), size });
    return this;
  }

  /** The body and glow geometries (null when empty). */
  geometries(): { body: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null } {
    const out = { body: this.body.geometry(), glow: this.glowing.geometry() };
    this.body = new Buf();
    this.glowing = new Buf();
    return out;
  }
}

/** Colour of a palette key as a THREE.Color (linear). */
export const color3 = (c: Col): THREE.Color => new THREE.Color(colorOf(c));
export const hex = colorOf;
