// Unit 4's door guard models: a door (or window) on a short stretch of wall with a magnet on its leaf, a reed switch
// on its frame and a little terminal block for clip leads; and a plug-in module, a small green board on a header row
// (the voice module). Everything is built in code; printing is drawn on canvases in our own type.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MODULE, MODULE_PINS, MODULE_PRINT, doorDims, doorMidY, doorTerminals, leafAngle, moduleBox, moduleLegs } from "../alarm";
import { PITCH } from "../dims";
import type { PartParamsMap } from "../types";
import { FONT, canvasTexture } from "../three/canvas";
import { memoGeo, roundedBox } from "../three/geometry";
import { mat } from "../three/materials";
import { useEased } from "../three/anim";
import { IN_HOLE, type ModelProps } from "./common";

const WALL = "#e6dfcf";
const WOOD = "#9a6a43";
const BASE = "#7a4a2a";

/** A word printed on a small plate (the door's tag, a module's name). */
function printTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void): THREE.CanvasTexture {
  const PPM = 48;
  return canvasTexture(key, Math.max(8, Math.round(w * PPM)), Math.max(8, Math.round(h * PPM)), draw);
}

// ---------------------------------------------------------------------------------------------------------------
// The door.

export function DoorModel({ params }: ModelProps<PartParamsMap["door"]>) {
  const style = params.style ?? "door";
  const D = doorDims(style, params.side);
  const s = D.s;
  const b = D.base;
  const leaf = useRef<THREE.Group>(null);
  useEased(s * leafAngle(params.open), (v) => {
    if (leaf.current) leaf.current.rotation.y = v;
  }, 10);
  const y0 = b.h + D.sill;
  const y1 = b.h + D.top;
  const mid = doorMidY(style);
  const term = doorTerminals(params);
  const tag = params.tag;
  const tagMat = useMemo(() => {
    if (!tag) return null;
    const tex = printTexture(`door-tag:${tag}`, 22, 5, (ctx, W, H) => {
      ctx.fillStyle = "#f3eee2";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2a2622";
      ctx.font = `800 ${H * 0.62}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tag, W / 2, H / 2);
    });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  }, [tag]);
  useLayoutEffect(() => () => tagMat?.dispose(), [tagMat]);
  const leafH = D.top - D.sill - 1;
  return (
    <group>
      {/* Base plank. */}
      <mesh geometry={memoGeo(`door-base:${style}:${s}`, () => roundedBox(b.x1 - b.x0, b.h, b.z1 - b.z0, 1.2, 2))} material={mat.paint(BASE)} position={[(b.x0 + b.x1) / 2, b.h / 2, (b.z0 + b.z1) / 2]} castShadow receiveShadow />
      {/* The wall round the opening: two jambs, a header and (for a window) the wall under the sill. */}
      <mesh geometry={memoGeo(`door-jamb:${style}`, () => new THREE.BoxGeometry(D.jamb, D.h, D.t))} material={mat.paint(WALL)} position={[-D.w / 2 + D.jamb / 2, b.h + D.h / 2, 0]} castShadow receiveShadow />
      <mesh geometry={memoGeo(`door-jamb:${style}`, () => new THREE.BoxGeometry(D.jamb, D.h, D.t))} material={mat.paint(WALL)} position={[D.w / 2 - D.jamb / 2, b.h + D.h / 2, 0]} castShadow receiveShadow />
      <mesh geometry={memoGeo(`door-head:${style}`, () => new THREE.BoxGeometry(D.w - 2 * D.jamb, D.h - D.top, D.t))} material={mat.paint(WALL)} position={[0, b.h + (D.top + D.h) / 2, 0]} castShadow receiveShadow />
      {D.sill > 2 && <mesh geometry={memoGeo(`door-sill:${style}`, () => new THREE.BoxGeometry(D.w - 2 * D.jamb, D.sill, D.t))} material={mat.paint(WALL)} position={[0, b.h + D.sill / 2, 0]} castShadow receiveShadow />}
      {/* The leaf, hinged on the jamb away from the block, swinging toward you; the magnet on its free edge. */}
      <group ref={leaf} position={[s * (D.w / 2 - D.jamb), 0, 0]}>
        <mesh geometry={memoGeo(`door-leaf:${style}`, () => roundedBox(D.leaf - 0.6, leafH, D.leafT, 0.4, 2))} material={mat.paint(style === "window" ? "#cfe0e6" : WOOD)} position={[(-s * D.leaf) / 2, (y0 + y1) / 2, 0]} castShadow receiveShadow />
        {style === "window" && <mesh geometry={memoGeo("door-pane-bar", () => new THREE.BoxGeometry(1.2, leafH, D.leafT + 0.4))} material={mat.paint(WALL)} position={[(-s * D.leaf) / 2, (y0 + y1) / 2, 0]} />}
        {style === "door" && <mesh geometry={memoGeo("door-knob", () => new THREE.SphereGeometry(1.6, 16, 12))} material={mat.brass()} position={[-s * (D.leaf - 7), mid - 6, D.leafT / 2 + 1.4]} castShadow />}
        <mesh geometry={memoGeo("door-magnet", () => roundedBox(3, 9, 2.4, 0.4, 2))} material={mat.white()} position={[-s * (D.leaf - 3.2), mid, D.leafT / 2 + 1.2]} castShadow />
        <mesh geometry={memoGeo("door-magnet-band", () => new THREE.BoxGeometry(3.05, 2.2, 2.45))} material={mat.paint("#c9372a")} position={[-s * (D.leaf - 3.2), mid + 2.2, D.leafT / 2 + 1.2]} />
      </group>
      {/* The reed module on the block's jamb: a white case with a glass capsule along it. */}
      <group position={[-s * (D.w / 2 - D.jamb / 2), mid, D.t / 2 + 1.4]}>
        <mesh geometry={memoGeo("door-reed", () => roundedBox(3.4, 13, 2.8, 0.4, 2))} material={mat.white()} castShadow />
        <mesh geometry={memoGeo("door-reed-glass", () => new THREE.CylinderGeometry(0.55, 0.55, 9, 10))} material={mat.paint("#a9c3c9")} position={[0, 0, 1.45]} />
      </group>
      {/* Its two wires down the jamb and over to the terminal block. */}
      <mesh geometry={memoGeo(`door-wires:${style}`, () => new THREE.CylinderGeometry(0.45, 0.45, mid - b.h - 2, 8))} material={mat.insulation("#eae7e0")} position={[-s * (D.w / 2 + 0.6), (mid + b.h) / 2, D.t / 2 + 0.6]} />
      <mesh geometry={memoGeo("door-block", () => roundedBox(D.block.w, D.block.h, D.block.d, 1, 2))} material={mat.blackMatte()} position={[D.block.x, b.h + D.block.h / 2, D.block.z]} castShadow receiveShadow />
      {(["a", "b"] as const).map((leg) => (
        <group key={leg} position={[term[leg][0], b.h + D.block.h, term[leg][2]]}>
          <mesh geometry={memoGeo("door-screw", () => new THREE.CylinderGeometry(1.9, 2.1, 1.4, 18))} material={mat.brass()} position={[0, 0.7, 0]} castShadow />
          <mesh geometry={memoGeo("door-slot", () => new THREE.BoxGeometry(3, 0.3, 0.5))} material={mat.darkInset()} position={[0, 1.45, 0]} />
        </group>
      ))}
      {tagMat && (
        <mesh material={tagMat} position={[0, b.h / 2, b.z1 + 0.05]}>
          <planeGeometry args={[22, 2.6]} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Plug-in modules.

function moduleTop(model: "voice", w: number, d: number): THREE.CanvasTexture {
  const pins = MODULE_PINS[model];
  return printTexture(`module-top:${model}:${w}:${d}`, w, d, (ctx, W, H) => {
    const mm = W / w;
    ctx.fillStyle = "#2f6e47";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f1efe6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Pin names just behind the pin row (the row sits `back` from the board's far edge), the name behind them.
    ctx.font = `700 ${1.35 * mm}px ${FONT}`;
    pins.forEach((p, i) => ctx.fillText(p.print, (MODULE.margin + i * PITCH) * mm, (MODULE.back - 2.6) * mm));
    ctx.font = `800 ${2.3 * mm}px ${FONT}`;
    ctx.fillText(MODULE_PRINT[model], W / 2, (MODULE.back - 6.6) * mm);
    // Pads round the pins.
    ctx.strokeStyle = "#d8c27a";
    ctx.lineWidth = 0.35 * mm;
    pins.forEach((_, i) => {
      ctx.beginPath();
      ctx.arc((MODULE.margin + i * PITCH) * mm, MODULE.back * mm, 0.75 * mm, 0, Math.PI * 2);
      ctx.stroke();
    });
  });
}

export function PlugModuleModel({ params, mount }: ModelProps<PartParamsMap["plug-module"]>) {
  const model = params.model ?? "voice";
  const legs = moduleLegs(model);
  const [x0, z0, x1, z1] = moduleBox(model);
  const w = x1 - x0;
  const d = z1 - z0;
  // On the board the origin is the first pin's hole at the board's surface; on the desk the module stands on its pins,
  // centred under the board.
  const shift = mount === "desk" ? -((legs.length - 1) * PITCH) / 2 : 0;
  const lift = MODULE.lift;
  const top = useMemo(() => new THREE.MeshStandardMaterial({ map: moduleTop(model, w, d), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }), [model, w, d]);
  useLayoutEffect(() => {
    top.userData.keepColor = true;
    return () => top.dispose();
  }, [top]);
  return (
    <group position={[shift, mount === "desk" ? -IN_HOLE : 0, 0]}>
      {legs.map((leg, i) => (
        <mesh key={leg} geometry={memoGeo(`module-pin:${lift}`, () => new THREE.BoxGeometry(0.64, lift - IN_HOLE, 0.64))} material={mat.brass()} position={[i * PITCH, (lift + IN_HOLE) / 2, 0]} castShadow />
      ))}
      <mesh geometry={memoGeo(`module-spacer:${legs.length}`, () => new THREE.BoxGeometry(legs.length * PITCH, 2.5, 2.5))} material={mat.blackPlastic()} position={[((legs.length - 1) * PITCH) / 2, 1.25, 0]} castShadow />
      <mesh geometry={memoGeo(`module-pcb:${w}:${d}`, () => roundedBox(w, MODULE.t, d, 0.8, 2))} material={mat.paint("#2f6e47")} position={[(x0 + x1) / 2, lift + MODULE.t / 2, (z0 + z1) / 2]} castShadow receiveShadow />
      <mesh material={top} position={[(x0 + x1) / 2, lift + MODULE.t + 0.02, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
      </mesh>
      {/* The singer's 555 and its 100 µF on the board. */}
      <mesh geometry={memoGeo("module-chip", () => roundedBox(6.4, 2.6, 4.8, 0.3, 2))} material={mat.blackGloss()} position={[(x0 + x1) / 2 - 1.6, lift + MODULE.t + 1.3, z0 + 4]} castShadow />
      <mesh geometry={memoGeo("module-cap", () => new THREE.CylinderGeometry(1.8, 1.8, 4.2, 18))} material={mat.paint("#2b4f9c")} position={[x1 - 3, lift + MODULE.t + 2.1, z0 + 4]} castShadow />
    </group>
  );
}
