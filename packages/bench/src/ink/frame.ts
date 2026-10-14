// Drawing frames: a part's origin and turn on the desk. Pure.

import { rotateXZ } from "../parts";
import type { Vec2 } from "../types";

export type Frame = { ox: number; oz: number; rot: number };

/** Local box [x0, z0, x1, z1] in a frame, in mm. */
export type Box = [number, number, number, number];

/** Local (x, z) in a frame to the desk. */
export function toWorld(f: Frame, x: number, z: number): Vec2 {
  const [rx, rz] = rotateXZ(x, z, f.rot);
  return [f.ox + rx, f.oz + rz];
}

/** Desk (x, z) to a frame's local coordinates. */
export function toLocal(f: Frame, x: number, z: number): Vec2 {
  return rotateXZ(x - f.ox, z - f.oz, -f.rot);
}

/** SVG transform for a frame (rotateXZ turns counter-clockwise on the page, SVG rotate clockwise). */
export function frameTransform(f: Frame): string {
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return f.rot ? `translate(${r(f.ox)} ${r(f.oz)}) rotate(${r(-f.rot)})` : `translate(${r(f.ox)} ${r(f.oz)})`;
}

export function boxCorners(f: Frame, b: Box): Vec2[] {
  return [toWorld(f, b[0], b[1]), toWorld(f, b[2], b[1]), toWorld(f, b[2], b[3]), toWorld(f, b[0], b[3])];
}

/** Round to 0.001 mm for compact SVG attributes. */
export const n3 = (v: number) => Math.round(v * 1000) / 1000;

/** Ink sizes the shared dims do not cover (mm). */
export const INK = {
  clipLen: 21,
  clipJaw: 7.5,
  clipW: 5.2,
  probeLen: 50,
  /** An attached probe is held nearly upright: from above it is short. */
  probeHeld: 26,
  probeTip: 9,
  plugR: 4.6,
  plugLen: 22,
  cableW: 1.7,
  probeCableW: 2.1,
  jumperW: 1.25,
  snapW: 1.15,
};
