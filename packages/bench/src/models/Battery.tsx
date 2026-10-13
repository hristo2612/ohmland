// 9 V alkaline battery standing upright: small round positive stud, larger hexagonal negative socket,
// an original wrap-around label, and an optional snap connector (its leads are drawn by the bench).

import { useMemo } from "react";
import * as THREE from "three";
import { BATTERY } from "../dims";
import type { PartParamsMap } from "../types";
import { FONT, canvasTexture } from "../three/canvas";
import { latheY, memoGeo, roundedBox, roundedRectNearFace, roundedRectOutline, roundedSlab, wallsAround } from "../three/geometry";
import { mat } from "../three/materials";
import { Smoke } from "../effects/effects";
import { healthOf, type ModelProps } from "./common";

const W = BATTERY.wid;
const D = BATTERY.thick;
const R = 2.7;
const JACKET0 = 1.3;
const JACKET1 = 44.4;
const TOP = 45.9;
export const BATTERY_TERM_X = BATTERY.termSpacing / 2;

/** Where the snap connector's leads leave its top, in battery-local coordinates. */
export const SNAP_EXITS = {
  pos: { pos: [-1.4, TOP + 7.6, 0] as [number, number, number], dir: [0, 1, 0] as [number, number, number] },
  neg: { pos: [1.4, TOP + 7.6, 0] as [number, number, number], dir: [0, 1, 0] as [number, number, number] },
};

function labelTexture(): THREE.CanvasTexture {
  const ppm = 22;
  const { u0, u1, perimeter } = roundedRectNearFace(W, D, R);
  const h = JACKET1 - JACKET0;
  return canvasTexture("battery-label", Math.round(perimeter * ppm), Math.round(h * ppm), (ctx, w, hh) => {
    const g = ctx.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, "#22335f");
    g.addColorStop(1, "#16213f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hh);
    // Amber band running round the whole battery.
    ctx.fillStyle = "#f2a83a";
    ctx.beginPath();
    ctx.moveTo(0, hh * 0.7);
    ctx.lineTo(w, hh * 0.62);
    ctx.lineTo(w, hh * 0.8);
    ctx.lineTo(0, hh * 0.88);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(0, hh * 0.9, w, ppm * 0.35);

    const face = (ua: number, ub: number, front: boolean) => {
      const cx = ((ua + ub) / 2) * w;
      const fw = (ub - ua) * w;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${ppm * (front ? 14 : 10)}px ${FONT}`;
      ctx.fillText("9V", cx, hh * (front ? 0.36 : 0.34));
      ctx.font = `700 ${ppm * 2.1}px ${FONT}`;
      if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${ppm * 0.5}px`;
      ctx.fillText(front ? "ALKALINE" : "6LR61", cx, hh * 0.56);
      if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
      // Polarity marks under the terminals (positive on the left, seen from the front).
      ctx.font = `800 ${ppm * 3.2}px ${FONT}`;
      const off = (BATTERY.termSpacing / 2 / W) * fw;
      ctx.fillStyle = "#f2a83a";
      ctx.fillText(front ? "+" : "−", cx - off, hh * 0.09);
      ctx.fillText(front ? "−" : "+", cx + off, hh * 0.09);
      ctx.fillStyle = "#1a2547";
      ctx.font = `700 ${ppm * 1.7}px ${FONT}`;
      ctx.fillText(front ? "OHMLAND CELL" : "DO NOT RECHARGE", cx, hh * 0.76);
    };
    face(u0, u1, true);
    // The far face sits half a perimeter away.
    face(u0 + 0.5, u1 + 0.5, false);
  });
}

function TopTerminals() {
  const plus = memoGeo("bat-plus", () =>
    latheY(
      [
        [0.001, 0],
        [3.0, 0],
        [3.0, 0.25],
        [2.45, 0.35],
        [2.45, 1.05],
        [2.25, 1.3],
        [2.7, 1.55],
        [2.75, 2.25],
        [2.45, 2.6],
        [0.001, 2.62],
      ],
      36,
    ),
  );
  const minus = memoGeo("bat-minus", () => {
    const s = new THREE.Shape();
    const r = 4.1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 2.55, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2, curveSegments: 24 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.2, 0);
    return g;
  });
  const slit = memoGeo("bat-slit", () => new THREE.BoxGeometry(0.28, 0.3, 1.5));
  return (
    <group position={[0, TOP, 0]}>
      <mesh geometry={plus} material={mat.nickel()} position={[-BATTERY_TERM_X, 0, 0]} castShadow />
      <group position={[BATTERY_TERM_X, 0, 0]}>
        <mesh geometry={minus} material={mat.nickel()} castShadow />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              geometry={slit}
              material={mat.darkInset()}
              position={[Math.cos(a) * 3.3, 2.45, Math.sin(a) * 3.3]}
              rotation={[0, -a + Math.PI / 2, 0]}
            />
          );
        })}
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat.darkInset()}>
          <circleGeometry args={[2.5, 24]} />
        </mesh>
      </group>
    </group>
  );
}

function SnapCap() {
  const body = memoGeo("snap-body", () => roundedBox(W - 0.8, 6.8, 10.2, 2.6, 3));
  const boss = memoGeo("snap-boss", () => new THREE.CylinderGeometry(3.6, 3.9, 0.8, 28));
  const tube = memoGeo("snap-tube", () => roundedBox(5.4, 3.2, 3.2, 1.2, 2));
  return (
    <group position={[0, TOP + 3.4, 0]}>
      <mesh geometry={body} material={mat.blackMatte()} castShadow />
      <mesh geometry={boss} material={mat.blackMatte()} position={[-BATTERY_TERM_X, 3.6, 0]} />
      <mesh geometry={boss} material={mat.blackMatte()} position={[BATTERY_TERM_X, 3.6, 0]} />
      <mesh geometry={tube} material={mat.blackMatte()} position={[0, 4.6, 0]} castShadow />
    </group>
  );
}

export function BatteryModel({ params, state }: ModelProps<PartParamsMap["battery"]>) {
  const label = useMemo(() => new THREE.MeshPhysicalMaterial({ map: labelTexture(), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }), []);
  const jacket = memoGeo("bat-jacket", () => wallsAround(roundedRectOutline(W, D, R, 8), JACKET0, JACKET1));
  const bottom = memoGeo("bat-bottom", () => roundedSlab(W - 0.2, D - 0.2, JACKET0 + 0.2, R, 0.5));
  const top = memoGeo("bat-top", () => {
    const g = roundedSlab(W - 0.3, D - 0.3, TOP - JACKET1 + 0.3, R - 0.1, 0.7);
    g.translate(0, JACKET1 - 0.3, 0);
    return g;
  });
  const health = healthOf(state);
  return (
    <group>
      <mesh geometry={jacket} material={label} castShadow receiveShadow />
      <mesh geometry={bottom} material={mat.steel()} castShadow />
      <mesh geometry={top} material={mat.aluminium()} castShadow />
      <TopTerminals />
      {params.snap && <SnapCap />}
      {(health === "hot" || health === "smoking") && (
        <group position={[0, TOP + 2, 0]}>
          <Smoke active={health === "smoking"} amount={0.5} spread={10} />
        </group>
      )}
    </group>
  );
}
