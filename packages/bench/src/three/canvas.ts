// Small helpers for procedural CanvasTextures (no image files are downloaded).

import * as THREE from "three";

export const FONT = `"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`;
export const MONO = `"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`;

const cache = new Map<string, THREE.Texture>();

export type CanvasOpts = {
  srgb?: boolean;
  repeat?: [number, number];
  anisotropy?: number;
  mipmaps?: boolean;
};

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** A cached CanvasTexture drawn once. */
export function canvasTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: CanvasOpts = {},
): THREE.CanvasTexture {
  const hit = cache.get(key) as THREE.CanvasTexture | undefined;
  if (hit) return hit;
  const canvas = makeCanvas(w, h);
  // A CPU-backed canvas: GPU-accelerated canvases with thousands of small draws were sometimes uploaded half
  // rasterised. These are drawn once, so the software path costs little.
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 8;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  if (opts.mipmaps === false) {
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
  }
  tex.name = key;
  cache.set(key, tex);
  return tex;
}

/** Deterministic pseudo-random numbers so procedural textures look the same on every load. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** Soft round sprite: white centre fading to transparent. */
export function radialTexture(key: string, stops: [number, string][], size = 128): THREE.CanvasTexture {
  return canvasTexture(
    `radial:${key}`,
    size,
    size,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      for (const [o, c] of stops) g.addColorStop(o, c);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { srgb: true },
  );
}

export function glowTexture(): THREE.CanvasTexture {
  return radialTexture("glow", [
    [0, "rgba(255,255,255,1)"],
    [0.12, "rgba(255,255,255,0.85)"],
    [0.32, "rgba(255,255,255,0.32)"],
    [0.6, "rgba(255,255,255,0.08)"],
    [1, "rgba(255,255,255,0)"],
  ]);
}

export function softDotTexture(): THREE.CanvasTexture {
  return radialTexture("softdot", [
    [0, "rgba(255,255,255,0.9)"],
    [0.45, "rgba(255,255,255,0.45)"],
    [1, "rgba(255,255,255,0)"],
  ]);
}

/** Puffy smoke sprite with a little internal texture. */
export function smokeTexture(): THREE.CanvasTexture {
  return canvasTexture("smoke", 128, 128, (ctx, w, h) => {
    const r = rng(7);
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (r() - 0.5) * w * 0.4;
      const y = h / 2 + (r() - 0.5) * h * 0.4;
      const rad = w * (0.16 + r() * 0.22);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, "rgba(255,255,255,0.22)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // Fade the square edges.
    ctx.globalCompositeOperation = "destination-in";
    const m = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w / 2);
    m.addColorStop(0, "rgba(0,0,0,1)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Text decal on a transparent background. Lines are drawn centred. */
export function textTexture(
  key: string,
  w: number,
  h: number,
  lines: { text: string; size: number; y: number; weight?: number; color?: string; font?: string; spacing?: number }[],
  bg?: string,
): THREE.CanvasTexture {
  return canvasTexture(`text:${key}`, w, h, (ctx) => {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const l of lines) {
      ctx.fillStyle = l.color ?? "#ffffff";
      ctx.font = `${l.weight ?? 600} ${l.size}px ${l.font ?? FONT}`;
      if ("letterSpacing" in ctx && l.spacing !== undefined) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${l.spacing}px`;
      ctx.fillText(l.text, w / 2, l.y);
      if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
    }
  });
}
