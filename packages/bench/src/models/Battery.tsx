// 9 V alkaline battery standing upright: small round positive stud, larger hexagonal negative socket,
// an original wrap-around label, and an optional snap connector (its leads are drawn by the bench).

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AA, BATTERY, COIN } from "../dims";
import { useLabels } from "../labels";
import type { PartParamsMap } from "../types";
import { FONT, canvasTexture, rng } from "../three/canvas";
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
  pos: { pos: [-1.5, TOP + 3.3, 7.4] as [number, number, number], dir: [0, -0.12, 1] as [number, number, number] },
  neg: { pos: [1.5, TOP + 3.3, 7.4] as [number, number, number], dir: [0, -0.12, 1] as [number, number, number] },
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
  const tube = memoGeo("snap-tube", () => roundedBox(6.4, 3.0, 3.6, 1.2, 2));
  return (
    <group position={[0, TOP + 3.4, 0]}>
      <mesh geometry={body} material={mat.blackMatte()} castShadow />
      <mesh geometry={boss} material={mat.blackMatte()} position={[-BATTERY_TERM_X, 3.6, 0]} />
      <mesh geometry={boss} material={mat.blackMatte()} position={[BATTERY_TERM_X, 3.6, 0]} />
      {/* Strain relief where the two leads leave the front of the cap. */}
      <mesh geometry={tube} material={mat.blackMatte()} position={[0, -0.1, 5.6]} castShadow />
    </group>
  );
}

/** Scuffs and a hand-written "USED" over a 9 V battery's label. */
function wornTexture(used: string): THREE.CanvasTexture {
  const base = labelTexture();
  const src = base.image as HTMLCanvasElement;
  return canvasTexture(`battery-label-worn:${used}`, src.width, src.height, (ctx, w, h) => {
    ctx.drawImage(src, 0, 0);
    ctx.fillStyle = "rgba(120,110,95,0.28)";
    ctx.fillRect(0, 0, w, h);
    const r = rng(77);
    ctx.strokeStyle = "rgba(235,228,214,0.55)";
    for (let i = 0; i < 160; i++) {
      ctx.lineWidth = 1 + r() * 3;
      const x = r() * w;
      const y = r() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 30);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(w * 0.25, h * 0.86);
    ctx.rotate(-0.08);
    ctx.fillStyle = "rgba(250,250,245,0.92)";
    ctx.font = `italic 800 ${h * 0.12}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(used, 0, 0);
    ctx.restore();
  });
}

export function BatteryModel(props: ModelProps<PartParamsMap["battery"]>) {
  const size = props.params.size ?? "9v";
  if (size === "aa") return <AaCellModel {...props} />;
  if (size === "coin") return <CoinCellModel />;
  return <NineVoltModel {...props} />;
}

function NineVoltModel({ params, state }: ModelProps<PartParamsMap["battery"]>) {
  const labels = useLabels();
  const label = useMemo(
    () => new THREE.MeshPhysicalMaterial({ map: params.worn ? wornTexture(labels.print.used) : labelTexture(), roughness: params.worn ? 0.7 : 0.35, clearcoat: params.worn ? 0.1 : 0.6, clearcoatRoughness: 0.25 }),
    [params.worn, labels],
  );
  useLayoutEffect(() => () => label.dispose(), [label]);
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

// AA and coin cells ------------------------------------------------------------------------------------------------

const CHEM: Record<string, { wrap: string; band: string; text: string; volts: string }> = {
  alkaline: { wrap: "#2a5d86", band: "#f2a83a", text: "ALKALINE", volts: "1.5V" },
  nimh: { wrap: "#2f8a52", band: "#d7f0dc", text: "NiMH RECHARGEABLE", volts: "1.2V" },
  lithium: { wrap: "#5a5f69", band: "#c0c6cf", text: "LITHIUM", volts: "1.5V" },
};

function aaWrapTexture(chem: string): THREE.CanvasTexture {
  const c = CHEM[chem] ?? CHEM.alkaline!;
  // u runs round the cell (0 faces the viewer, 0.75 faces up once it lies along x), v along it (top = the + end).
  return canvasTexture(`aa-wrap:${chem}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = c.wrap;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = c.band;
    ctx.fillRect(0, 0, w, h * 0.14);
    const label = (u: number) => {
      ctx.save();
      ctx.translate(u * w, h * 0.56);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 64px ${FONT}`;
      ctx.fillText(`AA ${c.volts}`, 0, -22);
      ctx.font = `700 ${c.text.length > 10 ? 26 : 34}px ${FONT}`;
      ctx.fillText(c.text, 0, 34);
      ctx.restore();
    };
    label(0.75);
    label(0.06);
    label(1.06);
  });
}

/** An AA cell lying in a small two-saddle cradle, plus end cap toward +x. */
function AaCellModel({ params }: ModelProps<PartParamsMap["battery"]>) {
  const chem = params.chem ?? "alkaline";
  const wrap = useMemo(() => new THREE.MeshPhysicalMaterial({ map: aaWrapTexture(chem), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }), [chem]);
  useLayoutEffect(() => () => wrap.dispose(), [wrap]);
  const R = AA.dia / 2;
  const L = AA.len;
  const body = memoGeo("aa-body", () => {
    const g = new THREE.CylinderGeometry(R, R, L - 1.6, 40, 1, true);
    g.rotateZ(-Math.PI / 2);
    return g;
  });
  const capMinus = memoGeo("aa-minus", () => {
    const g = latheY([[0.001, 0], [R - 0.8, 0], [R - 0.2, 0.4], [R, 0.8]], 32);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const capPlus = memoGeo("aa-plus", () => {
    const g = latheY([[R, 0], [R - 0.3, 0.5], [R - 1.2, 0.8], [2.9, 0.8], [2.8, 1.8], [2.4, 2.2], [0.001, 2.2]], 32);
    g.rotateZ(-Math.PI / 2);
    return g;
  });
  const y = AA.lift + R;
  return (
    <group>
      {[-15, 15].map((x) => (
        <mesh key={x} geometry={memoGeo("aa-saddle", () => roundedSlab(6, 15, AA.lift + 3.4, 1.2, 0.4))} material={mat.plastic("#3b3f46", 0.6)} position={[x, 0, 0]} castShadow receiveShadow />
      ))}
      <group position={[0, y, 0]}>
        <mesh geometry={body} material={wrap} castShadow receiveShadow />
        <mesh geometry={capMinus} material={mat.steel()} position={[-L / 2 + 0.8, 0, 0]} castShadow />
        <mesh geometry={capPlus} material={mat.nickel()} position={[L / 2 - 0.8, 0, 0]} castShadow />
      </group>
    </group>
  );
}

function coinTexture(): THREE.CanvasTexture {
  return canvasTexture("coin-cell", 512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.4, h * 0.35, 20, w / 2, h / 2, w / 2);
    g.addColorStop(0, "#f4f6f8");
    g.addColorStop(1, "#b9bfc6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3b4048";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 120px ${FONT}`;
    ctx.fillText("+", w / 2, h * 0.26);
    ctx.font = `800 92px ${FONT}`;
    ctx.fillText("2032", w / 2, h * 0.52);
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText("3V LITHIUM", w / 2, h * 0.72);
  });
}

/** A 20 mm coin cell in a small black holder with a solder tab out of each side (plus to +x). */
function CoinCellModel() {
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: coinTexture(), metalness: 0.75, roughness: 0.28 }), []);
  useLayoutEffect(() => () => face.dispose(), [face]);
  const R = COIN.dia / 2;
  return (
    <group>
      <mesh geometry={memoGeo("coin-holder", () => roundedSlab(COIN.holder, COIN.holder - 2, 2.8, 3, 0.4))} material={mat.blackMatte()} castShadow receiveShadow />
      <mesh geometry={memoGeo("coin-cell-body", () => new THREE.CylinderGeometry(R, R, COIN.thick, 40))} material={mat.steel()} position={[0, 2.8 + COIN.thick / 2, 0]} castShadow />
      <mesh material={face} position={[0, 2.8 + COIN.thick + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R - 0.3, 40]} />
      </mesh>
      {/* Retaining spring over the cell (the plus contact) and its tab. */}
      <mesh geometry={memoGeo("coin-spring", () => roundedBox(14, 0.4, 5, 0.15, 1))} material={mat.nickel()} position={[6, 2.8 + COIN.thick + 0.3, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={memoGeo("coin-tab", () => roundedBox(7, 0.5, 4.5, 0.2, 1))} material={mat.nickel()} position={[s * (COIN.tab - 1.5), 2.4, 0]} castShadow />
      ))}
    </group>
  );
}
