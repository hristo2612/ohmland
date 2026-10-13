// Desk parts and lab props: small 8 ohm speaker, a glass of water, half a lemon with copper and zinc strips.

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { CUP, LEMON } from "../dims";
import type { PartParamsMap, Quality } from "../types";
import { useLabels } from "../labels";
import { FONT, canvasTexture, rng } from "../three/canvas";
import { latheY, memoGeo, roundedBox } from "../three/geometry";
import { mat } from "../three/materials";
import type { ModelProps } from "./common";

// Speaker ------------------------------------------------------------------------------------------------------------

/** Where the speaker wires leave the terminal tabs (local), for the bench to draw them. */
export function speakerExits(size: number): Record<"a" | "b", { pos: [number, number, number]; dir: [number, number, number] }> {
  const R = size / 2;
  return {
    a: { pos: [-2.6, 11.2, R + 2.6], dir: [0, 0.1, 1] },
    b: { pos: [2.6, 11.2, R + 2.6], dir: [0, 0.1, 1] },
  };
}

function coneTexture(): THREE.Texture {
  return canvasTexture("speaker-cone", 512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#2a2b2e";
    ctx.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
    }
  });
}

export function SpeakerModel({ params }: ModelProps<PartParamsMap["speaker"]>) {
  const D = params.size ?? 40;
  const R = D / 2;
  const cone = useMemo(() => new THREE.MeshStandardMaterial({ map: coneTexture(), roughness: 0.92 }), []);
  useLayoutEffect(() => () => cone.dispose(), [cone]);
  const geos = useMemo(
    () => ({
      magnet: latheY([[0.001, 0], [R * 0.5, 0], [R * 0.55, 0.4], [R * 0.55, 5.2], [R * 0.5, 5.6], [0.001, 5.6]], 40),
      basket: latheY([[R * 0.56, 5.4], [R * 0.6, 6.2], [R * 0.86, 10.6], [R - 0.2, 11.6], [R, 11.9], [R, 12.6], [R - 0.6, 12.8], [R * 0.86, 12.8]], 48),
      surround: latheY(
        Array.from({ length: 11 }, (_, i) => {
          const t = (i / 10) * Math.PI;
          return [R * 0.87 + (1 - Math.cos(t)) * R * 0.035, 12.3 + Math.sin(t) * 0.9] as [number, number];
        }),
        48,
      ),
      cone: latheY(
        Array.from({ length: 12 }, (_, i) => {
          const t = i / 11;
          const rr = R * 0.87 - t * (R * 0.87 - R * 0.3);
          return [rr, 12.3 - Math.pow(t, 0.8) * 4.6] as [number, number];
        }),
        48,
      ),
      cap: latheY(
        Array.from({ length: 9 }, (_, i) => {
          const t = (i / 8) * (Math.PI / 2);
          return [Math.cos(t) * R * 0.31 + 0.001, 7.6 + Math.sin(t) * 1.8] as [number, number];
        }),
        40,
      ),
    }),
    [R],
  );
  return (
    <group>
      <mesh geometry={geos.magnet} material={mat.chrome()} castShadow receiveShadow />
      <mesh geometry={geos.basket} material={mat.paint("#2f3136", true)} castShadow receiveShadow />
      <mesh geometry={geos.surround} material={mat.rubber("#1c1c1e")} castShadow />
      <mesh geometry={geos.cone} material={cone} receiveShadow />
      <mesh geometry={geos.cap} material={mat.glossy("#1d1e21")} castShadow />
      {/* Terminal board with two tinned tabs. */}
      <group position={[0, 11.9, R + 0.6]}>
        <mesh geometry={memoGeo("spk-board", () => roundedBox(11, 0.9, 4.2, 0.3, 1))} material={mat.plastic("#8a5a2b", 0.7)} castShadow />
        {[-2.6, 2.6].map((x) => (
          <mesh key={x} geometry={memoGeo("spk-tab", () => roundedBox(2.2, 0.35, 4.4, 0.1, 1))} material={mat.lead()} position={[x, 0.55, 1.2]} castShadow />
        ))}
      </group>
    </group>
  );
}

// Cup of water --------------------------------------------------------------------------------------------------------

function cupLabelTexture(text: string): THREE.Texture {
  return canvasTexture(`cup-label:${text}`, 512, 160, (ctx, w, h) => {
    ctx.fillStyle = "#fbf7ec";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#d9d1bf";
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = "#2f3b52";
    ctx.font = `800 ${text.length > 7 ? 64 : 80}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

const WATER_TINT = { distilled: "#f4fbff", tap: "#dcefff", salty: "#e3f4f2" };

export function CupModel({ params, quality = "high" }: ModelProps<PartParamsMap["cup"]> & { quality?: Quality }) {
  const labels = useLabels();
  const R = CUP.dia / 2;
  const H = CUP.height;
  const W = CUP.water;
  const glass = useMemo(
    () =>
      quality === "high"
        ? new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.03, transmission: 1, thickness: 1.6, ior: 1.5, clearcoat: 1, specularIntensity: 1 })
        : new THREE.MeshPhysicalMaterial({ color: "#eef6fb", roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false, clearcoat: 1 }),
    [quality],
  );
  const water = useMemo(
    () =>
      quality === "high"
        ? new THREE.MeshPhysicalMaterial({
            color: WATER_TINT[params.water],
            roughness: 0.02,
            transmission: 1,
            thickness: 30,
            ior: 1.33,
            attenuationColor: new THREE.Color(params.water === "tap" ? "#bfe0f5" : params.water === "salty" ? "#cdeee8" : "#eaf6ff"),
            attenuationDistance: 120,
          })
        : new THREE.MeshPhysicalMaterial({ color: "#bcdcf2", roughness: 0.05, transparent: true, opacity: 0.4, depthWrite: false }),
    [quality, params.water],
  );
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: cupLabelTexture(labels.water[params.water]), roughness: 0.75 }), [labels, params.water]);
  useLayoutEffect(
    () => () => {
      glass.dispose();
      water.dispose();
      label.dispose();
    },
    [glass, water, label],
  );
  const shell = memoGeo("cup-shell", () =>
    latheY(
      [
        [0.001, 0],
        [R - 1.6, 0],
        [R - 0.2, 0.6],
        [R, 2],
        [R + 0.6, H - 0.6],
        [R + 0.85, H - 0.1],
        [R + 0.45, H + 0.15],
        [R - 0.65, H - 0.2],
        [R - 0.95, H - 1],
        [R - 1.45, 4.6],
        [R - 2.2, 4.0],
        [0.001, 4.0],
      ],
      64,
    ),
  );
  const waterGeo = memoGeo("cup-water", () =>
    latheY(
      [
        [0.001, 4.05],
        [R - 2.15, 4.05],
        [R - 1.5, 4.7],
        [R - 1.1, W - 0.6],
        [R - 1.05, W + 0.35],
        [R - 2.6, W],
        [0.001, W],
      ],
      64,
    ),
  );
  const grains = useMemo(() => {
    if (params.water !== "salty") return [];
    const r = rng(17);
    return Array.from({ length: 26 }, () => [(r() - 0.5) * R * 1.2, 4.3, (r() - 0.5) * R * 1.2, r() * 3] as const);
  }, [params.water, R]);
  return (
    <group>
      <mesh geometry={waterGeo} material={water} renderOrder={1} />
      <mesh geometry={shell} material={glass} castShadow renderOrder={2} />
      {/* Paper label on the front of the glass. */}
      <mesh
        geometry={memoGeo("cup-label", () => new THREE.CylinderGeometry(R + 0.75, R + 0.62, 13, 32, 1, true, -0.62, 1.24))}
        material={label}
        position={[0, H * 0.32, 0]}
      />
      {grains.map(([x, y, z, a], i) => (
        <mesh key={i} geometry={memoGeo("salt", () => new THREE.BoxGeometry(0.7, 0.5, 0.6))} material={mat.white()} position={[x, y, z]} rotation={[a, a * 2, 0]} />
      ))}
    </group>
  );
}

// Lemon cell -----------------------------------------------------------------------------------------------------------

function lemonFaceTexture(): THREE.Texture {
  return canvasTexture("lemon-face", 1024, 1024, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const R = w / 2;
    ctx.fillStyle = "#f1cf2f";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6edc4";
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.93, 0, Math.PI * 2);
    ctx.fill();
    const n = 10;
    const r = rng(21);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + 0.05;
      const a1 = ((i + 1) / n) * Math.PI * 2 - 0.05;
      const g = ctx.createRadialGradient(cx, cy, R * 0.12, cx, cy, R * 0.86);
      g.addColorStop(0, "#f7e68e");
      g.addColorStop(1, "#f0d65a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos((a0 + a1) / 2) * R * 0.13, cy + Math.sin((a0 + a1) / 2) * R * 0.13);
      ctx.arc(cx, cy, R * 0.84, a0, a1);
      ctx.closePath();
      ctx.fill();
      // Juice vesicles.
      for (let k = 0; k < 90; k++) {
        const a = a0 + r() * (a1 - a0);
        const d = R * (0.18 + r() * 0.64);
        ctx.fillStyle = `rgba(255,255,230,${0.12 + r() * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4 + r() * 6, 1.5 + r() * 2, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Seeds.
    for (const [a, d] of [
      [0.9, 0.42],
      [3.6, 0.38],
    ] as [number, number][]) {
      ctx.fillStyle = "#efe2b0";
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * R * d, cy + Math.sin(a) * R * d, 26, 12, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fbf3d6";
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.09, 0, Math.PI * 2);
    ctx.fill();
  });
}

function peelBump(): THREE.Texture {
  return canvasTexture(
    "lemon-peel",
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, w, h);
      const r = rng(8);
      for (let i = 0; i < 2600; i++) {
        const x = r() * w;
        const y = r() * h;
        const rad = 2 + r() * 5;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, "rgba(30,30,30,0.6)");
        g.addColorStop(1, "rgba(30,30,30,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    },
    { srgb: false, repeat: [3, 2] },
  );
}

function zincTexture(): THREE.Texture {
  return canvasTexture("zinc", 256, 512, (ctx, w, h) => {
    ctx.fillStyle = "#bfc6cc";
    ctx.fillRect(0, 0, w, h);
    const r = rng(4);
    // Galvanised spangle: irregular crystal facets.
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `hsl(205 8% ${62 + r() * 22}%)`;
      ctx.beginPath();
      const x = r() * w;
      const y = r() * h;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + r();
        const d = 20 + r() * 40;
        if (k) ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        else ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      }
      ctx.fill();
    }
  });
}

let zincMat: THREE.Material | null = null;
/** Galvanised steel (zinc spangle), shared by the lemon cell's strip and the zinc electrode. */
export function zincMaterial(): THREE.Material {
  zincMat ??= new THREE.MeshStandardMaterial({ map: zincTexture(), metalness: 0.85, roughness: 0.38 });
  return zincMat;
}

export function LemonModel() {
  const H = LEMON.height;
  const strip = memoGeo("lemon-strip", () => roundedBox(0.7, 30, LEMON.stripW, 0.25, 2));
  const stripY = H + LEMON.stripUp - 15;
  return (
    <group>
      <LemonHalf />
      <mesh geometry={strip} material={mat.copperBright()} position={[-10, stripY, 0]} castShadow />
      <mesh geometry={strip} material={zincMaterial()} position={[10, stripY, 0]} castShadow />
    </group>
  );
}

/** Half a lemon, cut face up (the fruit cell prop, with or without electrodes). `slots` marks two cuts in the face. */
export function LemonHalf({ slots = false }: { slots?: boolean }) {
  const R = LEMON.dia / 2;
  const H = LEMON.height;
  const face = useMemo(() => new THREE.MeshPhysicalMaterial({ map: lemonFaceTexture(), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }), []);
  const peel = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f3d23a", roughness: 0.5, bumpMap: peelBump(), bumpScale: 0.8 }), []);
  useLayoutEffect(
    () => () => {
      face.dispose();
      peel.dispose();
    },
    [face, peel],
  );
  const rind = memoGeo("lemon-rind", () => {
    const pts: [number, number][] = [[0.001, 0.2], [2.2, 0.25], [3.2, 0.9]];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * (Math.PI / 2);
      pts.push([3 + Math.sin(t) * (R - 3), 1.2 + (1 - Math.cos(t)) * (H - 1.2)]);
    }
    pts.push([R - 0.2, H + 0.25], [R - 1.2, H + 0.35]);
    return latheY(pts, 56);
  });
  return (
    <group>
      <mesh geometry={rind} material={peel} castShadow receiveShadow />
      <mesh material={face} position={[0, H + 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[R - 1.0, 64]} />
      </mesh>
      {slots &&
        [-11, 11].map((x) => (
          <mesh key={x} geometry={memoGeo("lemon-slot", () => new THREE.PlaneGeometry(12, 2))} material={mat.basic("#c9a91f")} position={[x, H + 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        ))}
    </group>
  );
}
