/**
 * The isle on screen. It draws a plan as it stands after event k: each island's board as one mesh, every piece and
 * landmark as an instance in a pool per (kind, tier, variant), so even a 300-lesson isle is a few dozen pools. The
 * robot floats over the plaza, lamps and windows glow at night (by the learner's local time), and a reveal flies the
 * camera to what the latest events brought and springs it in, with sparks and a sound.
 *
 * Only this module and its imports load three.js; the app imports it through mountIsle(), on demand.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { tiersOf, variantsOf } from "../catalog";
import { EN, type IsleMessages } from "../messages";
import { key, tierAt, type IsleItem, type IslePlan } from "../plan";
import { play } from "./audio";
import { Emitter, Points, pointScale } from "./fx";
import { Shape, type Built } from "./kit";
import { buildLandmark } from "./landmarks";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { InkPass } from "./ink";
import { bridge, cloud, designators, landAt, landMesh, landPalette, paintBoard, turn, type Board, type LandInfo } from "./land";
import { NOTEBOOK, gradeFor, type Look, type Paper } from "./look";
import { SMALL, buildPiece } from "./pieces";
import { makeRobot } from "./robot";

export type { Look, Paper } from "./look";

export type IsleLabel = { title: string; detail: string; kind: string; x: number; y: number };
export type RevealInfo = { title: string; lines: string[]; big: boolean };
export type IsleStats = {
  fps: number;
  frameMs: number;
  /** Mean main-thread time of a drawn frame (the update and the render calls), in ms. */
  workMs: number;
  /** Frames drawn since the isle was mounted (a still or slowly moving isle is not drawn on every frame). */
  drawn: number;
  frames: number;
  calls: number;
  triangles: number;
  instances: number;
  pools: number;
  geometries: number;
  dpr: number;
};
export type MountOptions = {
  /** Drag to turn and pinch or scroll to zoom (the /isle page). Without it the camera sways gently (a teaser). */
  interactive: boolean;
  /** "low" caps the pixel ratio at 1.5 (2 for "high") and halves the shadow map. */
  quality: "high" | "low";
  /** No reveal sound. */
  muted: boolean;
  /** No sway, bob, sparks or springs: a reveal shows its result at once, and a still isle is drawn only on change. */
  reducedMotion: boolean;
  /** The learner's local time for day and night (default: the clock, checked every minute). */
  time?: Date;
  /** Called with what was tapped (null when the tap hit nothing), and again as it moves on screen. */
  onPick?: (label: IsleLabel | null) => void;
  /** Show the isle as it stood after this event (default: the last). */
  at?: number;
  /** The words for labels and reveal captions (default: English, ISLE_EN), so the app can translate them. */
  messages?: IsleMessages;
  /** The reveal sound plays on this context (default: the page's shared isle context, unlocked by primeAudio()). */
  audio?: AudioContext;
  /** Turns a teaser (not interactive) slowly round, in degrees a second, instead of swaying; reducedMotion keeps it still. */
  autoRotate?: number;
  /** Screen space covered at the edge, in CSS pixels (say a caption card at the bottom): the isle and reveals frame above it. */
  inset?: IsleInset;
  /**
   * "notebook" (the default) sets the isle on the Classic notebook page: paper instead of sky, graphite ink round the
   * voxels, muted inks, soft pencil shadows, a night page, and calmer motion. "classic" is the original sky look.
   */
  look?: Look;
  /**
   * Notebook only: what lies under the isle. "grid" (the default) is grid paper, "plain" paper without the grid, and
   * "clear" a transparent canvas, so the page's own paper shows through (the isle still casts its pencil shadow on it).
   */
  paper?: Paper;
};
export type IsleInset = { bottom?: number };
export type IsleView = {
  /** Animates what events from + 1 ... to brought; resolves once it has landed. */
  reveal(from: number, to: number): Promise<RevealInfo>;
  setTime(date: Date): void;
  pause(): void;
  resume(): void;
  resize(): void;
  stats(): IsleStats;
  dispose(): void;
  /** Shows the isle after event k (no animation). */
  show(k: number): void;
  /** Swaps in a new plan (for example one more event) and shows it after event k (default: the last). */
  update(plan: IslePlan, k?: number): void;
  setMuted(muted: boolean): void;
  /** Zooms the default framing in (above 1) or out (below 1), for zoom buttons. */
  setZoom(zoom: number): void;
  /** Forgets the tapped thing, so its label is not sent again as the camera moves (onPick is not called). */
  clearPick(): void;
  /** Changes the covered screen space (see MountOptions.inset), for example when a caption card is resized. */
  setInset(inset: IsleInset): void;
};

const deg = (d: number) => (d * Math.PI) / 180;
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const spring = (k: number, big: boolean) => (big ? 1 - Math.exp(-4.2 * k) * Math.cos(8.5 * k) : 1 - Math.exp(-6 * k) * Math.cos(11 * k));
/** The notebook's spring: it presses in like a stamp, one small overshoot (4 %, 7 % for a landmark) and settled. */
const press = (k: number, big: boolean) => (big ? 1 - Math.exp(-5.5 * k) * Math.cos(6.5 * k) : 1 - Math.exp(-8 * k) * Math.cos(8 * k));
const smooth = (x: number) => ease(Math.max(0, Math.min(1, x)));

/** 0 by day, 1 at night, by local time: dusk from 18:30 to 20:30, dawn from 5:30 to 7:30. */
export function nightOf(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7.5 && h <= 18.5) return 0;
  if (h > 18.5 && h < 20.5) return smooth((h - 18.5) / 2);
  if (h >= 5.5 && h < 7.5) return 1 - smooth((h - 5.5) / 2);
  return 1;
}

const SKY = {
  dayTop: new THREE.Color("#7CC6EC"),
  dayBottom: new THREE.Color("#E4F3F4"),
  duskTop: new THREE.Color("#5E68A8"),
  duskBottom: new THREE.Color("#F6B88E"),
  nightTop: new THREE.Color("#0A1130"),
  nightBottom: new THREE.Color("#2A3266"),
};

/**
 * How each look moves. The notebook's motion is calmer: the robot hovers in place with a slow, small bob, a teaser
 * sways less, nothing smokes or drifts, and a reveal is shorter, with springs that press in instead of bouncing.
 * Times in seconds, angles in degrees.
 */
const MOTION = {
  classic: {
    /** When the new things land after a reveal starts, and the camera's flight to them (start, length). */
    land: 1.1,
    fly: [0.25, 0.85],
    /** Pauses between land rising, the lesson's piece, and each of a module's landmarks. */
    gaps: [0.45, 0.6, 0.4],
    /** How long the last thing takes to settle (lesson, module), and how long the camera lingers after. */
    settle: [0.9, 1.5],
    linger: 2.6,
    /** How far a new island chunk rises from. */
    rise: 5,
    sway: 10,
    swayRate: 0.12,
    bob: 0.12,
    bobRate: 2.1,
    tilt: 0.05,
    wander: 0.9,
    /** Sparks, wobble, smoke and drifting clouds. */
    lively: true,
  },
  notebook: {
    land: 0.6,
    fly: [0.05, 0.55],
    gaps: [0.3, 0.4, 0.3],
    settle: [0.6, 1.0],
    linger: 1.8,
    rise: 3,
    sway: 4,
    swayRate: 0.08,
    bob: 0.07,
    bobRate: 1.4,
    tilt: 0,
    wander: 0,
    lively: false,
  },
} as const;

export function createIsleView(el: HTMLElement, initial: IslePlan, opts: MountOptions): IsleView {
  let plan = initial;
  const msg = opts.messages ?? EN;
  let muted = opts.muted;
  const reduced = opts.reducedMotion;
  const look: Look = opts.look ?? "notebook";
  const notebook = look === "notebook";
  const paper: Paper = opts.paper ?? "grid";
  const mo = MOTION[look];
  const grade = gradeFor(look);
  const landPal = landPalette(grade);
  const amberC = new THREE.Color(NOTEBOOK.amber);
  /** A teaser that turns round (unless motion is reduced), framed as it stands at each angle. */
  const turning = !opts.interactive && !!opts.autoRotate && !reduced;
  /** Degrees turned so far, and where the frame was last fitted. */
  let spin = 0;
  let fittedAt = 0;
  /** CSS pixels covered at the bottom, and the canvas height they are a share of. */
  let insetPx = Math.max(0, opts.inset?.bottom ?? 0);
  let heightPx = 1;
  const cover = () => Math.min(0.6, insetPx / heightPx);
  const canvas = document.createElement("canvas");
  // an interactive isle takes touch gestures; a teaser leaves them to the page, so it still scrolls
  canvas.style.cssText = `display:block;width:100%;height:100%;outline:none;touch-action:${opts.interactive ? "none" : "auto"}`;
  canvas.setAttribute("aria-hidden", "true");
  el.append(canvas);
  // the notebook draws into its own multisampled target (for the ink), so the canvas needs no antialiasing of its own
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !notebook, alpha: notebook && paper === "clear", powerPreference: "high-performance" });
  const dpr = Math.min(window.devicePixelRatio || 1, opts.quality === "low" ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  // multisampled only where pixels are big enough for jagged edges to show (a 1x screen at high quality); on a phone or
  // a retina screen the ink lines and small pixels hide them, and the depth resolve is the costly part of the pass
  const ink = notebook ? new InkPass(paper, opts.quality === "high" && dpr < 1.5 ? 4 : 0) : null;
  if (ink) renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  /** Set whenever something changed, so a still isle is not drawn again. */
  let dirty = true;
  /** Set by slow idle motion only (the notebook draws it on every other frame). */
  let alive = false;

  // Camera: orthographic and isometric; the frame follows the isle as it grows.
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 8000);
  const POLAR = 55;
  const AZ = 45;
  cam.position.setFromSphericalCoords(900, deg(POLAR), deg(AZ));
  const controls = opts.interactive ? new OrbitControls(cam, canvas) : null;
  if (controls) {
    controls.enablePan = false;
    controls.enableDamping = !reduced;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.minPolarAngle = deg(32);
    controls.maxPolarAngle = deg(68);
    controls.minZoom = 0.6;
    controls.maxZoom = 10;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }
  let aspect = 1;
  const focus = new THREE.Vector3();
  const focusGoal = new THREE.Vector3();
  const lift = new THREE.Vector3();
  let half = 10;
  let halfGoal = 10;

  // Light and sky.
  // Light: a bright sky fill and a sun from the front left, so left faces are lit and right faces fall into shade.
  const hemi = new THREE.HemisphereLight("#EAF4FF", "#8A7A62", 2.0);
  const sun = new THREE.DirectionalLight("#FFF6E6", 1.6);
  sun.castShadow = true;
  const shadowSize = opts.quality === "low" ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 3;
  if (notebook) {
    // pencil shadows: wider and lighter, so a shaded face reads as soft graphite, not a hole
    sun.shadow.radius = 5;
    sun.shadow.intensity = 0.62;
  }
  scene.add(hemi, sun, sun.target);
  // The sky is a screen-space gradient (an orthographic camera would see a sky sphere as one flat colour).
  // The notebook has no sky and no stars: the ink pass lays the isle on paper.
  const skyU = { uTop: { value: SKY.dayTop.clone() }, uBottom: { value: SKY.dayBottom.clone() } };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyU,
    depthWrite: false,
    depthTest: false,
    vertexShader: "varying float vY; void main(){ vY = position.y * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.9999, 1.0); }",
    fragmentShader:
      "uniform vec3 uTop; uniform vec3 uBottom; varying float vY; void main(){ gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(0.0, 1.0, vY)), 1.0);\n#include <colorspace_fragment>\n}",
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  if (!notebook) scene.add(sky);

  // Stars: fixed points on the screen's upper part, shown at night.
  const starU = { uFade: { value: 0 }, uPx: { value: 1 } };
  const starMat = new THREE.ShaderMaterial({
    uniforms: starU,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader:
      "uniform float uPx; attribute float aSize; varying float vA; void main(){ vA = position.z; gl_Position = vec4(position.xy, 0.9998, 1.0); gl_PointSize = aSize * uPx; }",
    fragmentShader:
      "uniform float uFade; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)) * vA * uFade; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.97, 0.88) * a, a);\n#include <colorspace_fragment>\n}",
  });
  const starGeo = new THREE.BufferGeometry();
  {
    let x = 99;
    const rnd = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
    const n = 180;
    const pos = new Float32Array(n * 3);
    const sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rnd() * 2 - 1;
      pos[i * 3 + 1] = 1 - rnd() * rnd() * 1.6;
      pos[i * 3 + 2] = 0.35 + rnd() * 0.65;
      sz[i] = 1.5 + rnd() * rnd() * 3;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
  }
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  if (!notebook) scene.add(stars);

  // Materials.
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const landMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glowU = { uNight: { value: 0 } };
  const glowMat = new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: glowU,
    vertexShader: /* glsl */ `
      attribute vec3 dayColor;
      uniform float uNight;
      varying vec3 vC;
      void main() {
        float lit = uNight;
        #ifdef USE_INSTANCING_COLOR
          lit *= instanceColor.r;
        #endif
        vC = mix(dayColor, color * 1.08, lit);
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main() {
        gl_FragColor = vec4(vC, 1.0);
        #include <colorspace_fragment>
      }`,
  });

  // Kit geometries, built once each, on demand.
  type Geo = { body: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null; built: Built };
  const geos = new Map<string, Geo>();
  const geoKey = (it: IsleItem, tier: number) => (it.landmark ? `${it.kind}:${Math.min(tier, tiersOf(it.kind) - 1)}` : `${it.kind}:${it.v % variantsOf(it.kind)}`);
  const geoOf = (it: IsleItem, tier: number): Geo => {
    const k = geoKey(it, tier);
    let g = geos.get(k);
    if (!g) {
      const s = new Shape({ grade });
      const built = it.landmark ? buildLandmark(s, it.kind, Math.min(tier, tiersOf(it.kind) - 1)) : buildPiece(s, it.kind, it.v % variantsOf(it.kind));
      g = { ...s.geometries(), built };
      geos.set(k, g);
    }
    return g;
  };

  const M = new THREE.Matrix4();
  const Qt = new THREE.Quaternion();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const compose = (x: number, y: number, z: number, ry: number, s = 1, sy = s) =>
    M.compose(P.set(x, y, z), Qt.setFromAxisAngle(UP, ry), S.set(Math.max(1e-3, s), Math.max(1e-3, sy), Math.max(1e-3, s)));
  const worldOf = (it: IsleItem) => {
    const o = plan.islands[it.island]!;
    return { x: o.x + it.x, y: o.y, z: o.z + it.z };
  };
  const ryOf = (it: IsleItem) => (it.rot * Math.PI) / 2;

  // What is on screen.
  const world = new THREE.Group();
  scene.add(world);
  type Pool = { key: string; items: IsleItem[]; tiers: number[]; mesh: THREE.InstancedMesh; glow: THREE.InstancedMesh | null; small: boolean };
  let pools: Pool[] = [];
  let lands: THREE.Mesh[] = [];
  let extras: THREE.Object3D[] = [];
  let shownK = 0;
  let extent = { x: 0, z: 0, r: 8, top: 6, depth: 10 };
  /** The isle's bounds on screen (in world units along the default camera's right and up axes). */
  let screenBox = { sx0: -8, sx1: 8, sy0: -8, sy1: 8 };
  const th = deg(AZ);
  const ph = deg(POLAR);
  const RIGHT = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
  const UPV = new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.sin(ph), -Math.cos(ph) * Math.cos(th));
  const onScreen = (x: number, y: number, z: number): [number, number] => [x * RIGHT.x + z * RIGHT.z, x * UPV.x + y * UPV.y + z * UPV.z];
  // The default camera's right, up and view axes as they are now: a turning isle turns them, and the frame, the
  // clouds and the screen box follow.
  const camR = RIGHT.clone();
  const camU = UPV.clone();
  const camV = new THREE.Vector3().crossVectors(RIGHT, UPV);
  const turnTo = (azDeg: number) => {
    const a = deg(azDeg);
    camR.set(Math.cos(a), 0, -Math.sin(a));
    camU.set(-Math.cos(ph) * Math.sin(a), Math.sin(ph), -Math.cos(ph) * Math.cos(a));
    camV.crossVectors(camR, camU);
  };
  /** The points that bound the isle on screen (x, y, z triples), kept for a turning isle to refit its frame. */
  let bounds: number[] = [];
  const boxNow = () => {
    const b = { sx0: Infinity, sx1: -Infinity, sy0: Infinity, sy1: -Infinity };
    for (let i = 0; i < bounds.length; i += 3) {
      const x = bounds[i]!;
      const y = bounds[i + 1]!;
      const z = bounds[i + 2]!;
      const a = x * camR.x + z * camR.z;
      const v = x * camU.x + y * camU.y + z * camU.z;
      b.sx0 = Math.min(b.sx0, a);
      b.sx1 = Math.max(b.sx1, a);
      b.sy0 = Math.min(b.sy0, v);
      b.sy1 = Math.max(b.sy1, v);
    }
    return b;
  };
  let landInfo: (LandInfo | null)[] = [];
  let boards: (Board | null)[] = [];
  let refs = designators(plan.items);
  let halos = new Points(1, "soft", { additive: true, order: 3 });
  let smokeAt: THREE.Vector3[] = [];

  const clear = () => {
    for (const p of pools) {
      world.remove(p.mesh);
      p.mesh.dispose();
      if (p.glow) {
        world.remove(p.glow);
        p.glow.dispose();
      }
    }
    for (const l of lands) {
      world.remove(l);
      l.geometry.dispose();
    }
    for (const e of extras) {
      world.remove(e);
      e.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    pools = [];
    lands = [];
    extras = [];
  };

  /** Shows the isle after event kk; `hold` items are left out (the reveal draws them itself), and so is `newLand`. */
  const show = (kk: number, hold: Set<number> = new Set(), newLand: Map<number, Set<number>> = new Map()) => {
    clear();
    shownK = kk;
    landInfo = plan.islands.map((isl) => (isl.at <= kk ? landAt(isl, kk) : null));
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    let top = 6;
    let depth = 4;
    const fr = { sx0: Infinity, sx1: -Infinity, sy0: Infinity, sy1: -Infinity };
    const seen: number[] = [];
    const see = (x: number, y: number, z: number) => {
      const [a, b] = onScreen(x, y, z);
      fr.sx0 = Math.min(fr.sx0, a);
      fr.sx1 = Math.max(fr.sx1, a);
      fr.sy0 = Math.min(fr.sy0, b);
      fr.sy1 = Math.max(fr.sy1, b);
      if (turning) seen.push(x, y, z);
    };
    const lights: { x: number; y: number; z: number; c: THREE.Color; s: number }[] = [];
    smokeAt = [];
    boards = plan.islands.map((isl, i) => {
      const info = landInfo[i];
      if (!info) return null;
      const present = plan.items.filter((it) => it.island === i && tierAt(it, kk) >= 0 && !hold.has(it.id)).map((it) => ({ it, built: geoOf(it, tierAt(it, kk)).built }));
      const board = paintBoard(isl, info, present, refs);
      const fresh = newLand.get(i);
      const keep = fresh ? new Set([...info.cells.keys()].filter((c) => !fresh.has(c))) : null;
      // the board's top takes shadows; its sides and keel only cast them (self-shadowed steps look streaky)
      const geo = landMesh(info, board, keep, landPal);
      const mesh = new THREE.Mesh(geo.top, landMat);
      mesh.position.set(isl.x, isl.y, isl.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      const sides = new THREE.Mesh(geo.sides, landMat);
      sides.position.copy(mesh.position);
      sides.castShadow = true;
      world.add(mesh, sides);
      lands.push(mesh, sides);
      for (const c of info.cells.values()) {
        x0 = Math.min(x0, isl.x + c.x);
        x1 = Math.max(x1, isl.x + c.x);
        z0 = Math.min(z0, isl.z + c.z);
        z1 = Math.max(z1, isl.z + c.z);
        depth = Math.max(depth, c.depth - isl.y);
        if (c.rim === 0) {
          see(isl.x + c.x - 0.5, isl.y, isl.z + c.z - 0.5);
          see(isl.x + c.x + 0.5, isl.y, isl.z + c.z + 0.5);
          see(isl.x + c.x + 0.5, isl.y, isl.z + c.z - 0.5);
          see(isl.x + c.x - 0.5, isl.y, isl.z + c.z + 0.5);
        }
        see(isl.x + c.x, isl.y - c.depth, isl.z + c.z);
      }
      return board;
    });
    // the pencil shadow each island casts on the page, far enough below its keel that it floats
    if (pageShadows) {
      let n = 0;
      plan.islands.forEach((isl, i) => {
        const info = landInfo[i];
        if (!info || n >= pageShadows.instanceMatrix.count) return;
        let cx = 0;
        let cz = 0;
        let deep = 0;
        for (const c of info.cells.values()) {
          cx += c.x;
          cz += c.z;
          deep = Math.max(deep, c.depth);
        }
        cx = isl.x + cx / info.cells.size;
        cz = isl.z + cz / info.cells.size;
        const r = Math.sqrt(info.cells.size / Math.PI) + 0.5;
        const y = isl.y - Math.min(deep, 48) - (0.35 * r + 1);
        compose(cx, y, cz, 0, r * 1.55);
        pageShadows.setMatrixAt(n++, M);
        // its middle stays in the frame (the soft rim may fall in the margin), so the isle is not framed smaller
        for (const [dx, dz] of [
          [0.25, 0.25],
          [-0.25, -0.25],
        ] as const)
          see(cx + dx * r, y, cz + dz * r);
      });
      pageShadows.count = n;
      pageShadows.instanceMatrix.needsUpdate = true;
      pageShadows.computeBoundingSphere();
    }
    // a ribbon cable bridge from the main island to each other one
    plan.islands.forEach((isl, i) => {
      const info = landInfo[i];
      const main = landInfo[0];
      if (i === 0 || !info || !main) return;
      const m0 = plan.islands[0]!;
      const dir = Math.atan2(isl.z - m0.z, isl.x - m0.x);
      const c = Math.cos(dir);
      const sn = Math.sin(dir);
      let a = 0;
      while (main.cells.has(key(Math.round(c * a), Math.round(sn * a)))) a += 0.5;
      let b = 0;
      while (info.cells.has(key(Math.round(-c * b), Math.round(-sn * b)))) b += 0.5;
      const ax = m0.x + c * (a - 0.75);
      const az = m0.z + sn * (a - 0.75);
      const bx = isl.x - c * (b - 0.75);
      const bz = isl.z - sn * (b - 0.75);
      const s = new Shape({ grade });
      bridge(s, bx - ax, isl.y - m0.y, bz - az);
      const g = s.geometries().body!;
      const mesh = new THREE.Mesh(g, bodyMat);
      mesh.position.set(ax, m0.y, az);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      world.add(mesh);
      extras.push(mesh);
    });
    if (!Number.isFinite(x0)) x0 = x1 = z0 = z1 = 0;
    // the pools
    const byKey = new Map<string, { items: IsleItem[]; tiers: number[] }>();
    for (const it of plan.items) {
      const t = tierAt(it, kk);
      if (t < 0 || hold.has(it.id) || plan.islands[it.island]!.at > kk) continue;
      const k2 = geoKey(it, t);
      const e = byKey.get(k2) ?? { items: [], tiers: [] };
      e.items.push(it);
      e.tiers.push(t);
      byKey.set(k2, e);
    }
    for (const [k2, e] of byKey) {
      const g = geoOf(e.items[0]!, e.tiers[0]!);
      if (!g.body) continue;
      const mesh = new THREE.InstancedMesh(g.body, bodyMat, e.items.length);
      const glow = g.glow ? new THREE.InstancedMesh(g.glow, glowMat, e.items.length) : null;
      e.items.forEach((it, i) => {
        const w = worldOf(it);
        const ry = ryOf(it);
        compose(w.x, w.y, w.z, ry);
        mesh.setMatrixAt(i, M);
        if (glow) glow.setMatrixAt(i, M);
        top = Math.max(top, g.built.top + w.y + 1);
        see(w.x, w.y + g.built.top, w.z);
        for (const l of g.built.lights) {
          const [lx, lz] = turn(l.x, l.z, it.rot);
          lights.push({ x: w.x + lx, y: w.y + l.y, z: w.z + lz, c: new THREE.Color(l.color), s: l.size });
        }
        for (const [sx, sy, sz] of g.built.smoke) {
          const [lx, lz] = turn(sx, sz, it.rot);
          smokeAt.push(new THREE.Vector3(w.x + lx, w.y + sy, w.z + lz));
        }
      });
      const small = SMALL.has(e.items[0]!.kind);
      mesh.castShadow = !small;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      world.add(mesh);
      if (glow) {
        glow.computeBoundingSphere();
        world.add(glow);
      }
      pools.push({ key: k2, items: e.items, tiers: e.tiers, mesh, glow, small });
    }
    // halos for the lights, one draw call
    scene.remove(halos.obj);
    halos.dispose();
    halos = new Points(Math.max(1, lights.length), "soft", { additive: true, order: 3 });
    // on the night page every lamp glows towards the notebook's amber (a coloured LED keeps a little of its colour)
    if (notebook) for (const l of lights) l.c.lerp(amberC, 0.45);
    lights.forEach((l, i) => halos.set(i, l.x, l.y, l.z, l.s, 0.85, l.c));
    halos.draw(lights.length);
    halos.flush();
    halos.fade.value = night;
    scene.add(halos.obj);
    extent = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.max(x1 - x0, z1 - z0) / 2 + 1, top: Math.max(top, 5.5), depth: Math.min(depth, 48) };
    // the robot hovers over the main plaza: keep it in the frame
    const m0 = plan.islands[0]!;
    see(m0.x, m0.y + 6.5, m0.z);
    if (Number.isFinite(fr.sx0)) screenBox = fr;
    if (turning && seen.length) {
      bounds = seen;
      screenBox = boxNow();
    }
    fitShadow();
    halfGoal = frameFor(extent);
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
  };

  /** The shape of the open part of the screen (above any inset). */
  const openAspect = () => aspect / (1 - cover());
  /** Half the view height that fits the whole isle in the open part of the screen, with a small margin. */
  const frameFor = (_e: typeof extent) => {
    const hh = (screenBox.sy1 - screenBox.sy0) / 2;
    const hw = (screenBox.sx1 - screenBox.sx0) / 2;
    const a = openAspect();
    const m = a < 0.8 ? 1.07 : 1.12;
    return Math.max(hh * m + 0.5, (hw * m + 0.5) / a) / userZoom;
  };
  /** The point the default camera looks at so the isle sits in the middle of the open part of the screen. */
  const frameCentre = (out: THREE.Vector3) => out.copy(camR).multiplyScalar((screenBox.sx0 + screenBox.sx1) / 2).addScaledVector(camU, (screenBox.sy0 + screenBox.sy1) / 2);
  let userZoom = 1;
  const fitShadow = () => {
    const R = extent.r + 8;
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 2000 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(extent.x - 50, 125, extent.z + 100);
    sun.target.position.set(extent.x, 0, extent.z);
    sun.target.updateMatrixWorld();
  };

  // The robot floats over the main plaza, with a soft shadow under it.
  // the robot's shell keeps a little light of its own, so it reads warm white in any light
  const robotMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6b645a, emissiveIntensity: 0.45 });
  const robot = makeRobot(robotMat, glowMat, look);
  scene.add(robot.group);
  /**
   * A soft round shadow as an alpha map (which reads the green channel): grey levels on black, `stops` are
   * [offset, level] from the middle out. The classic look keeps its original map, white with a fading alpha.
   */
  const roundTex = (stops: [number, number][], grey: boolean) => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [o, a] of stops) r.addColorStop(o, grey ? `rgb(${Math.round(a * 255)},${Math.round(a * 255)},${Math.round(a * 255)})` : `rgba(255,255,255,${a})`);
    if (grey) {
      g.fillStyle = "#000";
      g.fillRect(0, 0, 64, 64);
    }
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  };
  const shadowTex = roundTex(
    [
      [0, 1],
      [0.5, 0.6],
      [1, 0],
    ],
    notebook,
  );
  const robotShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.3),
    new THREE.MeshBasicMaterial({ color: notebook ? NOTEBOOK.ink : 0x0b2a1a, alphaMap: shadowTex, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  // the notebook's islands each cast a flat pencil shadow on the page (one draw call for them all)
  const pageTex = notebook
    ? roundTex(
        [
          [0, 1],
          [0.5, 0.94],
          [0.78, 0.6],
          [1, 0],
        ],
        true,
      )
    : null;
  const pageShadows = pageTex
    ? new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: NOTEBOOK.shade, alphaMap: pageTex, transparent: true, opacity: 0.6, depthWrite: false }),
        8,
      )
    : null;
  if (pageShadows) {
    pageShadows.count = 0;
    pageShadows.renderOrder = -1;
    scene.add(pageShadows);
  }
  robotShadow.rotation.x = -Math.PI / 2;
  robotShadow.renderOrder = 1;
  scene.add(robotShadow);
  const robotAt = new THREE.Vector3(0, 3.4, 0);
  const robotWant = new THREE.Vector3();

  // Clouds drift past (not on the notebook's page).
  const cloudShape = new Shape();
  cloud(cloudShape, 1);
  const cloudGeo = cloudShape.geometries().body!;
  const CLOUDS = 6;
  const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xdfe8f2, emissiveIntensity: 0.35, transparent: true });
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, CLOUDS);
  clouds.frustumCulled = false;
  if (mo.lively) scene.add(clouds);
  /** Clouds sit in the screen's margins round the isle (beside it on a wide screen, above and below on a tall one), behind it, drifting a little. */
  const SLOTS: ["l" | "r" | "t" | "b", number][] = [
    ["l", 0.45],
    ["r", 0.25],
    ["l", -0.4],
    ["r", -0.55],
    ["t", -0.3],
    ["b", 0.35],
  ];
  // the clouds keep their place on screen: they move with the camera's axes when the isle turns
  const cloudC = new THREE.Vector3();
  const placeClouds = () => {
    const vh = halfGoal * userZoom;
    const vw = vh * openAspect();
    const cx = (screenBox.sx0 + screenBox.sx1) / 2;
    const cy = (screenBox.sy0 + screenBox.sy1) / 2;
    const ihw = (screenBox.sx1 - screenBox.sx0) / 2;
    const ihh = (screenBox.sy1 - screenBox.sy0) / 2;
    frameCentre(cloudC);
    SLOTS.forEach(([side, rel], i) => {
      const lr = side === "l" || side === "r";
      const margin = lr ? vw - ihw : vh - ihh;
      const k = Math.max(0.5, Math.min(1.35, (margin * 0.5) / 5));
      const drift = Math.sin(t * 0.05 + i * 1.9) * 0.8 * k;
      let sx: number;
      let sy: number;
      if (lr) {
        sx = cx + (side === "l" ? -1 : 1) * (ihw + margin * 0.45) + drift;
        sy = cy + rel * vh * 0.75;
      } else {
        sx = cx + rel * vw * 0.8 + drift;
        sy = cy + (side === "t" ? 1 : -1) * (ihh + margin * 0.45);
      }
      P.copy(cloudC).addScaledVector(camR, sx - cx).addScaledVector(camU, sy - cy).addScaledVector(camV, -60);
      compose(P.x, P.y, P.z, 0, margin < 3.5 ? 0.001 : k);
      clouds.setMatrixAt(i, M);
    });
    clouds.instanceMatrix.needsUpdate = true;
  };

  // Effects.
  // the notebook has no sparks or smoke, and its reveal dust is drawn only while there is some
  const sparks = new Emitter(240, "spark", { additive: false });
  const dust = new Emitter(120, "soft", {});
  const smoke = new Emitter(160, "soft", {});
  if (mo.lively) scene.add(sparks.pts.obj, dust.pts.obj, smoke.pts.obj);
  else {
    scene.add(dust.pts.obj);
    dust.pts.obj.visible = false;
  }
  const dustC = new THREE.Color("#E6E1D2");
  const smokeC = new THREE.Color("#F2F2F2");
  const sparkC = ["#FFF4C2", "#FFD27A", "#FF9F45", "#FFFFFF", "#8FE3FF", "#E39A52"].map((c) => new THREE.Color(c));
  const paperC = new THREE.Color(NOTEBOOK.paper);
  const burst = (x: number, y: number, z: number, foot: number, big: boolean) => {
    if (!mo.lively) {
      // the notebook: no sparks, just a small ring of paper dust where the thing pressed in
      const n = big ? 14 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        dust.emit(x + Math.cos(a) * foot * 0.8, y + 0.15, z + Math.sin(a) * foot * 0.8, Math.cos(a) * 1.1, 0.35, Math.sin(a) * 1.1, 0.6, 0.55, 1.3, 0.5, paperC);
      }
      return;
    }
    for (let i = 0; i < (big ? 64 : 34); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * (big ? 4 : 2.5);
      sparks.emit(x + Math.cos(a) * foot * 0.3, y + 0.6, z + Math.sin(a) * foot * 0.3, Math.cos(a) * sp, 3 + Math.random() * (big ? 6 : 4), Math.sin(a) * sp, 0.9 + Math.random() * 0.6, big ? 0.36 : 0.28, 0.1, 1, sparkC[i % sparkC.length]!, 9);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      dust.emit(x + Math.cos(a) * foot, y + 0.2, z + Math.sin(a) * foot, Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6, 0.9, 0.9, 2.2, 0.55, dustC);
    }
  };

  // Day and night.
  let clock = opts.time ?? null;
  let night = nightOf(clock ?? new Date());
  const PAGE = {
    paper: new THREE.Color(NOTEBOOK.paper),
    paperNight: new THREE.Color(NOTEBOOK.paperNight),
    grid: new THREE.Color(NOTEBOOK.grid),
    gridNight: new THREE.Color(NOTEBOOK.gridNight),
    ink: new THREE.Color(NOTEBOOK.ink),
    inkNight: new THREE.Color(NOTEBOOK.inkNight),
    shade: new THREE.Color(NOTEBOOK.shade),
    shadeNight: new THREE.Color(NOTEBOOK.shadeNight),
  };
  const levels = { ink: new THREE.Color(), contour: 0.85, line: 0.8, crease: 0.4, paper: new THREE.Color(), grid: new THREE.Color() };
  /** The notebook by day, at dusk and at night: a page in daylight, then the night page under a warm desk lamp. */
  const applyPage = (n: number, w: number) => {
    // the night page is lit like a desk at night: a dim room and a warm lamp, so the isle still reads as a drawing
    hemi.intensity = 2.15 - 0.85 * n;
    hemi.color.set("#FFF8EC").lerp(new THREE.Color("#8F8A93"), n);
    hemi.groundColor.set("#B5A68C").lerp(new THREE.Color("#2A2621"), n);
    sun.intensity = 1.35 - 0.7 * n;
    sun.color.set("#FFF3E0").lerp(new THREE.Color("#F0C890"), n).lerp(new THREE.Color("#FFC08A"), w * 0.5);
    robotMat.emissiveIntensity = 0.4 + 0.5 * n;
    glowU.uNight.value = n;
    halos.fade.value = n;
    levels.ink.copy(PAGE.ink).lerp(PAGE.inkNight, n);
    // by night the lines are light graphite on the dark page: the contour clear, the lines inside it faint
    levels.contour = 0.85 - 0.25 * n;
    levels.line = 0.78 - 0.43 * n;
    levels.crease = 0.36 * (1 - n);
    levels.paper.copy(PAGE.paper).lerp(PAGE.paperNight, n);
    levels.grid.copy(PAGE.grid).lerp(PAGE.gridNight, n);
    ink!.setLevels(levels);
    if (pageShadows) {
      const m = pageShadows.material as THREE.MeshBasicMaterial;
      // on its own paper the shadow is the paper's shade; over the page's paper (clear) a thin warm graphite, which
      // darkens a light page and a night page alike
      if (paper === "clear") {
        m.color.set("#2A2118");
        m.opacity = 0.16 + 0.14 * n;
      } else m.color.copy(PAGE.shade).lerp(PAGE.shadeNight, n);
    }
    dirty = true;
  };
  const applyTime = () => {
    const n = night;
    const w = Math.max(0, 1 - Math.abs(n * 2 - 1) * 1.6);
    if (ink) {
      applyPage(n, w);
      return;
    }
    skyU.uTop.value.copy(SKY.dayTop).lerp(SKY.nightTop, n).lerp(SKY.duskTop, w * 0.6);
    skyU.uBottom.value.copy(SKY.dayBottom).lerp(SKY.nightBottom, n).lerp(SKY.duskBottom, w * 0.7);
    hemi.intensity = 2.0 - 1.1 * n;
    cloudMat.emissiveIntensity = 0.35 * (1 - n) + 0.04;
    cloudMat.opacity = 1 - 0.55 * n;
    robotMat.emissiveIntensity = 0.45 + 0.55 * n;
    hemi.color.set("#EAF4FF").lerp(new THREE.Color("#7D8FD0"), n);
    hemi.groundColor.set("#8A7A62").lerp(new THREE.Color("#1C2036"), n);
    sun.intensity = 1.6 - 1.15 * n;
    sun.color.set("#FFF6E6").lerp(new THREE.Color("#A9B9FF"), n).lerp(new THREE.Color("#FFB07A"), w * 0.7);
    glowU.uNight.value = n;
    halos.fade.value = n;
    starU.uFade.value = Math.max(0, n * 1.2 - 0.2);
    stars.visible = n > 0.05;
    dirty = true;
  };
  applyTime();
  const minute = opts.time ? 0 : window.setInterval(() => {
    if (clock) return;
    const n = nightOf(new Date());
    if (n !== night) {
      night = n;
      applyTime();
    }
  }, 60_000);

  // Taps: a part tells what put it there.
  let labelled: { it: IsleItem | null; tier: number } | null = null;
  let lastLabel = "";
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const nameOf = (kind: string, tier: number) => {
    const n = msg.names[kind];
    if (Array.isArray(n)) return n[Math.max(0, Math.min(tier, n.length - 1))] ?? kind;
    return n ?? kind;
  };
  const detailOf = (it: IsleItem, tier: number) => {
    const s = it.story[Math.max(0, Math.min(tier, it.story.length - 1))];
    const parts: string[] = [];
    const n = tiersOf(it.kind);
    if (it.landmark && n > 1) parts.push(msg.tier(tier + 1, n));
    if (s?.type === "lesson") parts.push(msg.placedBy(s.title));
    else if (s?.type === "module") parts.push(tier > 0 ? msg.raisedBy(s.title) : msg.builtBy(s.title));
    else if (it.kind === "dock") parts.push(msg.dockDetail);
    return parts.join(". ");
  };
  const tap = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const targets: THREE.Object3D[] = [robot.hit, ...pools.filter((p) => p.mesh.visible).map((p) => p.mesh)];
    const h = ray.intersectObjects(targets, false)[0];
    if (h && h.object === robot.hit) labelled = { it: null, tier: 0 };
    else {
      const pool = h && pools.find((p) => p.mesh === h.object);
      labelled = pool && h.instanceId !== undefined ? { it: pool.items[h.instanceId]!, tier: pool.tiers[h.instanceId]! } : null;
    }
    lastLabel = "";
    if (!labelled) opts.onPick?.(null);
    dirty = true;
  };
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => {
    down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  };
  const onUp = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 500) tap(e.clientX, e.clientY);
    down = null;
  };
  if (opts.onPick) {
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
  }
  const anchor = new THREE.Vector3();
  const placeLabel = () => {
    if (!labelled || !opts.onPick) return;
    let title: string;
    let detail: string;
    let kind: string;
    if (!labelled.it) {
      anchor.copy(robot.group.position).y += 1.2 * robot.group.scale.y;
      title = msg.robot;
      detail = msg.robotDetail;
      kind = "robot";
    } else {
      const it = labelled.it;
      const w = worldOf(it);
      anchor.set(w.x, w.y + geoOf(it, labelled.tier).built.top + 0.3, w.z);
      title = it.kind === "dock" ? msg.dock : nameOf(it.kind, labelled.tier);
      detail = detailOf(it, labelled.tier);
      kind = it.kind;
    }
    anchor.project(cam);
    const r = canvas.getBoundingClientRect();
    const x = ((anchor.x + 1) / 2) * r.width;
    const y = ((1 - anchor.y) / 2) * r.height;
    const k = `${x.toFixed(0)}:${y.toFixed(0)}:${title}`;
    if (k === lastLabel) return;
    lastLabel = k;
    opts.onPick({ title, detail, kind, x, y });
  };

  // The reveal.
  /** Something springing in during a reveal: a part, a new land chunk rising, or a part's marks on the board. */
  type Actor = { mesh: THREE.Mesh; glow: THREE.Mesh | null; t0: number; big: boolean; out?: boolean; x: number; y: number; z: number; ry: number; foot: number; kind: "part" | "chunk" | "marks"; done?: boolean };
  let actors: Actor[] = [];
  let rv: { t0: number; focus: THREE.Vector3; zoom: number; end: number; resolve: () => void; robot: THREE.Vector3; ground: number } | null = null;
  let linger: { until: number; focus: THREE.Vector3; zoom: number } | null = null;
  let t = 0;

  const describe = (from: number, to: number): RevealInfo => {
    const changed = plan.items.filter((it) => it.tiers.some((x) => x > from && x <= to));
    const evs = plan.events.slice(from + 1, to + 1);
    const moduleE = [...evs].reverse().find((e) => e.type === "module");
    const lessonE = [...evs].reverse().find((e) => e.type === "lesson");
    const big = !!moduleE;
    const pieces = changed.filter((it) => !it.landmark);
    const marks = changed.filter((it) => it.landmark);
    const lines: string[] = [];
    const newIsland = plan.islands.find((i) => i.at > from && i.at <= to);
    const landGrew = plan.islands.some((isl) => isl.cells.some((c) => c.at > from && c.at <= to));
    if (big) {
      const built = marks.find((it) => it.tiers[0]! > from && it.tiers[0]! <= to) ?? marks[0];
      const title = built ? nameOf(built.kind, tierAt(built, to)) : msg.isleGrows;
      lines.push(msg.moduleDone(moduleE!.title));
      for (const it of marks) if (it !== built) lines.push(it.tiers[0]! > from ? msg.newPiece(nameOf(it.kind, tierAt(it, to))) : msg.raised(nameOf(it.kind, tierAt(it, to))));
      if (newIsland) lines.push(msg.newIsland(msg.units[newIsland.unit] ?? newIsland.unit));
      if (landGrew) lines.push(msg.islandGrew);
      for (const it of pieces) lines.push(msg.newPiece(nameOf(it.kind, 0)));
      return { title, lines, big };
    }
    const piece = pieces[pieces.length - 1];
    const title = piece ? nameOf(piece.kind, 0) : msg.isleGrows;
    if (lessonE) lines.push(msg.placedBy(lessonE.title));
    if (newIsland) lines.push(msg.newIsland(msg.units[newIsland.unit] ?? newIsland.unit));
    return { title, lines, big };
  };

  const reveal = (from: number, to: number): Promise<RevealInfo> => {
    from = Math.max(-1, Math.min(from, plan.events.length - 1));
    to = Math.max(from, Math.min(to, plan.events.length - 1));
    const info = describe(from, to);
    finishReveal();
    if (!muted) play(info.big, reduced ? 0 : mo.land - 0.4, opts.audio);
    if (reduced || to === from) {
      show(to);
      return Promise.resolve(info);
    }
    const changed = plan.items.filter((it) => it.tiers.some((x) => x > from && x <= to));
    const newLand = new Map<number, Set<number>>();
    plan.islands.forEach((isl, i) => {
      const s = new Set<number>();
      // a whole new island rises as one chunk
      for (const c of isl.cells) if (c.at > from && c.at <= to) s.add(key(c.x, c.z));
      if (s.size) newLand.set(i, s);
    });
    const hold = new Set(changed.map((c) => c.id));
    show(to, hold, newLand);
    const t0 = t + mo.land;
    let delay = 0;
    // new land first, then the piece, then what the module built or raised
    for (const [i, cells] of newLand) {
      const info2 = landInfo[i];
      const board = boards[i];
      const isl = plan.islands[i]!;
      if (!info2) continue;
      const parts = landMesh(info2, board ?? null, cells, landPal);
      const g = mergeGeometries([parts.top, parts.sides], false);
      parts.top.dispose();
      parts.sides.dispose();
      let cx = 0;
      let cz = 0;
      for (const kk of cells) {
        const c = info2.cells.get(kk);
        if (!c) continue;
        cx += c.x;
        cz += c.z;
      }
      cx /= cells.size;
      cz /= cells.size;
      g.translate(-cx, 0, -cz);
      const m = new THREE.Mesh(g, landMat);
      m.castShadow = m.receiveShadow = true;
      world.add(m);
      actors.push({ mesh: m, glow: null, t0: t0 + delay, big: true, x: isl.x + cx, y: isl.y, z: isl.z + cz, ry: 0, foot: Math.sqrt(cells.size) / 2, kind: "chunk" });
    }
    if (newLand.size && info.big) delay += mo.gaps[0];
    const put = (it: IsleItem, tier: number, at: number, out = false) => {
      const g = geoOf(it, tier);
      if (!g.body) return;
      const m = new THREE.Mesh(g.body, bodyMat);
      m.castShadow = true;
      const gl = g.glow ? new THREE.Mesh(g.glow, glowMat) : null;
      world.add(m);
      if (gl) world.add(gl);
      const w = worldOf(it);
      actors.push({ mesh: m, glow: gl, t0: at, big: it.landmark, out, x: w.x, y: w.y, z: w.z, ry: ryOf(it), foot: it.foot, kind: "part" });
      // its marks on the board spring in with it
      const isl = plan.islands[it.island]!;
      const land = landInfo[it.island];
      if (!out && land) {
        const b = paintBoard(isl, land, [{ it, built: g.built }], refs, false);
        const own = new Set<number>();
        for (const c of land.cells.values()) if (Math.abs(c.x - it.x) <= it.foot + 2 && Math.abs(c.z - it.z) <= it.foot + 2.5) own.add(key(c.x, c.z));
        const mg = markMesh(b, land, own);
        if (mg) {
          mg.translate(-it.x, 0, -it.z);
          const mm = new THREE.Mesh(mg, landMat);
          mm.receiveShadow = true;
          world.add(mm);
          actors.push({ mesh: mm, glow: null, t0: at, big: false, x: w.x, y: w.y + 0.002, z: w.z, ry: 0, foot: 0, kind: "marks" });
        }
      }
    };
    const lessonItems = changed.filter((it) => !it.landmark);
    const moduleItems = changed.filter((it) => it.landmark);
    for (const it of lessonItems) put(it, tierAt(it, to), t0 + delay);
    if (lessonItems.length) delay += moduleItems.length ? mo.gaps[1] : 0;
    // the landmark built by this module leads; one that only rose follows
    moduleItems.sort((a, b) => Number(b.tiers[0]! > from) - Number(a.tiers[0]! > from));
    for (const it of moduleItems) {
      const before = tierAt(it, from);
      if (before >= 0) put(it, before, t0 + delay - 0.3, true);
      put(it, tierAt(it, to), t0 + delay);
      delay += mo.gaps[2];
    }
    const lead = info.big ? moduleItems[0] ?? lessonItems[0] : lessonItems[lessonItems.length - 1] ?? moduleItems[0];
    const fw = lead ? worldOf(lead) : actors[0] ? { x: actors[0].x, y: actors[0].y, z: actors[0].z } : { x: 0, y: 0, z: 0 };
    const leadTop = lead ? geoOf(lead, tierAt(lead, to)).built.top : 2;
    return new Promise<RevealInfo>((resolve) => {
      const focusV = new THREE.Vector3(fw.x, fw.y + Math.min(3, leadTop * 0.4), fw.z);
      rv = {
        t0: t,
        focus: focusV,
        zoom: Math.max(1.2, Math.min(info.big ? 2.0 : 3.0, halfGoal / (info.big ? 7 : 5))),
        end: t0 + delay + mo.settle[info.big ? 1 : 0],
        resolve: () => resolve(info),
        robot: new THREE.Vector3(fw.x - 1.4 - (lead?.foot ?? 1) * 0.5, fw.y + leadTop + 0.8, fw.z + 1.2 + (lead?.foot ?? 1) * 0.5),
        ground: fw.y,
      };
    });
  };
  /** The marks of one item (pads, outline, designator) as a mesh over the cells round it. */
  const markMesh = (b: Board, land: LandInfo, own: Set<number>): THREE.BufferGeometry | null => {
    const sub: LandInfo = { cells: new Map([...land.cells].filter(([k]) => own.has(k)).map(([k, c]) => [k, { ...c, depth: 0.001 }])), radius: land.radius };
    if (!sub.cells.size) return null;
    const parts = landMesh(sub, b, null, landPal);
    parts.sides.dispose();
    const g = parts.top;
    // keep only the marks: drop the cell tops and sides the land mesh already has
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const idx = g.getIndex()!;
    const keep: number[] = [];
    for (let i = 0; i < idx.count; i += 6) {
      let maxY = -Infinity;
      for (let j = 0; j < 6; j++) maxY = Math.max(maxY, pos.getY(idx.getX(i + j)));
      if (maxY > 0.005 && maxY < 0.1) for (let j = 0; j < 6; j++) keep.push(idx.getX(i + j));
    }
    if (!keep.length) {
      g.dispose();
      return null;
    }
    g.setIndex(keep);
    return g;
  };
  /** Ends a running reveal at once: everything lands where it belongs. */
  const finishReveal = () => {
    if (!rv) return;
    const r = rv;
    rv = null;
    for (const a of actors) {
      world.remove(a.mesh);
      if (a.kind !== "part") a.mesh.geometry.dispose();
      if (a.glow) world.remove(a.glow);
    }
    actors = [];
    show(shownK);
    r.resolve();
  };

  // Size.
  const size = new THREE.Vector2();
  const resize = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    if (ink) {
      renderer.getDrawingBufferSize(size);
      ink.setSize(size.x, size.y, dpr);
    }
    aspect = w / h;
    heightPx = h;
    halfGoal = frameFor(extent);
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  // Per frame.
  let blinkUntil = 0;
  let nextBlink = 2.5;
  let userMoved = false;
  controls?.addEventListener("start", () => {
    userMoved = true;
    linger = null;
  });
  controls?.addEventListener("change", () => {
    dirty = true;
  });
  const update = (dt: number) => {
    // a turning teaser turns, and refits its frame to the isle as it stands now every half degree (eased below)
    if (turning) {
      spin = (spin + dt * opts.autoRotate!) % 360;
      dirty = true;
      turnTo(AZ + spin);
      if (Math.abs(spin - fittedAt) > 0.5) {
        fittedAt = spin;
        screenBox = boxNow();
        halfGoal = frameFor(extent);
      }
    }
    // framing: the whole isle, or the reveal's flight to its newest thing
    frameCentre(focusGoal);
    let hg = halfGoal;
    let flying = false;
    if (rv) {
      const k2 = t - rv.t0;
      const f = ease((k2 - mo.fly[0]) / mo.fly[1]);
      hg = halfGoal / (1 + (rv.zoom - 1) * f);
      lift.setFromMatrixColumn(cam.matrixWorld, 1).multiplyScalar(hg * 0.22 * f);
      focusGoal.lerp(rv.focus, f).add(lift);
      flying = true;
      if (t >= rv.end) {
        linger = { until: t + mo.linger, focus: rv.focus.clone(), zoom: rv.zoom };
        finishReveal();
      }
    } else if (linger) {
      if (t > linger.until || userMoved) linger = null;
      else {
        hg = halfGoal / linger.zoom;
        lift.setFromMatrixColumn(cam.matrixWorld, 1).multiplyScalar(hg * 0.22);
        focusGoal.copy(linger.focus).add(lift);
        flying = true;
      }
    }
    const e = reduced ? 1 : Math.min(1, dt * (flying ? 5 : 2.6));
    const moving = Math.abs(hg - half) > 1e-3 || focus.distanceToSquared(focusGoal) > 1e-6;
    half += (hg - half) * e;
    focus.lerp(focusGoal, e);
    if (moving) dirty = true;
    if (controls) {
      const off = cam.position.clone().sub(controls.target);
      controls.target.copy(focus);
      cam.position.copy(focus).add(off);
    } else {
      // a teaser sways gently, or turns round slowly when asked to
      const az = turning ? AZ + spin : AZ + (reduced ? 0 : Math.sin(t * mo.swayRate) * mo.sway);
      cam.position.setFromSphericalCoords(900, deg(POLAR), deg(az)).add(focus);
      cam.lookAt(focus);
    }
    // the framed half height sits in the open part of the screen: the view reaches further down, under the inset
    const c = cover();
    Object.assign(cam, { top: half, bottom: (-half * (1 + c)) / (1 - c), left: (-half * aspect) / (1 - c), right: (half * aspect) / (1 - c) });
    cam.updateProjectionMatrix();

    // the reveal's actors spring in (or shrink away)
    let busy = false;
    for (const a of actors) {
      const k2 = t - a.t0;
      let s = 1;
      let yo = 0;
      if (k2 < 0) s = a.out ? 1 : 0;
      else if (a.out) s = Math.max(0, 1 - k2 / 0.25);
      else {
        const sp = (notebook ? press : spring)(k2, a.big);
        s = sp;
        if (a.kind === "chunk") yo = -mo.rise * (1 - sp);
        if (!a.done) {
          a.done = true;
          if (a.foot > 0 && !reduced) burst(a.x, a.y, a.z, Math.min(5, a.foot), a.big && a.kind === "part");
        }
      }
      if (k2 < 2.2) busy = true;
      if (a.kind === "chunk") {
        const cs = Math.min(1, 0.6 + 0.4 * s);
        compose(a.x, a.y + yo, a.z, a.ry, cs, cs);
      } else if (a.kind === "marks") compose(a.x, a.y, a.z, a.ry, Math.max(0, Math.min(1.05, s)), 1);
      else {
        const wob = mo.lively && k2 > 0 && !a.out ? 0.08 * Math.sin(k2 * 16) * Math.exp(-5 * k2) : 0;
        compose(a.x, a.y, a.z, a.ry, s, s * (1 + wob));
      }
      a.mesh.matrixAutoUpdate = false;
      a.mesh.matrix.copy(M);
      a.mesh.visible = s > 0.002;
      if (a.glow) {
        a.glow.matrixAutoUpdate = false;
        a.glow.matrix.copy(M);
        a.glow.visible = a.mesh.visible;
      }
    }
    if (busy) {
      renderer.shadowMap.needsUpdate = true;
      dirty = true;
    }

    // level of detail: small pieces drop out when they would be a pixel or two
    const ppu = renderer.getDrawingBufferSize(size).y / ((cam.top - cam.bottom) / cam.zoom);
    const near = ppu > 7;
    for (const p of pools) if (p.small && p.mesh.visible !== near) {
      p.mesh.visible = near;
      if (p.glow) p.glow.visible = near;
      dirty = true;
    }

    // the robot: over the plaza, or beside the newest thing in a reveal
    const m0 = plan.islands[0]!;
    const rs = Math.max(1.5, Math.min(2.8, extent.r * 0.085));
    if (rv) robotWant.copy(rv.robot);
    else robotWant.set(m0.x + Math.cos(t * 0.21) * mo.wander, m0.y + 2.6 + rs * 0.6, m0.z + Math.sin(t * 0.21) * mo.wander);
    robotAt.lerp(robotWant, reduced ? 1 : Math.min(1, dt * (rv ? 2.4 : 1.2)));
    const bob = reduced ? 0 : Math.sin(t * mo.bobRate) * mo.bob;
    robot.group.position.set(robotAt.x, robotAt.y + bob, robotAt.z);
    robot.group.scale.setScalar(rs);
    robot.group.rotation.y = Math.atan2(cam.position.x - robotAt.x, cam.position.z - robotAt.z);
    robot.group.rotation.z = reduced ? 0 : Math.sin(t * 1.3) * mo.tilt;
    robotShadow.position.set(robotAt.x, (rv ? rv.ground : m0.y) + 0.07, robotAt.z);
    const hgt = Math.max(0.5, robotAt.y - robotShadow.position.y);
    robotShadow.scale.setScalar(rs * Math.max(0.5, 1.3 - hgt * 0.08));
    (robotShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.06, 0.26 - hgt * 0.02);
    if (!reduced) {
      if (t > nextBlink) {
        blinkUntil = t + 0.13;
        nextBlink = t + 2.8 + ((t * 7.31) % 2.4);
      }
      robot.blink(t < blinkUntil);
      if (mo.lively) {
        // effects and clouds
        if (smokeAt.length)
          for (const c of smokeAt)
            if (Math.random() < dt * 2.2) smoke.emit(c.x, c.y, c.z, 0.1, 0.7, 0, 3.2, 0.45, 1.6, 0.6 - night * 0.3, smokeC);
        smoke.update(dt, 0.2);
        sparks.update(dt);
        dust.update(dt);
        placeClouds();
        dirty = true;
      } else {
        // the notebook: only the robot's bob and blink, and a reveal's dust while it lasts
        if (rv || dust.live) {
          dust.update(dt);
          dust.pts.obj.visible = dust.live > 0;
          dirty = true;
        }
        alive = true;
      }
    }
    controls?.update();
  };

  // Frame clock, pausing, and the numbers stats() reports.
  const N = 120;
  const rec = { dt: new Float32Array(N), i: 0, n: 0 };
  let raf = 0;
  let last = performance.now();
  let paused = false;
  let offscreen = false;
  let lastCalls = 0;
  let lastTris = 0;
  let tick = 0;
  let drawn = 0;
  /** Time spent drawing (update and render calls, in ms), over the last N drawn frames. */
  const work = { ms: new Float32Array(N), i: 0, n: 0 };
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const ms = now - last;
    last = now;
    const dt = Math.min(0.05, ms / 1000);
    t += dt;
    const w0 = performance.now();
    update(dt);
    // the notebook's slow idle motion (a bob, a sway) is drawn on every other frame; anything else on every frame
    const draw = dirty || (alive && (tick++ & 1) === 0);
    alive = false;
    if (!draw) return;
    dirty = false;
    pointScale.value = (renderer.getDrawingBufferSize(size).y * cam.zoom) / (cam.top - cam.bottom);
    starU.uPx.value = renderer.getPixelRatio();
    renderer.info.reset();
    if (ink) ink.render(renderer, scene, cam);
    else renderer.render(scene, cam);
    lastCalls = renderer.info.render.calls;
    lastTris = renderer.info.render.triangles;
    placeLabel();
    rec.dt[rec.i] = ms;
    rec.i = (rec.i + 1) % N;
    rec.n = Math.min(N, rec.n + 1);
    work.ms[work.i] = performance.now() - w0;
    work.i = (work.i + 1) % N;
    work.n = Math.min(N, work.n + 1);
    drawn++;
  };
  const start = () => {
    if (raf || paused || offscreen) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const io = new IntersectionObserver((entries) => {
    offscreen = !entries.some((e) => e.isIntersecting);
    if (offscreen) stop();
    else start();
  });
  io.observe(el);

  resize();
  show(Math.min(opts.at ?? plan.events.length - 1, plan.events.length - 1));
  half = halfGoal;
  frameCentre(focus);
  if (mo.lively) placeClouds();
  start();

  return {
    reveal,
    setTime(d: Date) {
      clock = d;
      night = nightOf(d);
      applyTime();
    },
    pause() {
      paused = true;
      stop();
    },
    resume() {
      paused = false;
      start();
    },
    resize,
    stats(): IsleStats {
      const n = rec.n;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += rec.dt[i]!;
      const frameMs = n ? sum / n : 0;
      return {
        fps: frameMs ? 1000 / frameMs : 0,
        frameMs,
        workMs: work.n ? work.ms.reduce((s, x, i) => (i < work.n ? s + x : s), 0) / work.n : 0,
        drawn,
        frames: n,
        calls: lastCalls,
        triangles: lastTris,
        instances: pools.reduce((s, p) => s + p.items.length, 0),
        pools: pools.length,
        geometries: renderer.info.memory.geometries,
        dpr,
      };
    },
    show(k: number) {
      finishReveal();
      show(Math.max(-1, Math.min(k, plan.events.length - 1)));
    },
    update(next: IslePlan, k?: number) {
      finishReveal();
      plan = next;
      refs = designators(plan.items);
      show(Math.max(-1, Math.min(k ?? plan.events.length - 1, plan.events.length - 1)));
    },
    setMuted(m: boolean) {
      muted = m;
    },
    setZoom(z: number) {
      userZoom = Math.max(0.5, Math.min(8, z));
      halfGoal = frameFor(extent);
      dirty = true;
    },
    clearPick() {
      labelled = null;
      lastLabel = "";
    },
    setInset(inset: IsleInset) {
      insetPx = Math.max(0, inset.bottom ?? 0);
      halfGoal = frameFor(extent);
      dirty = true;
    },
    dispose() {
      stop();
      if (minute) clearInterval(minute);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      controls?.dispose();
      finishReveal();
      clear();
      for (const g of geos.values()) {
        g.body?.dispose();
        g.glow?.dispose();
      }
      geos.clear();
      robot.dispose();
      halos.dispose();
      starGeo.dispose();
      starMat.dispose();
      sparks.pts.dispose();
      dust.pts.dispose();
      smoke.pts.dispose();
      cloudGeo.dispose();
      clouds.dispose();
      sky.geometry.dispose();
      robotShadow.geometry.dispose();
      shadowTex.dispose();
      pageTex?.dispose();
      if (pageShadows) {
        pageShadows.geometry.dispose();
        (pageShadows.material as THREE.Material).dispose();
        pageShadows.dispose();
      }
      ink?.dispose();
      for (const m of [bodyMat, landMat, glowMat, skyMat, cloudMat, robotMat, robotShadow.material as THREE.Material]) m.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
