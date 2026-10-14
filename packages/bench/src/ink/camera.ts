// The ink view's 2D camera: a desk point at the middle of the view and a scale in CSS px per millimetre.
// Pure maths, shared by rendering, hit testing, project() and focus().

/** x and z of the desk point at the centre of the view (mm), s in CSS px per mm. */
export type Cam = { x: number; z: number; s: number };
export type Viewport = { w: number; h: number };
/** Desk rectangle [x0, z0, x1, z1] in mm. */
export type Rect = [number, number, number, number];
/** Space kept clear at each edge of the view, in CSS px (panels, margins). */
export type Pad = { top: number; right: number; bottom: number; left: number };

export const NO_PAD: Pad = { top: 0, right: 0, bottom: 0, left: 0 };

/** Closest and farthest zoom: a whole desk on a phone, a few holes filling a laptop screen. */
export const MIN_SCALE = 0.6;
export const MAX_SCALE = 60;

export function worldToScreen(c: Cam, vp: Viewport, x: number, z: number): [number, number] {
  return [(x - c.x) * c.s + vp.w / 2, (z - c.z) * c.s + vp.h / 2];
}

export function screenToWorld(c: Cam, vp: Viewport, px: number, py: number): [number, number] {
  return [(px - vp.w / 2) / c.s + c.x, (py - vp.h / 2) / c.s + c.z];
}

/** The SVG transform that draws desk millimetres at this camera. */
export function camMatrix(c: Cam, vp: Viewport): [number, number, number, number, number, number] {
  return [c.s, 0, 0, c.s, vp.w / 2 - c.x * c.s, vp.h / 2 - c.z * c.s];
}

export function clampScale(s: number, min = MIN_SCALE, max = MAX_SCALE): number {
  return Math.min(max, Math.max(min, s));
}

/** Frame a rectangle inside the view minus the padding, centred in what is left. */
export function fitRect(r: Rect, vp: Viewport, pad: Pad = NO_PAD, max = MAX_SCALE): Cam {
  const w = Math.max(1, vp.w - pad.left - pad.right);
  const h = Math.max(1, vp.h - pad.top - pad.bottom);
  const rw = Math.max(1e-3, r[2] - r[0]);
  const rh = Math.max(1e-3, r[3] - r[1]);
  const s = clampScale(Math.min(w / rw, h / rh), MIN_SCALE, max);
  // The rectangle's centre lands on the centre of the free area.
  const fx = pad.left + w / 2;
  const fy = pad.top + h / 2;
  const cx = (r[0] + r[2]) / 2 - (fx - vp.w / 2) / s;
  const cz = (r[1] + r[3]) / 2 - (fy - vp.h / 2) / s;
  return { x: cx, z: cz, s };
}

/** Zoom by `factor` keeping the desk point under the screen point (px, py) where it is. */
export function zoomAt(c: Cam, vp: Viewport, px: number, py: number, factor: number): Cam {
  const s = clampScale(c.s * factor);
  const [wx, wz] = screenToWorld(c, vp, px, py);
  return { s, x: wx - (px - vp.w / 2) / s, z: wz - (py - vp.h / 2) / s };
}

/** Move the view by a screen delta (a drag of the paper). */
export function panBy(c: Cam, dx: number, dy: number): Cam {
  return { s: c.s, x: c.x - dx / c.s, z: c.z - dy / c.s };
}

/**
 * Keep part of the work area on screen: the view centre stays within the work rectangle grown by half a view, so
 * the learner can never lose the bench off the edge of the paper.
 */
export function clampCam(c: Cam, vp: Viewport, work: Rect): Cam {
  const mx = vp.w / 2 / c.s;
  const mz = vp.h / 2 / c.s;
  const x = Math.min(work[2] + mx * 0.6, Math.max(work[0] - mx * 0.6, c.x));
  const z = Math.min(work[3] + mz * 0.6, Math.max(work[1] - mz * 0.6, c.z));
  return x === c.x && z === c.z ? c : { s: c.s, x, z };
}

/** Interpolate two cameras: position linearly, scale geometrically (zoom feels even). */
export function lerpCam(a: Cam, b: Cam, t: number): Cam {
  const s = a.s * Math.pow(b.s / a.s, t);
  return { s, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

export function sameCam(a: Cam, b: Cam, eps = 1e-3): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.z - b.z) < eps && Math.abs(a.s / b.s - 1) < eps;
}

export function growRect(r: Rect, by: number): Rect {
  return [r[0] - by, r[1] - by, r[2] + by, r[3] + by];
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

export function rectOfPoints(pts: readonly (readonly [number, number])[], pad = 0): Rect | null {
  if (!pts.length) return null;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, z] of pts) {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  return [x0 - pad, z0 - pad, x1 + pad, z1 + pad];
}

/** Ease for camera glides: quick start, gentle landing. */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
