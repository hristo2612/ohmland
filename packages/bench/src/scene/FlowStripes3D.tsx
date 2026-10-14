// The striped flow styles in 3D (docs/BENCH-VIEWS.md, "Overlays"): a thin sleeve over every cable, jumper and part
// lead that carries current, drawn by one shader per style (barber stripes, marching dashes, pulses, chevrons) in the
// flow tint. The pattern scrolls by a uniform each frame: no geometry or React work while it moves. The tracer's run
// uses the same sleeve and shader along the loop, in red pencil's colour on the flow tint, revealed up to its head.

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useStore } from "zustand";
import type { Snapshot } from "@ohmland/sim";
import { DOT_MIN_AMPS, ELECTRON_SLOWDOWN, dotSpeed, flowMap, traceLoop, unitSpacing, type FlowStyle } from "../flow";
import { BOARD_TOP } from "../dims";
import { holeWorld } from "../board";
import { jumperPath } from "../models/Leads";
import { stillMotion } from "../motion";
import type { BenchStore } from "../store";
import type { BenchState, Vec3 } from "../types";
import type { FloorFn } from "../three/geometry";
import { useAnimating } from "../three/anim";
import { leadCable } from "./views";
import { usePaperPalette } from "./palette";

const OVERLAY = { fx: true };
const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

/** Sleeve radii (mm): a hair over the clip lead's cable (0.9) and the jumper's insulation (0.8); a part's leads. */
const R_LEAD = 0.97;
const R_JUMPER = 0.87;
const R_PART = 0.5;
const R_TRACE = 1.08;

type Striped = Exclude<FlowStyle, "dots">;

// ---------------------------------------------------------------------------------------------------------------
// The sleeve: a tube along the conductor with each vertex's distance from the start (mm) and the path's heading.

type Sleeve = { geo: THREE.TubeGeometry; length: number };

function sleeve(points: THREE.Vector3[], radius: number): Sleeve | null {
  const pts = points.filter((p, i) => i === 0 || p.distanceTo(points[i - 1]!) > 0.05);
  if (pts.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
  const length = curve.getLength();
  if (length < 0.5) return null;
  const radial = 12;
  const segs = Math.max(4, Math.min(420, Math.round(length * 1.4)));
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const uv = geo.attributes.uv!;
  const n = uv.count;
  const dist = new Float32Array(n);
  const tan = new Float32Array(n * 3);
  for (let i = 0; i <= segs; i++) {
    const t = geo.tangents[i] ?? new THREE.Vector3(1, 0, 0);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      dist[k] = uv.getX(k) * length;
      tan[k * 3] = t.x;
      tan[k * 3 + 1] = t.y;
      tan[k * 3 + 2] = t.z;
    }
  }
  geo.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
  geo.setAttribute("aTan", new THREE.BufferAttribute(tan, 3));
  return { geo, length };
}

// ---------------------------------------------------------------------------------------------------------------
// The shader. `u` runs along the motion inside one unit (0 to the spacing, its front toward larger u); `lat` runs
// across the cable as the camera sees it (-1 to 1, 0 down the middle).

const VERT = /* glsl */ `
attribute float aDist;
attribute vec3 aTan;
varying float vDist;
varying float vAround;
varying vec3 vN;
varying vec3 vV;
varying vec3 vT;
void main() {
  vDist = aDist;
  vAround = uv.y;
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  vV = mv.xyz;
  vN = normalize( normalMatrix * normal );
  vT = normalize( mat3( modelViewMatrix ) * aTan );
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform float uOffset;
uniform float uSpacing;
uniform float uDir;
uniform float uRadius;
uniform float uHead;
uniform float uStill;
uniform vec3 uFlow;
uniform vec3 uRim;
uniform vec3 uRed;
varying float vDist;
varying float vAround;
varying vec3 vN;
varying vec3 vV;
varying vec3 vT;

// 1 where lo <= x <= hi, softened over about a pixel.
float inside( float x, float lo, float hi ) {
  float w = max( fwidth( x ), 1e-4 ) * 0.75;
  return smoothstep( lo - w, lo + w, x ) * ( 1.0 - smoothstep( hi - w, hi + w, x ) );
}

void main() {
  vec3 N = normalize( vN );
  vec3 V = normalize( -vV );
  vec3 T = normalize( vT );
  float ndv = clamp( abs( dot( N, V ) ), 0.0, 1.0 );
  vec3 side = cross( T, V );
  float sl = length( side );
  float lat = sl > 1e-4 ? dot( N, side / sl ) : 0.0;
  float L = abs( lat );
  float S = uSpacing;
  float s = ( vDist - uOffset ) * uDir;
  float u = mod( s, S );
  float c = 0.5 * S;
#if defined( TRACER )
  vec3 fill = uRed;
  vec3 edge = uFlow;
#else
  vec3 fill = uFlow;
  vec3 edge = uRim;
#endif
  vec3 col = fill;
  float a = 0.0;

#if defined( BARBER )
  // One stripe per unit, wound once round the cable per unit of travel (about 45 degrees on a clip lead).
  float ub = mod( s + vAround * S, S );
  float w = 0.46 * S;
  float on = inside( ub, c - 0.5 * w, c + 0.5 * w );
  float core = inside( ub, c - 0.5 * w + 0.2, c + 0.5 * w - 0.2 );
  // Standing still, each stripe brightens toward its front edge, so the way it goes still reads.
  float ramp = uStill > 0.5 ? mix( 0.35, 1.0, clamp( ( ub - ( c - 0.5 * w ) ) / w, 0.0, 1.0 ) ) : 1.0;
  col = mix( edge, fill, core );
  a = on * ramp;
  col *= 0.62 + 0.38 * ndv;
#elif defined( DASHES )
  // A short bright dash down the middle of the cable, and a faint tail that narrows behind it.
  float h = 3.2;
  float tail = 2.2;
  float lane = 1.0 - smoothstep( 0.52, 0.64, L );
  float head = inside( u, c - 0.5 * h, c + 0.5 * h ) * lane;
  float core = inside( u, c - 0.5 * h + 0.24, c + 0.5 * h - 0.24 ) * ( 1.0 - smoothstep( 0.36, 0.46, L ) );
  float k = clamp( ( u - ( c - 0.5 * h - tail ) ) / tail, 0.0, 1.0 );
  float t = inside( u, c - 0.5 * h - tail, c - 0.5 * h ) * ( 1.0 - smoothstep( 0.06 + 0.22 * k, 0.12 + 0.22 * k, L ) ) * k * ( uStill > 0.5 ? 0.8 : 0.55 );
  col = head > 0.01 ? mix( edge, fill, core ) : fill;
  a = max( head, t );
  col *= 0.86 + 0.14 * ndv;
#elif defined( PULSES )
  // A soft band round the cable: a crisp front and a long glow behind, and a thin dark ring just ahead.
  float d = u - c;
  float sig = d > 0.0 ? 0.5 : 1.8;
  float g = exp( -0.5 * d * d / ( sig * sig ) );
#ifdef TRACER
  float r = exp( -0.5 * pow( ( d - 1.1 ) / 0.24, 2.0 ) );
#else
  float r = exp( -0.5 * pow( ( d - 1.15 ) / 0.2, 2.0 ) ) * 0.5;
#endif
  col = mix( edge, fill, g / max( 1e-3, g + r ) );
  a = max( g * 0.95, r );
  col *= 0.74 + 0.26 * ndv;
#elif defined( CHEVRONS )
  // An arrowhead across the cable, its arms swept back toward the edges.
  float k = 1.7 * uRadius;
  float hw = 0.3;
  float lane = 1.0 - smoothstep( 0.78, 0.9, L );
  float d = u - ( c - k * L );
  float stroke = inside( d, -hw, hw );
  float rim = inside( d, -hw - 0.24, hw + 0.24 );
  col = mix( edge, fill, stroke );
  a = rim * lane;
  col *= 0.84 + 0.16 * ndv;
#endif

#ifdef TRACER
  // Revealed up to the run's head.
  a *= 1.0 - smoothstep( uHead - 0.25, uHead + 0.25, vDist );
#endif
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( col, a );
  #include <colorspace_fragment>
}`;

function stripeMaterial(style: Striped, tracer: boolean, colors: { flow: string; red: string }): THREE.ShaderMaterial {
  const flow = new THREE.Color(colors.flow);
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { [style.toUpperCase()]: "", ...(tracer ? { TRACER: "" } : {}) },
    uniforms: {
      uOffset: { value: 0 },
      uSpacing: { value: unitSpacing(style, 1e-3) },
      uDir: { value: 1 },
      uRadius: { value: R_LEAD },
      uHead: { value: 0 },
      uStill: { value: 0 },
      uFlow: { value: flow },
      // The rim: a dark line round each stripe, so the light tint reads on a yellow or white lead too.
      uRim: { value: flow.clone().multiplyScalar(0.06).add(new THREE.Color(0.006, 0.012, 0.022)) },
      uRed: { value: new THREE.Color(colors.red) },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Flow

type Ride = { key: string; pts: THREE.Vector3[]; radius: number };

/** Every conductor that carries current, as drawn: clip leads (cable only), jumpers and the stretches through parts. */
function rides(bench: BenchState, floor: FloorFn, snapshot: Snapshot | null): { rides: Ride[]; amps: Map<string, number> } {
  const f = flowMap(bench, snapshot);
  const amps = new Map<string, number>();
  const out: Ride[] = [];
  for (const l of bench.leads) {
    const i = f.leads[l.id] ?? 0;
    if (!(Math.abs(i) >= DOT_MIN_AMPS) || (!l.a.to && !l.b.to)) continue;
    // The cable as LeadView draws it, from one clip's tail to the other's.
    out.push({ key: `lead:${l.id}`, pts: leadCable(bench, l, floor).cable, radius: R_LEAD });
    amps.set(`lead:${l.id}`, i);
  }
  if (bench.board) {
    for (const w of bench.wires) {
      const i = f.wires[w.id] ?? 0;
      if (!(Math.abs(i) >= DOT_MIN_AMPS)) continue;
      const a = holeWorld(bench.board, w.a);
      const b = holeWorld(bench.board, w.b);
      if (!a || !b) continue;
      const j = jumperPath(new THREE.Vector3(a[0], BOARD_TOP, a[1]), new THREE.Vector3(b[0], BOARD_TOP, b[1]));
      out.push({ key: `wire:${w.id}`, pts: j.insul, radius: R_JUMPER });
      amps.set(`wire:${w.id}`, i);
    }
  }
  for (const p of f.parts) {
    if (!(Math.abs(p.amps) >= DOT_MIN_AMPS)) continue;
    const a = v3(p.a).setY(p.a[1] + 0.6);
    const b = v3(p.b).setY(p.b[1] + 0.6);
    if (a.distanceTo(b) < 1) continue;
    const key = `part:${p.id}:${p.from}`;
    out.push({ key, pts: [a, b], radius: R_PART });
    amps.set(key, p.amps);
  }
  return { rides: out, amps };
}

export const FlowStripes3D = memo(function FlowStripes3D({ bench, store, floor, electrons, style }: { bench: BenchState; store: BenchStore; floor: FloorFn; electrons: boolean; style: Striped }) {
  // Rebuilt only when the set of conductors carrying current changes, not on every snapshot.
  const liveKey = useStore(store, (s) => [...rides(bench, floor, s.snapshot).amps.keys()].join("|"));
  const pal = usePaperPalette();
  const still = useMemo(() => stillMotion(), []);
  const meshes = useMemo(() => {
    const { rides: list } = rides(bench, floor, store.getState().snapshot);
    const out: { key: string; geo: THREE.TubeGeometry; material: THREE.ShaderMaterial; length: number }[] = [];
    for (const r of list) {
      const sl = sleeve(r.pts, r.radius);
      if (!sl) continue;
      const material = stripeMaterial(style, false, pal);
      material.uniforms.uRadius!.value = r.radius;
      material.uniforms.uStill!.value = still ? 1 : 0;
      out.push({ key: r.key, geo: sl.geo, material, length: sl.length });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bench, floor, liveKey, style, pal.flow, pal.red, still]);
  useLayoutEffect(
    () => () => {
      for (const m of meshes) {
        m.geo.dispose();
        m.material.dispose();
      }
    },
    [meshes],
  );
  const amps = useRef(new Map<string, number>());
  const travel = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const update = (s: Snapshot | null) => {
      amps.current = rides(bench, floor, s).amps;
      // Standing still, the spacing (and the way each unit faces) is all there is to show: set it now.
      if (still) for (const m of meshes) paint(m.material, m.key, 0);
    };
    update(store.getState().snapshot);
    return store.subscribe((s, prev) => s.snapshot !== prev.snapshot && update(s.snapshot));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bench, floor, store, meshes, still]);
  const paint = (material: THREE.ShaderMaterial, key: string, dt: number) => {
    const i = amps.current.get(key) ?? 0;
    const v = Math.sign(i) * dotSpeed(i) * (electrons ? -ELECTRON_SLOWDOWN : 1);
    const S = unitSpacing(style, i, still);
    const x = still ? 0 : ((((travel.current.get(key) ?? 0) + v * dt) % S) + S) % S;
    travel.current.set(key, x);
    const u = material.uniforms;
    u.uOffset!.value = x;
    u.uSpacing!.value = S;
    if (v !== 0) u.uDir!.value = Math.sign(v);
  };
  useAnimating(!still);
  useFrame((_, dt) => {
    if (still) return;
    const step = Math.min(0.1, dt);
    for (const m of meshes) paint(m.material, m.key, step);
  });
  return (
    <group userData={OVERLAY}>
      {meshes.map((m) => (
        <mesh key={m.key} geometry={m.geo} material={m.material} renderOrder={12} frustumCulled={false} userData={OVERLAY} />
      ))}
    </group>
  );
});

// ---------------------------------------------------------------------------------------------------------------
// The tracer's run

export const TraceRun3D = memo(function TraceRun3D({ bench, store, floor, from, at, style }: { bench: BenchState; store: BenchStore; floor: FloorFn; from: string; at: number; style: Striped }) {
  const pressed = useStore(store, (s) => s.ui.pressed);
  const trace = useMemo(() => traceLoop(bench, from, { pressed, snapshot: store.getState().snapshot }), [bench, from, pressed, store]);
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    const add = (p: THREE.Vector3) => {
      const q = out[out.length - 1];
      if (!q || q.distanceTo(p) > 0.2) out.push(p);
    };
    for (const s of trace.steps) {
      if (s.kind === "lead") {
        const l = bench.leads.find((x) => x.id === s.id);
        if (!l) continue;
        // Inside the cable, through the clips' jaws at each end.
        const c = leadCable(bench, l, floor);
        const line = [c.a.tip, ...c.cable, c.b.tip];
        for (const p of s.from === "a" ? line : line.reverse()) add(p.clone());
      } else {
        add(v3(s.a).setY(s.a[1] + 1.2));
        add(v3(s.b).setY(s.b[1] + 1.2));
      }
    }
    return out;
  }, [trace, bench, floor]);
  const pal = usePaperPalette();
  const run = useMemo(() => {
    const sl = sleeve(pts, R_TRACE);
    if (!sl) return null;
    const material = stripeMaterial(style, true, pal);
    material.uniforms.uRadius!.value = R_TRACE;
    material.uniforms.uSpacing!.value = style === "pulses" ? 7 : unitSpacing(style, 1e-3);
    return { ...sl, material };
  }, [pts, style, pal]);
  useLayoutEffect(
    () => () => {
      run?.geo.dispose();
      run?.material.dispose();
    },
    [run],
  );
  const still = useMemo(() => stillMotion(), []);
  const dur = Math.max(1200, Math.min(3600, trace.steps.length * 320));
  const done = useRef(false);
  const mark = useRef<THREE.Group>(null);
  useAnimating(!still && !done.current);
  useFrame(() => {
    if (!run) return;
    const k = still ? 1 : Math.max(0, Math.min(1, (performance.now() - at) / dur));
    // Ease out: the run slows as it reaches the end, where the mark lands.
    const e = 1 - Math.pow(1 - k, 2);
    run.material.uniforms.uHead!.value = run.length * e + (k >= 1 ? 1 : 0);
    if (mark.current) mark.current.visible = k >= 1;
    done.current = k >= 1;
  });
  if (!run) return null;
  const end = (trace.closed ? pts[0]! : pts[pts.length - 1]!).clone();
  end.y += 3.2;
  return (
    <group userData={OVERLAY}>
      <mesh geometry={run.geo} material={run.material} renderOrder={14} frustumCulled={false} userData={OVERLAY} />
      <group ref={mark} position={end} visible={false}>
        <Billboard>
          <TraceMark3D closed={trace.closed} red={pal.red} flow={pal.flow} />
        </Billboard>
      </group>
    </group>
  );
});

/** Where the run ended: a red disc with a light cross at a gap, a red ring where the loop closed. Not pencil marks. */
function TraceMark3D({ closed, red, flow }: { closed: boolean; red: string; flow: string }) {
  const m = { transparent: true, depthTest: false, depthWrite: false, toneMapped: false } as const;
  if (closed)
    return (
      <group>
        <mesh renderOrder={33} userData={OVERLAY}>
          <ringGeometry args={[2.3, 3.5, 40]} />
          <meshBasicMaterial color={red} {...m} />
        </mesh>
        <mesh renderOrder={32} userData={OVERLAY}>
          <ringGeometry args={[1.9, 3.9, 40]} />
          <meshBasicMaterial color={flow} {...m} />
        </mesh>
      </group>
    );
  return (
    <group>
      <mesh renderOrder={32} userData={OVERLAY}>
        <circleGeometry args={[3.9, 40]} />
        <meshBasicMaterial color={flow} {...m} />
      </mesh>
      <mesh renderOrder={33} userData={OVERLAY}>
        <circleGeometry args={[3.4, 40]} />
        <meshBasicMaterial color={red} {...m} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} rotation={[0, 0, (s * Math.PI) / 4]} renderOrder={34} userData={OVERLAY}>
          <planeGeometry args={[4.2, 0.9]} />
          <meshBasicMaterial color={flow} {...m} />
        </mesh>
      ))}
    </group>
  );
}
