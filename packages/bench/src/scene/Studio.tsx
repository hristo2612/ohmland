// Lighting, a procedural studio environment map and the warm wooden desk.

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { canvasTexture, rng } from "../three/canvas";
import type { Quality } from "../types";

export const DESK_SIZE: [number, number] = [2600, 1800];
export const BACKGROUND = "#e9e0d4";

/** A soft studio environment built from RoomEnvironment (no network download). */
export function StudioEnvironment({ intensity = 0.5 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.035).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
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
  }, [gl, scene, intensity, invalidate]);
  return null;
}

export function StudioLights({ quality, shadowSpan = 420, center = [0, 0] }: { quality: Quality; shadowSpan?: number; center?: [number, number] }) {
  const shadows = quality === "high";
  const size = quality === "high" ? 4096 : 1024;
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(center[0], 0, center[1]);
    return o;
  }, [center[0], center[1]]);
  return (
    <>
      <hemisphereLight args={["#fff7ec", "#8b6a48", 0.5]} />
      <primitive object={target} />
      <directionalLight
        position={[center[0] - 260, 560, center[1] + 300]}
        target={target}
        intensity={1.75}
        color="#fff0de"
        castShadow={shadows}
        shadow-mapSize={[size, size]}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={shadowSpan}
        shadow-camera-bottom={-shadowSpan}
        shadow-camera-near={100}
        shadow-camera-far={1600}
        shadow-bias={-0.00025}
        shadow-normalBias={0.18}
        shadow-radius={4}
      />
      <directionalLight position={[center[0] + 380, 260, center[1] - 260]} target={target} intensity={0.5} color="#dfe7ff" />
    </>
  );
}

function woodTexture(): THREE.CanvasTexture {
  return canvasTexture(
    "wood",
    2048,
    2048,
    (ctx, w, h) => {
      const r = rng(1234);
      const planks = 5;
      const ph = h / planks;
      for (let p = 0; p < planks; p++) {
        const y0 = p * ph;
        const hue = 33 + (r() - 0.5) * 3;
        const light = 66 + (r() - 0.5) * 4;
        ctx.fillStyle = `hsl(${hue} 34% ${light}%)`;
        ctx.fillRect(0, y0, w, ph);
        // Long grain lines.
        for (let i = 0; i < 260; i++) {
          const y = y0 + r() * ph;
          const amp = 2 + r() * 9;
          const f = 0.002 + r() * 0.004;
          const ph2 = r() * Math.PI * 2;
          ctx.strokeStyle = `hsla(${hue - 5} 40% ${34 + r() * 16}% / ${0.025 + r() * 0.07})`;
          ctx.lineWidth = 0.6 + r() * 2.4;
          ctx.beginPath();
          for (let x = -10; x <= w + 10; x += 16) {
            const yy = y + Math.sin(x * f + ph2) * amp + Math.sin(x * f * 3.1 + ph2 * 2) * amp * 0.25;
            if (x < 0) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
        // Broad soft streaks.
        for (let i = 0; i < 10; i++) {
          const y = y0 + r() * ph;
          ctx.fillStyle = `hsla(${hue - 4} 40% ${r() > 0.5 ? 76 : 44}% / 0.045)`;
          ctx.fillRect(0, y, w, 6 + r() * 26);
        }
        // Pores.
        for (let i = 0; i < 2600; i++) {
          ctx.fillStyle = `hsla(${hue - 8} 40% 32% / ${0.05 + r() * 0.08})`;
          ctx.fillRect(r() * w, y0 + r() * ph, 2 + r() * 7, 0.8);
        }
        // Plank joint.
        ctx.fillStyle = "rgba(90,60,30,0.12)";
        ctx.fillRect(0, y0, w, 1.2);
      }
    },
    { repeat: [DESK_SIZE[0] / 760, DESK_SIZE[1] / 760], anisotropy: 8 },
  );
}

/**
 * Draws the bench's biggest procedural texture (the 2048 px desk) ahead of time, for a page to call while the browser
 * is idle before a bench appears. The texture is cached, so the bench then only uploads it.
 */
export function prepareBench(): void {
  woodTexture();
}

/** Warm wooden desk top with a soft varnish. */
export function Desk({ quality }: { quality: Quality }) {
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: woodTexture(),
        roughness: 0.58,
        clearcoat: quality === "high" ? 0.25 : 0,
        clearcoatRoughness: 0.5,
      }),
    [quality],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow material={material}>
      <planeGeometry args={DESK_SIZE} />
    </mesh>
  );
}
