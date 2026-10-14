// The sheet of grid paper the bench stands on, paper-matched lighting and a soft studio environment.

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PAPER_LIGHT, PAPER_SIZE, installPaperTone, paperMaterial, type PaperPalette } from "../three/paper";
import type { Quality } from "../types";

export const DESK_SIZE: [number, number] = [PAPER_SIZE, PAPER_SIZE];
/** The page colour (light theme). */
export const BACKGROUND = PAPER_LIGHT.paper;

/** A soft studio environment built from RoomEnvironment (no network download). */
export function StudioEnvironment({ intensity = 0.22 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    scene.environmentIntensity = intensity;
    invalidate();
  }, [scene, intensity, invalidate]);
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.035).texture;
    scene.environment = env;
    invalidate();
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
      room.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | undefined;
        mat?.dispose?.();
      });
    };
  }, [gl, scene, invalidate]);
  return null;
}

/**
 * Soft, low-contrast light like daylight on a page: a strong sky fill, one gentle key light (the only shadow caster,
 * high quality) and a cool rim. Dark pages get a warm desk lamp instead. `dim` (0..1) turns the room lights down.
 */
export function StudioLights({
  quality,
  shadowSpan = 260,
  center = [0, 0],
  palette = PAPER_LIGHT,
  dim = 1,
}: {
  quality: Quality;
  shadowSpan?: number;
  center?: [number, number];
  palette?: PaperPalette;
  dim?: number;
}) {
  const k = Math.max(0.05, Math.min(1, dim));
  const shadows = quality === "high";
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(center[0], 0, center[1]);
    return o;
  }, [center[0], center[1]]);
  const dark = palette.dark;
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={dark ? ["#ffe9cc", "#3a2c1e", 0.75 * k] : ["#fffaf1", "#d9cdb8", 1.45 * k]} />
      <directionalLight
        position={[center[0] - 240, 560, center[1] + 260]}
        target={target}
        intensity={(dark ? 1.6 : 1.25) * k}
        color={dark ? "#ffd8a8" : "#fff4e4"}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={shadowSpan}
        shadow-camera-bottom={-shadowSpan}
        shadow-camera-near={100}
        shadow-camera-far={1600}
        shadow-bias={-0.0003}
        shadow-normalBias={0.18}
        shadow-radius={6}
      />
      <directionalLight position={[center[0] + 380, 260, center[1] - 260]} target={target} intensity={(dark ? 0.22 : 0.3) * k} color={dark ? "#9fb0d8" : "#e6ebf5"} />
    </>
  );
}

/**
 * Formerly drew the wooden desk texture ahead of time. The paper is drawn in a shader now, so this only installs the
 * paper tone curve; it stays so pages can keep calling it while idle.
 */
export function prepareBench(): void {
  installPaperTone();
}

/**
 * The page: grid paper, unlit so it comes out exactly as the page colour, with an optional notebook margin line at
 * `margin` (x in mm). On high quality a shadow catcher on top takes the key light's soft shadows.
 */
export function Desk({ quality, palette = PAPER_LIGHT, margin, light = 1 }: { quality: Quality; palette?: PaperPalette; margin?: number | null; light?: number }) {
  const paper = useMemo(() => paperMaterial(palette), [palette]);
  const catcher = useMemo(
    () => new THREE.ShadowMaterial({ color: palette.dark ? "#000000" : "#3a3226", opacity: palette.dark ? 0.35 : 0.12, depthWrite: false }),
    [palette],
  );
  useLayoutEffect(
    () => () => {
      paper.dispose();
      catcher.dispose();
    },
    [paper, catcher],
  );
  // The page is unlit, so the room lights dim it here (as they dim the background).
  paper.uniforms.light!.value = 0.12 + 0.88 * Math.max(0, Math.min(1, light));
  paper.uniforms.marginOn!.value = margin == null ? 0 : 1;
  paper.uniforms.marginX!.value = margin ?? -1e5;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={paper} renderOrder={-100} raycast={() => {}} userData={{ paper: true }}>
        <planeGeometry args={DESK_SIZE} />
      </mesh>
      {quality === "high" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={catcher} receiveShadow renderOrder={-99} raycast={() => {}} userData={{ paper: true }}>
          <planeGeometry args={DESK_SIZE} />
        </mesh>
      )}
    </group>
  );
}
