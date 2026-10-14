// Lab props for the Unit 1 labs: a resistor holder, a battery test station, a lemon half with electrode slots and its
// copper and zinc electrodes, a skin patch, material samples (copper wire, plastic ruler), the pencil card, value
// labels, a reject bin, the colour chart, a desk clock and a display case. Built from simple shapes, like the parts.

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { BAND_HEX } from "../colorCode";
import { BIN, CARD, CHART, CLOCK, ELECTRODE, HOLDER, SAMPLE, SHOWCASE, SKIN, STATION, TAG } from "../dims";
import { tagText } from "../flow";
import { useLabels } from "../labels";
import type { Moisture, PartParamsMap, Quality } from "../types";
import { FONT, MONO, canvasTexture, makeCanvas, rng } from "../three/canvas";
import { bentTube, latheY, memoGeo, roundedBox, roundedRectPlane, roundedSlab } from "../three/geometry";
import { mat } from "../three/materials";
import type { ModelProps } from "./common";
import { LemonHalf, zincMaterial } from "./Props";

const WOOD = "#c99863";
const WOOD_DARK = "#a97a48";

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

// Resistor holder ------------------------------------------------------------------------------------------------

/** A brass spring clip: two leaves the lead slips between, standing on the block. */
function SpringClip() {
  const leaf = memoGeo("holder-leaf", () => bentTube([[0, 0, 0], [0, 3.2, 0], [0, 4.4, -0.6], [0, 5.4, 0.2], [0, 5.9, 1.1]], 0.35, 0.6, 6));
  return (
    <group>
      <mesh geometry={memoGeo("holder-clip-foot", () => roundedBox(4.6, 0.8, 6, 0.3, 1))} material={mat.brass()} position={[0, 0.4, 0]} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={leaf} material={mat.brass()} position={[0, 0.6, s * 1.1]} scale={[1, 1, s]} castShadow />
      ))}
    </group>
  );
}

function ScrewTerminal() {
  return (
    <group>
      <mesh geometry={memoGeo("term-post", () => new THREE.CylinderGeometry(2.6, 2.8, 2.4, 20))} material={mat.brass()} position={[0, 1.2, 0]} castShadow />
      <mesh geometry={memoGeo("term-head", () => new THREE.CylinderGeometry(2.1, 2.1, 0.7, 20))} material={mat.nickel()} position={[0, 2.55, 0]} castShadow />
      <mesh geometry={memoGeo("term-slot", () => new THREE.BoxGeometry(3.4, 0.3, 0.5))} material={mat.darkInset()} position={[0, 2.95, 0]} rotation={[0, 0.6, 0]} />
    </group>
  );
}

export function HolderModel() {
  const base = memoGeo("holder-base", () => roundedSlab(HOLDER.len, HOLDER.d, HOLDER.h, 2.2, 0.6));
  return (
    <group>
      <mesh geometry={base} material={mat.plastic("#33373d", 0.55)} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * HOLDER.clipX, HOLDER.h, 0]}>
          <SpringClip />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * HOLDER.termX, HOLDER.h, 0]}>
          <ScrewTerminal />
        </group>
      ))}
      {/* Brass straps from each clip to its terminal. */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={memoGeo("holder-strap", () => roundedBox(HOLDER.termX - HOLDER.clipX, 0.4, 2.4, 0.15, 1))} material={mat.brass()} position={[(s * (HOLDER.termX + HOLDER.clipX)) / 2, HOLDER.h + 0.2, 0]} />
      ))}
    </group>
  );
}

// Battery test station -------------------------------------------------------------------------------------------

function stationTexture(text: { title: string; load: string }): THREE.Texture {
  return canvasTexture(`station:${text.title}:${text.load}`, 1040, 580, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#2c3a4f";
    ctx.font = `800 44px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "6px";
    ctx.fillText(text.title, w / 2, 46);
    if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
    // Battery bay outline.
    ctx.strokeStyle = "rgba(44,58,79,0.45)";
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 12]);
    ctx.strokeRect(w / 2 - 250, 110, 500, 250);
    ctx.setLineDash([]);
    // Polarity marks by the posts.
    ctx.font = `800 96px ${FONT}`;
    ctx.fillStyle = "#c23a2e";
    ctx.fillText("+", 130, 300);
    ctx.fillStyle = "#24272c";
    ctx.fillText("−", w - 130, 300);
    ctx.font = `700 40px ${FONT}`;
    ctx.fillStyle = "#2c3a4f";
    ctx.fillText(text.load, w / 2, h - 34);
  });
}

export function StationModel({ params }: ModelProps<PartParamsMap["station"]>) {
  const labels = useLabels();
  const base = memoGeo("station-base", () => roundedSlab(STATION.w, STATION.d, STATION.h, 4, 0.8));
  const print = useMemo(() => stationTexture({ title: labels.print.tester, load: labels.print.load }), [labels]);
  const on = !!params.load;
  return (
    <group>
      <mesh geometry={base} material={mat.plastic("#d9dee5", 0.5)} castShadow receiveShadow />
      <Print texture={print} w={STATION.w - 4} d={STATION.d - 4} y={STATION.h + 0.02} />
      {/* The battery bay: a shallow dark tray. */}
      <mesh geometry={memoGeo("station-bay", () => roundedSlab(56, 32, 0.6, 3, 0.2))} material={mat.plastic("#59616c", 0.7)} position={[0, STATION.h, STATION.bayZ]} receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * STATION.postX, STATION.h, STATION.postZ]}>
          <mesh geometry={memoGeo("station-post-base", () => new THREE.CylinderGeometry(4.6, 5, 6, 24))} material={mat.plastic(s < 0 ? "#c9342b" : "#24272c", 0.4)} position={[0, 3, 0]} castShadow />
          <mesh geometry={memoGeo("station-post", () => new THREE.CylinderGeometry(1.9, 1.9, STATION.postH - 6, 16))} material={mat.brass()} position={[0, 6 + (STATION.postH - 6) / 2, 0]} castShadow />
          <mesh geometry={memoGeo("station-post-cap", () => new THREE.SphereGeometry(2.3, 16, 10))} material={mat.brass()} position={[0, STATION.postH - 0.6, 0]} castShadow />
          {/* A sprung contact arm reaching toward the bay. */}
          <mesh geometry={memoGeo("station-arm", () => bentTube([[0, 4.5, 0], [0, 5.5, -10], [-6, 3, -20]], 0.55, 2, 6))} material={mat.brass()} scale={[s, 1, 1]} castShadow />
        </group>
      ))}
      {/* Load switch: a rocker that leans toward ON, with a little red lamp when the load is connected. */}
      <group position={[0, STATION.h, STATION.d / 2 - 12]}>
        <mesh geometry={memoGeo("station-sw-body", () => roundedSlab(18, 11, 3, 1.4, 0.4))} material={mat.blackMatte()} castShadow />
        <mesh geometry={memoGeo("station-rocker", () => roundedBox(14, 3, 8, 1.1, 2))} material={mat.plastic(on ? "#e0473a" : "#3a3d42", 0.4)} position={[0, 4.2, 0]} rotation={[on ? -0.22 : 0.22, 0, 0]} castShadow />
      </group>
      {/* The 100 Ω load itself, on show behind the switch. */}
      <group position={[0, STATION.h + 1.4, STATION.d / 2 - 22]}>
        <mesh geometry={memoGeo("station-load", () => roundedBox(16, 2.8, 2.8, 1, 2))} material={mat.paint("#dcc49c")} castShadow />
        {[-4, -1.5, 1, 5].map((x, i) => (
          <mesh key={i} geometry={memoGeo("station-band", () => new THREE.BoxGeometry(1, 2.95, 2.95))} material={mat.paint(BAND_HEX[(["brown", "black", "brown", "gold"] as const)[i]!])} position={[x, 0, 0]} />
        ))}
      </group>
    </group>
  );
}

// Fruit cell and electrodes --------------------------------------------------------------------------------------

export function FruitModel() {
  return <LemonHalf slots />;
}

/** A copper-plated coin or a galvanised strip: lying flat on the desk, or standing in a lemon slot when `held`. */
export function ElectrodeModel({ params, held }: ModelProps<PartParamsMap["electrode"]> & { held?: boolean }) {
  const copper = params.metal === "copper";
  if (copper) {
    const coin = memoGeo("coin", () => latheY([[0.001, 0], [ELECTRODE.coin / 2 - 0.4, 0], [ELECTRODE.coin / 2, 0.3], [ELECTRODE.coin / 2, ELECTRODE.coinT - 0.3], [ELECTRODE.coin / 2 - 0.4, ELECTRODE.coinT], [0.001, ELECTRODE.coinT]], 40));
    const ring = memoGeo("coin-ring", () => new THREE.TorusGeometry(ELECTRODE.coin / 2 - 1.6, 0.25, 6, 40));
    const body = (
      <group>
        <mesh geometry={coin} material={mat.copperBright()} castShadow receiveShadow />
        <mesh geometry={ring} material={mat.copper()} position={[0, ELECTRODE.coinT, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    );
    if (held) {
      // Standing on its edge, half in the fruit, its face toward the viewer.
      return <group position={[0, ELECTRODE.coin / 2 - ELECTRODE.inside, -ELECTRODE.coinT / 2]} rotation={[Math.PI / 2, 0, 0]}>{body}</group>;
    }
    return body;
  }
  if (held) {
    const up = memoGeo("zinc-strip-up", () => roundedBox(ELECTRODE.stripW, ELECTRODE.stripL, ELECTRODE.stripT, 0.25, 2));
    return <mesh geometry={up} material={zincMaterial()} position={[0, ELECTRODE.stripL / 2 - ELECTRODE.inside, 0]} castShadow />;
  }
  const strip = memoGeo("zinc-strip", () => roundedBox(ELECTRODE.stripL, ELECTRODE.stripT, ELECTRODE.stripW, 0.25, 2));
  return <mesh geometry={strip} material={zincMaterial()} position={[0, ELECTRODE.stripT / 2, 0]} castShadow receiveShadow />;
}

// Skin patch -----------------------------------------------------------------------------------------------------

function skinTexture(): THREE.Texture {
  return canvasTexture("skin", 780, 300, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#f0c3a2");
    g.addColorStop(1, "#e2a986");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(42);
    // Pores and fine creases.
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(150,90,60,${0.05 + r() * 0.08})`;
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 0.6 + r() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(160,100,70,0.16)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) {
      const y = r() * h;
      ctx.beginPath();
      ctx.moveTo(r() * w * 0.3, y);
      ctx.bezierCurveTo(w * 0.4, y + (r() - 0.5) * 30, w * 0.6, y + (r() - 0.5) * 30, w * (0.7 + r() * 0.3), y + (r() - 0.5) * 20);
      ctx.stroke();
    }
  });
}

function skinScaleTexture(cm: string): THREE.Texture {
  return canvasTexture(`skin-scale:${cm}`, 1000, 200, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(40,50,80,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 54px ${FONT}`;
    for (let k = 0; k <= 4; k++) {
      const x = w / 2 + (k - 2) * (w / 7.8);
      ctx.beginPath();
      ctx.arc(x, 64, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(String(k), x, 150);
    }
    ctx.font = `600 40px ${FONT}`;
    ctx.fillText(cm, w / 2 + 2.62 * (w / 7.8), 150);
  });
}

function tabTexture(text: string, on: boolean): THREE.Texture {
  return canvasTexture(`tab:${text}:${on}`, 260, 140, (ctx, w, h) => {
    ctx.fillStyle = on ? "#2f7df6" : "#f4efe6";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = on ? "#ffffff" : "#3a3326";
    ctx.font = `800 ${text.length > 5 ? 50 : 58}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), w / 2, h / 2 + 4);
  });
}

const SKIN_LOOK: Record<Moisture, { roughness: number; clearcoat: number; drops: number; salt: number }> = {
  dry: { roughness: 0.85, clearcoat: 0, drops: 0, salt: 0 },
  damp: { roughness: 0.5, clearcoat: 0.3, drops: 6, salt: 0 },
  wet: { roughness: 0.25, clearcoat: 1, drops: 18, salt: 0 },
  salty: { roughness: 0.3, clearcoat: 0.9, drops: 12, salt: 22 },
};

export function SkinModel({ params }: ModelProps<PartParamsMap["skin"]>) {
  const labels = useLabels();
  const look = SKIN_LOOK[params.moisture] ?? SKIN_LOOK.dry;
  const skin = useMemo(
    () => new THREE.MeshPhysicalMaterial({ map: skinTexture(), roughness: look.roughness, clearcoat: look.clearcoat, clearcoatRoughness: 0.15 }),
    [look],
  );
  useLayoutEffect(() => () => skin.dispose(), [skin]);
  const pad = memoGeo("skin-pad", () => roundedBox(SKIN.w, SKIN.h - SKIN.base, SKIN.d, 3.6, 4));
  const drops = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: look.drops }, () => [(r() - 0.5) * (SKIN.w - 10), (r() - 0.5) * (SKIN.d - 8), 0.5 + r() * 0.9] as const);
  }, [look.drops]);
  const salt = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: look.salt }, () => [(r() - 0.5) * (SKIN.w - 10), (r() - 0.5) * (SKIN.d - 8), r() * 3] as const);
  }, [look.salt]);
  const water = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#eaf6ff", roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 }), []);
  useLayoutEffect(() => () => water.dispose(), [water]);
  const names = labels.settings["skin.moisture"]?.values ?? {};
  return (
    <group>
      <mesh geometry={memoGeo("skin-base", () => roundedSlab(SKIN.baseW, SKIN.baseD, SKIN.base, 3, 0.6))} material={mat.paint(WOOD)} castShadow receiveShadow />
      <mesh geometry={pad} material={skin} position={[0, SKIN.base + (SKIN.h - SKIN.base) / 2, SKIN.padZ]} castShadow receiveShadow />
      <Print texture={skinScaleTexture(labels.print.cm)} w={SKIN.w} d={SKIN.w / 5} y={SKIN.h + 0.03} z={SKIN.padZ + 4} />
      {drops.map(([x, z, s], i) => (
        <mesh key={i} geometry={memoGeo("drop", () => new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2))} material={water} position={[x, SKIN.h, SKIN.padZ + z]} scale={[s, s * 0.45, s]} />
      ))}
      {salt.map(([x, z, a], i) => (
        <mesh key={i} geometry={memoGeo("salt", () => new THREE.BoxGeometry(0.7, 0.5, 0.6))} material={mat.white()} position={[x, SKIN.h + 0.2, SKIN.padZ + z]} rotation={[a, a * 2, 0]} />
      ))}
      {/* Moisture tabs along the front edge: dry, damp, wet, salty. */}
      {(["dry", "damp", "wet", "salty"] as const).map((m, i) => (
        <group key={m} position={[(i - 1.5) * 22, SKIN.base, SKIN.baseD / 2 - 9]}>
          <mesh geometry={memoGeo("skin-tab", () => roundedSlab(19, 10, 1.2, 1.4, 0.3))} material={mat.plastic(params.moisture === m ? "#2f7df6" : "#f4efe6", 0.5)} castShadow />
          <Print texture={tabTexture(names[m] ?? m, params.moisture === m)} w={17} d={8} y={1.23} />
        </group>
      ))}
    </group>
  );
}

// Material samples -----------------------------------------------------------------------------------------------

function rulerTexture(): THREE.Texture {
  return canvasTexture("ruler", 1500, 280, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(30,40,60,0.85)";
    ctx.font = `600 34px ${FONT}`;
    ctx.textAlign = "center";
    for (let mm = 0; mm <= 140; mm++) {
      const x = 50 + mm * 10;
      const len = mm % 10 === 0 ? 70 : mm % 5 === 0 ? 48 : 30;
      ctx.fillRect(x - 1.5, 0, 3, len);
      if (mm % 10 === 0) ctx.fillText(String(mm / 10), x, 112);
    }
  });
}

export function SampleModel({ params, quality = "high" }: ModelProps<PartParamsMap["sample"]> & { quality?: Quality }) {
  const plastic = useMemo(
    () =>
      quality === "high"
        ? new THREE.MeshPhysicalMaterial({ color: "#cfe6f5", roughness: 0.12, transmission: 0.85, thickness: 2, ior: 1.49, clearcoat: 1 })
        : new THREE.MeshPhysicalMaterial({ color: "#cfe6f5", roughness: 0.15, transparent: true, opacity: 0.6, clearcoat: 1 }),
    [quality],
  );
  useLayoutEffect(() => () => plastic.dispose(), [plastic]);
  if (params.material === "plastic") {
    return (
      <group>
        <mesh geometry={memoGeo("ruler", () => roundedBox(SAMPLE.ruler, SAMPLE.rulerT, SAMPLE.rulerW, 0.8, 2))} material={plastic} position={[0, SAMPLE.rulerT / 2, 0]} castShadow receiveShadow />
        <Print texture={rulerTexture()} w={SAMPLE.ruler} d={SAMPLE.ruler * (280 / 1500)} y={SAMPLE.rulerT + 0.02} z={-SAMPLE.rulerW / 2 + SAMPLE.ruler * (140 / 1500)} />
      </group>
    );
  }
  const L = SAMPLE.wire / 2;
  const r = SAMPLE.wireR;
  const wire = memoGeo("copper-wire", () =>
    bentTube(
      [
        [-L, r, 0],
        [-L * 0.55, r, 1.8],
        [-L * 0.1, r, -1.2],
        [L * 0.35, r, 1.4],
        [L, r, 0],
      ],
      r,
      14,
      8,
    ),
  );
  return <mesh geometry={wire} material={mat.copperBright()} castShadow />;
}

// Pencil card ----------------------------------------------------------------------------------------------------

function cardTexture(cm: string, start: string): THREE.Texture {
  return canvasTexture(`card:${cm}:${start}`, 1320, 660, (ctx, w, h) => {
    ctx.fillStyle = "#efebe2";
    ctx.fillRect(0, 0, w, h);
    const px = (mm: number) => (mm + 66) * 10; // card x (mm) -> canvas x
    const pz = (mm: number) => (mm + 33) * 10; // card z (mm) -> canvas y
    // Faint guide line and the start arrow.
    ctx.strokeStyle = "rgba(60,80,120,0.18)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(px(CARD.x0), pz(CARD.lineZ));
    ctx.lineTo(px(CARD.x0 + 100), pz(CARD.lineZ));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(47,125,246,0.8)";
    ctx.beginPath();
    ctx.moveTo(px(CARD.x0) - 6, pz(CARD.lineZ) - 40);
    ctx.lineTo(px(CARD.x0) + 14, pz(CARD.lineZ) - 70);
    ctx.lineTo(px(CARD.x0) - 26, pz(CARD.lineZ) - 70);
    ctx.closePath();
    ctx.fill();
    ctx.font = `700 30px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(start, px(CARD.x0) + 22, pz(CARD.lineZ) - 74);
    // Ruler along the front edge, 0 to 10 cm, lined up with the line.
    ctx.fillStyle = "#1f2a44";
    ctx.textAlign = "center";
    ctx.font = `800 44px ${FONT}`;
    const y0 = pz(12);
    ctx.fillRect(px(CARD.x0), y0 - 2, 1000, 4);
    for (let mm = 0; mm <= 100; mm++) {
      const x = px(CARD.x0 + mm);
      const len = mm % 10 === 0 ? 56 : mm % 5 === 0 ? 38 : 22;
      ctx.fillRect(x - 2, y0, 4, len);
      if (mm % 10 === 0) ctx.fillText(String(mm / 10), x, y0 + 100);
    }
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(cm, px(CARD.x0 + 108), y0 + 100);
  });
}

const GRAPHITE = ["#9a9da2", "#6f7277", "#53565b", "#3c3e42"];

/** A yellow hexagonal pencil, sharpened at +x, lying along x. */
function Pencil() {
  const L = 104;
  const body = memoGeo("pencil-body", () => {
    const g = new THREE.CylinderGeometry(3.6, 3.6, L, 6);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const cone = memoGeo("pencil-cone", () => {
    const g = new THREE.CylinderGeometry(0.5, 3.4, 13, 6);
    g.rotateZ(-Math.PI / 2);
    return g;
  });
  const tip = memoGeo("pencil-tip", () => {
    const g = new THREE.ConeGeometry(0.75, 3.2, 10);
    g.rotateZ(-Math.PI / 2);
    return g;
  });
  return (
    <group position={[0, 3.6, 0]}>
      <mesh geometry={body} material={mat.paint("#f2c230")} castShadow />
      <mesh geometry={cone} material={mat.plastic("#e8c9a0", 0.7)} position={[L / 2 + 6.5, 0, 0]} castShadow />
      <mesh geometry={tip} material={mat.plastic("#3a3c40", 0.35)} position={[L / 2 + 13.6, 0, 0]} />
      <mesh geometry={memoGeo("pencil-ferrule", () => new THREE.CylinderGeometry(3.7, 3.7, 6, 16).rotateZ(Math.PI / 2))} material={mat.aluminium()} position={[-L / 2 - 3, 0, 0]} castShadow />
      <mesh geometry={memoGeo("pencil-eraser", () => new THREE.CylinderGeometry(3.4, 3.4, 6, 16).rotateZ(Math.PI / 2))} material={mat.rubber("#ef8f9a")} position={[-L / 2 - 9, 0, 0]} castShadow />
    </group>
  );
}

export function CardModel({ params }: ModelProps<PartParamsMap["card"]>) {
  const labels = useLabels();
  const tex = useMemo(() => cardTexture(labels.print.cm, labels.print.start), [labels]);
  const top = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, color: "#d6d1c7", roughness: 0.9, envMapIntensity: 0.5 }), [tex]);
  useLayoutEffect(() => () => top.dispose(), [top]);
  const len = Math.max(0, Math.min(10, params.length)) * 10;
  const layers = Math.max(0, Math.min(4, Math.round(params.layers)));
  const width = params.wide ? 4 : 2;
  const graphite = useMemo(
    () => new THREE.MeshStandardMaterial({ color: GRAPHITE[Math.max(0, layers - 1)], metalness: 0.35 + layers * 0.08, roughness: 0.42, polygonOffset: true, polygonOffsetFactor: -2 }),
    [layers],
  );
  useLayoutEffect(() => () => graphite.dispose(), [graphite]);
  return (
    <group>
      <mesh geometry={memoGeo("card-slab", () => roundedSlab(CARD.w, CARD.d, CARD.t, 2, 0.15))} material={mat.white()} castShadow receiveShadow />
      <mesh geometry={memoGeo("card-top", () => roundedRectPlane(CARD.w - 0.4, CARD.d - 0.4, 1.8))} material={top} position={[0, CARD.t + 0.01, 0]} receiveShadow />
      {len > 0 && layers > 0 && (
        <mesh material={graphite} position={[CARD.x0 + len / 2, CARD.t + 0.03, CARD.lineZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[len + width * 0.4, width]} />
        </mesh>
      )}
      <group position={[-6, 0, -CARD.d / 2 - 9]} rotation={[0, 0.04, 0]}>
        <Pencil />
      </group>
    </group>
  );
}

// Value label, reject bin, colour chart -------------------------------------------------------------------------

function tagTexture(text: string): THREE.Texture {
  return canvasTexture(`tag:${text}`, 480, 260, (ctx, w, h) => {
    ctx.fillStyle = "#fffdf6";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#d8cfba";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = "#e7e0cf";
    ctx.beginPath();
    ctx.arc(54, h / 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1f2a44";
    ctx.font = `800 ${text.length > 6 ? 82 : 100}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2 + 34, h / 2 + 6);
  });
}

export function TagModel({ params }: ModelProps<PartParamsMap["tag"]>) {
  const text = tagText(params.text, params.alt);
  const tex = useMemo(() => tagTexture(text), [text]);
  return (
    <group>
      <mesh geometry={memoGeo("tag-card", () => roundedSlab(TAG.w, TAG.d, 0.4, 1.2, 0.1))} material={mat.white()} castShadow receiveShadow />
      <Print texture={tex} w={TAG.w - 0.6} d={TAG.d - 0.6} y={0.42} />
      <mesh geometry={memoGeo("tag-string", () => new THREE.TorusGeometry(2.6, 0.22, 6, 20))} material={mat.plastic("#c8453a", 0.6)} position={[-TAG.w / 2 + 1.2, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

function binLabelTexture(text: string): THREE.Texture {
  return canvasTexture(`bin:${text}`, 512, 110, (ctx, w, h) => {
    ctx.fillStyle = "#fbf7ec";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#9b2a20";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "6px";
    // Shrink long words to fit the label.
    let size = 64;
    do {
      ctx.font = `800 ${size}px ${FONT}`;
      size -= 4;
    } while (ctx.measureText(text).width > w - 40 && size > 20);
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
}

export function BinModel({ params }: ModelProps<PartParamsMap["bin"]>) {
  const labels = useLabels();
  const red = mat.plastic("#c8453a", 0.45);
  const t = 1.6;
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: binLabelTexture(params.label ?? labels.print.rejects), roughness: 0.7 }), [params.label, labels]);
  useLayoutEffect(() => () => label.dispose(), [label]);
  return (
    <group>
      <mesh geometry={memoGeo("bin-floor", () => roundedSlab(BIN.w, BIN.d, 2.2, 4, 0.4))} material={red} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} geometry={memoGeo("bin-wall-x", () => roundedBox(t, BIN.h, BIN.d, 0.6, 1))} material={red} position={[s * (BIN.w / 2 - t / 2), BIN.h / 2, 0]} castShadow receiveShadow />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} geometry={memoGeo("bin-wall-z", () => roundedBox(BIN.w, BIN.h, t, 0.6, 1))} material={red} position={[0, BIN.h / 2, s * (BIN.d / 2 - t / 2)]} castShadow receiveShadow />
      ))}
      <mesh material={label} position={[0, BIN.h * 0.52, BIN.d / 2 + 0.05]}>
        <planeGeometry args={[BIN.w * 0.62, BIN.w * 0.62 * (110 / 512)]} />
      </mesh>
    </group>
  );
}

const CHART_ROWS: { color: keyof typeof BAND_HEX; digit: string; mult: string; tol?: string }[] = [
  { color: "black", digit: "0", mult: "× 1" },
  { color: "brown", digit: "1", mult: "× 10", tol: "± 1%" },
  { color: "red", digit: "2", mult: "× 100", tol: "± 2%" },
  { color: "orange", digit: "3", mult: "× 1 k" },
  { color: "yellow", digit: "4", mult: "× 10 k" },
  { color: "green", digit: "5", mult: "× 100 k" },
  { color: "blue", digit: "6", mult: "× 1 M" },
  { color: "violet", digit: "7", mult: "× 10 M" },
  { color: "grey", digit: "8", mult: "" },
  { color: "white", digit: "9", mult: "" },
  { color: "gold", digit: "", mult: "× 0.1", tol: "± 5%" },
  { color: "silver", digit: "", mult: "× 0.01", tol: "± 10%" },
];

function chartTexture(l: ReturnType<typeof useLabels>["print"]): THREE.Texture {
  return canvasTexture(`chart:${l.chart}:${l.digit}`, 1000, 660, (ctx, w, h) => {
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1f2a44";
    ctx.textBaseline = "middle";
    ctx.font = `800 40px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(l.chart, 40, 42);
    ctx.font = `700 26px ${FONT}`;
    ctx.fillStyle = "#5d6680";
    ctx.fillText(l.digit, 420, 92);
    ctx.fillText(l.multiplier, 570, 92);
    ctx.fillText(l.tolerance, 780, 92);
    const rowH = 44;
    CHART_ROWS.forEach((r, i) => {
      const y = 132 + i * rowH;
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(31,42,68,0.05)";
        ctx.fillRect(30, y - rowH / 2, w - 60, rowH);
      }
      ctx.fillStyle = BAND_HEX[r.color];
      ctx.fillRect(40, y - 15, 96, 30);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(40, y - 15, 96, 30);
      ctx.fillStyle = "#1f2a44";
      ctx.font = `600 30px ${FONT}`;
      ctx.fillText(l.bands[r.color] ?? r.color, 160, y + 1);
      ctx.font = `800 32px ${MONO}`;
      ctx.fillText(r.digit, 440, y + 1);
      ctx.font = `600 30px ${MONO}`;
      ctx.fillText(r.mult, 570, y + 1);
      if (r.tol) ctx.fillText(r.tol, 780, y + 1);
    });
  });
}

export function ChartModel() {
  const labels = useLabels();
  // Toned down: the card faces the key light, and full white washes the print out.
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: chartTexture(labels.print), color: "#bdb8ae", roughness: 0.9, envMapIntensity: 0.4 }), [labels]);
  useLayoutEffect(() => () => face.dispose(), [face]);
  const tilt = 0.95;
  return (
    <group>
      {/* A card propped up on a small wooden stand, tilted toward the viewer. */}
      <mesh geometry={memoGeo("chart-stand", () => roundedSlab(CHART.w * 0.9, 14, 4, 2, 0.5))} material={mat.paint(WOOD_DARK)} position={[0, 0, 10]} castShadow receiveShadow />
      <group position={[0, 3.5, 12]} rotation={[tilt, 0, 0]}>
        <mesh geometry={memoGeo("chart-card", () => roundedBox(CHART.w, 0.8, CHART.d, 0.3, 1))} material={mat.white()} position={[0, 0, -CHART.d / 2]} castShadow receiveShadow />
        <mesh material={face} position={[0, 0.42, -CHART.d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CHART.w - 1, CHART.d - 1]} />
        </mesh>
      </group>
    </group>
  );
}

// Desk clock -----------------------------------------------------------------------------------------------------

/** A desk clock with an LCD that shows the simulated time since the lab started, in hours and minutes. */
export function ClockModel({ minutes = 0 }: { minutes?: number }) {
  const labels = useLabels();
  // The canvas lives with its texture (a ref would point at the other canvas when React runs a memo twice).
  const { canvas: c, texture } = useMemo(() => {
    const canvas = makeCanvas(512, 256);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas, texture: t };
  }, []);
  const lcd = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), [texture]);
  useLayoutEffect(
    () => () => {
      texture.dispose();
      lcd.dispose();
    },
    [texture, lcd],
  );
  useLayoutEffect(() => {
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const h = Math.floor(minutes / 60);
    const mm = Math.floor(minutes % 60);
    ctx.fillStyle = "#b9c7a6";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#1d2416";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(labels.print.time, 28, 46);
    ctx.textAlign = "right";
    ctx.font = `700 120px ${MONO}`;
    ctx.fillText(`${h}:${String(mm).padStart(2, "0")}`, c.width - 30, 160);
    texture.needsUpdate = true;
  }, [minutes, c, texture, labels]);
  return (
    <group rotation={[0, 0, 0]}>
      <group position={[0, CLOCK.h / 2, 0]} rotation={[-0.2, 0, 0]}>
        <mesh geometry={memoGeo("clock-body", () => roundedBox(CLOCK.w, CLOCK.h, CLOCK.d, 4, 3))} material={mat.plastic("#e9e4da", 0.5)} castShadow receiveShadow />
        <mesh geometry={memoGeo("clock-bezel", () => roundedBox(CLOCK.w - 6, CLOCK.h - 8, 1, 2, 2))} material={mat.blackMatte()} position={[0, 0.5, CLOCK.d / 2]} />
        <mesh material={lcd} position={[0, 0.5, CLOCK.d / 2 + 0.55]}>
          <planeGeometry args={[CLOCK.w - 10, (CLOCK.w - 10) / 2]} />
        </mesh>
      </group>
    </group>
  );
}

// Display case ---------------------------------------------------------------------------------------------------

function placardTexture(text: string): THREE.Texture {
  return canvasTexture(`placard:${text}`, 600, 220, (ctx, w, h) => {
    ctx.fillStyle = "#fffdf6";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1f2a44";
    ctx.font = `600 38px ${FONT}`;
    ctx.textBaseline = "top";
    // Wrap the text onto up to four lines.
    const words = text.split(" ");
    let line = "";
    let y = 20;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > w - 40 && line) {
        ctx.fillText(line, 20, y);
        y += 46;
        line = word;
      } else line = next;
    }
    if (line) ctx.fillText(line, 20, y);
  });
}

export function ShowcaseModel({ quality = "high" }: { quality?: Quality }) {
  const labels = useLabels();
  const glass = useMemo(
    () =>
      quality === "high"
        ? new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.04, transmission: 1, thickness: 1, ior: 1.5, clearcoat: 1 })
        : new THREE.MeshPhysicalMaterial({ color: "#eef6fb", roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false, clearcoat: 1 }),
    [quality],
  );
  const phone = useMemo(() => new THREE.MeshStandardMaterial({ map: placardTexture(labels.print.phonePack), roughness: 0.8 }), [labels]);
  const car = useMemo(() => new THREE.MeshStandardMaterial({ map: placardTexture(labels.print.carBattery), roughness: 0.8 }), [labels]);
  const sign = useMemo(() => new THREE.MeshStandardMaterial({ map: binLabelTexture(labels.print.showcase), roughness: 0.7 }), [labels]);
  useLayoutEffect(
    () => () => {
      glass.dispose();
      phone.dispose();
      car.dispose();
      sign.dispose();
    },
    [glass, phone, car, sign],
  );
  const W = SHOWCASE.w;
  const D = SHOWCASE.d;
  const H = SHOWCASE.h;
  return (
    <group>
      <mesh geometry={memoGeo("case-base", () => roundedSlab(W + 6, D + 6, 6, 3, 0.8))} material={mat.paint(WOOD_DARK)} castShadow receiveShadow />
      {/* A phone battery pack standing on a little easel. */}
      <group position={[-W / 4, 6, -6]}>
        <mesh geometry={memoGeo("pack", () => roundedBox(34, 52, 4, 2, 2))} material={mat.glossy("#2c3e66")} position={[0, 27, 0]} rotation={[-0.2, 0, 0]} castShadow />
        <mesh geometry={memoGeo("pack-label", () => roundedBox(26, 14, 0.4, 0.5, 1))} material={mat.white()} position={[0, 30, 2.4]} rotation={[-0.2, 0, 0]} />
        <mesh geometry={memoGeo("pack-contacts", () => roundedBox(8, 2.4, 1, 0.3, 1))} material={mat.brass()} position={[0, 52.5, -4]} rotation={[-0.2, 0, 0]} />
      </group>
      {/* A model car battery: black case, red and black posts. */}
      <group position={[W / 4, 6, -6]}>
        <mesh geometry={memoGeo("car-bat", () => roundedBox(44, 30, 26, 2, 2))} material={mat.plastic("#1f2125", 0.6)} position={[0, 15, 0]} castShadow />
        <mesh geometry={memoGeo("car-lid", () => roundedBox(46, 3, 28, 1.2, 2))} material={mat.plastic("#2b2e33", 0.5)} position={[0, 31, 0]} castShadow />
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 14, 32.5, -6]}>
            <mesh geometry={memoGeo("car-post", () => new THREE.CylinderGeometry(2.4, 2.8, 4, 16))} material={mat.aluminium()} position={[0, 2, 0]} />
            <mesh geometry={memoGeo("car-cap", () => new THREE.CylinderGeometry(3.4, 3.4, 1.4, 16))} material={mat.plastic(s < 0 ? "#24272c" : "#c9342b", 0.4)} position={[0, 0.7, 0]} />
          </group>
        ))}
      </group>
      {/* Placards in front of each. */}
      {[
        [-W / 4, phone],
        [W / 4, car],
      ].map(([x, m], i) => (
        <mesh key={i} material={m as THREE.Material} position={[x as number, 6.05, D / 2 - 10]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[48, 48 * (220 / 600)]} />
        </mesh>
      ))}
      {/* The glass box and its sign. */}
      <mesh geometry={memoGeo("case-glass", () => new THREE.BoxGeometry(W, H, D))} material={glass} position={[0, 6 + H / 2, 0]} renderOrder={3} />
      <mesh material={sign} position={[0, 6 + H - 6, D / 2 + 0.2]}>
        <planeGeometry args={[W * 0.6, W * 0.6 * (110 / 512)]} />
      </mesh>
    </group>
  );
}
