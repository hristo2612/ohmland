// A single part on a slowly turning stand, for the parts bin and lesson hooks.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { PartState } from "@ohmland/sim";
import { PartModel } from "../models/PartModel";
import { isEffect } from "../effects/effects";
import { MultimeterModel } from "../models/Multimeter";
import { defaultParams } from "../parts";
import { StudioEnvironment, StudioLights } from "../scene/Studio";
import { PaletteContext, useReadPalette } from "../scene/palette";
import { PaperRenderer, PaperUpkeep } from "../scene/Render";
import { installPaperTone } from "../three/paper";
import { Spotlight } from "../three/post";
import { LabelsContext, mergeLabels, type BenchLabels } from "../labels";
import { prefersReducedMotion } from "../three/anim";
import { glowTexture } from "../three/canvas";
import type { BenchPartKind, MeterMode, PartParamsMap, Quality } from "../types";

export type PreviewKind = BenchPartKind | "multimeter";

/** Lifts its children so their lowest point rests on y = 0 and reports their size (in the parent's frame). */
export function AutoLift({ children, onSize, deps, center = false }: { children: ReactNode; onSize?: (box: THREE.Box3) => void; deps?: unknown; center?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    g.updateWorldMatrix(true, true);
    const toLocal = new THREE.Matrix4().copy(g.parent ? g.parent.matrixWorld : new THREE.Matrix4()).invert();
    const box = new THREE.Box3();
    const m4 = new THREE.Matrix4();
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry || !m.visible) return;
      const material = m.material as THREE.Material & { blending?: THREE.Blending };
      if (isEffect(m) || material.blending === THREE.AdditiveBlending) return;
      m.geometry.computeBoundingBox();
      m4.multiplyMatrices(toLocal, m.matrixWorld);
      box.union(m.geometry.boundingBox!.clone().applyMatrix4(m4));
    });
    if (!box.isEmpty()) {
      const c = box.getCenter(new THREE.Vector3());
      const shift = new THREE.Vector3(center ? -c.x : 0, -box.min.y, center ? -c.z : 0);
      g.position.copy(shift);
      box.translate(shift);
      onSize?.(box);
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
  return <group ref={ref}>{children}</group>;
}

function Turntable({ children, speed }: { children: ReactNode; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    if (!ref.current || speed === 0) return;
    ref.current.rotation.y += dt * speed;
    invalidate();
  });
  return <group ref={ref} rotation={[0, -0.6, 0]}>{children}</group>;
}

function Framer({ box, margin = 1.08 }: { box: THREE.Box3 | null; margin?: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    if (!box) return;
    // Fit the bounding sphere of the turning part (its footprint diagonal sweeps a circle).
    const dim = box.getSize(new THREE.Vector3());
    const center = new THREE.Vector3(0, dim.y / 2, 0);
    const radius = 0.5 * Math.hypot(Math.hypot(dim.x, dim.z), dim.y) + 0.5;
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / Math.max(1, size.height)));
    const d = (radius / Math.sin(Math.min(vHalf, hHalf))) * margin;
    const dir = new THREE.Vector3(0, 0.52, 0.86).normalize();
    camera.position.copy(center).addScaledVector(dir, d);
    camera.near = Math.max(0.5, d / 50);
    camera.far = d * 20;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    invalidate();
  }, [box, camera, margin, size.width, size.height, invalidate]);
  return null;
}

function Pedestal({ dark }: { dark: boolean }) {
  const shadow = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture(), color: dark ? "#000000" : "#3a3226", transparent: true, opacity: dark ? 0.4 : 0.2, depthWrite: false }),
    [dark],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[400, 64]} />
        <shadowMaterial opacity={dark ? 0.3 : 0.12} color={dark ? "#000000" : "#3a3226"} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} material={shadow}>
        <planeGeometry args={[40, 40]} />
      </mesh>
    </group>
  );
}

export type PartPreviewProps<K extends PreviewKind = PreviewKind> = {
  kind: K;
  params?: K extends BenchPartKind ? Partial<PartParamsMap[K]> : { mode?: MeterMode; display?: string; unit?: string };
  /** Simulated state to show (lit LED, smoking resistor...). */
  state?: PartState | null;
  /** Lay the part on the desk instead of standing it up. */
  pose?: "stand" | "desk";
  /** Turntable speed in radians per second (0 stops it). Reduced motion stops it too. */
  spin?: number;
  quality?: Quality;
  background?: string;
  labels?: Partial<BenchLabels>;
  className?: string;
  style?: CSSProperties;
};

/** A single part rendered nicely on a turntable. */
export function PartPreview({ kind, params, state, pose = "stand", spin = 0.45, quality = "high", background, labels, className, style }: PartPreviewProps) {
  const [box, setBox] = useState<THREE.Box3 | null>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const merged = useMemo(() => mergeLabels(labels), [labels]);
  const body =
    kind === "multimeter" ? (
      <MultimeterModel mode={(params as { mode?: MeterMode })?.mode ?? "dcv"} display={(params as { display?: string })?.display ?? "9.12"} unit={(params as { unit?: string })?.unit} />
    ) : (
      <PartModel
        kind={kind}
        params={{ ...defaultParams(kind), ...(params ?? {}) } as never}
        mount={pose === "desk" ? "desk" : "preview"}
        state={state ?? null}
        quality={quality}
      />
    );
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const palette = useReadPalette(el);
  const bg = background ?? palette.paper;
  const spot = useMemo(() => new Spotlight({ amount: 0, color: new THREE.Color(bg) }), []);
  useEffect(() => () => spot.dispose(), [spot]);
  installPaperTone();
  return (
    <div ref={setEl} className={className} style={{ position: "relative", width: "100%", height: "100%", background: bg, ...style }}>
      <Canvas
        frameloop="demand"
        shadows={quality === "high" ? "percentage" : false}
        dpr={[1, 2]}
        camera={{ fov: 30, position: [0, 40, 60] }}
        gl={{ antialias: quality === "low", alpha: false, toneMapping: THREE.CustomToneMapping, preserveDrawingBuffer: true }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(bg);
        }}
      >
        <PaletteContext.Provider value={palette}>
          <LabelsContext.Provider value={merged}>
            <StudioEnvironment intensity={palette.dark ? 0.2 : 0.3} />
            <StudioLights quality={quality} shadowSpan={80} palette={palette} />
            <Pedestal dark={palette.dark} />
            <Turntable speed={reduced ? 0 : spin}>
              <AutoLift center deps={`${kind}:${pose}:${JSON.stringify(params ?? {})}`} onSize={(b) => setBox((prev) => (prev && prev.equals(b) ? prev : b))}>
                {body}
              </AutoLift>
            </Turntable>
            <Framer box={box} />
            <PaperUpkeep version={box} dark={palette.dark} shadows={quality === "high"} live={!reduced && spin !== 0} />
            <PaperRenderer quality={quality} palette={palette} spot={spot} bloom={0.9} />
          </LabelsContext.Provider>
        </PaletteContext.Provider>
      </Canvas>
    </div>
  );
}
