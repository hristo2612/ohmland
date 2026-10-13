// Breadboard meshes: top surface with real holes, socket funnels, channel, print texture and x-ray strips.

import * as THREE from "three";
import { BOARD_PRINT, PITCH, RAILS, type BoardGeometry } from "../board";
import { FONT, canvasTexture, rng } from "../three/canvas";
import { memoGeo } from "../three/geometry";

const BEVEL = 0.7;
const CHANNEL_END = 1.8;

type Quad = { x0: number; x1: number; z0: number; z1: number };

/** Push two triangles for quad (i..i+3) wound so the face normal points along `out`. */
function pushOriented(idx: number[], i: number, pts: number[][], out: number[]) {
  const [a, b, c] = pts as [number[], number[], number[]];
  const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
  const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
  const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
  const dot = n[0]! * out[0]! + n[1]! * out[1]! + n[2]! * out[2]!;
  if (dot >= 0) idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  else idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
}

function pushQuads(quads: Quad[], y: number, W: number, D: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const q of quads) {
    if (q.x1 - q.x0 < 1e-4 || q.z1 - q.z0 < 1e-4) continue;
    const i = pos.length / 3;
    const corners: [number, number][] = [
      [q.x0, q.z0],
      [q.x1, q.z0],
      [q.x1, q.z1],
      [q.x0, q.z1],
    ];
    for (const [x, z] of corners) {
      pos.push(x, y, z);
      nor.push(0, 1, 0);
      uv.push((x + W / 2) / W, 1 - (z + D / 2) / D);
    }
    idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Top face of the board with square openings at every hole and a gap for the centre channel. */
export function boardTopGeometry(geom: BoardGeometry): THREE.BufferGeometry {
  return memoGeo(`bb-top:${geom.kind}`, () => {
    const W = geom.width;
    const D = geom.depth;
    const x0 = -W / 2 + BEVEL;
    const x1 = W / 2 - BEVEL;
    const z0 = -D / 2 + BEVEL;
    const z1 = D / 2 - BEVEL;
    const half = BOARD_PRINT.holeChamfer / 2;
    const ch = BOARD_PRINT.channelHalfWidth;
    const rows = new Map<number, number[]>();
    for (const h of geom.holes.values()) {
      const key = Math.round(h.z * 1000) / 1000;
      const list = rows.get(key) ?? [];
      list.push(h.x);
      rows.set(key, list);
    }
    type Band = { z0: number; z1: number; xs?: number[]; channel?: boolean };
    const bands: Band[] = [...rows.entries()].map(([z, xs]) => ({ z0: z - half, z1: z + half, xs: xs.sort((a, b) => a - b) }));
    bands.push({ z0: -ch, z1: ch, channel: true });
    bands.sort((a, b) => a.z0 - b.z0);
    const quads: Quad[] = [];
    let cur = z0;
    for (const b of bands) {
      if (b.z0 > cur) quads.push({ x0, x1, z0: cur, z1: b.z0 });
      if (b.channel) {
        quads.push({ x0, x1: x0 + CHANNEL_END, z0: b.z0, z1: b.z1 });
        quads.push({ x0: x1 - CHANNEL_END, x1, z0: b.z0, z1: b.z1 });
      } else {
        let x = x0;
        for (const hx of b.xs!) {
          quads.push({ x0: x, x1: hx - half, z0: b.z0, z1: b.z1 });
          x = hx + half;
        }
        quads.push({ x0: x, x1, z0: b.z0, z1: b.z1 });
      }
      cur = b.z1;
    }
    if (cur < z1) quads.push({ x0, x1, z0: cur, z1 });
    return pushQuads(quads, geom.height, W, D);
  });
}

/** Bevelled rim, side walls and bottom of the board body. */
export function boardShellGeometry(geom: BoardGeometry): THREE.BufferGeometry {
  return memoGeo(`bb-shell:${geom.kind}`, () => {
    const W = geom.width;
    const D = geom.depth;
    const H = geom.height;
    const b = BEVEL;
    const pos: number[] = [];
    const idx: number[] = [];
    const quad = (a: number[], bb: number[], c: number[], d: number[], out: number[]) => {
      const i = pos.length / 3;
      pos.push(...a, ...bb, ...c, ...d);
      pushOriented(idx, i, [a, bb, c], out);
    };
    const ix0 = -W / 2 + b;
    const ix1 = W / 2 - b;
    const iz0 = -D / 2 + b;
    const iz1 = D / 2 - b;
    const ox0 = -W / 2;
    const ox1 = W / 2;
    const oz0 = -D / 2;
    const oz1 = D / 2;
    const yb = H - b;
    // Bevel strips (top inner rectangle down to the outer rectangle).
    quad([ix0, H, iz1], [ix1, H, iz1], [ox1, yb, oz1], [ox0, yb, oz1], [0, 1, 1]); // near
    quad([ix1, H, iz0], [ix0, H, iz0], [ox0, yb, oz0], [ox1, yb, oz0], [0, 1, -1]); // far
    quad([ix1, H, iz1], [ix1, H, iz0], [ox1, yb, oz0], [ox1, yb, oz1], [1, 1, 0]); // right
    quad([ix0, H, iz0], [ix0, H, iz1], [ox0, yb, oz1], [ox0, yb, oz0], [-1, 1, 0]); // left
    // Walls.
    quad([ox0, yb, oz1], [ox1, yb, oz1], [ox1, 0, oz1], [ox0, 0, oz1], [0, 0, 1]);
    quad([ox1, yb, oz0], [ox0, yb, oz0], [ox0, 0, oz0], [ox1, 0, oz0], [0, 0, -1]);
    quad([ox1, yb, oz1], [ox1, yb, oz0], [ox1, 0, oz0], [ox1, 0, oz1], [1, 0, 0]);
    quad([ox0, yb, oz0], [ox0, yb, oz1], [ox0, 0, oz1], [ox0, 0, oz0], [-1, 0, 0]);
    // Bottom.
    quad([ox0, 0, oz1], [ox1, 0, oz1], [ox1, 0, oz0], [ox0, 0, oz0], [0, -1, 0]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    return ng;
  });
}

/** The centre channel: two walls, two end walls and a floor. */
export function channelGeometry(geom: BoardGeometry): THREE.BufferGeometry {
  return memoGeo(`bb-channel:${geom.kind}`, () => {
    const W = geom.width;
    const H = geom.height;
    const ch = BOARD_PRINT.channelHalfWidth;
    const depth = BOARD_PRINT.channelDepth;
    const x0 = -W / 2 + BEVEL + CHANNEL_END;
    const x1 = W / 2 - BEVEL - CHANNEL_END;
    const yb = H - depth;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const quad = (pts: number[][], shade: number[], out: number[]) => {
      const i = pos.length / 3;
      pts.forEach((p, k) => {
        pos.push(...p);
        const s = shade[k]!;
        col.push(s, s, s);
      });
      pushOriented(idx, i, pts, out);
    };
    quad([[x0, H, -ch], [x1, H, -ch], [x1, yb, -ch], [x0, yb, -ch]], [1, 1, 0.55, 0.55], [0, 0, 1]);
    quad([[x1, H, ch], [x0, H, ch], [x0, yb, ch], [x1, yb, ch]], [1, 1, 0.55, 0.55], [0, 0, -1]);
    quad([[x0, H, ch], [x0, H, -ch], [x0, yb, -ch], [x0, yb, ch]], [1, 1, 0.6, 0.6], [1, 0, 0]);
    quad([[x1, H, -ch], [x1, H, ch], [x1, yb, ch], [x1, yb, -ch]], [1, 1, 0.6, 0.6], [-1, 0, 0]);
    quad([[x0, yb, -ch], [x1, yb, -ch], [x1, yb, ch], [x0, yb, ch]], [0.5, 0.5, 0.5, 0.5], [0, 1, 0]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    return ng;
  });
}

/** One hole: a chamfered square funnel into a dark square pit (instanced at every hole). */
export function socketGeometry(): THREE.BufferGeometry {
  return memoGeo("bb-socket", () => {
    const t = BOARD_PRINT.holeChamfer / 2;
    const s = BOARD_PRINT.holeSize / 2;
    const yc = -0.42;
    const yd = -2.7;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const quad = (pts: number[][], shade: number[], out: number[]) => {
      const i = pos.length / 3;
      pts.forEach((p, k) => {
        pos.push(...p);
        const v = shade[k]!;
        col.push(v, v, v * 0.98);
      });
      pushOriented(idx, i, pts, out);
    };
    // Each ring face points into the hole (toward the axis) and, for the chamfer, upward too.
    const ring = (a: number, b: number, ya: number, yb: number, sa: number, sb: number, up: number) => {
      quad([[-a, ya, a], [a, ya, a], [b, yb, b], [-b, yb, b]], [sa, sa, sb, sb], [0, up, -1]);
      quad([[a, ya, -a], [-a, ya, -a], [-b, yb, -b], [b, yb, -b]], [sa, sa, sb, sb], [0, up, 1]);
      quad([[a, ya, a], [a, ya, -a], [b, yb, -b], [b, yb, b]], [sa, sa, sb, sb], [-1, up, 0]);
      quad([[-a, ya, -a], [-a, ya, a], [-b, yb, b], [-b, yb, -b]], [sa, sa, sb, sb], [1, up, 0]);
    };
    ring(t, s, 0, yc, 0.92, 0.5, 1);
    ring(s, s, yc, yd, 0.3, 0.02, 0);
    quad([[-s, yd, -s], [s, yd, -s], [s, yd, s], [-s, yd, s]], [0.02, 0.02, 0.02, 0.02], [0, 1, 0]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    return ng;
  });
}

/** Square outline that marks a highlighted hole. */
export function holeRingGeometry(): THREE.BufferGeometry {
  return memoGeo("bb-hole-ring", () => {
    const outer = new THREE.Shape();
    const o = 1.12;
    const i = 0.8;
    outer.moveTo(-o, -o);
    outer.lineTo(o, -o);
    outer.lineTo(o, o);
    outer.lineTo(-o, o);
    outer.lineTo(-o, -o);
    const hole = new THREE.Path();
    hole.moveTo(-i, -i);
    hole.lineTo(-i, i);
    hole.lineTo(i, i);
    hole.lineTo(i, -i);
    hole.lineTo(-i, -i);
    outer.holes.push(hole);
    const g = new THREE.ShapeGeometry(outer);
    g.rotateX(-Math.PI / 2);
    return g;
  });
}

/** Metal spring clip under a 5-hole strip (or a rail), seen in the x-ray view. Unit length along z. */
export function stripGeometry(): THREE.BufferGeometry {
  return memoGeo("bb-strip", () => {
    // A U channel: floor and two side walls with small finger bumps.
    const parts: THREE.BufferGeometry[] = [];
    const floor = new THREE.BoxGeometry(1.5, 0.22, 1);
    floor.translate(0, -1.0, 0);
    parts.push(floor);
    for (const sx of [-0.66, 0.66]) {
      const wall = new THREE.BoxGeometry(0.18, 1.9, 1);
      wall.translate(sx, -0.15, 0);
      parts.push(wall);
    }
    return mergeGeometries(parts);
  });
}

function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...(ng.attributes.position!.array as Float32Array));
    nor.push(...(ng.attributes.normal!.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

const PPM = 16;

function boardPrintDraw(geom: BoardGeometry, bump: boolean) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const W = geom.width;
    const D = geom.depth;
    const X = (x: number) => (x + W / 2) * PPM;
    const Z = (z: number) => (z + D / 2) * PPM;
    ctx.fillStyle = bump ? "#000000" : "#f7f5f0";
    ctx.fillRect(0, 0, w, h);
    const mid = (geom.cols + 1) / 2;
    const colX = (c: number) => (c - mid) * PITCH;

    if (!bump) {
      // Faint moulding texture.
      const r = rng(11);
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = r() > 0.5 ? "rgba(0,0,0,0.018)" : "rgba(255,255,255,0.05)";
        ctx.fillRect(r() * w, r() * h, 1.5, 1.5);
      }
      // Soft shading around every hole opening (moulded chamfer reads as a slight dip).
      for (const hole of geom.holes.values()) {
        const cx = X(hole.x);
        const cz = Z(hole.z);
        const g = ctx.createRadialGradient(cx, cz, PPM * 0.6, cx, cz, PPM * 1.15);
        g.addColorStop(0, "rgba(120,110,95,0.16)");
        g.addColorStop(1, "rgba(120,110,95,0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - PPM * 1.2, cz - PPM * 1.2, PPM * 2.4, PPM * 2.4);
      }
      // Seams between the rail strips and the main block.
      for (const z of [-16.95, 16.95]) {
        ctx.fillStyle = "rgba(150,140,125,0.35)";
        ctx.fillRect(X(-W / 2), Z(z) - PPM * 0.11, W * PPM, PPM * 0.22);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(X(-W / 2), Z(z) + PPM * 0.11, W * PPM, PPM * 0.12);
      }
      // Power rail lines.
      const rx0 = colX(geom.railCols[0]!) - PITCH * 1.2;
      const rx1 = colX(geom.railCols[geom.railCols.length - 1]!) + PITCH * 1.2;
      const lineW = 0.5 * PPM;
      const lines: [number, string][] = [
        [BOARD_PRINT.farRed, "#d8392f"],
        [BOARD_PRINT.farBlue, "#2f60c4"],
        [BOARD_PRINT.nearRed, "#d8392f"],
        [BOARD_PRINT.nearBlue, "#2f60c4"],
      ];
      for (const [z, c] of lines) {
        ctx.fillStyle = c;
        ctx.fillRect(X(rx0), Z(z) - lineW / 2, (rx1 - rx0) * PPM, lineW);
      }
      if (geom.splitRails) {
        // A visible break in the lines where the rails are split.
        const gx = colX(32);
        ctx.fillStyle = "#f7f5f0";
        for (const [z] of lines) ctx.fillRect(X(gx) - PPM * 1.4, Z(z) - lineW, PPM * 2.8, lineW * 2);
      }
    }

    const ink = bump ? "#ffffff" : "#8f8a80";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Plus and minus marks at both ends of each rail.
    const rx0 = colX(geom.railCols[0]!) - PITCH * 1.9;
    const rx1 = colX(geom.railCols[geom.railCols.length - 1]!) + PITCH * 1.9;
    const signs: [string, number, string][] = [];
    for (const rail of RAILS) {
      const hz = [...geom.holes.values()].find((hh) => hh.row === rail)!.z;
      const plus = rail.endsWith("p");
      signs.push([plus ? "+" : "−", hz, plus ? "#d8392f" : "#2f60c4"]);
    }
    ctx.font = `700 ${2.3 * PPM}px ${FONT}`;
    for (const [s, z, c] of signs) {
      ctx.fillStyle = bump ? "#ffffff" : c;
      ctx.fillText(s, X(rx0), Z(z) + PPM * 0.1);
      ctx.fillText(s, X(rx1), Z(z) + PPM * 0.1);
    }
    // Column numbers, every fifth, on both sides of the terminal area.
    ctx.fillStyle = ink;
    ctx.font = `600 ${1.45 * PPM}px ${FONT}`;
    const numbered = [1];
    for (let c = 5; c <= geom.cols; c += 5) numbered.push(c);
    for (const c of numbered) {
      for (const z of [BOARD_PRINT.farNumbers, BOARD_PRINT.nearNumbers]) ctx.fillText(String(c), X(colX(c)), Z(z));
    }
    // Row letters at both ends.
    ctx.font = `600 ${1.5 * PPM}px ${FONT}`;
    const lx = colX(1) - PITCH * 1.05;
    const rx = colX(geom.cols) + PITCH * 1.05;
    for (const hole of geom.holes.values()) {
      if (hole.rail || hole.col !== 1) continue;
      ctx.fillText(hole.row, X(lx), Z(hole.z));
      ctx.fillText(hole.row, X(rx), Z(hole.z));
    }
  };
}

export function boardPrintTextures(geom: BoardGeometry): { map: THREE.Texture; bump: THREE.Texture } {
  const w = Math.round(geom.width * PPM);
  const h = Math.round(geom.depth * PPM);
  const key = `${geom.kind}:${geom.splitRails}`;
  const map = canvasTexture(`bb-print:${key}`, w, h, boardPrintDraw(geom, false));
  const bump = canvasTexture(`bb-bump:${key}`, w, h, boardPrintDraw(geom, true), { srgb: false });
  return { map, bump };
}
