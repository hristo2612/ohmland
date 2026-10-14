// The 3D view's half of the BenchController: projecting targets to the screen, telling overlays when the view
// changed, framing targets (focus and the home view) and the spotlight (veil, rings, lifted parts).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { CameraControls as CameraControlsImpl } from "@react-three/drei";
import { PITCH, boardGeometry, boardOrigin } from "../board";
import { BOARD_TOP, GATE } from "../dims";
import { METER, anchorPosition, isOnBoard } from "../layout";
import { parseAnchor } from "../anchors";
import { UPRIGHT_KINDS, partDef, partMarks, rotateXZ } from "../parts";
import type { BenchStore } from "../store";
import type { BenchState, Vec3 } from "../types";
import { prefersReducedMotion } from "../three/anim";
import { isEffect } from "../effects/effects";
import { SPOT_LAYER, type Spotlight } from "../three/post";
import type { PaperPalette } from "../three/paper";
import type { FocusOptions, Inset, ScreenPoint } from "../view/controller";
import { STRESS_MARK, meterSpot, parseTarget, targetPoint } from "../view/targets";
import { focalTargets, frameWithParts, needsReading } from "../view/framing";
import { heldOf, holderOf } from "../seats";

export type ViewApi = {
  /** Element-relative CSS px of a target or a world point. */
  project(target: string | Vec3): ScreenPoint | null;
  onViewChange(cb: () => void): () => void;
  focus(targets: string[], opts?: FocusOptions): void;
  spotlight(targets: string[] | null): void;
  /** Frame the whole work area (from straight above when `top`). */
  home(top: boolean, smooth?: boolean): void;
  /** True while the camera rests where the last home() put it. */
  atHome(): boolean;
};

/** Camera angles: polar from straight down, azimuth around y. */
export const HOME_POLAR = 0.62;
const PORTRAIT_POLAR = 0.42;
const FOV = 32;
/** Nothing is framed smaller than this (mm), so one LED still shows a little of what is around it. */
const MIN_FRAME = 24;
/**
 * Focused targets fill at most this share of the view's height (and half again of its width): a close-up keeps the
 * camera back, so what stands round the targets does not swell into blurs between the camera and them.
 */
const MAX_FILL = 0.45;

const tmpBox = new THREE.Box3();

/** World box of the solid, visible meshes under `root` (no glows, overlays or hit proxies). */
export function contentBox(root: THREE.Object3D, out = new THREE.Box3()): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible || !m.layers.isEnabled(0) || (m as THREE.InstancedMesh).isInstancedMesh || !m.geometry) return;
    const mat = m.material as THREE.Material;
    if (!mat || Array.isArray(mat) || isEffect(m) || !mat.visible || (mat.transparent && mat.opacity < 0.05)) return;
    if (m.geometry.type === "InstancedBufferGeometry") return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    tmpBox.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
    out.union(tmpBox);
  });
  return out;
}

const pointBox = (p: Vec3, r: number, up = r) => new THREE.Box3(new THREE.Vector3(p[0] - r, p[1] - r * 0.5, p[2] - r), new THREE.Vector3(p[0] + r, p[1] + up, p[2] + r));

function meterBox(bench: BenchState): THREE.Box3 | null {
  const m = bench.meter;
  if (!m) return null;
  const box = new THREE.Box3();
  for (const [lx, lz] of [
    [-METER.width / 2, -METER.length / 2],
    [METER.width / 2, -METER.length / 2],
    [-METER.width / 2, METER.length / 2],
    [METER.width / 2, METER.length / 2],
  ] as [number, number][]) {
    const [rx, rz] = rotateXZ(lx, lz, m.rot);
    box.expandByPoint(new THREE.Vector3(m.pos[0] + rx, 0, m.pos[1] + rz));
  }
  box.max.y = METER.height;
  return box;
}

function boardBox(bench: BenchState): THREE.Box3 | null {
  if (!bench.board) return null;
  const g = boardGeometry(bench.board);
  const [ox, oz] = boardOrigin(bench.board);
  return new THREE.Box3(new THREE.Vector3(ox - g.width / 2, 0, oz - g.depth / 2), new THREE.Vector3(ox + g.width / 2, BOARD_TOP, oz + g.depth / 2));
}

/** Solve for a camera looking along `dir` that fits `points` inside the NDC rectangle `rect`. */
function solveFrame(
  points: THREE.Vector3[],
  dir: THREE.Vector3,
  fov: number,
  aspect: number,
  rect: { l: number; r: number; b: number; t: number },
  minDist: number,
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const box = new THREE.Box3().setFromPoints(points);
  const target = box.getCenter(new THREE.Vector3());
  target.y = Math.max(0, Math.min(40, target.y));
  const cam = new THREE.PerspectiveCamera(fov, aspect, 1, 10000);
  let dist = Math.max(minDist, box.getSize(new THREE.Vector3()).length() * 1.5);
  const v = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const cosPolar = Math.max(0.3, dir.y);
  for (let it = 0; it < 48; it++) {
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of points) {
      v.copy(p).project(cam);
      x0 = Math.min(x0, v.x);
      x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    const s = Math.max((x1 - x0) / (rect.r - rect.l), (y1 - y0) / (rect.t - rect.b));
    const halfH = dist * Math.tan((fov * Math.PI) / 360);
    const halfW = halfH * aspect;
    right.setFromMatrixColumn(cam.matrixWorld, 0);
    up.setFromMatrixColumn(cam.matrixWorld, 1);
    fwd.set(up.x, 0, up.z);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    target.addScaledVector(right, ((x0 + x1) / 2 - (rect.l + rect.r) / 2) * halfW * 0.8);
    target.addScaledVector(fwd, ((((y0 + y1) / 2 - (rect.b + rect.t) / 2) * halfH) / cosPolar) * 0.8);
    dist *= 1 + (s - 1) * 0.8;
  }
  dist = Math.max(dist, minDist);
  return { position: target.clone().addScaledVector(dir, dist), target };
}

const boxPoints = (b: THREE.Box3): THREE.Vector3[] => {
  const out: THREE.Vector3[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
};

export function ViewRig({
  store,
  apiRef,
  viewPad,
  inset,
  setSpotTargets,
  initialCamera,
  onChange,
  pendingFocus,
}: {
  store: BenchStore;
  apiRef: React.MutableRefObject<ViewApi | null>;
  viewPad: React.MutableRefObject<{ left: number; bottom: number }>;
  /** The part of the view a docked panel covers (focus's `inset`): every framing keeps clear of it. */
  inset: React.MutableRefObject<Required<Inset>>;
  setSpotTargets: (t: string[] | null) => void;
  initialCamera: boolean;
  /** Called once per drawn frame in which the camera, the canvas size or the bench changed. */
  onChange: () => void;
  /** A focus asked for before the canvas was ready. */
  pendingFocus: React.MutableRefObject<{ targets: string[]; opts?: FocusOptions } | null>;
}) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const home = useRef<{ position: THREE.Vector3; target: THREE.Vector3; top: boolean } | null>(null);
  const homed = useRef(initialCamera);
  const cache = useRef<{ bench: BenchState | null; frame: number; points: Map<string, Vec3 | null> }>({ bench: null, frame: -1, points: new Map() });
  /** Drawn frames so far, and how many more frames overlays hear about after a bench change. */
  const frames = useRef({ n: 0, settle: 0 });

  useLayoutEffect(() => {
    const controls = () => get().controls as unknown as CameraControlsImpl | null;
    const bench = () => store.getState().bench;

    /** Box of one target in world space, from the rendered models where they matter. */
    const targetBox = (t: string): THREE.Box3 | null => {
      const parsed = parseTarget(t);
      if (!parsed) return null;
      const b = bench();
      const scene = get().scene;
      if (parsed.type === "part") {
        if (b.meter && parsed.id === b.meter.id) {
          if (parsed.sub) {
            const p = meterSpot(b, parsed.sub);
            return p ? pointBox(p, parsed.sub === "display" ? 30 : 10) : null;
          }
          return meterBox(b);
        }
        if (parsed.sub) {
          const p = targetPoint(b, t);
          return p ? pointBox(p, 10) : null;
        }
        const obj = scene.getObjectByName(`part:${parsed.id}`);
        const box = obj ? contentBox(obj) : new THREE.Box3();
        if (box.isEmpty()) {
          const p = targetPoint(b, t);
          return p ? pointBox(p, 6) : null;
        }
        return box;
      }
      if (parsed.type === "lead") {
        const l = b.leads.find((x) => x.id === parsed.id);
        if (!l) return null;
        const box = new THREE.Box3();
        for (const end of ["a", "b"] as const) {
          const p = anchorPosition(b, `lead:${l.id}.${end}`);
          if (p) box.union(pointBox(p, 12, 8));
        }
        return box.isEmpty() ? null : box;
      }
      if (parsed.type === "wire") {
        const box = new THREE.Box3();
        for (const end of ["a", "b"] as const) {
          const p = anchorPosition(b, `wire:${parsed.id}.${end}`);
          if (p) box.union(pointBox(p, 3, 6));
        }
        return box.isEmpty() ? null : box;
      }
      const p = anchorPosition(b, parsed.anchor);
      return p ? pointBox(p, 4) : null;
    };

    /**
     * The work area: the lab's own frame when it sets one (with a part that pokes a little out of it taken in whole),
     * else the board, every part, the meter body and the leads that hold something.
     */
    const workBoxes = (portrait: boolean): THREE.Box3[] => {
      const frame = store.getState().frame;
      const b = bench();
      const scene = get().scene;
      if (frame) {
        const fb = new THREE.Box3(new THREE.Vector3(frame[0], 0, frame[1]), new THREE.Vector3(frame[2], 16, frame[3]));
        const boxes: THREE.Box3[] = [];
        for (const p of b.parts) {
          const obj = scene.getObjectByName(`part:${p.id}`);
          const box = obj ? contentBox(obj) : null;
          if (box && !box.isEmpty()) boxes.push(box);
        }
        const mb = meterBox(b);
        if (mb) boxes.push(mb);
        // The same rule as the ink view (frameWithParts), on the desk plane.
        const [x0, z0, x1, z1] = frameWithParts(
          frame,
          boxes.map((x) => [x.min.x, x.min.z, x.max.x, x.max.z] as [number, number, number, number]),
        );
        // The grown frame on the desk, and the parts whole inside it (their height counts).
        const inside = boxes.filter((x) => x.min.x >= x0 - 0.01 && x.max.x <= x1 + 0.01 && x.min.z >= z0 - 0.01 && x.max.z <= z1 + 0.01);
        return [new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 16, z1)), ...inside];
      }
      const out: THREE.Box3[] = [];
      const bb = boardBox(b);
      if (bb) out.push(bb);
      for (const p of b.parts) {
        if (portrait && bb && !isOnBoard(b, p)) continue;
        const obj = scene.getObjectByName(`part:${p.id}`);
        const box = obj ? contentBox(obj) : new THREE.Box3();
        if (!box.isEmpty()) out.push(box);
        else out.push(pointBox([p.pos[0], 0, p.pos[1]], 14, 10));
      }
      if (!portrait || !bb) {
        const mb = meterBox(b);
        if (mb) out.push(mb);
        const cables: THREE.Box3[] = [];
        for (const l of b.leads) {
          for (const e of [l.a, l.b]) {
            const p = e.to ? anchorPosition(b, e.to) : null;
            if (p) out.push(pointBox(p, 16, 8));
          }
          // A lead that holds something counts with its cable, which may reach a little past the rest; a loose lead
          // lying aside does not widen the view.
          if (!l.a.to && !l.b.to) continue;
          const obj = scene.getObjectByName(`lead:${l.id}`);
          const box = obj ? contentBox(obj) : null;
          if (box && !box.isEmpty()) cables.push(box);
        }
        if (cables.length && out.length) {
          const core = new THREE.Box3();
          for (const o of out) core.union(o);
          core.expandByVector(new THREE.Vector3(22, 0, 22));
          core.max.y = Math.max(core.max.y, 30);
          for (const c of cables) out.push(c.intersect(core));
        }
      }
      if (!out.length) out.push(new THREE.Box3(new THREE.Vector3(-110, 0, -55), new THREE.Vector3(110, 10, 55)));
      return out;
    };

    const viewRect = (padding: number) => {
      const { width, height } = get().size;
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      const pad = viewPad.current;
      const i = inset.current;
      const px = (x: number) => (x / w) * 2;
      const py = (y: number) => (y / h) * 2;
      const left = Math.max(pad.left, i.left);
      const bottom = Math.max(pad.bottom, i.bottom);
      // The tray and a docked panel come first; the margin takes at most a fifth of the room they leave on each side.
      const mx = Math.min(padding, Math.max(0, w - left - i.right) * 0.2);
      const my = Math.min(padding, Math.max(0, h - bottom - i.top) * 0.2);
      const l = -1 + px(left + mx);
      const r = 1 - px(i.right + mx);
      const b = -1 + py(bottom + my);
      const t = 1 - py(i.top + my);
      return { l: Math.min(l, r - 0.2), r, b: Math.min(b, t - 0.2), t, aspect: w / h };
    };

    /** View direction: from the front, or (on a tall screen, for a wide work area) from its left end. */
    const angles = (turn: boolean, top: boolean) => {
      const polar = top ? 0.001 : turn ? PORTRAIT_POLAR : HOME_POLAR;
      const az = turn ? -Math.PI / 2 : 0;
      return new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az)).normalize();
    };
    /** Turn the view a quarter on tall screens when the boxes are clearly wider than deep. */
    const shouldTurn = (boxes: THREE.Box3[]) => {
      const { width, height } = get().size;
      if (width / Math.max(1, height) >= 0.85) return false;
      const u = new THREE.Box3();
      for (const b of boxes) u.union(b);
      const s = u.getSize(new THREE.Vector3());
      return s.x > s.z * 1.15;
    };

    const move = (pose: { position: THREE.Vector3; target: THREE.Vector3 }, smooth: boolean) => {
      const c = controls();
      if (!c) return;
      const anim = smooth && !prefersReducedMotion();
      void c.setLookAt(pose.position.x, pose.position.y, pose.position.z, pose.target.x, pose.target.y, pose.target.z, anim);
      if (!anim) c.update(0);
      invalidate();
    };

    const frame = (boxes: THREE.Box3[], opts: { padding: number; top?: boolean; turn: boolean; minSize?: number; maxFill?: number }) => {
      // Fit the corners of each box (not of their union, whose far top corners hold nothing and push the view away).
      const pts: THREE.Vector3[] = [];
      const union = new THREE.Box3();
      for (const b of boxes) {
        if (b.isEmpty()) continue;
        union.union(b);
        pts.push(...boxPoints(b));
      }
      const min = opts.minSize ?? 0;
      if (min > 0) {
        const c = union.getCenter(new THREE.Vector3());
        const s = union.getSize(new THREE.Vector3());
        const grow = new THREE.Box3().copy(union).expandByVector(new THREE.Vector3(Math.max(0, (min - s.x) / 2), 0, Math.max(0, (min - s.z) / 2)));
        grow.expandByPoint(new THREE.Vector3(c.x, Math.max(grow.max.y, 4), c.z));
        pts.push(...boxPoints(grow));
      }
      let rect = viewRect(opts.padding);
      if (opts.maxFill) {
        // A close-up never fills the view: the targets take at most this share of its height (NDC spans 2).
        const cx = (rect.l + rect.r) / 2;
        const cy = (rect.b + rect.t) / 2;
        const hh = Math.min((rect.t - rect.b) / 2, opts.maxFill);
        const hw = Math.min((rect.r - rect.l) / 2, opts.maxFill * 1.5);
        rect = { l: cx - hw, r: cx + hw, b: cy - hh, t: cy + hh, aspect: rect.aspect };
      }
      const cam = get().camera as THREE.PerspectiveCamera;
      return solveFrame(pts, angles(opts.turn, !!opts.top), cam.fov ?? FOV, rect.aspect, rect, 45);
    };

    /**
     * A pose `read` px between neighbouring holes at the targets, when `pose` frames them smaller: as much of them as
     * fits at that scale, moved only as far as it takes to keep their anchors (`focalTargets`) in view. Null when
     * `pose` is close enough already.
     */
    const readingPose = (
      pose: { position: THREE.Vector3; target: THREE.Vector3 },
      boxes: THREE.Box3[],
      targets: string[],
      read: number,
      padding: number,
      turn: boolean,
    ): { position: THREE.Vector3; target: THREE.Vector3 } | null => {
      const { width, height } = get().size;
      const cam = (get().camera as THREE.PerspectiveCamera).clone();
      cam.position.copy(pose.position);
      cam.lookAt(pose.target);
      cam.updateMatrixWorld(true);
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const a = pose.target.clone().project(cam);
      const b = pose.target.clone().addScaledVector(right, PITCH).project(cam);
      const pitch = Math.hypot(((b.x - a.x) / 2) * width, ((b.y - a.y) / 2) * height);
      if (pitch >= read) return null;
      // The desk the free part of the view shows at that scale (depth foreshortened by the camera's tilt).
      const rect = viewRect(padding);
      const mm = PITCH / read;
      const across = (((rect.r - rect.l) / 2) * width * mm) / 2;
      const deep = (((rect.t - rect.b) / 2) * height * mm) / Math.cos(turn ? PORTRAIT_POLAR : HOME_POLAR) / 2;
      const [hx, hz] = turn ? [deep, across] : [across, deep];
      const all = new THREE.Box3();
      for (const bx of boxes) all.union(bx);
      const focal = new THREE.Box3();
      for (const t of focalTargets(targets)) {
        const fb = targetBox(t);
        if (fb && !fb.isEmpty()) focal.union(fb);
      }
      if (focal.isEmpty()) focal.copy(all);
      const keep = (c: number, lo: number, hi: number, half: number) => {
        const room = 3;
        if (hi - lo > (half - room) * 2) return (lo + hi) / 2;
        return Math.min(lo + half - room, Math.max(hi - half + room, c));
      };
      const c = all.getCenter(new THREE.Vector3());
      const cx = keep(c.x, focal.min.x, focal.max.x, hx);
      const cz = keep(c.z, focal.min.z, focal.max.z, hz);
      const y = Math.max(0, focal.min.y);
      const sheet = new THREE.Box3(new THREE.Vector3(cx - hx, y, cz - hz), new THREE.Vector3(cx + hx, y + 1, cz + hz));
      return frame([sheet], { padding, turn });
    };

    const isPortrait = () => {
      const { width, height } = get().size;
      return width / Math.max(1, height) < 0.85 && !!bench().board;
    };
    const defaultPadding = () => {
      const { width, height } = get().size;
      return Math.round(Math.max(16, Math.min(56, Math.min(width, height) * 0.06)));
    };

    const goHome = (top: boolean, smooth = true) => {
      const boxes = workBoxes(isPortrait());
      const pose = frame(boxes, { padding: defaultPadding(), top, turn: shouldTurn(boxes) });
      home.current = { ...pose, top };
      move(pose, smooth);
    };

    const v = new THREE.Vector3();
    const toScreen = (p: Vec3): ScreenPoint => {
      const { camera, size } = get();
      camera.updateMatrixWorld();
      v.set(p[0], p[1], p[2]).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const visible = v.z > -1 && v.z < 1 && x >= 0 && y >= 0 && x <= size.width && y <= size.height;
      return { x, y, visible };
    };

    /**
     * World point of a target, cached within a drawn frame of one bench. Parts use the centre of their rendered model,
     * which follows a bench change a frame or two late (a part moved from the desk into the board still has its desk
     * pose until React has rendered it), so nothing is kept from one frame to the next.
     */
    const worldPoint = (t: string): Vec3 | null => {
      const b = bench();
      const c = cache.current;
      if (c.bench !== b || c.frame !== frames.current.n) {
        c.bench = b;
        c.frame = frames.current.n;
        c.points.clear();
      }
      if (c.points.has(t)) return c.points.get(t)!;
      const parsed = parseTarget(t);
      let p: Vec3 | null = null;
      const gate = parsed?.type === "part" && parsed.sub ? b.parts.find((x) => x.id === parsed.id && x.kind === "gate") : undefined;
      if (gate && parsed?.type === "part" && parsed.sub) {
        // A gate rides its cable as drawn: its marks (the flag, the unit button) are on the rendered gate.
        const flag = get().scene.getObjectByName(`part:${gate.id}`)?.getObjectByName("gate-flag");
        const m = partMarks(gate)[parsed.sub];
        if (flag && m) {
          // On the flag, which turns to face the camera.
          flag.updateWorldMatrix(true, false);
          const w = flag.localToWorld(new THREE.Vector3(m[0], m[1] - GATE.lift, 1.6));
          p = [w.x, w.y, w.z];
        } else p = targetPoint(b, t);
      } else if (parsed?.type === "part" && !parsed.sub && !(b.meter && parsed.id === b.meter.id)) {
        const obj = get().scene.getObjectByName(`part:${parsed.id}`);
        const box = obj ? contentBox(obj) : null;
        if (box && !box.isEmpty()) {
          const ctr = box.getCenter(new THREE.Vector3());
          p = [ctr.x, ctr.y, ctr.z];
        } else p = targetPoint(b, t);
      } else p = targetPoint(b, t);
      // Models mount a frame after the bench changes: only remember what came from a model.
      if (p && (parsed?.type !== "part" || get().scene.getObjectByName(`part:${parsed.id}`))) c.points.set(t, p);
      return p;
    };

    apiRef.current = {
      project: (t) => {
        const p = typeof t === "string" ? worldPoint(t) : t;
        return p ? toScreen(p) : null;
      },
      onViewChange: () => () => {},
      focus: (targets, opts = {}) => {
        homed.current = true;
        if (!targets.length) {
          goHome(false, !opts.instant);
          return;
        }
        const boxes = targets.map(targetBox).filter((b): b is THREE.Box3 => !!b && !b.isEmpty());
        if (!boxes.length) return;
        // Leave some of the bench around the targets, so the learner sees where they are.
        const { width, height } = get().size;
        const padding = opts.padding ?? Math.max(defaultPadding(), Math.round(Math.min(width, height) * 0.14));
        // Print and digits (a colour chart, a value tag, a chip's number, a display) are read upright: no quarter turn
        // on a tall screen.
        const printed = targets.some((t) => {
          const pt = parseTarget(t);
          const kind = pt?.type === "part" ? bench().parts.find((p) => p.id === pt.id)?.kind : undefined;
          return !!kind && UPRIGHT_KINDS.has(kind);
        });
        const turn = !printed && shouldTurn(boxes);
        // Hands-on work (`read`) comes as close as aiming needs; a look at a part keeps the camera back.
        let pose = frame(boxes, { padding, turn, minSize: MIN_FRAME, maxFill: opts.read ? undefined : MAX_FILL });
        if (opts.read && needsReading(bench(), targets)) pose = readingPose(pose, boxes, targets, opts.read, padding, turn) ?? pose;
        home.current = null;
        move(pose, !opts.instant);
      },
      spotlight: (targets) => setSpotTargets(targets && targets.length ? [...targets] : null),
      home: (top, smooth = true) => {
        homed.current = true;
        goHome(top, smooth);
      },
      atHome: () => {
        const h = home.current;
        const c = controls();
        if (!h || !c) return false;
        const pos = c.getPosition(new THREE.Vector3(), true);
        const tgt = c.getTarget(new THREE.Vector3(), true);
        const tol = Math.max(0.5, h.position.distanceTo(h.target) * 0.004);
        return pos.distanceTo(h.position) < tol && tgt.distanceTo(h.target) < tol;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [get, store, apiRef, viewPad, inset, invalidate, setSpotTargets]);

  // Tell overlays when the camera, the canvas size or the bench changed (once per drawn frame, before it is drawn), and
  // for a few frames after a bench change, while the models catch up.
  const last = useRef({ m: new THREE.Matrix4(), p: new THREE.Matrix4(), w: -1, h: -1, bench: null as BenchState | null });
  useFrame(() => {
    const { camera, size } = get();
    const api = apiRef.current;
    if (api && pendingFocus.current) {
      const f = pendingFocus.current;
      pendingFocus.current = null;
      api.focus(f.targets, { ...f.opts, instant: true });
    }
    if (!homed.current && api) {
      // First frame: the models are mounted now, so frame what is really on the bench.
      homed.current = true;
      api.home(false, false);
    }
    camera.updateMatrixWorld();
    const l = last.current;
    const bench = store.getState().bench;
    const resized = size.width !== l.w || size.height !== l.h;
    if (resized && l.w > 0 && api?.atHome() && home.current) {
      // The layout changed while the learner had not moved the camera: keep the work area framed.
      api.home(home.current.top, false);
      camera.updateMatrixWorld();
    }
    const f = frames.current;
    f.n++;
    // The models catch up with a bench change over the next frame or two: overlays hear about those frames too.
    if (bench !== l.bench) f.settle = 3;
    const settling = f.settle > 0;
    if (settling) f.settle--;
    if (!settling && !resized && bench === l.bench && l.m.equals(camera.matrixWorld) && l.p.equals(camera.projectionMatrix)) return;
    l.m.copy(camera.matrixWorld);
    l.p.copy(camera.projectionMatrix);
    l.w = size.width;
    l.h = size.height;
    l.bench = bench;
    onChange();
  });
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Spotlight: lift the spotlit things onto the spotlight layer, fade the veil in, and draw a red-pencil ring under
// each one.

const RING_VERT = /* glsl */ `
varying vec2 vP;
uniform vec2 size;
void main() {
  vP = ( uv - 0.5 ) * size;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;
const RING_FRAG = /* glsl */ `
uniform vec2 size;
uniform vec2 halfSize;
uniform float radius;
uniform float width;
uniform float glow;
uniform vec3 color;
uniform float amount;
varying vec2 vP;
float sdRound( vec2 p, vec2 b, float r ) {
  vec2 q = abs( p ) - b + r;
  return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - r;
}
void main() {
  float d = sdRound( vP, halfSize, radius );
  // The ring is drawn "width" pixels wide from any distance, like a pencil line.
  float px = abs( d ) / max( fwidth( d ), 1e-4 );
  float ring = 1.0 - smoothstep( width * 0.5 - 0.6, width * 0.5 + 0.6, px );
  float halo = exp( -max( d, 0.0 ) / glow ) * step( 0.0, d ) * 0.16 + exp( -max( -d, 0.0 ) / ( glow * 0.6 ) ) * step( d, 0.0 ) * 0.07;
  float a = max( ring * 0.85, halo ) * amount;
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( color, a );
  #include <colorspace_fragment>
}`;

function ringMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      size: { value: new THREE.Vector2(10, 10) },
      halfSize: { value: new THREE.Vector2(4, 4) },
      radius: { value: 3 },
      width: { value: 0.8 },
      glow: { value: 2.5 },
      color: { value: new THREE.Color(color) },
      amount: { value: 0 },
    },
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
}

const RING_GEO = new THREE.PlaneGeometry(1, 1);

const sameRings = (a: Ring[], b: Ring[]) =>
  a.length === b.length && a.every((r, i) => r.key === b[i]!.key && r.y === b[i]!.y && r.box.equals(b[i]!.box));

/** The parts that come into the spotlight with a part: what it holds, and the holder it sits in. */
function spotCompanions(bench: BenchState, id: string): string[] {
  const part = bench.parts.find((p) => p.id === id);
  if (!part) return [];
  const out = Object.values(heldOf(part)).filter((x): x is string => !!x);
  const holder = holderOf(bench, id);
  if (holder) out.push(holder.holder.id);
  return out;
}

type Ring = { key: string; box: THREE.Box3; y: number };

/**
 * Things that may stand between the camera and the spotlit targets: parts, clip leads and meter probes that are not
 * themselves lifted into the spotlight. A lead clipped to a target stays (it is part of what the learner looks at);
 * meter probes are judged by the probe itself, not their cable.
 */
function blockerCandidates(scene: THREE.Object3D, bench: BenchState, targets: string[], lifted: THREE.Object3D[]): { obj: THREE.Object3D; box: THREE.Box3 }[] {
  const ids = new Set<string>();
  for (const t of targets) {
    const p = parseTarget(t);
    if (p?.type === "part") ids.add(p.id);
    else if (p?.type === "anchor") {
      const a = parseAnchor(p.anchor);
      if (a?.type === "pin") ids.add(a.part);
    }
  }
  for (const id of [...ids]) for (const c of spotCompanions(bench, id)) ids.add(c);
  const partOf = (anchor: string | null) => {
    const a = anchor ? parseAnchor(anchor) : null;
    return a?.type === "pin" ? a.part : null;
  };
  const keepLead = new Set(bench.leads.filter((l) => ids.has(partOf(l.a.to) ?? "") || ids.has(partOf(l.b.to) ?? "")).map((l) => l.id));
  const liftedSet = new Set(lifted);
  const under = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (liftedSet.has(p)) return true;
    return false;
  };
  // A lead carrying a spotlit gate holds it: hiding the lead would hide the gate.
  const holds = new Set<THREE.Object3D>();
  for (const l of lifted) for (let p = l.parent; p; p = p.parent) holds.add(p);
  const out: { obj: THREE.Object3D; box: THREE.Box3 }[] = [];
  scene.traverse((o) => {
    const name = o.name;
    if (!/^(part|lead|probe):/.test(name) || under(o) || holds.has(o)) return;
    const [kind, id] = name.split(":") as [string, string];
    if (kind === "part" && ids.has(id)) return;
    if (kind === "lead" && keepLead.has(id)) return;
    let box: THREE.Box3 | null;
    if (kind === "probe") box = contentBox(o.getObjectByName("probe-body") ?? o);
    else if (kind === "part" && bench.meter && id === bench.meter.id) box = meterBox(bench);
    else box = contentBox(o);
    if (box && !box.isEmpty()) out.push({ obj: o, box });
  });
  return out;
}

const tmpV = new THREE.Vector3();

/** A box's screen rectangle (NDC) and its nearest and middle depth in front of the camera. */
function screenBox(box: THREE.Box3, camera: THREE.Camera): { x0: number; y0: number; x1: number; y1: number; near: number; mid: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let near = Infinity;
  for (const p of boxPoints(box)) {
    near = Math.min(near, -tmpV.copy(p).applyMatrix4(camera.matrixWorldInverse).z);
    tmpV.copy(p).project(camera);
    x0 = Math.min(x0, tmpV.x);
    x1 = Math.max(x1, tmpV.x);
    y0 = Math.min(y0, tmpV.y);
    y1 = Math.max(y1, tmpV.y);
  }
  const mid = -box.getCenter(tmpV).applyMatrix4(camera.matrixWorldInverse).z;
  return { x0, y0, x1, y1, near, mid };
}

/** The candidates whose middle is nearer the camera than a target they overlap on screen. */
function inFront(b: { targets: THREE.Box3[]; candidates: { obj: THREE.Object3D; box: THREE.Box3 }[] }, camera: THREE.Camera): Set<THREE.Object3D> {
  const out = new Set<THREE.Object3D>();
  if (!b.targets.length) return out;
  const ts = b.targets.map((t) => screenBox(t, camera));
  for (const c of b.candidates) {
    const s = screenBox(c.box, camera);
    if (ts.some((t) => s.x0 < t.x1 && s.x1 > t.x0 && s.y0 < t.y1 && s.y1 > t.y0 && s.mid < t.near)) out.add(c.obj);
  }
  return out;
}

const viewEye = new THREE.Vector3();

/** In the board: every lead in a hole, or a probe pen standing on its tip in one (the ring lies on the board). */
function standsInBoard(bench: BenchState, part: BenchState["parts"][number]): boolean {
  if (isOnBoard(bench, part)) return true;
  const nose = partDef(part.kind).nose;
  return !!bench.board && !!nose && !!part.holes?.[nose];
}

/**
 * Where a part shows on the ring's plane, seen from the camera: every vertex above the plane slid down its view ray
 * onto it, so a standing part (a probe pen on its tip, an open lid) is ringed where it shows, not only round its feet.
 */
function seenFootprint(root: THREE.Object3D, box: THREE.Box3, y: number, eye: THREE.Vector3): THREE.Box3 {
  const out = new THREE.Box3();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible || !m.layers.isEnabled(0) || (m as THREE.InstancedMesh).isInstancedMesh || isEffect(m)) return;
    const pos = m.geometry?.getAttribute("position");
    if (!pos) return;
    // A few hundred points of each mesh are plenty for a ring.
    const step = Math.max(1, Math.floor(pos.count / 300));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const t = v.y <= y || eye.y <= v.y ? 1 : (eye.y - y) / (eye.y - v.y);
      out.expandByPoint(new THREE.Vector3(eye.x + (v.x - eye.x) * t, box.min.y, eye.z + (v.z - eye.z) * t));
    }
  });
  if (out.isEmpty()) return box;
  out.min.y = box.min.y;
  out.max.y = box.max.y;
  return out;
}

/**
 * Owns the spotlight's look: which objects are on the spotlight layer (re-checked every frame while it shows, so
 * models that re-mount stay lifted), the veil amount (eased) and the rings.
 */
export function SpotlightRig({ store, targets, spot, palette }: { store: BenchStore; targets: string[] | null; spot: Spotlight; palette: PaperPalette }) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const lifted = useRef(new Set<THREE.Object3D>());
  const roots = useRef<THREE.Object3D[]>([]);
  /** The bench and targets the rings were worked out for, and how many more frames to work them out again. */
  const seen = useRef<{ bench: BenchState | null; targets: string[] | null; settle: number; eye: THREE.Vector3 }>({ bench: null, targets: null, settle: 0, eye: new THREE.Vector3() });
  const [rings, setRings] = useState<Ring[]>([]);
  const ringGroup = useRef<THREE.Group>(null);
  /** What may stand between the camera and a target (worked out with the rings), and what is hidden now. */
  const blockers = useRef<{ targets: THREE.Box3[]; candidates: { obj: THREE.Object3D; box: THREE.Box3 }[] }>({ targets: [], candidates: [] });
  const hidden = useRef(new Set<THREE.Object3D>());
  const lastView = useRef(new THREE.Matrix4());
  const material = useMemo(() => ringMaterial(palette.red), [palette.red]);
  useEffect(() => () => material.dispose(), [material]);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  spot.state.color.set(palette.paper);
  const want = targets ? 0.66 : 0;
  useEffect(() => {
    invalidate();
  }, [targets, invalidate]);

  useFrame((_, dt) => {
    const scene = get().scene;
    const bench = store.getState().bench;
    const s = seen.current;
    // Rings and lifted roots follow the models: work them out again after the bench or the targets change, and for a
    // few frames after that, while the models catch up (a part stood in a hole, an opened box's contents mount).
    if (targets && (s.bench !== bench || s.targets !== targets)) {
      s.bench = bench;
      s.targets = targets;
      s.settle = 3;
    }
    // Rings lie where the camera sees their parts: when it moves, they follow.
    const eye = get().camera.getWorldPosition(viewEye);
    if (targets && s.eye.distanceTo(eye) > Math.max(2, eye.length() * 0.01)) {
      s.eye.copy(eye);
      s.settle = Math.max(s.settle, 1);
    }
    if (targets && s.settle > 0) {
      s.settle--;
      if (s.settle > 0) invalidate();
      const r: THREE.Object3D[] = [];
      const next: Ring[] = [];
      const targetBoxes: THREE.Box3[] = [];
      for (const t of targets) {
        const parsed = parseTarget(t);
        if (!parsed) continue;
        if (parsed.type === "part") {
          const obj = scene.getObjectByName(`part:${parsed.id}`);
          if (obj) r.push(obj);
          // A holder brings what it holds (an open box's contents), and a seated part its holder, as in ink.
          for (const id of spotCompanions(bench, parsed.id)) {
            const o = scene.getObjectByName(`part:${id}`);
            if (o) r.push(o);
          }
          // A stress bar is a tag over the view: it rings itself (Readouts).
          if (parsed.sub === STRESS_MARK) continue;
          const isMeter = !!bench.meter && parsed.id === bench.meter.id;
          if (isMeter && parsed.sub) {
            const p = meterSpot(bench, parsed.sub);
            if (p) next.push({ key: t, box: pointBox(p, parsed.sub === "display" ? 30 : 6, 1), y: p[1] - 0.4 });
            continue;
          }
          const part = bench.parts.find((x) => x.id === parsed.id);
          const box = obj ? contentBox(obj) : null;
          if (box && !box.isEmpty()) {
            targetBoxes.push(box);
            const y = part && standsInBoard(bench, part) ? BOARD_TOP : 0;
            next.push({ key: t, box: obj ? seenFootprint(obj, box, y, s.eye) : box, y });
          }
        } else if (parsed.type === "lead" || parsed.type === "wire") {
          const obj = scene.getObjectByName(`${parsed.type}:${parsed.id}`);
          if (obj) r.push(obj);
        } else {
          const a = parseAnchor(parsed.anchor);
          if (a?.type === "pin") {
            const obj = scene.getObjectByName(`part:${a.part}`);
            if (obj) r.push(obj);
          }
          const p = anchorPosition(bench, parsed.anchor);
          if (p) {
            next.push({ key: t, box: pointBox(p, 1.4, 0.5), y: a?.type === "hole" || a?.type === "wire" ? BOARD_TOP : Math.max(0, p[1] - 1) });
            targetBoxes.push(pointBox(p, 3, 2));
          }
        }
      }
      blockers.current = { targets: targetBoxes, candidates: blockerCandidates(scene, bench, targets, r) };
      lastView.current.identity();
      roots.current = r;
      setRings((prev) => (sameRings(prev, next) ? prev : next));
    }
    if (!targets && s.targets) {
      s.targets = null;
      roots.current = [];
      blockers.current = { targets: [], candidates: [] };
    }
    // What stands between the camera and a target is not veiled but gone, so a close-up is never a blur of handles.
    const camera = get().camera;
    camera.updateMatrixWorld();
    if (!lastView.current.equals(camera.matrixWorld)) {
      lastView.current.copy(camera.matrixWorld);
      const next = targets ? inFront(blockers.current, camera) : new Set<THREE.Object3D>();
      for (const o of hidden.current) if (!next.has(o)) o.visible = true;
      for (const o of next) o.visible = false;
      hidden.current = next;
    } else if (!targets && hidden.current.size) {
      for (const o of hidden.current) o.visible = true;
      hidden.current = new Set();
    }
    // Lift (or drop) the spotlit meshes.
    const now = new Set<THREE.Object3D>();
    for (const root of roots.current)
      root.traverse((o) => {
        if (((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite) && o.layers.isEnabled(0)) {
          o.layers.enable(SPOT_LAYER);
          now.add(o);
        }
      });
    for (const o of lifted.current) if (!now.has(o)) o.layers.disable(SPOT_LAYER);
    lifted.current = now;
    // Ease the veil in and out.
    const a = spot.state.amount;
    if (Math.abs(a - want) > 0.002 && !reduced) {
      spot.state.amount = a + (want - a) * Math.min(1, dt * 9);
      invalidate();
    } else spot.state.amount = want;
    material.uniforms.amount!.value = targets ? Math.min(1, spot.state.amount / 0.66) : 0;
    if (!targets && spot.state.amount === 0 && rings.length) setRings([]);
  }, -1);
  useLayoutEffect(() => {
    ringGroup.current?.traverse((o) => o.layers.set(SPOT_LAYER));
  });
  return (
    <group ref={ringGroup}>
      {rings.map((r) => (
        <SpotRing key={r.key} ring={r} material={material} />
      ))}
    </group>
  );
}

function SpotRing({ ring, material }: { ring: Ring; material: THREE.ShaderMaterial }) {
  const { box } = ring;
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const margin = 2.4 + Math.min(s.x, s.z) * 0.12;
  const hx = s.x / 2 + margin;
  const hz = s.z / 2 + margin;
  const pad = 6;
  const mat = useMemo(() => {
    const m = material.clone();
    m.uniforms.color = material.uniforms.color!;
    m.uniforms.amount = material.uniforms.amount!;
    return m;
  }, [material]);
  useEffect(() => () => mat.dispose(), [mat]);
  mat.uniforms.size!.value.set((hx + pad) * 2, (hz + pad) * 2);
  mat.uniforms.halfSize!.value.set(hx, hz);
  // A band round a small part; a rounded rectangle round a big one, whose corners it must not cut (as in ink).
  mat.uniforms.radius!.value = Math.min(Math.min(hx, hz) * 0.85, margin * 3.2);
  mat.uniforms.width!.value = 2.4;
  mat.uniforms.glow!.value = Math.max(1.5, Math.min(hx, hz) * 0.25);
  return (
    <mesh
      geometry={RING_GEO}
      material={mat}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[c.x, ring.y + 0.15, c.z]}
      scale={[(hx + pad) * 2, (hz + pad) * 2, 1]}
      renderOrder={40}
      raycast={() => {}}
    />
  );
}
