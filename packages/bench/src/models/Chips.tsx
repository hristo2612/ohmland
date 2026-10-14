// Unit 4 models: DIP chips (and the surface mount lookalike), IC sockets, the 7-segment display (bare or on its
// carrier board), the 7805 in TO-220 with an optional heat sink, the DIP switch, the logic probe, AA battery packs and
// the bench supply. Everything is built in code; printing is drawn on canvases in our own type.

import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PartState } from "@ohmland/sim";
import {
  CARRIER,
  CHIP_PRINT,
  DIP,
  DIPSW,
  DISPLAY,
  PACK,
  PROBE,
  PROBE_PROFILE,
  SEGMENTS,
  SEGMENT_SHAPES,
  SEVENSEG_LEGS,
  SOCKET,
  SOIC,
  SUPPLY,
  TO220,
  chipPinCount,
  dipFootprint,
  soicFeet,
  supplyVolts,
  type Segment,
} from "../chips";
import { BOARD_TOP, PITCH } from "../dims";
import { useLabels } from "../labels";
import type { ChipModel, PartParamsMap } from "../types";
import { Halo, LightSpill, Scorch, Smoke } from "../effects/effects";
import { FONT, MONO, canvasTexture } from "../three/canvas";
import { latheY, memoGeo, roundedBox } from "../three/geometry";
import { LED_HEX, mat } from "../three/materials";
import { useEased } from "../three/anim";
import { SPOT_LAYER } from "../three/post";
import { aaWrapTexture } from "./Battery";
import { IN_HOLE, RoomLight, healthOf, mix, type ModelProps } from "./common";
import { UprightMount } from "./Switches";

const P = PITCH;
const HAND = `"Kalam", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;

/** A box geometry translated to (x, y, z). */
function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
  for (const p of parts) p.dispose();
  return g;
}

/** Warmth 0..1 from a part's temperature: nothing below 45 degrees, full above 125. */
export function warmth(state?: PartState | null): number {
  return Math.max(0, Math.min(1, ((state?.temp ?? 25) - 45) / 80));
}

// ---------------------------------------------------------------------------------------------------------------
// Printing.

const PPM = 64;

/** Black epoxy top: the notch, the pin-1 dimple, the part number (or a taped label), burn marks. */
function chipTopTexture(o: { len: number; w: number; print: string; sub: string; hidden: boolean; label: string; dead: boolean; soic: boolean }): THREE.CanvasTexture {
  const key = `chip-top:${o.len}:${o.w}:${o.print}:${o.hidden ? o.label : ""}:${o.dead}:${o.soic}`;
  const W = Math.round(o.len * PPM);
  const H = Math.round(o.w * PPM);
  return canvasTexture(key, W, H, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const mm = PPM;
    if (o.soic) {
      // A bevel along the pin-1 side and a small dot.
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, h - 0.35 * mm, w, 0.35 * mm);
      ctx.beginPath();
      ctx.arc(0.7 * mm, h - 0.95 * mm, 0.32 * mm, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fill();
    } else {
      // Half-moon notch at the pin-1 end, and the dimple by pin 1.
      ctx.beginPath();
      ctx.arc(0, h / 2, 0.95 * mm, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 0.09 * mm;
      ctx.beginPath();
      ctx.arc(0, h / 2, 0.95 * mm, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(1.25 * mm, h - 1.25 * mm, 0.5 * mm, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();
    }
    if (!o.hidden) {
      ctx.fillStyle = "rgba(222,218,208,0.92)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let size = (o.soic ? 0.85 : 1.55) * mm;
      ctx.font = `600 ${size}px ${FONT}`;
      const room = w - (o.soic ? 1.2 : 2.6) * mm;
      const fit = room / Math.max(1, ctx.measureText(o.print).width);
      if (fit < 1) size *= fit;
      ctx.font = `600 ${size}px ${FONT}`;
      ctx.fillText(o.print, w / 2 + (o.soic ? 0 : 0.5 * mm), h * (o.soic ? 0.45 : 0.42));
      ctx.font = `500 ${size * 0.62}px ${FONT}`;
      ctx.fillStyle = "rgba(222,218,208,0.7)";
      ctx.fillText(o.sub, w / 2 + (o.soic ? 0 : 0.5 * mm), h * (o.soic ? 0.75 : 0.68));
    } else {
      // A strip of paper tape over the number, with a pencilled label.
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-0.04);
      const tw = Math.min(w * 0.62, 11 * mm);
      const th = h * 0.86;
      ctx.fillStyle = "#efe6cf";
      ctx.fillRect(-tw / 2, -th / 2, tw, th);
      ctx.strokeStyle = "rgba(120,100,70,0.35)";
      ctx.lineWidth = 0.08 * mm;
      ctx.strokeRect(-tw / 2, -th / 2, tw, th);
      ctx.fillStyle = "#2f2b26";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${th * 0.55}px ${HAND}`;
      ctx.fillText(o.label, 0, th * 0.04);
      ctx.restore();
    }
    if (o.dead) {
      // A burst: an ashen crater ringed with brown, and cracks running out of it.
      const cx = w * 0.56;
      const cy = h * 0.5;
      const r = Math.min(h * 0.42, w * 0.22);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.9);
      g.addColorStop(0, "rgba(128,116,104,0.95)");
      g.addColorStop(0.32, "rgba(96,80,66,0.9)");
      g.addColorStop(0.55, "rgba(70,42,26,0.8)");
      g.addColorStop(1, "rgba(40,24,14,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(20,12,8,0.85)";
      ctx.lineWidth = 0.14 * mm;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(205,195,180,0.6)";
      ctx.lineWidth = 0.09 * mm;
      for (const [a, len] of [[0.4, 1.0], [2.3, 0.9], [3.6, 1.2], [5.2, 0.8]] as const) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
        ctx.lineTo(cx + Math.cos(a + 0.25) * r * (1 + len * 0.6), cy + Math.sin(a + 0.25) * r * (1 + len * 0.6));
        ctx.lineTo(cx + Math.cos(a - 0.1) * r * (1.2 + len), cy + Math.sin(a - 0.1) * r * (1.2 + len));
        ctx.stroke();
      }
    }
  });
}

/** A pin label: its x in the board frame, which row (near or far), and its text. */
type PinMark = { x: number; near: boolean; text: string };

/** Pin numbers (or names) along both long edges of a body (shown up close or in a spotlight). */
function pinNumberTexture(marks: readonly PinMark[], len: number, w: number, x0: number): THREE.CanvasTexture {
  const key = `pin-marks:${len}:${w}:${x0}:${marks.map((m) => `${m.x.toFixed(2)}${m.near ? "n" : "f"}${m.text}`).join(",")}`;
  return canvasTexture(key, Math.round(len * PPM), Math.round(w * PPM), (ctx, cw, ch) => {
    ctx.clearRect(0, 0, cw, ch);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = (marks.some((m) => m.text.length > 2) ? 0.9 : 1.05) * PPM;
    ctx.font = `700 ${size}px ${FONT}`;
    for (const m of marks) {
      const x = (m.x - x0) * PPM;
      const y = m.near ? ch - 0.85 * PPM : 0.85 * PPM;
      ctx.lineWidth = 0.32 * PPM;
      ctx.strokeStyle = "rgba(20,18,16,0.9)";
      ctx.strokeText(m.text, x, y);
      ctx.fillStyle = "#fff8e8";
      ctx.fillText(m.text, x, y);
    }
  });
}

/** Pin numbers of a DIP, by position. */
function dipMarks(n: number): PinMark[] {
  return dipFootprint(n).map((f) => ({ x: f.dx * P, near: f.dz === 0, text: f.leg }));
}

/**
 * Pin numbers printed over a body that fade in when the camera comes close, or while the part is in a spotlight.
 * Placed in the part's board frame (pin 1 at the origin).
 */
function PinNumbers({ marks, len, w, cx, cz, y }: { marks: readonly PinMark[]; len: number; w: number; cx: number; cz: number; y: number }) {
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: pinNumberTexture(marks, len, w, cx - len / 2), transparent: true, depthWrite: false, toneMapped: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3 }),
    [marks, len, w, cx],
  );
  useLayoutEffect(() => {
    material.userData.keepColor = true;
    return () => material.dispose();
  }, [material]);
  const ref = useRef<THREE.Mesh>(null);
  const at = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    m.getWorldPosition(at);
    const d = camera.position.distanceTo(at);
    const near = Math.max(0, Math.min(1, (165 - d) / 45));
    const spot = m.layers.isEnabled(SPOT_LAYER) ? 1 : 0;
    const o = Math.max(near, spot);
    material.opacity = o;
    m.visible = o > 0.02;
  });
  return (
    <mesh ref={ref} material={material} position={[cx, y + 0.03, cz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6} userData={{ fx: true }}>
      <planeGeometry args={[len, w]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// DIP chips.

/** Tinned legs of a DIP in the board frame (pin 1 at the origin): a shoulder out of the body, a wide part, a pin. */
function dipLegs(n: number, bodyW: number, lift: number): THREE.BufferGeometry {
  return memoGeo(`dip-legs:${n}:${bodyW}:${lift}`, () => {
    const cz = -1.5 * P;
    const parts: THREE.BufferGeometry[] = [];
    for (const f of dipFootprint(n)) {
      const x = f.dx * P;
      const zr = f.dz * P;
      const s = f.dz === 0 ? 1 : -1;
      const zs = cz + (s * bodyW) / 2;
      const yTop = lift + 1.05;
      const z0 = zs - 0.5 * s;
      const z1 = zr - 0.06 * s;
      parts.push(boxAt(1.45, 0.26, Math.abs(z1 - z0), x, yTop, (z0 + z1) / 2));
      parts.push(boxAt(1.45, yTop - 0.95, 0.26, x, (yTop + 0.95) / 2, zr - 0.13 * s));
      parts.push(boxAt(0.95, 0.35, 0.26, x, 0.8, zr - 0.07 * s));
      parts.push(boxAt(0.5, 0.9 - IN_HOLE, 0.26, x, (0.9 + IN_HOLE) / 2, zr));
    }
    return merged(parts);
  });
}

function chipBodyMaterial(heat: number, dead: boolean): THREE.Material {
  const k = Math.round(heat * 10);
  return memoMaterial(`chip-body:${k}:${dead}`, () => {
    // Warm epoxy darkens toward brown with a faint ember glow: a cue that it is too hot to touch.
    const base = dead ? "#151210" : mix("#1d1e21", "#33190f", heat * 0.65);
    const m = new THREE.MeshPhysicalMaterial({ color: base, roughness: dead ? 0.85 : 0.62, clearcoat: dead ? 0 : 0.15, clearcoatRoughness: 0.6 });
    if (heat > 0.05 && !dead) {
      m.emissive = new THREE.Color("#d9481a");
      m.emissiveIntensity = heat * heat * 0.07;
    }
    return m;
  });
}

const matCache = new Map<string, THREE.Material>();
function memoMaterial(key: string, make: () => THREE.Material): THREE.Material {
  let m = matCache.get(key);
  if (!m) {
    m = make();
    m.name = key;
    matCache.set(key, m);
  }
  return m;
}

/** A date code under the part number, the same for every chip of a model (looks printed, means nothing). */
function dateCode(model: string): string {
  let h = 7;
  for (let i = 0; i < model.length; i++) h = (h * 31 + model.charCodeAt(i)) >>> 0;
  return `${18 + (h % 7)}${String(10 + (h % 40)).padStart(2, "0")}`;
}

/** The top of a chip: its printing as a decal just above the epoxy. */
function ChipTop({ len, w, y, cx, cz, print, sub, hidden, label, dead, soic }: { len: number; w: number; y: number; cx: number; cz: number; print: string; sub: string; hidden: boolean; label: string; dead: boolean; soic: boolean }) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ map: chipTopTexture({ len, w, print, sub, hidden, label, dead, soic }), transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    [len, w, print, sub, hidden, label, dead, soic],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} position={[cx, y + 0.012, cz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
      <planeGeometry args={[len, w]} />
    </mesh>
  );
}

/** Heat, smoke and burn marks over a chip-like body. */
function Distress({ state, at, scorch, mount }: { state?: PartState | null; at: [number, number, number]; scorch: [number, number]; mount: string }) {
  const health = healthOf(state);
  return (
    <>
      {(health === "smoking" || health === "dead") && (
        <group position={at}>
          <Smoke active={health === "smoking"} amount={0.55} spread={3} />
        </group>
      )}
      {health === "dead" && mount === "board" && (
        <group position={[at[0], 0, at[2]]}>
          <Scorch width={scorch[0]} depth={scorch[1]} opacity={0.45} />
        </group>
      )}
    </>
  );
}

export function ChipModel({ params, mount, state, held, perched }: ModelProps<PartParamsMap["chip"]> & { held?: boolean; perched?: boolean }) {
  const model = params.model ?? "555";
  if (params.package === "soic") return <SoicChip model={model} params={params} state={state} perched={!!perched} />;
  const n = chipPinCount(model);
  const len = DIP.len[n] ?? 9.4;
  const cx = ((n / 2 - 1) / 2) * P;
  const cz = -1.5 * P;
  const dead = healthOf(state) === "dead";
  const heat = dead ? 0 : warmth(state);
  const top = DIP.lift + DIP.h;
  const m = held ? "board" : mount;
  const marks = useMemo(() => dipMarks(n), [n]);
  return (
    <UprightMount mount={m} cx={cx} cz={cz}>
      <mesh geometry={memoGeo(`dip-body:${n}`, () => roundedBox(len, DIP.h, DIP.w, 0.4, 3))} material={chipBodyMaterial(heat, dead)} position={[cx, DIP.lift + DIP.h / 2, cz]} castShadow receiveShadow />
      {/* The notch reads on the end face too. */}
      <mesh geometry={memoGeo("dip-notch-end", () => new THREE.CircleGeometry(0.95, 20, -Math.PI / 2, Math.PI))} material={mat.darkInset()} position={[cx - len / 2 - 0.01, top - 0.02, cz]} rotation={[0, -Math.PI / 2, Math.PI / 2]} />
      <ChipTop len={len - 0.25} w={DIP.w - 0.25} y={top} cx={cx} cz={cz} print={CHIP_PRINT[model]} sub={dateCode(model)} hidden={!!params.hidden} label={params.label ?? "?"} dead={dead} soic={false} />
      <PinNumbers marks={marks} len={len - 0.6} w={DIP.w - 0.5} cx={cx} cz={cz} y={top} />
      <mesh geometry={dipLegs(n, DIP.w, DIP.lift)} material={mat.lead()} castShadow />
      <Distress state={state} at={[cx, top, cz]} scorch={[len + 6, 12]} mount={m} />
    </UprightMount>
  );
}

function soicFeetGeometry(n: number): THREE.BufferGeometry {
  return memoGeo(`soic-feet:${n}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, , z] of Object.values(soicFeet(n))) {
      const s = Math.sign(z);
      parts.push(boxAt(0.42, 0.2, 0.55, x, 0.85, s * (SOIC.w / 2 + 0.22)));
      parts.push(boxAt(0.42, 0.8, 0.2, x, 0.52, s * (SOIC.w / 2 + 0.5)));
      parts.push(boxAt(0.42, 0.18, 0.65, x, 0.12, s * (SOIC.feet / 2 - 0.3)));
    }
    return merged(parts);
  });
}

/** The surface mount lookalike: a small body on gull-wing feet 1.27 mm apart. On the board it lies askew on top. */
function SoicChip({ model, params, state, perched }: { model: ChipModel; params: PartParamsMap["chip"]; state?: PartState | null; perched: boolean }) {
  const n = chipPinCount(model);
  const len = SOIC.len[n] ?? 4.9;
  const dead = healthOf(state) === "dead";
  return (
    // Not seated: one row of feet rests on the plastic, the other is lifted.
    <group rotation={[perched ? 0.07 : 0, 0, 0]} position={[0, perched ? 0.2 : 0, 0]}>
      <mesh geometry={memoGeo(`soic-body:${n}`, () => roundedBox(len, SOIC.h, SOIC.w, 0.18, 2))} material={chipBodyMaterial(dead ? 0 : warmth(state), dead)} position={[0, SOIC.lift + SOIC.h / 2, 0]} castShadow receiveShadow />
      <ChipTop len={len - 0.1} w={SOIC.w - 0.1} y={SOIC.lift + SOIC.h} cx={0} cz={0} print={CHIP_PRINT[model]} sub={dateCode(model)} hidden={!!params.hidden} label={params.label ?? "?"} dead={dead} soic />
      <mesh geometry={soicFeetGeometry(n)} material={mat.lead()} castShadow />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// IC socket.

function socketTopTexture(n: number, len: number): THREE.CanvasTexture {
  return canvasTexture(`socket-top:${n}`, Math.round(len * PPM), Math.round(SOCKET.w * PPM), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const x0 = (len - (n / 2 - 1) * P) / 2;
    for (const f of dipFootprint(n)) {
      const x = (x0 + f.dx * P) * PPM;
      const y = f.dz === 0 ? h / 2 + 1.5 * P * PPM : h / 2 - 1.5 * P * PPM;
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(x - 0.45 * PPM, y - 0.62 * PPM, 0.9 * PPM, 1.24 * PPM);
      ctx.fillStyle = "rgba(205,190,150,0.6)";
      ctx.fillRect(x - 0.18 * PPM, y - 0.3 * PPM, 0.36 * PPM, 0.6 * PPM);
    }
    // The socket's own notch, moulded into the pin-1 end.
    ctx.beginPath();
    ctx.arc(0, h / 2, 1.1 * PPM, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
  });
}

function socketFrame(n: number, len: number): THREE.BufferGeometry {
  return memoGeo(`socket-frame:${n}`, () => {
    const h = SOCKET.h;
    const rail = 2.7;
    const parts = [
      boxAt(len, h, rail, 0, h / 2, 1.5 * P),
      boxAt(len, h, rail, 0, h / 2, -1.5 * P),
      boxAt(SOCKET.end, h, SOCKET.w - 2 * rail + 0.2, -len / 2 + SOCKET.end / 2, h / 2, 0),
      boxAt(SOCKET.end, h, SOCKET.w - 2 * rail + 0.2, len / 2 - SOCKET.end / 2, h / 2, 0),
      // Two thin webs across the middle hold the rails.
      boxAt(0.9, h * 0.35, SOCKET.w - 2 * rail + 0.2, -len / 6, h * 0.175, 0),
      boxAt(0.9, h * 0.35, SOCKET.w - 2 * rail + 0.2, len / 6, h * 0.175, 0),
    ];
    return merged(parts);
  });
}

function socketPins(n: number): THREE.BufferGeometry {
  return memoGeo(`socket-pins:${n}`, () => merged(dipFootprint(n).map((f) => boxAt(0.5, 0.4 - IN_HOLE, 0.3, f.dx * P, (0.4 + IN_HOLE) / 2, f.dz * P))));
}

export function SocketModel({ params, mount }: ModelProps<PartParamsMap["ic-socket"]>) {
  const n = params.pins ?? 8;
  const len = (n / 2 - 1) * P + 2.4;
  const cx = ((n / 2 - 1) / 2) * P;
  const cz = -1.5 * P;
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: socketTopTexture(n, len), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), [n, len]);
  useLayoutEffect(() => () => material.dispose(), [material]);
  const lift = 0.3;
  return (
    <UprightMount mount={mount} cx={cx} cz={cz}>
      <group position={[cx, lift, cz]}>
        <mesh geometry={socketFrame(n, len)} material={mat.plastic("#2b2c30", 0.7)} castShadow receiveShadow />
        <mesh material={material} position={[0, SOCKET.h + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <planeGeometry args={[len, SOCKET.w]} />
        </mesh>
      </group>
      <mesh geometry={socketPins(n)} material={mat.brass()} castShadow />
    </UprightMount>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// DIP switch.

function dipSwitchTopTexture(n: number, len: number, tags: readonly string[], on: string): THREE.CanvasTexture {
  return canvasTexture(`dipsw-top:${n}:${tags.join("|")}:${on}`, Math.round(len * PPM), Math.round(DIPSW.w * PPM), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const x0 = (len - (n - 1) * P) / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // ON and its arrow along the far edge.
    ctx.fillStyle = "rgba(250,248,240,0.95)";
    ctx.font = `700 ${1.05 * PPM}px ${FONT}`;
    ctx.fillText(on, 1.6 * PPM, 1.0 * PPM);
    ctx.strokeStyle = "rgba(250,248,240,0.95)";
    ctx.lineWidth = 0.14 * PPM;
    ctx.beginPath();
    ctx.moveTo(3.0 * PPM, 1.0 * PPM);
    ctx.lineTo(3.0 * PPM + 1.6 * PPM, 1.0 * PPM);
    ctx.stroke();
    for (let k = 0; k < n; k++) {
      const x = (x0 + k * P) * PPM;
      // The slot.
      ctx.fillStyle = "rgba(20,20,24,0.9)";
      ctx.fillRect(x - 0.62 * PPM, h / 2 - (DIPSW.slot / 2) * PPM, 1.24 * PPM, DIPSW.slot * PPM);
      // Under each slider its number, or the name a lab tagged it with.
      const tag = tags[k];
      ctx.fillStyle = "rgba(250,248,240,0.95)";
      ctx.font = `700 ${(tag ? 1.1 : 0.95) * PPM}px ${FONT}`;
      ctx.fillText(tag ?? String(k + 1), x, h - 0.95 * PPM);
    }
  });
}

function DipSlider({ on, x }: { on: boolean; x: number }) {
  const ref = useRef<THREE.Group>(null);
  const travel = DIPSW.slot / 2 - DIPSW.knob / 2 - 0.2;
  useEased(on ? -travel : travel, (v) => {
    if (ref.current) ref.current.position.z = v;
  }, 24);
  return (
    <group position={[x, 0, 0]}>
      <group ref={ref}>
        <mesh geometry={memoGeo("dipsw-knob", () => roundedBox(1.0, 1.1, DIPSW.knob, 0.15, 2))} material={mat.plastic("#f4f1ea", 0.45)} position={[0, 0.25, 0]} castShadow />
      </group>
    </group>
  );
}

export function DipSwitchModel({ params, mount }: ModelProps<PartParamsMap["dip-switch"]>) {
  const n = params.positions ?? 8;
  const pins = n * 2;
  const len = n * P + 0.4;
  const cx = ((n - 1) / 2) * P;
  const cz = -1.5 * P;
  const labels = useLabels();
  const tags = params.tags ?? [];
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: dipSwitchTopTexture(n, len, tags, labels.print.on), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n, len, tags.join("|"), labels.print.on],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  const top = DIPSW.lift + DIPSW.h;
  return (
    <UprightMount mount={mount} cx={cx} cz={cz}>
      <mesh geometry={memoGeo(`dipsw-body:${n}`, () => roundedBox(len, DIPSW.h, DIPSW.w, 0.35, 2))} material={mat.glossy("#2f5fc4")} position={[cx, DIPSW.lift + DIPSW.h / 2, cz]} castShadow receiveShadow />
      <mesh material={material} position={[cx, top + 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[len, DIPSW.w]} />
      </mesh>
      <group position={[cx - ((n - 1) / 2) * P, top, cz]}>
        {Array.from({ length: n }, (_, k) => (
          <DipSlider key={k} x={k * P} on={!!(params as Record<string, unknown>)[`s${k + 1}`]} />
        ))}
      </group>
      <mesh geometry={dipLegs(pins, DIPSW.w, DIPSW.lift)} material={mat.lead()} castShadow />
    </UprightMount>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 7-segment display.

function segmentGeometry(seg: Segment): THREE.BufferGeometry {
  return memoGeo(`seg:${seg}`, () => {
    const pts = SEGMENT_SHAPES[seg];
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(s, 6);
    g.rotateX(-Math.PI / 2);
    return g;
  });
}

function displayLegs(lift: number): THREE.BufferGeometry {
  return memoGeo(`seg-legs:${lift}`, () =>
    merged(
      SEVENSEG_LEGS.map((_, i) => {
        const x = (i < 5 ? i : 9 - i) * P;
        const z = i < 5 ? 0 : -6 * P;
        return boxAt(0.5, lift + 0.6 - IN_HOLE, 0.3, x, (lift + 0.6 + IN_HOLE) / 2, z);
      }),
    ),
  );
}

function carrierTexture(ohms: number, labelsOn: boolean): THREE.CanvasTexture {
  const code = ohmsCode(ohms);
  return canvasTexture(`carrier:${code}:${labelsOn}`, Math.round(CARRIER.w * PPM), Math.round(CARRIER.d * PPM), (ctx, w, h) => {
    ctx.fillStyle = "#2f6e47";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(230,240,225,0.55)";
    ctx.lineWidth = 0.12 * PPM;
    ctx.strokeRect(0.5 * PPM, 0.5 * PPM, w - PPM, h - PPM);
    // Four small resistors down each side, each marked with its code.
    const side = (x: number, letters: string[]) => {
      letters.forEach((l, i) => {
        const y = (3.2 + i * 4.9) * PPM;
        ctx.fillStyle = "#c9c7c0";
        ctx.fillRect(x - 0.9 * PPM, y - 1.9 * PPM, 1.8 * PPM, 0.55 * PPM);
        ctx.fillRect(x - 0.9 * PPM, y + 1.35 * PPM, 1.8 * PPM, 0.55 * PPM);
        ctx.fillStyle = "#1c1c1e";
        ctx.fillRect(x - 0.9 * PPM, y - 1.35 * PPM, 1.8 * PPM, 2.7 * PPM);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "#f2efe6";
        ctx.font = `600 ${0.9 * PPM}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(code, 0, 0);
        ctx.restore();
        if (labelsOn) {
          ctx.fillStyle = "rgba(240,245,235,0.85)";
          ctx.font = `600 ${1.0 * PPM}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(l, x + (x < w / 2 ? 1.9 : -1.9) * PPM, y);
        }
      });
    };
    side(2.1 * PPM, ["e", "d", "c", "dp"]);
    side(w - 2.1 * PPM, ["a", "b", "f", "g"]);
  });
}

/** Three-digit resistor code: 3300 is "332". */
function ohmsCode(ohms: number): string {
  if (ohms < 10) return `${ohms}R`.replace(".", "R");
  const e = Math.floor(Math.log10(ohms)) - 1;
  const d = Math.round(ohms / 10 ** e);
  return `${d}${e}`;
}

export function SevenSegModel({ params, mount, state, quality = "high" }: ModelProps<PartParamsMap["sevenseg"]>) {
  const color = params.color ?? "red";
  const hex = LED_HEX[color] ?? LED_HEX.red!;
  const carrier = !!params.carrier;
  const lift = carrier ? CARRIER.lift + CARRIER.t : DISPLAY.lift;
  const cx = 2 * P;
  const cz = -3 * P;
  const extra = state?.extra ?? {};
  const deadSegs = typeof extra["dead"] === "string" ? (extra["dead"] as string) : "";
  const glows = SEGMENTS.map((s) => (deadSegs.includes(s) ? 0 : Math.max(0, Math.min(1, Number(extra[s] ?? 0)))));
  const allDead = healthOf(state) === "dead";
  const room = useContext(RoomLight);
  const boost = 1 + (1 - Math.max(0, Math.min(1, room))) * 3;
  // One material per segment: its glow changes with every snapshot.
  const mats = useMemo(() => SEGMENTS.map(() => new THREE.MeshBasicMaterial({ toneMapped: false })), []);
  useLayoutEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const off = mix("#b9b2a7", hex.lens, 0.14);
  const lit = new THREE.Color(hex.emit);
  glows.forEach((g, i) => {
    const m = mats[i]!;
    const dead = allDead || deadSegs.includes(SEGMENTS[i]!);
    if (dead) m.color.set("#3a2a24");
    else if (g < 0.02) m.color.set(off);
    else m.color.set(mix(off, hex.emit, Math.min(1, 0.35 + g))).lerp(lit, Math.min(1, g)).multiplyScalar(1 + g * (quality === "high" ? 2.6 : 1.6));
  });
  const brightest = Math.max(...glows);
  const sum = glows.reduce((a, b) => a + b, 0);
  const top = lift + DISPLAY.h;
  return (
    <UprightMount mount={mount} cx={cx} cz={cz}>
      {carrier && <CarrierBoard ohms={params.segmentOhms ?? 3300} cx={cx} cz={cz} />}
      <mesh geometry={memoGeo("seg-body", () => roundedBox(DISPLAY.w, DISPLAY.h, DISPLAY.d, 0.35, 2))} material={mat.plastic("#3b3d42", 0.62)} position={[cx, lift + DISPLAY.h / 2, cz]} castShadow receiveShadow />
      <mesh geometry={memoGeo("seg-face", () => roundedBox(DISPLAY.w - 0.6, 0.12, DISPLAY.d - 0.6, 0.05, 1))} material={mat.plastic("#55585e", 0.8)} position={[cx, top + 0.02, cz]} receiveShadow />
      <group position={[cx, top + 0.1, cz]}>
        {SEGMENTS.map((s, i) => (
          <mesh key={s} geometry={segmentGeometry(s)} material={mats[i]!} renderOrder={4} />
        ))}
        {/* Light washing over the face (flat, so it never cuts through the body). */}
        {brightest > 0.02 && (
          <group position={[-0.5, 0.05, 0]}>
            <LightSpill color={hex.emit} intensity={Math.min(1, (0.35 + sum / 8) * brightest * (quality === "low" ? 1.1 : 1) * boost)} radius={11} />
          </group>
        )}
      </group>
      <PinNumbers marks={SEVENSEG_MARKS} len={DISPLAY.w - 0.8} w={DISPLAY.d - 0.8} cx={cx} cz={cz} y={top + 0.1} />
      <mesh geometry={displayLegs(lift)} material={mat.lead()} castShadow />
      <Distress state={state} at={[cx, top, cz]} scorch={[18, 24]} mount={mount} />
    </UprightMount>
  );
}

/** The display's pins named by segment, five along each edge of the face. */
const SEVENSEG_MARKS: PinMark[] = SEVENSEG_LEGS.map((leg, i) => ({ x: (i < 5 ? i : 9 - i) * P, near: i < 5, text: leg === "com2" ? "com" : leg }));

function CarrierBoard({ ohms, cx, cz }: { ohms: number; cx: number; cz: number }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: carrierTexture(ohms, true), roughness: 0.55 }), [ohms]);
  useLayoutEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      <mesh geometry={memoGeo("carrier-pcb", () => roundedBox(CARRIER.w, CARRIER.t, CARRIER.d, 0.5, 2))} material={[mat.plastic("#2a6040", 0.6), mat.plastic("#2a6040", 0.6), material, mat.plastic("#2a6040", 0.6), mat.plastic("#2a6040", 0.6), mat.plastic("#2a6040", 0.6)]} position={[cx, CARRIER.lift + CARRIER.t / 2, cz]} castShadow receiveShadow />
      {/* Black header shoulders under the board. */}
      {[0, -6 * P].map((z) => (
        <mesh key={z} geometry={memoGeo("carrier-header", () => roundedBox(5 * P, CARRIER.lift, 2.4, 0.2, 1))} material={mat.blackMatte()} position={[cx, CARRIER.lift / 2, z]} castShadow />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 7805 in TO-220.

function tabGeometry(): THREE.BufferGeometry {
  return memoGeo("to220-tab", () => {
    const T = TO220;
    const H = T.bodyH + T.tabH;
    const s = new THREE.Shape();
    s.moveTo(-T.w / 2, 0);
    s.lineTo(T.w / 2, 0);
    s.lineTo(T.w / 2, H - 0.8);
    s.lineTo(T.w / 2 - 0.8, H);
    s.lineTo(-T.w / 2 + 0.8, H);
    s.lineTo(-T.w / 2, H - 0.8);
    s.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, H - 2.8, T.hole / 2, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: T.tabD, bevelEnabled: false, curveSegments: 24 });
    return g;
  });
}

function regulatorPrint(): THREE.CanvasTexture {
  return canvasTexture("to220-print", 640, 384, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(222,218,208,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 150px ${FONT}`;
    ctx.fillText("7805", w / 2, h * 0.36);
    ctx.font = `600 84px ${FONT}`;
    ctx.fillStyle = "rgba(222,218,208,0.72)";
    ctx.fillText("+5V", w / 2, h * 0.72);
  });
}

function regulatorLegs(): THREE.BufferGeometry {
  return memoGeo("to220-legs", () =>
    merged(
      [0, 1, 2].flatMap((i) => [boxAt(1.3, 1.6, 0.5, i * P, TO220.lift - 0.8, 0), boxAt(TO220.legW, TO220.lift - 1.4 - IN_HOLE, 0.5, i * P, (TO220.lift - 1.4 + IN_HOLE) / 2, 0)]),
    ),
  );
}

function heatSinkGeometry(): THREE.BufferGeometry {
  return memoGeo("to220-sink", () => {
    const S = TO220.sink;
    const parts = [boxAt(S.w, S.h, 1.6, 0, S.h / 2, -0.8)];
    for (let i = 0; i < S.fins; i++) {
      const x = -S.w / 2 + 0.6 + (i * (S.w - 1.2)) / (S.fins - 1);
      parts.push(boxAt(0.9, S.h, S.d, x, S.h / 2, -S.d / 2 - 1.2));
    }
    return merged(parts);
  });
}

function RegulatorBody({ heat, dead, heatsink }: { heat: number; dead: boolean; heatsink: boolean }) {
  const T = TO220;
  const print = useMemo(() => new THREE.MeshBasicMaterial({ map: regulatorPrint(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), []);
  useLayoutEffect(() => () => print.dispose(), [print]);
  const tabMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9c6bf", metalness: 0.42, roughness: 0.42 }), []);
  useLayoutEffect(() => {
    tabMat.userData.keepColor = true;
    return () => tabMat.dispose();
  }, [tabMat]);
  // The tab warms a little toward straw; a dead part's is darkened.
  tabMat.color.set(dead ? "#6b5a4f" : mix("#c9c6bf", "#b98a55", heat * 0.35));
  const plasticDepth = T.bodyD - T.tabD;
  return (
    <group>
      {/* Metal tab at the back, with its hole. */}
      <mesh geometry={tabGeometry()} material={tabMat} position={[0, 0, -plasticDepth / 2 - T.tabD]} castShadow receiveShadow />
      <mesh geometry={memoGeo("to220-body", () => roundedBox(T.w, T.bodyH, plasticDepth, 0.3, 2))} material={chipBodyMaterial(heat, dead)} position={[0, T.bodyH / 2, 0]} castShadow receiveShadow />
      <mesh material={print} position={[0, T.bodyH * 0.55, plasticDepth / 2 + 0.02]} renderOrder={3}>
        <planeGeometry args={[T.w * 0.85, T.w * 0.51]} />
      </mesh>
      {heatsink && (
        <group position={[0, -0.6, -plasticDepth / 2 - T.tabD]}>
          <mesh geometry={heatSinkGeometry()} material={mat.aluminium()} castShadow receiveShadow />
          {/* The bolt through the tab. */}
          <mesh geometry={memoGeo("to220-bolt", () => new THREE.CylinderGeometry(1.6, 1.6, 1.2, 6))} material={mat.steel()} position={[0, T.bodyH + T.tabH - 2.2, T.tabD + 0.6]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      )}
    </group>
  );
}

export function RegulatorModel({ params, mount, state }: ModelProps<PartParamsMap["regulator7805"]>) {
  const dead = healthOf(state) === "dead";
  const heat = dead ? 0 : warmth(state);
  const T = TO220;
  const heatsink = !!params.heatsink;
  if (mount === "desk") {
    // Lying on its back, print up, legs toward you.
    const back = (T.bodyD - T.tabD) / 2 + T.tabD;
    return (
      <group position={[0, back + (heatsink ? 13.2 : 0), 3.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <RegulatorBody heat={heat} dead={dead} heatsink={heatsink} />
        {[-1, 0, 1].map((i) => (
          <mesh key={i} geometry={memoGeo("to220-desk-leg", () => boxAt(T.legW, T.deskLeg, 0.5, 0, -T.deskLeg / 2, 0))} material={mat.lead()} position={[i * P, 0, 0]} castShadow />
        ))}
        <Distress state={state} at={[0, T.bodyH, 0]} scorch={[14, 12]} mount={mount} />
      </group>
    );
  }
  return (
    <group>
      <group position={[P, T.lift, -0.3]}>
        <RegulatorBody heat={heat} dead={dead} heatsink={heatsink} />
      </group>
      <mesh geometry={regulatorLegs()} material={mat.lead()} castShadow />
      <Distress state={state} at={[P, T.lift + T.bodyH + T.tabH, 0]} scorch={[14, 10]} mount={mount} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Logic probe.

const PR = PROBE.dia / 2;
const NZ = PROBE.needle;

/** Pen profile along its axis (radius, distance from the tip). */
const PEN = PROBE_PROFILE.map(([r, z]) => [r, z] as [number, number]);

/** The dark nose: the same profile up to the barrel, a hair proud of it. */
const NOSE: [number, number][] = PEN.slice(0, 6).map(([r, z]) => [r + 0.04, z]);

function probeLabel(hi: string, lo: string, pulse: string): THREE.CanvasTexture {
  return canvasTexture(`probe-label:${hi}:${lo}:${pulse}`, 192, 640, (ctx, w, h) => {
    ctx.fillStyle = "#3a3c41";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f2ede2";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 42px ${FONT}`;
    // One name beside each lamp, reading along the pen.
    [hi, lo, pulse].forEach((t, i) => {
      ctx.save();
      ctx.translate(w * 0.74, h * (0.2 + i * 0.3));
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(t, 0, 0);
      ctx.restore();
    });
  });
}

/** Lamp positions along the pen (distance from the tip). */
const LAMPS = [PROBE.lamps, PROBE.lamps + PROBE.lamp, PROBE.lamps + 2 * PROBE.lamp];

function Lamp({ on, z }: { on: boolean; z: number }) {
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useLayoutEffect(() => () => material.dispose(), [material]);
  material.color.set(on ? "#ffb347" : "#5a4a3a");
  if (on) material.color.multiplyScalar(2.2);
  return (
    <group position={[-1.2, PR - 0.25, z]}>
      <mesh geometry={memoGeo("probe-lamp", () => new THREE.SphereGeometry(1.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2))} material={material} />
      {on && <Halo color="#ffa733" intensity={0.8} size={10} />}
    </group>
  );
}

export function LogicProbeModel({ state, probing }: ModelProps<PartParamsMap["logic-probe"]> & { probing?: boolean }) {
  const labels = useLabels();
  const x = state?.extra ?? {};
  const powered = !!x["powered"];
  const level = String(x["level"] ?? "");
  const pulse = !!x["pulse"];
  const label = useMemo(
    () => new THREE.MeshStandardMaterial({ map: probeLabel(labels.print.hi ?? "HI", labels.print.lo ?? "LO", labels.print.pulse ?? "PULSE"), roughness: 0.6 }),
    [labels.print.hi, labels.print.lo, labels.print.pulse],
  );
  useLayoutEffect(() => () => label.dispose(), [label]);
  const body = memoGeo("probe-body", () => {
    const g = latheY(PEN, 40);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const nose = memoGeo("probe-nose", () => {
    const g = latheY(NOSE, 40);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const needle = memoGeo("probe-needle", () => {
    const g = latheY([[0.001, 0], [0.35, 1.2], [0.42, NZ]], 12);
    g.rotateX(Math.PI / 2);
    return g;
  });
  // Lying on the desk the lamps face up; standing in a hole the pen leans back toward you, rolled so they face you.
  const lean = probing ? PROBE.lean : 0;
  return (
    <group position={[0, probing ? BOARD_TOP - 1 : PR, 0]} rotation={[-lean, 0, 0]}>
      <group rotation={[0, 0, probing ? Math.PI : 0]}>
        <mesh geometry={needle} material={mat.chrome()} castShadow />
        <mesh geometry={body} material={mat.plastic("#e9e4d8", 0.45)} castShadow receiveShadow />
        <mesh geometry={nose} material={mat.rubber("#2c2d31")} castShadow />
        {/* The dark label strip with the lamp names. */}
        <mesh material={label} position={[0, PR + 0.02, LAMPS[1]!]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5, 20]} />
        </mesh>
        <Lamp on={powered && level === "H"} z={LAMPS[0]!} />
        <Lamp on={powered && level === "L"} z={LAMPS[1]!} />
        <Lamp on={powered && pulse} z={LAMPS[2]!} />
      </group>
    </group>
  );
}

/** Where the logic probe's leads leave its tail (local, with the pen lying or leaning in a hole). */
export function probeExits(probing: boolean): Record<"vcc" | "gnd", { pos: [number, number, number]; dir: [number, number, number] }> {
  const L = PROBE.len + 8;
  const a = probing ? PROBE.lean : 0;
  const y0 = probing ? BOARD_TOP - 1 : PROBE.dia / 2;
  const y = y0 + Math.sin(a) * L;
  const z = Math.cos(a) * L;
  const dir: [number, number, number] = [0, Math.sin(a) * 0.4 - 0.2, 1];
  return { vcc: { pos: [-0.8, y, z], dir: [-0.15, dir[1], 1] }, gnd: { pos: [0.8, y, z], dir: [0.15, dir[1], 1] } };
}

// ---------------------------------------------------------------------------------------------------------------
// AA battery pack.

export function packSize(cells: number): { w: number; d: number } {
  return { w: cells * PACK.cell + 2 * PACK.wall, d: PACK.cellLen + 2 * PACK.end };
}

function packShell(cells: number): THREE.BufferGeometry {
  return memoGeo(`pack-shell:${cells}`, () => {
    const { w, d } = packSize(cells);
    const h = PACK.h;
    const t = PACK.wall;
    const parts = [
      boxAt(w, 1.2, d, 0, 0.6, 0),
      boxAt(t, h, d, -w / 2 + t / 2, h / 2, 0),
      boxAt(t, h, d, w / 2 - t / 2, h / 2, 0),
      boxAt(w, h, PACK.end, 0, h / 2, -d / 2 + PACK.end / 2),
      boxAt(w, h, PACK.end, 0, h / 2, d / 2 - PACK.end / 2),
    ];
    for (let i = 1; i < cells; i++) parts.push(boxAt(0.8, h * 0.45, d - 2 * PACK.end, -w / 2 + t + i * PACK.cell, h * 0.225, 0));
    return merged(parts);
  });
}

export function PackModel({ params }: ModelProps<PartParamsMap["battery-pack"]>) {
  const cells = params.cells ?? 3;
  const { w } = packSize(cells);
  const wrap = useMemo(() => new THREE.MeshPhysicalMaterial({ map: aaWrapTexture("alkaline"), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }), []);
  useLayoutEffect(() => () => wrap.dispose(), [wrap]);
  const R = PACK.cell / 2 - 0.2;
  const L = PACK.cellLen;
  const cell = memoGeo("pack-cell", () => {
    const g = new THREE.CylinderGeometry(R, R, L - 1.6, 32, 1, false);
    g.rotateX(Math.PI / 2);
    return g;
  });
  return (
    <group>
      <mesh geometry={packShell(cells)} material={mat.plastic("#26272b", 0.7)} castShadow receiveShadow />
      {Array.from({ length: cells }, (_, i) => (
        // Cells alternate, plus to minus, so they add up in series.
        <group key={i} position={[-w / 2 + PACK.wall + PACK.cell / 2 + i * PACK.cell, R + 1.2, 0]} rotation={[0, i % 2 ? Math.PI : 0, 0]}>
          <mesh geometry={cell} material={wrap} castShadow receiveShadow />
          <mesh geometry={memoGeo("pack-nub", () => {
            const g = new THREE.CylinderGeometry(2.6, 2.8, 1.3, 20);
            g.rotateX(Math.PI / 2);
            return g;
          })} material={mat.nickel()} position={[0, 0, L / 2 - 0.4]} />
          <mesh geometry={memoGeo("pack-spring", () => {
            const g = new THREE.TorusGeometry(2.6, 0.35, 6, 20);
            return g;
          })} material={mat.steel()} position={[0, 0, -L / 2 - 0.3]} />
        </group>
      ))}
    </group>
  );
}

/** Where a pack's leads leave its near end (local). */
export function packExits(cells: number): Record<"pos" | "neg", { pos: [number, number, number]; dir: [number, number, number] }> {
  const { d } = packSize(cells);
  return { pos: { pos: [-5, PACK.h * 0.55, d / 2 + 0.4], dir: [-0.1, -0.1, 1] }, neg: { pos: [5, PACK.h * 0.55, d / 2 + 0.4], dir: [0.1, -0.1, 1] } };
}

// ---------------------------------------------------------------------------------------------------------------
// Bench supply.

function supplyLcd(volts: number): THREE.CanvasTexture {
  const text = volts.toFixed(1);
  return canvasTexture(`supply-lcd:${text}`, 512, 192, (ctx, w, h) => {
    ctx.fillStyle = "#c9d3bb";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1f2419";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = `700 150px ${MONO}`;
    ctx.fillText(text, w * 0.8, h * 0.54);
    ctx.font = `700 70px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("V", w * 0.83, h * 0.62);
  });
}

/** The flat of the supply's top, inside its rounded edges. */
const TOP_W = SUPPLY.w - 6;
const TOP_D = SUPPLY.d - 6;

/** The supply's whole top: cream case, the dark panel with dial marks round the knob, + and − by the posts. */
function supplyTop(): THREE.CanvasTexture {
  const S = SUPPLY;
  const k = 10;
  return canvasTexture("supply-top", TOP_W * k, TOP_D * k, (ctx, w, h) => {
    const X = (x: number) => (x + TOP_W / 2) * k;
    const Z = (z: number) => (z + TOP_D / 2) * k;
    ctx.fillStyle = "#ddd6c6";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3b3d42";
    ctx.fillRect(X(-S.w / 2 + 4), Z(-12), (S.w - 8) * k, 44 * k);
    ctx.fillStyle = "#4a4740";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${3.2 * k}px ${FONT}`;
    ctx.fillText("0–12 V", X(22), Z(S.lcdZ));
    ctx.strokeStyle = "#f2ede2";
    ctx.lineWidth = 0.4 * k;
    for (let i = 0; i <= 12; i++) {
      const a = (-135 + (i * 270) / 12) * (Math.PI / 180) - Math.PI / 2;
      const r0 = (S.knobR + 1.6) * k;
      const r1 = (S.knobR + (i % 6 === 0 ? 4 : 3)) * k;
      ctx.beginPath();
      ctx.moveTo(X(0) + Math.cos(a) * r0, Z(0) + Math.sin(a) * r0);
      ctx.lineTo(X(0) + Math.cos(a) * r1, Z(0) + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.font = `700 ${5.5 * k}px ${FONT}`;
    ctx.fillStyle = "#e2664c";
    ctx.fillText("+", X(-S.postX - 8.5), Z(S.postZ));
    ctx.fillStyle = "#f2ede2";
    ctx.fillText("−", X(S.postX + 8.5), Z(S.postZ));
  });
}

function BindingPost({ color, x }: { color: string; x: number }) {
  return (
    <group position={[x, SUPPLY.h, SUPPLY.postZ]}>
      <mesh geometry={memoGeo("post-base", () => latheY([[4.2, 0], [4.2, 1.6], [3.4, 2.2], [0.001, 2.2]], 24))} material={mat.plastic(color, 0.4)} castShadow />
      <mesh geometry={memoGeo("post-cap", () => latheY([[3.0, 2.2], [3.0, 5.4], [2.4, 6.2], [0.001, 6.4]], 24))} material={mat.plastic(color, 0.35)} castShadow />
      <mesh geometry={memoGeo("post-stud", () => new THREE.CylinderGeometry(0.9, 0.9, 1.4, 12))} material={mat.brass()} position={[0, 6.8, 0]} />
    </group>
  );
}

export function SupplyModel({ params }: ModelProps<PartParamsMap["bench-supply"]>) {
  const S = SUPPLY;
  const volts = supplyVolts(params);
  const lcd = useMemo(() => new THREE.MeshBasicMaterial({ map: supplyLcd(volts) }), [volts]);
  useLayoutEffect(() => () => lcd.dispose(), [lcd]);
  const top = useMemo(() => new THREE.MeshStandardMaterial({ map: supplyTop(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1 }), []);
  useLayoutEffect(() => {
    top.userData.keepColor = true;
    return () => top.dispose();
  }, [top]);
  const knob = useRef<THREE.Group>(null);
  useEased(-((params.position ?? 0.5) - 0.5) * Math.PI * 1.5, (v) => {
    if (knob.current) knob.current.rotation.y = v;
  }, 16);
  return (
    <group>
      <mesh geometry={memoGeo("supply-box", () => roundedBox(S.w, S.h, S.d, 3, 3))} material={mat.paint("#d9d2c2")} position={[0, S.h / 2, 0]} castShadow receiveShadow />
      <mesh material={top} position={[0, S.h + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TOP_W, TOP_D]} />
      </mesh>
      <mesh geometry={memoGeo("supply-lcd-frame", () => roundedBox(36, 1.2, 14, 1, 2))} material={mat.blackMatte()} position={[S.lcdX, S.h + 0.4, S.lcdZ]} />
      <mesh material={lcd} position={[S.lcdX, S.h + 1.05, S.lcdZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[32, 11]} />
      </mesh>
      <group ref={knob} position={[0, S.h, 0]}>
        <mesh geometry={memoGeo("supply-knob", () => latheY([[S.knobR, 0], [S.knobR, 4.4], [S.knobR - 1, 5.6], [0.001, 5.8]], 40))} material={mat.plastic("#2a2b2f", 0.5)} castShadow />
        <mesh geometry={memoGeo("supply-pointer", () => boxAt(1.2, 0.4, S.knobR - 2, 0, 5.8, -(S.knobR - 2) / 2 - 1))} material={mat.white()} />
      </group>
      <BindingPost color="#c9372a" x={-S.postX} />
      <BindingPost color="#2b2925" x={S.postX} />
    </group>
  );
}

