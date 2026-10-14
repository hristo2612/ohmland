// Flexible things: meter probes and banana plugs, crocodile clips, cables, and solid-core jumper wires.

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { BOARD_TOP, PITCH } from "../dims";
import { bentTube, latheY, memoGeo, ropePoints, smoothTube, type FloorFn } from "../three/geometry";
import { WIRE_HEX, mat } from "../three/materials";
import { IN_HOLE } from "./common";

const UP = new THREE.Vector3(0, 1, 0);

/** Quaternion turning +y into `dir`, with a stable roll. */
export function quatFromY(dir: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
}

// ---------------------------------------------------------------------------------------------------------------
// Meter probe: tip at the origin, body along +y.

export const PROBE_LEN = 116;

function probeHandle(): THREE.BufferGeometry {
  return memoGeo("probe-handle", () => {
    const pts: [number, number][] = [
      [1.05, 13.2],
      [2.2, 13.6],
      [6.2, 14.2],
      [6.6, 15.0],
      [6.2, 16.4],
      [4.5, 17.2],
      [4.2, 19],
    ];
    // Grip rings along the handle.
    for (let y = 22; y < 60; y += 3) {
      pts.push([4.35, y - 0.6], [4.6, y], [4.35, y + 0.6]);
    }
    pts.push([4.4, 64], [4.55, 80], [4.4, 94], [3.9, 97], [3.6, 104], [2.6, 112], [2.0, PROBE_LEN]);
    return latheY(pts, 28);
  });
}

function probeTip(): THREE.BufferGeometry {
  return memoGeo("probe-tip", () =>
    latheY(
      [
        [0.001, 0],
        [0.32, 0.6],
        [0.62, 2.2],
        [0.62, 11.5],
        [1.0, 12.2],
        [1.0, 13.6],
      ],
      16,
    ),
  );
}

export function Probe({ color }: { color: "red" | "black" }) {
  return (
    <group>
      <mesh geometry={probeTip()} material={mat.chrome()} castShadow />
      <mesh geometry={probeHandle()} material={mat.glossy(color === "red" ? "#cf2a2d" : "#1e1f22")} castShadow />
    </group>
  );
}

/** Banana plug standing in a socket (pin down at the origin), body along +y. Cable leaves at +y PLUG_TOP. */
export const PLUG_TOP = 27;

function plugBody(): THREE.BufferGeometry {
  return memoGeo("plug-body", () => {
    const pts: [number, number][] = [
      [2.15, -0.5],
      [2.6, 0.2],
      [4.0, 0.9],
      [4.15, 3],
    ];
    for (let y = 5; y < 17; y += 2.4) pts.push([4.15, y - 0.5], [4.4, y], [4.15, y + 0.5]);
    pts.push([4.0, 18.5], [3.2, 21], [2.4, 25], [1.9, PLUG_TOP]);
    return latheY(pts, 28);
  });
}

function plugPin(): THREE.BufferGeometry {
  return memoGeo("plug-pin", () =>
    latheY(
      [
        [0.001, -10.5],
        [1.2, -10.2],
        [1.9, -8.5],
        [2.0, -6.0],
        [1.85, -4.5],
        [2.0, -2.5],
        [2.0, 0],
      ],
      18,
    ),
  );
}

export function BananaPlug({ color }: { color: "red" | "black" }) {
  return (
    <group>
      <mesh geometry={plugPin()} material={mat.nickel()} castShadow />
      <mesh geometry={plugBody()} material={mat.glossy(color === "red" ? "#cf2a2d" : "#1e1f22")} castShadow />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Crocodile clip: jaw tip at the origin, the clip extends along -x, jaws open in +-y. Cable leaves at -x CLIP_LEN.
// A mini clip with a slim sleeve (in the style of a mini grabber): about 26 mm long and 6 mm across, so it holds a
// 0.6 mm lead without hiding the part it holds.

export const CLIP_LEN = 26;
const HINGE = -8.6;
/** The jaws are drawn at full size and scaled to the mini clip. */
const JAW_SCALE: [number, number, number] = [0.68, 0.62, 0.56];

function jawGeometry(): THREE.BufferGeometry {
  return memoGeo("clip-jaw", () => {
    // Side profile (x along the clip, y up) of the upper jaw, with teeth on the lower edge near the tip.
    const H = -12.5;
    const s = new THREE.Shape();
    s.moveTo(0.3, 0.05);
    for (let i = 0; i < 8; i++) {
      const x = -i * 1.25;
      s.lineTo(x - 0.62, -0.42);
      s.lineTo(x - 1.25, 0.05);
    }
    s.lineTo(H + 0.6, 0.15);
    s.lineTo(H - 2, 0.9);
    s.lineTo(-20, 1.7);
    s.lineTo(-26.5, 2.6);
    s.lineTo(-27.2, 3.1);
    s.lineTo(-26.2, 3.4);
    s.lineTo(-19.5, 2.8);
    s.lineTo(H - 0.5, 2.55);
    s.lineTo(-6, 2.1);
    s.lineTo(-1.2, 1.25);
    s.lineTo(0.3, 0.05);
    const g = new THREE.ExtrudeGeometry(s, { depth: 4.4, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.18, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -2.2);
    // Taper the jaw toward the tip when seen from above.
    const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      if (x > H) {
        const t = Math.min(1, Math.max(0, -x / -H));
        p.setZ(i, p.getZ(i) * (0.5 + 0.5 * t));
      }
    }
    // To the mini clip's size (scaled in the geometry so normals stay right and the hinge sits at HINGE).
    g.scale(...JAW_SCALE);
    g.translate(-HINGE, 0, 0);
    g.computeVertexNormals();
    return g;
  });
}

function sleeveGeometry(): THREE.BufferGeometry {
  return memoGeo("clip-sleeve", () => {
    // Lathe along +y, later laid along -x: a slim insulating sleeve with a small lip, three grip rings and a taper
    // down to the cable.
    const pts: [number, number][] = [
      [2.65, 0],
      [3.0, 0.5],
      [2.9, 1.6],
      [2.75, 3.0],
    ];
    for (let y = 5; y <= 11; y += 2) pts.push([2.78, y - 0.45], [2.98, y], [2.78, y + 0.45]);
    pts.push([2.72, 13.2], [2.25, 15.4], [1.55, 17.2], [1.15, 18.4], [1.0, 18.9]);
    const g = latheY(pts, 28);
    g.scale(1, 1, 0.9);
    return g;
  });
}

export function AlligatorClip({ color, open = 0 }: { color: string; open?: number }) {
  const ang = 0.03 + open * 0.42;
  return (
    <group>
      <group position={[HINGE, 0, 0]}>
        <group rotation={[0, 0, ang]}>
          <mesh geometry={jawGeometry()} material={mat.nickel()} castShadow />
        </group>
        <group rotation={[0, 0, -ang]} scale={[1, -1, 1]}>
          <mesh geometry={jawGeometry()} material={mat.nickel()} castShadow />
        </group>
        {/* Spring coil at the hinge. */}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={mat.steel()}>
          <torusGeometry args={[0.7, 0.22, 8, 18]} />
        </mesh>
      </group>
      {/* Slim sleeve over the back half. */}
      <group position={[-7.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh geometry={sleeveGeometry()} material={mat.rubber(WIRE_HEX[color] ?? color)} castShadow />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Cables.

export function Cable({
  from,
  fromDir,
  to,
  toDir,
  length,
  radius,
  color,
  floor,
  bend = 0.18,
  stiff = 2,
  points,
}: {
  from: THREE.Vector3;
  fromDir: THREE.Vector3;
  to: THREE.Vector3;
  toDir: THREE.Vector3;
  length: number;
  radius: number;
  color: string;
  floor: FloorFn;
  /** Bending stiffness 0..0.5. */
  bend?: number;
  /** How many segments at each end keep the end direction. */
  stiff?: number;
  /** The cable's points when the caller already worked them out (the same as these inputs give). */
  points?: THREE.Vector3[];
}) {
  const key = `${from.toArray().map((v) => v.toFixed(2))}|${to.toArray().map((v) => v.toFixed(2))}|${fromDir.toArray().map((v) => v.toFixed(2))}|${toDir
    .toArray()
    .map((v) => v.toFixed(2))}|${length}|${radius}`;
  const geometry = useMemo(() => {
    const pts = points ?? ropePoints(from, fromDir, to, toDir, length, radius, floor, stiff, bend);
    return smoothTube(pts, radius, 10, 0.6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={mat.insulation(WIRE_HEX[color] ?? color)} castShadow receiveShadow />;
}

// ---------------------------------------------------------------------------------------------------------------
// Jumper wire: hand-cut solid-core wire from hole to hole. The insulation runs flat (short spans) or in a low arch
// (longer spans) and ends at the bends, so the bare tinned legs show where they drop into the holes.

const JUMPER_R = 0.8;
const JUMPER_Y = 2.0;

export function jumperPath(a: THREE.Vector3, b: THREE.Vector3): { insul: THREE.Vector3[]; legA: [number, number, number][]; legB: [number, number, number][] } {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const y0 = BOARD_TOP + JUMPER_Y;
  const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const inset = 1.05;
  const A = a.clone().setY(y0).addScaledVector(dir, inset);
  const B = b.clone().setY(y0).addScaledVector(dir, -inset);
  const insul: THREE.Vector3[] = [];
  if (d <= PITCH * 3.2) {
    insul.push(A, B);
  } else {
    const h = Math.min(0.8 + d * 0.075, 12);
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(A, B, t);
      // Flat-topped arch: quick rise near the ends, level across the middle.
      const s = Math.sin(Math.PI * t);
      p.y = y0 + h * Math.pow(s, 0.45);
      insul.push(p);
    }
  }
  const legA: [number, number, number][] = [
    [A.x, y0, A.z],
    [a.x, y0, a.z],
    [a.x, BOARD_TOP + IN_HOLE, a.z],
  ];
  const legB: [number, number, number][] = [
    [B.x, y0, B.z],
    [b.x, y0, b.z],
    [b.x, BOARD_TOP + IN_HOLE, b.z],
  ];
  return { insul, legA, legB };
}

export function JumperWire({ a, b, color }: { a: THREE.Vector3; b: THREE.Vector3; color: string }) {
  const geos = useMemo(() => {
    const { insul, legA, legB } = jumperPath(a, b);
    const tube =
      insul.length === 2
        ? (() => {
            const len = insul[0]!.distanceTo(insul[1]!);
            const g = new THREE.CylinderGeometry(JUMPER_R, JUMPER_R, len, 12, 1, false);
            g.rotateZ(Math.PI / 2);
            const dir = insul[1]!.clone().sub(insul[0]!);
            g.rotateY(Math.atan2(-dir.z, dir.x));
            const mid = insul[0]!.clone().add(insul[1]!).multiplyScalar(0.5);
            g.translate(mid.x, mid.y, mid.z);
            return g;
          })()
        : smoothTube(insul, JUMPER_R, 12, 1.4);
    return { tube, legA: bentTube(legA, 0.32, 0.55, 8), legB: bentTube(legB, 0.32, 0.55, 8), ends: insul.length === 2 ? null : [insul[0]!, insul[insul.length - 1]!, insul[1]!, insul[insul.length - 2]!] };
  }, [a.x, a.y, a.z, b.x, b.y, b.z]);
  useLayoutEffect(
    () => () => {
      geos.tube.dispose();
      geos.legA.dispose();
      geos.legB.dispose();
    },
    [geos],
  );
  const insulation = mat.insulation(WIRE_HEX[color] ?? color);
  const cap = memoGeo("jumper-cap", () => new THREE.CircleGeometry(JUMPER_R, 14));
  return (
    <group>
      <mesh geometry={geos.tube} material={insulation} castShadow receiveShadow />
      {geos.ends &&
        [0, 1].map((i) => {
          const end = geos.ends![i]!;
          const next = geos.ends![i + 2]!;
          const n = end.clone().sub(next).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
          return <mesh key={i} geometry={cap} material={insulation} position={end} quaternion={q} />;
        })}
      <mesh geometry={geos.legA} material={mat.lead()} castShadow />
      <mesh geometry={geos.legB} material={mat.lead()} castShadow />
    </group>
  );
}

/** Stripped, tinned end of a stranded lead (snap connector, speaker wire) going into a hole or lying on the desk. */
export function StrippedEnd({ at, dir, inHole }: { at: THREE.Vector3; dir: THREE.Vector3; inHole: boolean }) {
  const geo = useMemo(() => {
    if (inHole) return bentTube([[at.x, BOARD_TOP + IN_HOLE, at.z], [at.x, BOARD_TOP + 1.6, at.z]], 0.42, 0.3, 8);
    const d = dir.clone().normalize();
    return bentTube(
      [
        [at.x, at.y, at.z],
        [at.x + d.x * 5, at.y + d.y * 5, at.z + d.z * 5],
      ],
      0.42,
      0.3,
      8,
    );
  }, [at.x, at.y, at.z, dir.x, dir.y, dir.z, inHole]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat.lead()} castShadow />;
}
