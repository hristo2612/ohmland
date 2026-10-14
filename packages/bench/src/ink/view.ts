// The ink view's camera at run time: owns the current camera, writes it straight to the DOM (one transform per world
// layer, the grid paper's background, a stroke-width variable and a level of detail), animates glides and tells
// listeners. React never re-renders for a pan or zoom.

import { easeOut, fitRect, lerpCam, sameCam, screenToWorld, worldToScreen, zoomAt, clampScale, type Cam, type Pad, type Rect, type Viewport } from "./camera";

export type Lod = 0 | 1 | 2;

/** Level of detail for a scale: fine print and hole centres only once they can be seen. */
export function lodFor(s: number): Lod {
  return s < 2.2 ? 0 : s < 5 ? 1 : 2;
}

/** Scale (px per mm) from which pin numbers show on chips and displays: about 11 px per 1 mm of print. */
export const NEAR_SCALE = 11;

/** Grid paper cell in mm for a scale: 5 mm times a power of two, kept between 14 and 28 px. */
export function gridCell(s: number): number {
  let c = 5;
  while (c * s < 14) c *= 2;
  while (c * s > 28 && c > 0.625) c /= 2;
  return c;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export class InkView {
  cam: Cam = { x: 0, z: 0, s: 4 };
  vp: Viewport = { w: 1, h: 1 };
  /** The camera has been fitted at least once. */
  fitted = false;
  /** The learner has moved the view since the last fit (resizes then keep their view instead of refitting). */
  moved = false;
  private layers: SVGGElement[] = [];
  private root: HTMLElement | null = null;
  private listeners = new Set<() => void>();
  private frame = 0;
  private anim: { from: Cam; to: Cam; t0: number; ms: number } | null = null;
  private lastPx = 0;
  private lastLod: Lod | -1 = -1;

  attach(root: HTMLElement | null, layers: (SVGGElement | null)[]): void {
    this.root = root;
    this.layers = layers.filter((l): l is SVGGElement => !!l);
    this.lastPx = 0;
    this.lastLod = -1;
    this.write();
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  toScreen(x: number, z: number): [number, number] {
    return worldToScreen(this.cam, this.vp, x, z);
  }

  toWorld(px: number, py: number): [number, number] {
    return screenToWorld(this.cam, this.vp, px, py);
  }

  /** Move the camera now (cancels a glide). */
  set(cam: Cam, user = false): void {
    this.anim = null;
    const next = { ...cam, s: clampScale(cam.s) };
    if (user) this.moved = true;
    if (sameCam(next, this.cam, 1e-6)) return;
    this.cam = next;
    this.schedule();
  }

  zoomAt(px: number, py: number, factor: number): void {
    this.set(zoomAt(this.cam, this.vp, px, py, factor), true);
  }

  /** Glide to a camera (instant under reduced motion). */
  glide(to: Cam, ms = 360): void {
    if (ms <= 0 || prefersReducedMotion() || !this.fitted) {
      this.set(to);
      return;
    }
    this.anim = { from: { ...this.cam }, to: { ...to, s: clampScale(to.s) }, t0: performance.now(), ms };
    this.schedule();
  }

  /** Frame a desk rectangle, keeping clear of `pad`. */
  fit(r: Rect, pad: Pad, opts: { instant?: boolean; max?: number } = {}): void {
    const cam = fitRect(r, this.vp, pad, opts.max);
    this.moved = false;
    if (opts.instant || !this.fitted) {
      this.set(cam);
      this.fitted = true;
    } else this.glide(cam);
  }

  /** Tell listeners on the next frame that something they may follow moved (a part being dragged). */
  ping(): void {
    this.schedule();
  }

  /** The view has a size (before that, framing waits). */
  get sized(): boolean {
    return this.vp.w > 1 && this.vp.h > 1;
  }

  resize(w: number, h: number): void {
    if (w === this.vp.w && h === this.vp.h) return;
    this.vp = { w: Math.max(1, w), h: Math.max(1, h) };
    this.schedule();
  }

  /** Apply the camera to the DOM on the next frame (several changes in one frame cost one write). */
  private schedule(): void {
    if (this.frame) return;
    if (typeof requestAnimationFrame !== "function") {
      this.write();
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.anim) {
        const t = Math.min(1, (performance.now() - this.anim.t0) / this.anim.ms);
        this.cam = lerpCam(this.anim.from, this.anim.to, easeOut(t));
        if (t >= 1) this.anim = null;
        else this.schedule();
      }
      this.write();
    });
  }

  /** Write the camera to the DOM now and tell the listeners. */
  write(): void {
    const { cam, vp } = this;
    const m = `matrix(${cam.s} 0 0 ${cam.s} ${vp.w / 2 - cam.x * cam.s} ${vp.h / 2 - cam.z * cam.s})`;
    for (const l of this.layers) l.setAttribute("transform", m);
    const root = this.root;
    if (root) {
      const cell = gridCell(cam.s) * cam.s;
      const ox = (((vp.w / 2 - cam.x * cam.s) % cell) + cell) % cell;
      const oy = (((vp.h / 2 - cam.z * cam.s) % cell) + cell) % cell;
      root.style.backgroundSize = `${cell}px ${cell}px`;
      root.style.backgroundPosition = `${ox}px ${oy}px`;
      // Physical strokes (cables, leads) carry a pen outline of constant width: refresh it when the zoom moves on.
      const px = 1 / cam.s;
      if (!this.lastPx || Math.abs(px / this.lastPx - 1) > 0.04) {
        this.lastPx = px;
        root.style.setProperty("--px", px.toFixed(5));
      }
      const lod = lodFor(cam.s);
      if (lod !== this.lastLod) {
        this.lastLod = lod;
        root.dataset.lod = String(lod);
      }
      // Up close (a focused chip): pin numbers and names appear.
      const near = cam.s >= NEAR_SCALE ? "1" : "0";
      if (root.dataset.near !== near) root.dataset.near = near;
    }
    for (const cb of this.listeners) cb();
  }

  dispose(): void {
    if (this.frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.listeners.clear();
    this.layers = [];
    this.root = null;
  }
}
