import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { boardGeometry, boardOrigin } from "../board";
import type { BoardSpec, HoleId } from "../types";
import { useEased } from "../three/anim";
import {
  boardPrintTextures,
  boardShellGeometry,
  boardTopGeometry,
  channelGeometry,
  holeRingGeometry,
  socketGeometry,
  stripGeometry,
} from "./breadboardGeometry";

export const XRAY_HEX = "#13c4a8";

export type BreadboardProps = {
  spec: BoardSpec;
  /** Fade the body and show every metal strip (the x-ray toggle). */
  xray?: boolean;
  /** Strips to light up in the x-ray view. */
  litStrips?: ReadonlySet<string>;
  /** Holes to ring (everything connected to the hovered hole). */
  litHoles?: readonly HoleId[];
  /** Ring colour for lit holes. */
  ringColor?: string;
};

const STRIP_IDLE = new THREE.Color("#b9bec6");

export function Breadboard({ spec, xray = false, litStrips, litHoles, ringColor = XRAY_HEX }: BreadboardProps) {
  const geom = boardGeometry(spec);
  const [ox, oz] = boardOrigin(spec);
  const invalidate = useThree((s) => s.invalidate);
  const H = geom.height;

  const { map, bump } = useMemo(() => boardPrintTextures(geom), [geom]);
  const mats = useMemo(() => {
    const top = new THREE.MeshStandardMaterial({ color: "#ffffff", map, bumpMap: bump, bumpScale: 0.6, roughness: 0.6, metalness: 0 });
    const shell = new THREE.MeshStandardMaterial({ color: "#f3f1eb", roughness: 0.62 });
    const channel = new THREE.MeshStandardMaterial({ color: "#efece5", roughness: 0.7, vertexColors: true });
    const socket = new THREE.MeshStandardMaterial({ color: "#f4f2ec", roughness: 0.75, vertexColors: true });
    const strip = new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0.75, roughness: 0.35 });
    const lit = new THREE.MeshStandardMaterial({ color: XRAY_HEX, metalness: 0.3, roughness: 0.4, emissive: XRAY_HEX, emissiveIntensity: 0.9 });
    const ring = new THREE.MeshBasicMaterial({ color: ringColor, toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false });
    return { top, shell, channel, socket, strip, lit, ring };
  }, [map, bump, ringColor]);
  useLayoutEffect(
    () => () => {
      for (const m of Object.values(mats)) m.dispose();
    },
    [mats],
  );

  // Hole sockets: one instanced draw for every hole on the board.
  const holes = useMemo(() => [...geom.holes.values()], [geom]);
  const socketsRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = socketsRef.current;
    if (!m) return;
    const t = new THREE.Matrix4();
    holes.forEach((h, i) => {
      t.makeTranslation(h.x, H, h.z);
      m.setMatrixAt(i, t);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [holes, H, invalidate]);

  // X-ray fade of the plastic: strong with the toggle, lighter while hovering a hole.
  const bodyMats = [mats.top, mats.shell, mats.channel];
  const hovering = (litStrips?.size ?? 0) > 0;
  const backdropRef = useRef<THREE.Mesh>(null);
  // Hovering gives a gentler peek than the x-ray toggle.
  useEased(xray ? 0.3 : hovering ? 0.5 : 1, (v) => {
    if (backdropRef.current) {
      backdropRef.current.visible = v < 0.98;
      (backdropRef.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.88, (1 - v) * 1.25);
    }
    // The hole pits would read as clutter through the plastic, so they hide while it is see-through.
    if (socketsRef.current) socketsRef.current.visible = v > 0.97;
    for (const m of bodyMats) {
      const t = v < 0.999;
      m.opacity = v;
      if (m.transparent !== t) {
        m.transparent = t;
        m.depthWrite = !t;
        m.needsUpdate = true;
      }
    }
  });

  // Metal strips (x-ray). All of them faintly with the toggle; the lit net brightly whenever something is hovered.
  const terminal = useMemo(() => [...geom.strips.values()].filter((s) => !s.rail), [geom]);
  const rails = useMemo(() => [...geom.strips.values()].filter((s) => s.rail), [geom]);
  const stripRef = useRef<THREE.InstancedMesh>(null);
  const litRef = useRef<THREE.InstancedMesh>(null);
  const stripY = H - 3.35;
  useLayoutEffect(() => {
    const m = stripRef.current;
    const lit = litRef.current;
    if (!m || !lit) return;
    const t = new THREE.Matrix4();
    const s = new THREE.Matrix4();
    let n = 0;
    terminal.forEach((st, i) => {
      const len = st.z1 - st.z0 + 1.9;
      t.makeTranslation((st.x0 + st.x1) / 2, stripY, (st.z0 + st.z1) / 2);
      s.makeScale(1, 1, len);
      const mat4 = t.clone().multiply(s);
      m.setMatrixAt(i, mat4);
      m.setColorAt(i, STRIP_IDLE);
      if (litStrips?.has(st.id)) lit.setMatrixAt(n++, mat4);
    });
    lit.count = n;
    m.instanceMatrix.needsUpdate = true;
    lit.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    lit.computeBoundingSphere();
    invalidate();
  }, [terminal, litStrips, stripY, invalidate]);

  // Rings around lit holes.
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const maxRings = 400;
  useLayoutEffect(() => {
    const m = ringRef.current;
    if (!m) return;
    const t = new THREE.Matrix4();
    let n = 0;
    for (const id of litHoles ?? []) {
      const h = geom.holes.get(id);
      if (!h || n >= maxRings) continue;
      t.makeTranslation(h.x, H + 0.03, h.z);
      m.setMatrixAt(n++, t);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [litHoles, geom, H, invalidate]);


  return (
    <group position={[ox, 0, oz]}>
      <mesh geometry={boardTopGeometry(geom)} material={mats.top} receiveShadow />
      <mesh geometry={boardShellGeometry(geom)} material={mats.shell} receiveShadow castShadow />
      <mesh geometry={channelGeometry(geom)} material={mats.channel} receiveShadow />
      <instancedMesh ref={socketsRef} args={[socketGeometry(), mats.socket, holes.length]} receiveShadow frustumCulled={false} />
      <group visible={xray}>
        <instancedMesh ref={stripRef} args={[stripGeometry(), mats.strip, terminal.length]} frustumCulled={false} />
        {rails.map((r) => (
          <mesh key={r.id} geometry={stripGeometry()} material={mats.strip} position={[(r.x0 + r.x1) / 2, stripY, (r.z0 + r.z1) / 2]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, r.x1 - r.x0 + 1.9]} />
        ))}
      </group>
      {/* Dark backdrop inside the board so the strips read clearly in the x-ray view. */}
      <mesh ref={backdropRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, H - 4.7, 0]} visible={false} renderOrder={-1}>
        <planeGeometry args={[geom.width - 1.6, geom.depth - 1.6]} />
        <meshBasicMaterial color="#33404c" transparent opacity={0} depthWrite={false} />
      </mesh>
      <instancedMesh ref={litRef} args={[stripGeometry(), mats.lit, terminal.length]} frustumCulled={false} />
      {rails
        .filter((r) => litStrips?.has(r.id))
        .map((r) => (
          <mesh key={r.id} geometry={stripGeometry()} material={mats.lit} position={[(r.x0 + r.x1) / 2, stripY, (r.z0 + r.z1) / 2]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, r.x1 - r.x0 + 1.9]} />
        ))}
      <instancedMesh ref={ringRef} args={[holeRingGeometry(), mats.ring, maxRings]} frustumCulled={false} renderOrder={5} />
    </group>
  );
}

