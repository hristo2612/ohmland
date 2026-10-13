// A single part on a slowly turning stand, for the parts bin and lesson hooks.

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { PartState } from "@ohmland/sim";
import { PartModel } from "../models/PartModel";
import { MultimeterModel } from "../models/Multimeter";
import { defaultParams } from "../parts";
import { StudioEnvironment, StudioLights } from "../scene/Studio";
import { LabelsContext, mergeLabels, type BenchLabels } from "../labels";
import { prefersReducedMotion } from "../three/anim";
import { glowTexture } from "../three/canvas";
import type { BenchPartKind, MeterMode, PartParamsMap, Quality } from "../types";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export type PreviewKind = BenchPartKind | "multimeter";

/** Lifts its children so their lowest point rests on y = 0 and reports their size (in the parent's frame). */
export function AutoLift({ children, onSize, deps }: { children: ReactNode; onSize?: (box: THREE.Box3) => void; deps?: unknown }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.position.y = 0;
    g.updateWorldMatrix(true, true);
    const toLocal = new THREE.Matrix4().copy(g.parent ? g.parent.matrixWorld : new THREE.Matrix4()).invert();
    const box = new THREE.Box3();
    const m4 = new THREE.Matrix4();
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry || !m.visible) return;
      const material = m.material as THREE.Material & { blending?: THREE.Blending };
      if (material.blending === THREE.AdditiveBlending) return;
      m.geometry.computeBoundingBox();
      m4.multiplyMatrices(toLocal, m.matrixWorld);
      box.union(m.geometry.boundingBox!.clone().applyMatrix4(m4));
    });
    if (!box.isEmpty()) {
      g.position.y = -box.min.y;
      box.translate(new THREE.Vector3(0, -box.min.y, 0));
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

function Framer({ box, distance = 2.4 }: { box: THREE.Box3 | null; distance?: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    if (!box) return;
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * 0.62 + 2;
    const d = (r / Math.tan((camera.fov * Math.PI) / 360)) * (distance / 2);
    const cy = size.y * 0.42;
    camera.position.set(0, cy + d * 0.55, d * 0.85);
    camera.near = Math.max(0.5, d / 50);
    camera.far = d * 20;
    camera.lookAt(0, cy * 0.85, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [box, camera, distance, invalidate]);
  return null;
}

function Pedestal() {
  const shadow = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#000000", transparent: true, opacity: 0.22, depthWrite: false }),
    [],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[400, 64]} />
        <shadowMaterial opacity={0.18} />
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
  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", ...style }}>
      <Canvas
        frameloop="demand"
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 30, position: [0, 40, 60] }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, preserveDrawingBuffer: true }}
        onCreated={({ scene }) => {
          if (background) scene.background = new THREE.Color(background);
        }}
      >
        <LabelsContext.Provider value={merged}>
          <StudioEnvironment intensity={0.7} />
          <StudioLights quality={quality} shadowSpan={80} />
          <Pedestal />
          <Turntable speed={reduced ? 0 : spin}>
            <AutoLift deps={`${kind}:${pose}:${JSON.stringify(params ?? {})}`} onSize={(b) => setBox((prev) => (prev && prev.equals(b) ? prev : b))}>
              {body}
            </AutoLift>
          </Turntable>
          <Framer box={box} />
          {quality === "high" && (
            <EffectComposer multisampling={4}>
              <Bloom mipmapBlur luminanceThreshold={1} intensity={0.8} radius={0.6} />
              <ToneMapping mode={ToneMappingMode.NEUTRAL} />
            </EffectComposer>
          )}
        </LabelsContext.Provider>
      </Canvas>
    </div>
  );
}
