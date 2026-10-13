// 3 mm and 5 mm LEDs (diffused or water clear) and the clear-bodied phototransistor.
// The rim is flat on the cathode side and the anode lead is longer (with a small kink once it is in the board).

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { LED, PITCH } from "../dims";
import type { PartParamsMap, Quality } from "../types";
import { Halo, LightSpill, Smoke } from "../effects/effects";
import { canvasTexture, rng } from "../three/canvas";
import { bentTube, latheY, memoGeo } from "../three/geometry";
import { LED_HEX, mat } from "../three/materials";
import { IN_HOLE, RadialMount, healthOf, mix, type ModelProps } from "./common";

type LedSize = 3 | 5;

function rimGeometry(size: LedSize): THREE.BufferGeometry {
  return memoGeo(`led-rim:${size}`, () => {
    const d = LED[size];
    const R = d.rim / 2;
    const fx = R - d.flat;
    const a = Math.acos(fx / R);
    const s = new THREE.Shape();
    s.absarc(0, 0, R, a, Math.PI * 2 - a, false);
    s.lineTo(fx, Math.sin(a) * R);
    const g = new THREE.ExtrudeGeometry(s, { depth: d.rimH - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.08, 0);
    return g;
  });
}

function domeGeometry(size: LedSize, grow = 0): THREE.BufferGeometry {
  return memoGeo(`led-dome:${size}:${grow}`, () => {
    const d = LED[size];
    const R = d.dome / 2 + grow;
    const top = d.height + grow;
    const pts: [number, number][] = [
      [R - 0.05, d.rimH - 0.05],
      [R, d.rimH + 0.1],
      [R, top - R],
    ];
    for (let i = 1; i <= 14; i++) {
      const t = (i / 14) * (Math.PI / 2);
      pts.push([Math.cos(t) * R, top - R + Math.sin(t) * R]);
    }
    return latheY(pts, 40);
  });
}

function crackTexture(): THREE.CanvasTexture {
  return canvasTexture(
    "led-crack",
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const r = rng(5);
      ctx.strokeStyle = "#fff";
      ctx.lineCap = "round";
      const crack = (x: number, y: number, ang: number, len: number, width: number, depth: number) => {
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        let cx = x;
        let cy = y;
        for (let i = 0; i < len; i++) {
          ang += (r() - 0.5) * 0.9;
          cx += Math.cos(ang) * 7;
          cy += Math.sin(ang) * 7;
          ctx.lineTo(cx, cy);
          if (depth > 0 && r() < 0.18) crack(cx, cy, ang + (r() > 0.5 ? 0.9 : -0.9), len * 0.45, width * 0.6, depth - 1);
        }
        ctx.stroke();
      };
      // Lathe u runs around the dome and v up its height; draw cracks near the top, running down the sides.
      crack(w * 0.08, h * 0.02, Math.PI / 2 + 0.15, 26, 6, 2);
      crack(w * 0.14, h * 0.05, Math.PI / 2 - 0.35, 20, 4.5, 1);
      crack(w * 0.58, h * 0.04, Math.PI / 2 + 0.1, 18, 4, 1);
    },
    { srgb: false },
  );
}

let burnMat: THREE.Material | null = null;
function burnMaterial(): THREE.Material {
  burnMat ??= new THREE.MeshBasicMaterial({ color: "#120a06", transparent: true, opacity: 0.75, depthWrite: false });
  return burnMat;
}

/** Lens material per LED instance (emission changes with the snapshot). */
function useLensMaterial(color: string, lens: "diffused" | "clear", quality: Quality, dead: boolean) {
  const hex = LED_HEX[color] ?? LED_HEX.red!;
  const material = useMemo(() => {
    if (lens === "clear") {
      const tint = dead ? mix(hex.clear, "#6b6460", 0.45) : hex.clear;
      if (quality === "high") {
        return new THREE.MeshPhysicalMaterial({
          color: tint,
          roughness: dead ? 0.35 : 0.04,
          transmission: dead ? 0.6 : 1,
          thickness: 3.5,
          ior: 1.5,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          emissive: hex.emit,
          emissiveIntensity: 0,
        });
      }
      return new THREE.MeshPhysicalMaterial({
        color: tint,
        roughness: 0.06,
        transparent: true,
        opacity: dead ? 0.6 : 0.34,
        clearcoat: 1,
        emissive: hex.emit,
        emissiveIntensity: 0,
        depthWrite: false,
      });
    }
    const body = dead ? mix(hex.lens, "#3a302c", 0.62) : hex.lens;
    return new THREE.MeshPhysicalMaterial({
      color: body,
      roughness: dead ? 0.55 : 0.3,
      transparent: true,
      opacity: dead ? 0.97 : 0.9,
      clearcoat: 1,
      clearcoatRoughness: dead ? 0.4 : 0.1,
      emissive: hex.emit,
      emissiveIntensity: 0,
    });
  }, [hex, lens, quality, dead]);
  useLayoutEffect(() => () => material.dispose(), [material]);
  return material;
}

/** Lead frame inside the epoxy: cathode anvil with reflector cup and die, anode post with bond wire. */
function LeadFrame({ size, dieColor, dieGlow, dead, photo, diffused }: { size: LedSize; dieColor: string; dieGlow: number; dead: boolean; photo?: boolean; diffused?: boolean }) {
  const k = size === 5 ? 1 : 0.62;
  const geos = useMemo(
    () => ({
      cathode: memoGeo(`led-cath:${size}`, () => {
        const g = new THREE.BoxGeometry(0.5, 2.6 * k + 0.4, 0.42);
        g.translate(0.95 * k, (2.6 * k + 0.4) / 2 - 0.4, 0);
        return g;
      }),
      cup: memoGeo(`led-cup:${size}`, () => {
        const g = latheY(
          [
            [0.25 * k, 0],
            [0.42 * k, 0.05],
            [0.55 * k, 0.55 * k],
            [0.98 * k, 1.0 * k],
            [0.88 * k, 1.02 * k],
            [0.45 * k, 0.6 * k],
            [0.001, 0.58 * k],
          ],
          24,
        );
        g.translate(0.62 * k, 2.6 * k, 0);
        return g;
      }),
      anode: memoGeo(`led-anode:${size}`, () => {
        const g = new THREE.BoxGeometry(0.42, 3.7 * k + 0.4, 0.38);
        g.translate(-0.95 * k, (3.7 * k + 0.4) / 2 - 0.4, 0);
        return g;
      }),
      flag: memoGeo(`led-flag:${size}`, () => {
        const g = new THREE.BoxGeometry(0.7 * k, 0.35, 0.36);
        g.translate(-0.75 * k, 3.7 * k, 0);
        return g;
      }),
      wire: memoGeo(`led-wire:${size}`, () => {
        const c = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-0.6 * k, 3.85 * k, 0),
          new THREE.Vector3(0.0, 4.6 * k, 0),
          new THREE.Vector3(0.62 * k, 3.25 * k, 0),
        );
        return new THREE.TubeGeometry(c, 16, 0.035, 5, false);
      }),
      die: memoGeo(`led-die:${size}`, () => {
        const g = new THREE.BoxGeometry(0.34 * k, 0.2, 0.34 * k);
        g.translate(0.62 * k, 3.25 * k, 0);
        return g;
      }),
    }),
    [size, k],
  );
  const dieMat = useMemo(() => {
    if (photo) return mat.plastic("#2a2420", 0.4);
    if (dead) return mat.basic("#120d0b");
    const m = new THREE.MeshBasicMaterial({ color: dieColor, toneMapped: false });
    return m;
  }, [photo, dead, dieColor]);
  if (dieMat instanceof THREE.MeshBasicMaterial && !dead && !photo) {
    const c = new THREE.Color(dieColor);
    dieMat.color.copy(c).multiplyScalar(0.25 + dieGlow * (diffused ? 7 : 22));
  }
  return (
    <group>
      <mesh geometry={geos.cathode} material={mat.leadDark()} />
      <mesh geometry={geos.cup} material={mat.lead()} />
      <mesh geometry={geos.anode} material={mat.leadDark()} />
      <mesh geometry={geos.flag} material={mat.leadDark()} />
      <mesh geometry={geos.wire} material={mat.brass()} />
      <mesh geometry={geos.die} material={dieMat} />
    </group>
  );
}

type LegMode = "board" | "free" | "desk";

/** Two square-section leads. Anode (or emitter for the phototransistor) on the left is the longer one. */
function LedLegs({ size, mode }: { size: LedSize; mode: LegMode }) {
  const d = LED[size];
  const geos = useMemo(() => {
    const r = 0.24;
    const x = PITCH / 2;
    if (mode === "board") {
      const base = d.standoff;
      return [
        // A small kink takes up the anode's extra length.
        bentTube([[-x, base + 0.5, 0], [-x, 2.25, 0], [-x - 0.55, 1.65, 0], [-x, 1.05, 0], [-x, IN_HOLE, 0]], r, 0.3, 4),
        bentTube([[x, base + 0.5, 0], [x, IN_HOLE, 0]], r, 0.3, 4),
      ];
    }
    const la = mode === "desk" ? d.deskLeadA : 15;
    const lk = mode === "desk" ? d.deskLeadK : 13;
    return [bentTube([[-x, 0.5, 0], [-x, -la, 0]], r, 0.3, 4), bentTube([[x, 0.5, 0], [x, -lk, 0]], r, 0.3, 4)];
  }, [d, mode]);
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mat.lead()} castShadow />
      ))}
    </>
  );
}

function ledGlowIntensity(glow: number, lens: "diffused" | "clear"): number {
  // Perceived brightness 0..1 mapped to an emissive strength that crosses the bloom threshold when bright.
  const g = Math.max(0, Math.min(1, glow));
  // Kept moderate so the lens stays saturated; the die core and halo carry the brightness.
  // Neutral tone mapping washes very bright reds to pink, so the lens itself stays near 1.0; the die core
  // (which blooms) and the halo carry the extra brightness.
  return lens === "clear" ? g * 0.4 : 0.12 * Math.sign(g) + g * 0.62;
}

function LedBody({
  size,
  color,
  lens,
  quality,
  glow,
  dead,
  photo,
}: {
  size: LedSize;
  color: string;
  lens: "diffused" | "clear";
  quality: Quality;
  glow: number;
  dead: boolean;
  photo?: boolean;
}) {
  const lensMat = useLensMaterial(color, lens, quality, dead);
  lensMat.emissiveIntensity = dead || photo ? 0 : ledGlowIntensity(glow, lens);
  if (lens === "diffused" && !dead) {
    // A lit diffused lens is filled with light: hide the desk behind it and let the emission dominate.
    const k = Math.min(1, glow * 1.5);
    lensMat.opacity = 0.9 + 0.1 * k;
    lensMat.clearcoat = 1 - 0.6 * k;
    lensMat.color.set(mix(LED_HEX[color]?.lens ?? "#d8191f", "#000000", 0.55 * k));
  }
  const crack = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: "#efe6dc", alphaMap: crackTexture(), transparent: true, depthWrite: false, opacity: 0.8 }),
    [],
  );
  useLayoutEffect(() => () => crack.dispose(), [crack]);
  const hex = LED_HEX[color] ?? LED_HEX.red!;
  return (
    <group>
      <mesh geometry={rimGeometry(size)} material={lensMat} castShadow renderOrder={2} />
      <mesh geometry={domeGeometry(size)} material={lensMat} castShadow renderOrder={2} />
      <LeadFrame size={size} dieColor={hex.emit} dieGlow={glow} dead={dead} photo={photo} diffused={lens === "diffused"} />
      {dead && <mesh geometry={domeGeometry(size, 0.025)} material={crack} renderOrder={3} />}
      {dead && (
        <mesh position={[0.6 * (size === 5 ? 1 : 0.62), 3.3 * (size === 5 ? 1 : 0.62), 0]} material={burnMaterial()} renderOrder={1}>
          <sphereGeometry args={[size === 5 ? 1.0 : 0.65, 16, 12]} />
        </mesh>
      )}
    </group>
  );
}

function LedLike({
  params,
  mount,
  state,
  quality = "high",
  photo,
}: {
  params: { size?: LedSize; color?: string; lens?: "diffused" | "clear" };
  mount: ModelProps<unknown>["mount"];
  state?: ModelProps<unknown>["state"];
  quality?: Quality;
  photo?: boolean;
}) {
  const size = params.size ?? 5;
  const d = LED[size];
  const color = photo ? "white" : params.color ?? "red";
  const lens = photo ? "clear" : params.lens ?? "diffused";
  const health = healthOf(state);
  const dead = !photo && health === "dead";
  const glow = photo || dead ? 0 : Math.max(0, Math.min(1, state?.glow ?? 0));
  const hex = LED_HEX[color] ?? LED_HEX.red!;
  const legMode: LegMode = mount === "board" ? "board" : mount === "desk" ? "desk" : "free";
  const base = mount === "board" ? d.standoff : 0;
  const haloY = base + d.height * 0.62;
  return (
    <group>
      <RadialMount mount={mount} centerX={PITCH / 2} deskAxis={d.rim / 2}>
        <group position={[0, base, 0]}>
          <LedBody size={size} color={color} lens={lens} quality={quality} glow={glow} dead={dead} photo={photo} />
        </group>
        <LedLegs size={size} mode={legMode} />
        {glow > 0.01 && (
          <group position={[0, haloY, 0]}>
            <Halo color={hex.emit} intensity={quality === "low" ? glow * 1.1 : glow * 0.85} size={size === 5 ? 26 : 17} />
          </group>
        )}
        {health === "smoking" && !photo && (
          <group position={[0, base + d.height, 0]}>
            <Smoke active amount={0.6} spread={2} />
          </group>
        )}
      </RadialMount>
      {glow > 0.01 && mount !== "preview" && (
        <group position={mount === "board" ? [PITCH / 2, 0, 0] : [-d.height * 0.5, 0, 0]}>
          <LightSpill color={hex.emit} intensity={glow} radius={8 + glow * 8} />
        </group>
      )}
    </group>
  );
}

export function LedModel({ params, mount, state, quality }: ModelProps<PartParamsMap["led"]>) {
  return <LedLike params={params} mount={mount} state={state} quality={quality} />;
}

export function PhototransistorModel({ params, mount, quality }: ModelProps<PartParamsMap["phototransistor"]>) {
  return <LedLike params={{ size: params.size ?? 5 }} mount={mount} quality={quality} photo />;
}
