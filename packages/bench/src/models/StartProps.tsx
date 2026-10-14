// Start here props in 3D, in the same procedural style as the other lab props: the counting gate, sealed boxes and
// the parts cabinet, sorting trays and symbol drawers, the schematic card and its torn piece, the junk drawer's
// everyday objects, an AA cell cut open, and the static toy. Ink is drawn by the post pass, so shapes stay simple.

import { useContext, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import { useStore } from "zustand";
import { AA, BOX, CABINET, DRAWER, GATE, OBJECT, SCHEM, STATIC, TRAY } from "../dims";
import { dotRate, formatGate, gateAmps, tagText } from "../flow";
import { useLabels } from "../labels";
import { CLIP_PATH, schematicSlot } from "../parts";
import { BenchStoreContext, type BenchStore, type BenchStoreState } from "../store";
import { slotTurn, symbolInk, tornOutline } from "../symbols";
import type { PartParamsMap, SampleMaterial, SymbolKind } from "../types";
import { FONT, canvasTexture, makeCanvas } from "../three/canvas";
import { bentTube, latheY, memoGeo, roundedBox, roundedSlab } from "../three/geometry";
import { mat } from "../three/materials";

const INK = "#24221E";
const PAPER = "#FCFAF5";
const RED = "#B23A1C";
const CARD = "#d9c09a";
const CARD_DARK = "#c4a982";

/** A store-shaped stand-in for models shown outside a bench (previews, the gallery). */
const NULL_STORE = { getState: () => ({}), subscribe: () => () => {}, getInitialState: () => ({}), setState: () => {} } as unknown as BenchStore;

/** A flat printed sheet lying on a surface (canvas texture on a plane facing up). */
function Print({ texture, w, d, y, x = 0, z = 0, rot = 0 }: { texture: THREE.Texture; w: number; d: number; y: number; x?: number; z?: number; rot?: number }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, transparent: true, polygonOffset: true, polygonOffsetFactor: -1 }), [texture]);
  useLayoutEffect(() => () => material.dispose(), [material]);
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, rot]} material={material} receiveShadow>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

/** Strokes a symbol's paths onto a canvas: (x, y) its centre in px, `s` px per mm, `turn` degrees. */
export function strokeSymbol(ctx: CanvasRenderingContext2D, kind: SymbolKind, x: number, y: number, s: number, turn = 0, line = 0.55): void {
  const sym = symbolInk(kind);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (sym.fill) ctx.fill(new Path2D(sym.fill));
  ctx.lineWidth = line;
  ctx.stroke(new Path2D(sym.stroke));
  if (sym.thin) {
    ctx.lineWidth = line * 0.6;
    ctx.stroke(new Path2D(sym.thin));
  }
  ctx.restore();
}

// Gate --------------------------------------------------------------------------------------------------------------

/** The gate's flag: ticks counted (and a rate bar), or the current with its unit button, read live from the store. */
function GateFlag({ id, params }: { id: string; params: PartParamsMap["gate"] }) {
  const store = useContext(BenchStoreContext);
  const ticks = useStore(store ?? NULL_STORE, (s: Partial<BenchStoreState>) => Math.floor(s.gates?.[id] ?? 0));
  const amps = useStore(store ?? NULL_STORE, (s: Partial<BenchStoreState>) => (s.bench ? Math.round(Math.abs(gateAmps(s.bench, s.snapshot ?? null, id)) * 1e6) / 1e6 : 0));
  const { canvas: c, texture } = useMemo(() => {
    const canvas = makeCanvas(416, 208);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas, texture: t };
  }, []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }), [texture]);
  useLayoutEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );
  const number = params.mode === "number";
  const unit = params.unit === "mA" ? "mA" : "A";
  useLayoutEffect(() => {
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(5, 5, w - 10, h - 10, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textBaseline = "middle";
    if (number) {
      const reading = formatGate(amps, unit);
      ctx.textAlign = "left";
      ctx.font = `800 76px ${FONT}`;
      ctx.fillText(reading.slice(0, reading.lastIndexOf(" ")), 30, h / 2 + 4);
      ctx.fillStyle = "#E1E6F4";
      ctx.beginPath();
      ctx.roundRect(w - 150, 40, 120, h - 80, 16);
      ctx.fill();
      ctx.strokeStyle = "#1F3C9A";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = "#1F3C9A";
      ctx.textAlign = "center";
      ctx.font = `800 60px ${FONT}`;
      ctx.fillText(unit, w - 90, h / 2 + 4);
    } else {
      ctx.textAlign = "left";
      ctx.font = `800 96px ${FONT}`;
      ctx.fillText(String(ticks), 34, h * 0.42);
      ctx.beginPath();
      ctx.arc(w - 64, h * 0.42, 24, 0, Math.PI * 2);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.stroke();
      const rate = Math.min(1, dotRate(amps) / 4);
      ctx.fillStyle = "#EEE8DC";
      ctx.fillRect(34, h - 50, w - 68, 20);
      ctx.fillStyle = "#57524A";
      ctx.fillRect(34, h - 50, (w - 68) * rate, 20);
    }
    texture.needsUpdate = true;
  }, [c, texture, ticks, amps, number, unit]);
  return (
    <Billboard position={[0, GATE.lift, 0]}>
      <mesh material={material} renderOrder={30}>
        <planeGeometry args={[GATE.flagW, GATE.flagH]} />
      </mesh>
    </Billboard>
  );
}

/** A counting gate: a collar round the cable (along local x) and its flag on a short stem. */
export function GateModel({ id, params }: { id: string; params: PartParamsMap["gate"] }) {
  const sleeve = memoGeo("gate-sleeve", () => {
    const g = new THREE.CylinderGeometry(GATE.ring / 2, GATE.ring / 2, GATE.len, 24);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  return (
    <group>
      <mesh geometry={sleeve} material={mat.plastic("#f3efe6", 0.5)} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={memoGeo("gate-rim", () => new THREE.TorusGeometry(GATE.ring / 2 + 0.05, 0.22, 6, 24).rotateY(Math.PI / 2))} material={mat.plastic("#3a3d42", 0.5)} position={[s * (GATE.len / 2 - 1.2), 0, 0]} />
      ))}
      <mesh geometry={memoGeo("gate-stem", () => new THREE.CylinderGeometry(0.35, 0.35, GATE.lift - GATE.flagH / 2, 8))} material={mat.plastic("#57524A", 0.6)} position={[0, (GATE.lift - GATE.flagH / 2) / 2 + GATE.ring / 2, 0]} />
      <GateFlag id={id} params={params} />
    </group>
  );
}

// Sealed box and cabinet --------------------------------------------------------------------------------------------

function boxSize(p: PartParamsMap["box"]) {
  const cab = p.style === "cabinet";
  return { W: cab ? CABINET.w : BOX.w, D: cab ? CABINET.d : BOX.d, H: cab ? CABINET.h : BOX.h, wall: cab ? CABINET.wall : BOX.wall, strip: cab ? CABINET.strip : BOX.strip, cab };
}

function lidTexture(text: string, cab: boolean): THREE.Texture {
  return canvasTexture(`box-lid:${text}:${cab}`, 512, 288, (ctx, w, h) => {
    ctx.fillStyle = CARD;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(60,45,30,0.18)";
    ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(0, 30 + k * 46);
      ctx.bezierCurveTo(w * 0.3, 24 + k * 46, w * 0.7, 40 + k * 46, w, 30 + k * 46);
      ctx.stroke();
    }
    if (text) {
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${cab ? 72 : 190}px ${FONT}`;
      if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = cab ? "14px" : "0px";
      ctx.fillText(text, w / 2, h / 2 + 8);
    }
  });
}

function stripTexture(marks: boolean, W: number): THREE.Texture {
  return canvasTexture(`box-strip:${marks}:${W}`, 1024, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (!marks) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 110px ${FONT}`;
    const px = (mm: number) => w / 2 + (mm / W) * w;
    ctx.fillStyle = RED;
    ctx.fillText("+", px(-BOX.termX - 10), h / 2 + 6);
    ctx.fillStyle = INK;
    ctx.fillText("−", px(BOX.termX + 10), h / 2 + 4);
  });
}

function ScrewPost() {
  return (
    <group>
      <mesh geometry={memoGeo("box-post", () => new THREE.CylinderGeometry(3.4, 3.6, 2.6, 22))} material={mat.brass()} position={[0, 1.3, 0]} castShadow />
      <mesh geometry={memoGeo("box-post-head", () => new THREE.CylinderGeometry(2.3, 2.3, 0.8, 20))} material={mat.nickel()} position={[0, 2.9, 0]} castShadow />
      <mesh geometry={memoGeo("box-post-slot", () => new THREE.BoxGeometry(3.6, 0.3, 0.5))} material={mat.darkInset()} position={[0, 3.35, 0]} rotation={[0, 0.6, 0]} />
    </group>
  );
}

function Padlock3D({ lock }: { lock: { wheels: string[]; set: boolean[] } }) {
  const n = lock.wheels.length;
  const w = 24;
  const key = `${lock.wheels.join("|")}:${lock.set.join(",")}`;
  const tex = useMemo(
    () =>
      canvasTexture(`padlock:${key}`, 768, 160, (ctx, cw, ch) => {
        ctx.fillStyle = "#d6ad55";
        ctx.fillRect(0, 0, cw, ch);
        lock.wheels.forEach((label, i) => {
          const x = (i + 0.5) * (cw / n);
          const set = !!lock.set[i];
          ctx.fillStyle = set ? PAPER : "#EEE8DC";
          ctx.fillRect(x - cw / n / 2 + 10, 14, cw / n - 20, ch - 28);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4;
          ctx.strokeRect(x - cw / n / 2 + 10, 14, cw / n - 20, ch - 28);
          ctx.fillStyle = set ? INK : "#6B655B";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `800 ${set ? 44 : 84}px ${FONT}`;
          ctx.fillText(set ? label : "?", x, ch / 2 + 4);
        });
      }),
    [key, lock.wheels, lock.set, n],
  );
  return (
    <group>
      <mesh geometry={memoGeo(`padlock-body:${n}`, () => roundedBox(n * w + 7, 4.4, 16, 1.6, 2))} material={mat.brass()} position={[0, 2.2, 0]} castShadow />
      <Print texture={tex} w={n * w} d={13} y={4.45} />
      {/* The shackle stands up behind the wheels. */}
      <mesh geometry={memoGeo("padlock-shackle", () => new THREE.TorusGeometry(10, 1.3, 10, 24, Math.PI))} material={mat.steel()} position={[0, 4, -6.4]} rotation={[-0.35, 0, 0]} castShadow />
    </group>
  );
}

function BoxTag3D({ text }: { text: string }) {
  const tex = useMemo(
    () =>
      canvasTexture(`box-tag:${text}`, 384, 200, (ctx, w, h) => {
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#d8cfba";
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${text.length > 7 ? 64 : 80}px ${FONT}`;
        ctx.fillText(text, w / 2, h / 2 + 4);
      }),
    [text],
  );
  const w = Math.max(20, text.length * 2.9 + 6);
  return (
    <group>
      <mesh geometry={memoGeo(`box-tag-card:${w}`, () => roundedSlab(w, 11, 0.4, 1, 0.1))} material={mat.white()} castShadow receiveShadow />
      <Print texture={tex} w={w - 0.6} d={10.4} y={0.42} />
    </group>
  );
}

/** A sealed box (or the parts cabinet): hollow, a fixed front strip with terminals, a hinged lid. */
export function BoxModel({ params }: { params: PartParamsMap["box"] }) {
  const labels = useLabels();
  // The knob follows the trimmer inside (its position is on the bench).
  const store = useContext(BenchStoreContext);
  const knob = useStore(store ?? NULL_STORE, (s: Partial<BenchStoreState>) => {
    for (const id of Object.values(params.held ?? {})) {
      const t = s.bench?.parts.find((x) => x.id === id);
      if (t?.kind === "trimmer") return t.params.position;
    }
    return 0.5;
  });
  const { W, D, H, wall, strip, cab } = boxSize(params);
  const open = !!params.lid;
  const lidD = D - strip;
  const lidTex = useMemo(() => lidTexture(params.label ?? (cab ? labels.print.cabinet : ""), cab), [params.label, cab, labels]);
  const lidMat = useMemo(() => new THREE.MeshStandardMaterial({ map: lidTex, roughness: 0.85 }), [lidTex]);
  useLayoutEffect(() => () => lidMat.dispose(), [lidMat]);
  const card = mat.plastic(CARD, 0.85);
  const cardDark = mat.plastic(CARD_DARK, 0.85);
  const inside = mat.plastic("#ece4d4", 0.9);
  const lock = !open && cab && params.lock ? params.lock : null;
  const zs = D / 2 - strip / 2;
  return (
    <group>
      {/* Floor and walls (hollow, so an open box shows what is inside). */}
      <mesh geometry={memoGeo(`box-floor:${W}:${D}`, () => roundedSlab(W, D, wall, 2, 0.3))} material={card} receiveShadow castShadow />
      <mesh geometry={memoGeo(`box-inner:${W}:${D}`, () => roundedSlab(W - 2 * wall, D - 2 * wall, 0.2, 1, 0.05))} material={inside} position={[0, wall, 0]} receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} geometry={memoGeo(`box-wall-x:${D}:${H}`, () => roundedBox(wall, H, D, 0.5, 1))} material={card} position={[s * (W / 2 - wall / 2), H / 2, 0]} castShadow receiveShadow />
      ))}
      <mesh geometry={memoGeo(`box-wall-z:${W}:${H}`, () => roundedBox(W, H, wall, 0.5, 1))} material={card} position={[0, H / 2, -D / 2 + wall / 2]} castShadow receiveShadow />
      <mesh geometry={memoGeo(`box-wall-z:${W}:${H}`, () => roundedBox(W, H, wall, 0.5, 1))} material={card} position={[0, H / 2, D / 2 - wall / 2]} castShadow receiveShadow />
      {/* The fixed front strip across the top, where the terminals (or the padlock) sit. */}
      <mesh geometry={memoGeo(`box-strip:${W}:${strip}`, () => roundedBox(W, 3, strip, 0.8, 2))} material={cardDark} position={[0, H - 1.5, D / 2 - strip / 2]} castShadow receiveShadow />
      {!cab && <Print texture={stripTexture(params.marks !== "plain", W)} w={W} d={strip * 0.9} y={H + 0.02} z={zs} />}
      {!cab &&
        [-1, 1].map((s) => (
          <group key={s} position={[s * BOX.termX, H, zs]}>
            <ScrewPost />
          </group>
        ))}
      {params.knob && (
        <group position={[0, H, zs]}>
          <mesh geometry={memoGeo("box-knob", () => latheY([[0.001, 0], [BOX.knob, 0], [BOX.knob, 5], [BOX.knob - 1, 6.2], [0.001, 6.2]], 32))} material={mat.blackMatte()} castShadow />
          <group rotation={[0, -((knob - 0.5) * 270 * Math.PI) / 180, 0]}>
            <mesh geometry={memoGeo("box-knob-mark", () => roundedBox(1.2, 0.4, BOX.knob - 2, 0.15, 1))} material={mat.white()} position={[0, 6.25, -(BOX.knob - 2) / 2]} />
          </group>
        </group>
      )}
      {lock && (
        <group position={[0, H, zs]}>
          <Padlock3D lock={lock} />
        </group>
      )}
      {/* The lid, hinged at the back: shut it lies on the box; open it stands up behind. */}
      <group position={[0, H, -D / 2]} rotation={[open ? -1.75 : 0, 0, 0]}>
        <mesh geometry={memoGeo(`box-lid:${W}:${lidD}`, () => roundedBox(W, 2.4, lidD, 0.8, 2))} material={card} position={[0, 1.2, lidD / 2]} castShadow receiveShadow />
        <mesh material={lidMat} position={[0, 2.45, lidD / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - 4, lidD - 4]} />
        </mesh>
      </group>
      {params.tag && (
        <group position={[W / 2 + 8, 0.2, D / 2 - 6]}>
          <BoxTag3D text={tagText(params.tag, params.tagAlt)} />
        </group>
      )}
    </group>
  );
}

// Trays and drawers ----------------------------------------------------------------------------------------------

function labelTexture(text: string): THREE.Texture {
  return canvasTexture(`tray-label:${text}`, 640, 110, (ctx, w, h) => {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "4px";
    let size = 58;
    do {
      ctx.font = `800 ${size}px ${FONT}`;
      size -= 4;
    } while (ctx.measureText(text).width > w - 40 && size > 20);
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
}

function faceTexture(face: SymbolKind | undefined, text: string): THREE.Texture {
  return canvasTexture(`drawer-face:${face ?? ""}:${text}`, 480, 256, (ctx, w, h) => {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    if (face) strokeSymbol(ctx, face, w / 2, h / 2 + 6, 14.5, 0, 0.55);
    else {
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 64px ${FONT}`;
      ctx.fillText(text, w / 2, h / 2);
    }
  });
}

/** The junk drawer's sorting tray: a shallow wooden tray with a label on its front. */
export function TrayModel({ label }: { label: string }) {
  const wood = mat.paint("#c99863");
  const t = 2.4;
  const lab = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(label), roughness: 0.7 }), [label]);
  useLayoutEffect(() => () => lab.dispose(), [lab]);
  return (
    <group>
      <mesh geometry={memoGeo("tray-floor", () => roundedSlab(TRAY.w, TRAY.d, 2.6, 3, 0.4))} material={wood} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} geometry={memoGeo("tray-wall-x", () => roundedBox(t, TRAY.h, TRAY.d, 0.6, 1))} material={wood} position={[s * (TRAY.w / 2 - t / 2), TRAY.h / 2, 0]} castShadow receiveShadow />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} geometry={memoGeo("tray-wall-z", () => roundedBox(TRAY.w, TRAY.h, t, 0.6, 1))} material={wood} position={[0, TRAY.h / 2, s * (TRAY.d / 2 - t / 2)]} castShadow receiveShadow />
      ))}
      {label && (
        <mesh material={lab} position={[0, TRAY.h * 0.5, TRAY.d / 2 + 0.05]}>
          <planeGeometry args={[TRAY.w * 0.66, TRAY.w * 0.66 * (110 / 640)]} />
        </mesh>
      )}
    </group>
  );
}

/** A parts drawer, pulled open, with a symbol card on its front. */
export function DrawerModel({ face, label }: { face: SymbolKind | undefined; label: string }) {
  const wood = mat.paint("#c99863");
  const front = mat.paint("#a97a48");
  const t = 2;
  const card = useMemo(() => new THREE.MeshStandardMaterial({ map: faceTexture(face, label), roughness: 0.75 }), [face, label]);
  useLayoutEffect(() => () => card.dispose(), [card]);
  return (
    <group>
      <mesh geometry={memoGeo("drawer-floor", () => roundedSlab(DRAWER.w, DRAWER.d, 2.4, 2, 0.3))} material={wood} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} geometry={memoGeo("drawer-wall-x", () => roundedBox(t, DRAWER.h * 0.7, DRAWER.d, 0.5, 1))} material={wood} position={[s * (DRAWER.w / 2 - t / 2), (DRAWER.h * 0.7) / 2, 0]} castShadow />
      ))}
      <mesh geometry={memoGeo("drawer-back", () => roundedBox(DRAWER.w, DRAWER.h * 0.7, t, 0.5, 1))} material={wood} position={[0, (DRAWER.h * 0.7) / 2, -DRAWER.d / 2 + t / 2]} castShadow />
      <mesh geometry={memoGeo("drawer-front", () => roundedBox(DRAWER.w + 4, DRAWER.h, 4, 1, 2))} material={front} position={[0, DRAWER.h / 2, DRAWER.d / 2 - 2]} castShadow receiveShadow />
      <mesh material={card} position={[0, DRAWER.h * 0.56, DRAWER.d / 2 + 0.06]}>
        <planeGeometry args={[30, 16]} />
      </mesh>
      <mesh geometry={memoGeo("drawer-pull", () => roundedBox(14, 2.4, 3, 1, 2))} material={mat.brass()} position={[0, DRAWER.h * 0.16, DRAWER.d / 2 + 1.4]} castShadow />
    </group>
  );
}

// Schematic card and its torn piece -------------------------------------------------------------------------------

const PX = 8;

function schematicTexture(p: PartParamsMap["schematic"]): THREE.Texture {
  const key = `schematic:${JSON.stringify([p.symbols, p.torn, p.title])}`;
  return canvasTexture(key, SCHEM.w * PX, SCHEM.d * PX, (ctx, w, h) => {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    const X = (mm: number) => w / 2 + mm * PX;
    const Y = (mm: number) => h / 2 + mm * PX;
    const n = p.symbols.length;
    const slots = p.symbols.map((_, i) => schematicSlot(n, i));
    const W = SCHEM.loopW / 2;
    const D = SCHEM.loopD / 2;
    const z0 = 4;
    // The loop, broken where each symbol sits.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.55 * PX;
    ctx.lineCap = "round";
    const corners: [number, number][] = [
      [-W, z0 - D],
      [W, z0 - D],
      [W, z0 + D],
      [-W, z0 + D],
    ];
    corners.forEach((a, i) => {
      const b = corners[(i + 1) % 4]!;
      const vertical = a[0] === b[0];
      const along = vertical ? 1 : 0;
      const dir = Math.sign(b[along] - a[along]);
      const cuts = slots
        .filter(([x, z]) => (vertical ? Math.abs(x - a[0]) < 0.01 && z > Math.min(a[1], b[1]) && z < Math.max(a[1], b[1]) : Math.abs(z - a[1]) < 0.01 && x > Math.min(a[0], b[0]) && x < Math.max(a[0], b[0])))
        .map(([x, z]) => (vertical ? z : x))
        .sort((u, v) => (u - v) * dir);
      let cur = a[along]!;
      const seg = (from: number, to: number) => {
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(X(a[0]), Y(from));
          ctx.lineTo(X(a[0]), Y(to));
        } else {
          ctx.moveTo(X(from), Y(a[1]));
          ctx.lineTo(X(to), Y(a[1]));
        }
        ctx.stroke();
      };
      for (const c of cuts) {
        seg(cur, c - dir * 12);
        cur = c + dir * 12;
      }
      seg(cur, b[along]!);
    });
    p.symbols.forEach((sym, i) => {
      const [x, z] = slots[i]!;
      if (i === p.torn) {
        const pts = tornOutline(x, z, SCHEM.piece);
        ctx.beginPath();
        pts.forEach(([px, pz], k) => (k ? ctx.lineTo(X(px), Y(pz)) : ctx.moveTo(X(px), Y(pz))));
        ctx.closePath();
        ctx.fillStyle = "#e2dacb";
        ctx.fill();
        ctx.setLineDash([1.4 * PX, 1.2 * PX]);
        ctx.lineWidth = 0.3 * PX;
        ctx.strokeStyle = "#6B655B";
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.55 * PX;
        return;
      }
      const turn = slotTurn(n, i);
      strokeSymbol(ctx, sym.kind, X(x), Y(z), PX, turn);
      if (sym.text) {
        const side = Math.abs(Math.sin((turn * Math.PI) / 180)) > 0.5;
        ctx.fillStyle = INK;
        ctx.font = `600 ${3.6 * PX}px ${FONT}`;
        ctx.textAlign = side ? "left" : "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sym.text, X(x + (side ? 9 : 0)), Y(z + (side ? 0 : -8)));
      }
    });
    if (p.title) {
      ctx.fillStyle = "#6B655B";
      ctx.font = `600 ${3.4 * PX}px ${FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(p.title, X(-SCHEM.w / 2 + 5), Y(-SCHEM.d / 2 + 5.4));
    }
  });
}

export function SchematicModel({ params }: { params: PartParamsMap["schematic"] }) {
  const tex = useMemo(() => schematicTexture(params), [params]);
  return (
    <group>
      <mesh geometry={memoGeo("schem-card", () => roundedSlab(SCHEM.w, SCHEM.d, SCHEM.t, 1.6, 0.15))} material={mat.white()} castShadow receiveShadow />
      <Print texture={tex} w={SCHEM.w - 0.4} d={SCHEM.d - 0.4} y={SCHEM.t + 0.02} />
    </group>
  );
}

function pieceTexture(kind: SymbolKind, turn: number): THREE.Texture {
  return canvasTexture(`piece:${kind}:${turn}`, SCHEM.piece * PX * 2, SCHEM.piece * PX * 2, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    strokeSymbol(ctx, kind, w / 2, h / 2, PX * 2, turn);
  });
}

export function PieceModel({ params }: { params: PartParamsMap["piece"] }) {
  const geo = memoGeo("piece-card", () => {
    const pts = tornOutline(0, 0, SCHEM.piece);
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: SCHEM.t, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const tex = useMemo(() => pieceTexture(params.symbol, params.turn ?? 0), [params.symbol, params.turn]);
  return (
    <group>
      <mesh geometry={geo} material={mat.white()} castShadow receiveShadow />
      <Print texture={tex} w={SCHEM.piece} d={SCHEM.piece} y={SCHEM.t + 0.03} />
    </group>
  );
}

// Everyday objects ------------------------------------------------------------------------------------------------

function flatShape(points: [number, number][], holes: [number, number][][] = []): THREE.Shape {
  const s = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  return s;
}

function circlePts(cx: number, cz: number, r: number, n = 28): [number, number][] {
  return Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cz + Math.sin((i / n) * Math.PI * 2) * r]);
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.3): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function EverydayModel({ material, quality = "high" }: { material: Exclude<SampleMaterial, "copper" | "plastic">; quality?: "high" | "low" }) {
  const o = OBJECT[material];
  const L = o.len / 2;
  const glass = useMemo(
    () =>
      quality === "high"
        ? new THREE.MeshPhysicalMaterial({ color: "#bfe0e6", roughness: 0.06, transmission: 0.8, thickness: 8, ior: 1.5, clearcoat: 1 })
        : new THREE.MeshPhysicalMaterial({ color: "#bfe0e6", roughness: 0.08, transparent: true, opacity: 0.7, clearcoat: 1 }),
    [quality],
  );
  useLayoutEffect(() => () => glass.dispose(), [glass]);
  switch (material) {
    case "key": {
      const geo = memoGeo("obj-key", () => {
        const bow = circlePts(-17, 0, 10, 36);
        const blade: [number, number][] = [
          [-8.5, -3.6],
          [26.4, -3.6],
          [27, -3],
          [27, 2.2],
          [24.4, 3.6],
          [22.6, 1.6],
          [20.6, 3.6],
          [18.6, 1.6],
          [16.4, 3.6],
          [-8.5, 3.6],
        ];
        const a = extrude(flatShape(bow, [circlePts(-21, 0, 3, 20)]), o.t - 0.4, 0.2);
        const b = extrude(flatShape(blade), o.t - 0.6, 0.2);
        return mergeGeos([a, b]);
      });
      return <mesh geometry={geo} material={mat.brass()} position={[0, 0.2, 0]} castShadow receiveShadow />;
    }
    case "coin":
      return (
        <group>
          <mesh geometry={memoGeo("obj-coin", () => latheY([[0.001, 0], [L - 0.4, 0], [L, 0.3], [L, o.t - 0.3], [L - 0.4, o.t], [0.001, o.t]], 40))} material={mat.nickel()} castShadow receiveShadow />
          <mesh geometry={memoGeo("obj-coin-ring", () => new THREE.TorusGeometry(L - 1.8, 0.25, 6, 40))} material={mat.steel()} position={[0, o.t, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case "foil": {
      const geo = memoGeo("obj-foil", () => {
        const g = new THREE.PlaneGeometry(o.len, o.w, 24, 6);
        g.rotateX(-Math.PI / 2);
        const pos = g.attributes.position!;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          pos.setY(i, 0.35 + 0.35 * Math.abs(Math.sin(x * 0.9 + z * 1.7) * Math.cos(x * 0.37 - z)));
        }
        g.computeVertexNormals();
        return g;
      });
      return <mesh geometry={geo} material={mat.aluminium()} castShadow receiveShadow />;
    }
    case "pencil":
      return <mesh geometry={memoGeo("obj-lead", () => new THREE.CylinderGeometry(1, 1, o.len, 12).rotateZ(Math.PI / 2))} material={mat.plastic("#3a3b3f", 0.35)} position={[0, 1, 0]} castShadow />;
    case "spoon": {
      const geo = memoGeo("obj-spoon", () => {
        const pts: [number, number][] = [];
        // Handle, then round the bowl.
        pts.push([-L, -2.6], [14, -2]);
        for (let k = 0; k <= 24; k++) {
          const a = -Math.PI * 0.62 + (k / 24) * Math.PI * 1.24;
          pts.push([31 + Math.cos(a) * 15, Math.sin(a) * 10.5]);
        }
        pts.push([14, 2], [-L, 2.6]);
        return extrude(flatShape(pts), 1.4, 0.5);
      });
      return <mesh geometry={geo} material={mat.plastic("#f3efe6", 0.4)} position={[0, 0.5, 0]} castShadow receiveShadow />;
    }
    case "eraser":
      return (
        <group>
          <mesh geometry={memoGeo("obj-eraser", () => roundedBox(o.len, o.t, o.w, 2, 3))} material={mat.rubber("#e59aa0")} position={[0, o.t / 2, 0]} castShadow receiveShadow />
          <mesh geometry={memoGeo("obj-eraser-sleeve", () => roundedBox(L + 4, o.t + 0.6, o.w + 0.6, 0.6, 2))} material={mat.plastic("#cfd9ef", 0.7)} position={[(L + 4) / 2 - 4, o.t / 2, 0]} castShadow />
        </group>
      );
    case "marble":
      return <mesh geometry={memoGeo("obj-marble", () => new THREE.SphereGeometry(L, 28, 20))} material={glass} position={[0, L, 0]} castShadow />;
    case "wood":
      return <mesh geometry={memoGeo("obj-wood", () => roundedSlab(o.len, o.w, o.t, o.w / 2 - 0.2, 0.4))} material={mat.paint("#c99863")} castShadow receiveShadow />;
    case "string": {
      const geo = memoGeo("obj-string", () => {
        const pts: [number, number, number][] = [];
        for (let k = 0; k <= 26; k++) {
          const x = -L + (k / 26) * o.len;
          pts.push([x, 0.8, Math.sin(x * 0.26) * 2.6]);
        }
        return bentTube(pts, 0.8, 0.9, 8);
      });
      return <mesh geometry={geo} material={mat.rubber("#e3d6ba")} castShadow />;
    }
    case "clip": {
      const coated = memoGeo("obj-clip-coat", () => bentTube(clipPoints(), 0.7, 1.2, 10));
      const bare = memoGeo("obj-clip-bare", () => mergeGeos([bentTube([[CLIP_PATH.a[0], 0.7, CLIP_PATH.a[1]], [-12.4, 0.7, CLIP_PATH.a[1]]], 0.45, 0.5, 8), bentTube([[12.4, 0.7, CLIP_PATH.b[1]], [CLIP_PATH.b[0], 0.7, CLIP_PATH.b[1]]], 0.45, 0.5, 8)]));
      return (
        <group>
          <mesh geometry={coated} material={mat.plastic("#3e7cc7", 0.4)} castShadow />
          <mesh geometry={bare} material={mat.steel()} castShadow />
        </group>
      );
    }
  }
}

/** Points along the coated clip's wire (CLIP_PATH.coated: straight runs and two half turns), at the wire's height. */
function clipPoints(): [number, number, number][] {
  const y = 0.7;
  const pts: [number, number, number][] = [[-12.4, y, 3.2], [10, y, 3.2]];
  for (let k = 1; k < 12; k++) {
    const a = Math.PI / 2 - (k / 12) * Math.PI;
    pts.push([10 + Math.cos(a) * 3.5, y, -0.3 + Math.sin(a) * 3.5]);
  }
  pts.push([10, y, -3.8], [-10, y, -3.8]);
  for (let k = 1; k < 12; k++) {
    const a = -Math.PI / 2 - (k / 12) * Math.PI;
    pts.push([-10 + Math.cos(a) * 2.7, y, -1.1 - Math.sin(a) * 2.7]);
  }
  pts.push([-10, y, 1.6], [12.4, y, 1.6]);
  return pts;
}

function mergeGeos(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // A tiny merge (positions, normals, uvs, index) so a compound object is one mesh and gets one ink outline.
  const out = new THREE.BufferGeometry();
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const g of geos) {
    const p = g.attributes.position!;
    const n = g.attributes.normal;
    const t = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (t) uv.push(t.getX(i), t.getY(i));
      else uv.push(0, 0);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  if (nor.length === pos.length) out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  if (nor.length !== pos.length) out.computeVertexNormals();
  return out;
}

// AA cell, cut open -------------------------------------------------------------------------------------------------

function cutTexture(): THREE.Texture {
  // The cut face, along the cell (u: - end to + end), across it (v: one side of the can to the other).
  return canvasTexture("aa-cut", 1024, 300, (ctx, w, h) => {
    const R = AA.dia / 2;
    const v = (mm: number) => h / 2 + (mm / R) * (h / 2);
    ctx.fillStyle = "#c7cbd1";
    ctx.fillRect(0, 0, w, h);
    const x0 = w * 0.045;
    const x1 = w * 0.94;
    ctx.fillStyle = "#2f2b28";
    ctx.fillRect(x0, v(-R + 0.7), x1 - x0, v(R - 0.7) - v(-R + 0.7));
    ctx.fillStyle = "#f4efe3";
    ctx.fillRect(x0 + 18, v(-3.6), x1 - x0 - 36, v(3.6) - v(-3.6));
    ctx.fillStyle = "#b9bdc2";
    ctx.fillRect(x0 + 24, v(-2.9), x1 - x0 - 48, v(2.9) - v(-2.9));
    // Zinc paste speckle.
    ctx.fillStyle = "rgba(60,60,64,0.35)";
    for (let k = 0; k < 260; k++) {
      const x = x0 + 30 + ((k * 97) % (x1 - x0 - 60));
      const y = v(-2.6) + ((k * 53) % (v(2.6) - v(-2.6)));
      ctx.fillRect(x, y, 3, 3);
    }
    // The brass pin from the − end into the paste.
    ctx.fillStyle = "#d6ad55";
    ctx.fillRect(0, v(-0.45), (x1 - x0) * 0.62, v(0.45) - v(-0.45));
  });
}

/** An AA cell cut in half along its length, the cut face up: the can, the two chemicals, the separator, the pin. */
export function AaCutawayModel() {
  const R = AA.dia / 2;
  const L = AA.len;
  // The lower half of the can (theta 0 to pi lands below the axis once the cylinder lies along x).
  const half = memoGeo("aa-half", () => {
    const g = new THREE.CylinderGeometry(R, R, L - 1.6, 32, 1, false, 0, Math.PI);
    g.rotateZ(-Math.PI / 2);
    return g;
  });
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: cutTexture(), roughness: 0.7 }), []);
  useLayoutEffect(() => () => face.dispose(), [face]);
  const y = AA.lift + R;
  return (
    <group>
      {[-15, 15].map((x) => (
        <mesh key={x} geometry={memoGeo("aa-saddle", () => roundedSlab(6, 15, AA.lift + 3.4, 1.2, 0.4))} material={mat.plastic("#3b3f46", 0.6)} position={[x, 0, 0]} castShadow receiveShadow />
      ))}
      <group position={[0, y, 0]}>
        <mesh geometry={half} material={mat.steel()} castShadow receiveShadow />
        <mesh material={face} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[L - 1.6, AA.dia]} />
        </mesh>
        <mesh geometry={memoGeo("aa-cut-cap", () => new THREE.CylinderGeometry(2.8, 2.8, 1.6, 20, 1, false, 0, Math.PI).rotateZ(-Math.PI / 2))} material={mat.nickel()} position={[L / 2 - 0.2, 0, 0]} />
      </group>
    </group>
  );
}

// The static toy ------------------------------------------------------------------------------------------------------

const BALLOON_HEX = { red: "#d9483b", blue: "#3f6cc8", yellow: "#e8be2c" };

export function BalloonModel({ params }: { params: PartParamsMap["balloon"] }) {
  const R = STATIC.balloon / 2;
  const color = BALLOON_HEX[params.color ?? "red"];
  const string = memoGeo("balloon-string", () => bentTube([[0, 2.2, R * 1.15 + 1], [0, 1, R * 1.15 + 6], [2, 0.6, R * 1.15 + 11], [-1, 0.5, R * 1.15 + 16]], 0.25, 0.8, 6));
  return (
    <group>
      <mesh geometry={memoGeo("balloon-body", () => new THREE.SphereGeometry(R, 32, 24))} material={mat.glossy(color)} position={[0, R * 0.85, 0]} scale={[1, 0.85, 1.15]} castShadow />
      <mesh geometry={memoGeo("balloon-knot", () => new THREE.ConeGeometry(1.6, 2.6, 12).rotateX(Math.PI / 2))} material={mat.glossy(color)} position={[0, 2.4, R * 1.15]} castShadow />
      <mesh geometry={string} material={mat.rubber("#e3d6ba")} />
    </group>
  );
}

export function ScarfModel() {
  const tex = useMemo(
    () =>
      canvasTexture("wool", 512, 256, (ctx, w, h) => {
        ctx.fillStyle = "#b8574a";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(255,240,230,0.18)";
        ctx.lineWidth = 3;
        for (let y = 6; y < h; y += 10) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + ((x / 12) % 2 ? 3 : -3));
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,240,230,0.28)";
        ctx.fillRect(0, h * 0.18, w, 10);
        ctx.fillRect(0, h * 0.78, w, 10);
      }),
    [],
  );
  const wool = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), [tex]);
  useLayoutEffect(() => () => wool.dispose(), [wool]);
  return (
    <group>
      <mesh geometry={memoGeo("scarf", () => roundedSlab(STATIC.scarfW, STATIC.scarfD, 3.2, 3, 1.2))} material={wool} castShadow receiveShadow />
      {Array.from({ length: 26 }, (_, i) => (
        <mesh key={i} geometry={memoGeo("scarf-fringe", () => new THREE.CylinderGeometry(0.35, 0.35, 5, 5).rotateX(Math.PI / 2))} material={mat.rubber("#b8574a")} position={[-STATIC.scarfW / 2 + 3 + i * 4.2, 0.6, STATIC.scarfD / 2 + 2.2]} />
      ))}
    </group>
  );
}

const BITS: [number, number, number][] = [
  [-9, -6, 20],
  [3, -9, -15],
  [10, 1, 40],
  [-4, 5, -30],
  [-12, 6, 10],
  [6, 9, 70],
  [0, -1, 5],
];

export function PaperBitsModel() {
  return (
    <group>
      {BITS.map(([x, z, r], i) => (
        <mesh key={i} geometry={memoGeo("paper-bit", () => roundedBox(5, 0.15, 4, 0.05, 1))} material={mat.white()} position={[x, 0.1, z]} rotation={[0, (r * Math.PI) / 180, 0]} castShadow receiveShadow />
      ))}
    </group>
  );
}

export function CombModel() {
  const W = STATIC.combW;
  return (
    <group>
      <mesh geometry={memoGeo("comb-spine", () => roundedBox(W, 2.4, 4.4, 1, 2))} material={mat.blackPlastic()} position={[0, 1.2, -STATIC.combD / 2 + 2.2]} castShadow />
      {Array.from({ length: Math.floor((W - 4) / 2.2) }, (_, i) => (
        <mesh key={i} geometry={memoGeo("comb-tooth", () => roundedBox(0.9, 1.4, 8, 0.3, 1))} material={mat.blackPlastic()} position={[-W / 2 + 2.4 + i * 2.2, 0.7, 2]} castShadow />
      ))}
    </group>
  );
}

export function WallModel() {
  const paper = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: canvasTexture("wallpaper", 512, 256, (ctx, w, h) => {
          ctx.fillStyle = "#efe7d6";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#d8ccb2";
          ctx.lineWidth = 4;
          for (let x = 16; x < w; x += 48) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
        }),
        roughness: 0.9,
      }),
    [],
  );
  useLayoutEffect(() => () => paper.dispose(), [paper]);
  return <mesh geometry={memoGeo("wall-slab", () => roundedBox(STATIC.wallW, STATIC.wallH, STATIC.wallD, 1, 2))} material={paper} position={[0, STATIC.wallH / 2, 0]} castShadow receiveShadow />;
}
