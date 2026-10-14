// How the paper bench is drawn each frame: the scene (through the ink and bloom passes on high quality), the
// spotlight veil, contact shadows that update only when the bench changes, and matte paper materials.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadow, paperizeScene, type PaperPalette } from "../three/paper";
import { createPaperComposer, type Spotlight } from "../three/post";
import type { Quality } from "../types";

/** Ink line width in CSS px. */
export const INK_PX = 1.6;

/**
 * Takes over rendering (frame priority 1). High: render pass, spotlight veil, then ink, bloom and the paper tone
 * curve in one effect pass. Low: the scene straight to the screen (three's tone mapping is the same paper curve),
 * then the veil.
 */
export function PaperRenderer({ quality, palette, spot, bloom = 1.15 }: { quality: Quality; palette: PaperPalette; spot: Spotlight; bloom?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const composer = useMemo(
    () => (quality === "high" ? createPaperComposer(gl, scene, camera, spot, { ink: palette.ink, thickness: INK_PX * dpr, bloom }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quality, gl, scene, camera, spot],
  );
  useEffect(() => () => composer?.dispose(), [composer]);
  useLayoutEffect(() => {
    composer?.setSize(size.width, size.height);
    composer?.ink.set(palette.ink, INK_PX * dpr);
  }, [composer, size.width, size.height, dpr, palette.ink]);
  useFrame((_, delta) => {
    if (composer) {
      composer.render(delta);
      return;
    }
    gl.autoClear = true;
    gl.setRenderTarget(null);
    gl.render(scene, camera);
    spot.draw(gl, scene, camera);
  }, 1);
  return null;
}

/** What may cast a contact shadow: solid, visible meshes on the default layer (not glows, overlays or the page). */
export function isCaster(o: THREE.Object3D): boolean {
  const m = o as THREE.Mesh;
  if (!m.isMesh || !m.layers.isEnabled(0) || m.userData.paper || (m as THREE.InstancedMesh).isInstancedMesh) return false;
  const mat = m.material as THREE.Material;
  if (!mat || Array.isArray(mat) || !mat.visible) return false;
  if (mat.blending === THREE.AdditiveBlending || (mat.transparent && !mat.depthWrite) || (mat as THREE.ShaderMaterial).isShaderMaterial) return false;
  return true;
}

export type ShadowArea = {
  key: string;
  /** Centre on the desk (x, z) and size (w, d), mm. */
  center: [number, number];
  size: [number, number];
  /** Height of the surface the shadow falls on. */
  y: number;
  /** How far above the surface things still cast. */
  far: number;
  opacity: number;
  /** Blur in texels of the shadow map. */
  blur: number;
  resolution: number;
};

function ShadowPlane({ area, version, tint }: { area: ShadowArea; version: unknown; tint: string }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const cs = useMemo(
    () => new ContactShadow(area.size[0], area.size[1], area.resolution, area.far, area.blur, area.opacity),
    [area.size[0], area.size[1], area.resolution, area.far, area.blur, area.opacity],
  );
  useEffect(() => () => cs.dispose(), [cs]);
  cs.setTint(tint, area.opacity);
  // Draw again on the next frame or two after a change (models mount a frame late).
  const pending = useRef(2);
  useEffect(() => {
    pending.current = 2;
    invalidate();
  }, [version, cs, area.center[0], area.center[1], invalidate]);
  useFrame(() => {
    if (pending.current <= 0) return;
    pending.current--;
    cs.render(gl, scene, isCaster);
    if (pending.current > 0) invalidate();
  });
  return <primitive object={cs.mesh} position={[area.center[0], area.y + 0.03, area.center[1]]} />;
}

/** Soft contact shadows on the page (and on the board), redrawn only when `version` changes. */
export function SoftShadows({ areas, version, palette }: { areas: ShadowArea[]; /** Changes whenever the bench does. */ version: unknown; palette: PaperPalette }) {
  return (
    <>
      {areas.map((a) => (
        <ShadowPlane key={a.key} area={a} version={version} tint={palette.shadow} />
      ))}
    </>
  );
}

/**
 * Keeps materials matte and on-palette (each new material once) and the key light's shadow map current. Both work
 * only on frames after the bench changed: orbiting the camera redraws neither.
 */
export function PaperUpkeep({
  version,
  dark,
  shadows,
  live = false,
}: {
  /** Changes whenever the bench does. */
  version: unknown;
  dark: boolean;
  shadows: boolean;
  /** Something moves every frame (a turntable): keep the shadow map updating on its own. */
  live?: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const pending = useRef(3);
  useLayoutEffect(() => {
    gl.shadowMap.autoUpdate = live;
    gl.shadowMap.needsUpdate = true;
    // Count a whole frame's draws (post-processing renders several passes), for stats().
    gl.info.autoReset = false;
    return () => {
      gl.shadowMap.autoUpdate = true;
      gl.info.autoReset = true;
    };
  }, [gl, live]);
  useEffect(() => {
    pending.current = 3;
    invalidate();
  }, [version, shadows, invalidate]);
  useFrame(() => {
    gl.info.reset();
    if (pending.current <= 0) return;
    pending.current--;
    paperizeScene(scene, dark);
    if (shadows) gl.shadowMap.needsUpdate = true;
    if (pending.current > 0) invalidate();
  }, -2);
  return null;
}
