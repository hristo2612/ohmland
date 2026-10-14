// Invisible, enlarged hit proxies on their own layer. The interaction controller raycasts only this layer.

import { useMemo } from "react";
import * as THREE from "three";
import type { MeterMode, ProbeColor } from "../types";
import { isEffect } from "../effects/effects";

export const PICK_LAYER = 5;

export type Pick =
  | { type: "part"; id: string }
  | { type: "leg"; id: string; leg: string; flying: boolean }
  | { type: "press"; id: string }
  | { type: "flip"; id: string }
  | { type: "rotor"; id: string }
  /** The drawing area of a pencil card: dragging along it draws (or shades over) the line. */
  | { type: "draw"; id: string }
  /** A setting printed on a prop (a moisture tab, a load switch): clicking sets `key` to `value`. */
  | { type: "setting"; id: string; key: string; value: string | number | boolean }
  | { type: "wire"; id: string }
  | { type: "wireEnd"; id: string; end: "a" | "b" }
  | { type: "clip"; id: string; end: "a" | "b" }
  | { type: "meter" }
  | { type: "dial" }
  | { type: "dialMode"; mode: MeterMode }
  | { type: "plug"; color: ProbeColor }
  | { type: "probe"; color: ProbeColor };

const proxyMaterial = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0, depthWrite: false });
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 20);

function setLayer(o: THREE.Object3D | null) {
  if (o) o.layers.set(PICK_LAYER);
}

/** An invisible box (or cylinder) that the pointer can hit. Size in mm. */
export function Proxy({
  pick,
  size,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  shape = "box",
}: {
  pick: Pick;
  size: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  shape?: "box" | "cylinder";
}) {
  const userData = useMemo(() => ({ pick }), [JSON.stringify(pick)]);
  return (
    <mesh
      ref={setLayer}
      geometry={shape === "box" ? unitBox : unitCyl}
      material={proxyMaterial}
      position={position}
      rotation={rotation}
      scale={size}
      userData={userData}
      renderOrder={-1}
    />
  );
}

/** Find the pick info of a hit object (on it or its parents). */
export function pickOf(o: THREE.Object3D | null): Pick | null {
  while (o) {
    const p = (o.userData as { pick?: Pick }).pick;
    if (p) return p;
    o = o.parent;
  }
  return null;
}

/** Measure the local bounding box of a group's visible meshes (ignoring additive effects). */
export function localBox(group: THREE.Object3D): THREE.Box3 {
  group.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const box = new THREE.Box3();
  const m4 = new THREE.Matrix4();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.layers.isEnabled(0)) return;
    const mat = m.material as THREE.Material & { blending?: THREE.Blending };
    if (isEffect(o) || (o as THREE.Mesh & { isInstancedMesh?: boolean }).isInstancedMesh) return;
    if (m.geometry.type === "InstancedBufferGeometry") return;
    m.geometry.computeBoundingBox();
    m4.multiplyMatrices(inv, m.matrixWorld);
    box.union(m.geometry.boundingBox!.clone().applyMatrix4(m4));
  });
  return box;
}
