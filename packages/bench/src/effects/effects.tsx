// Simulation-driven effects: smoke, LED halos, light spill and scorch marks.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { canvasTexture, glowTexture, rng, smokeTexture } from "../three/canvas";
import { prefersReducedMotion } from "../three/anim";

const SMOKE_VERT = /* glsl */ `
attribute vec3 offset;
attribute float size;
attribute float alpha;
attribute float spin;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(offset, 1.0);
  float c = cos(spin);
  float s = sin(spin);
  mv.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * size;
  gl_Position = projectionMatrix * mv;
}
`;

const SMOKE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 color;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(color, t.a * vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; spin: number; vs: number };

/**
 * Rising smoke from a point (local coordinates). `amount` 0..1 scales the emission rate and darkness.
 * Keeps the canvas rendering while particles are alive.
 */
export function Smoke({ active, amount = 1, dark = false, spread = 2 }: { active: boolean; amount?: number; dark?: boolean; spread?: number }) {
  const N = 48;
  const invalidate = useThree((s) => s.invalidate);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const { geometry, material, parts } = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.attributes.position!);
    g.setAttribute("uv", quad.attributes.uv!);
    g.setAttribute("offset", new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("size", new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("alpha", new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("spin", new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = N;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 30, 0), 80);
    const m = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      uniforms: { map: { value: smokeTexture() }, color: { value: new THREE.Color(dark ? "#3b3836" : "#b4aea6") } },
      transparent: true,
      depthWrite: false,
    });
    const r = rng(Math.floor(Math.random() * 1e6));
    const ps: Particle[] = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 1, life: 0, spin: r() * 6, vs: (r() - 0.5) * 0.8 }));
    return { geometry: g, material: m, parts: ps };
  }, [dark]);
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const emitAcc = useRef(0);
  const alive = useRef(0);
  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (!active && alive.current === 0) return;
    const rate = reduced ? 3 : 10 + 14 * amount;
    if (active) emitAcc.current += dt * rate;
    const off = geometry.attributes.offset as THREE.InstancedBufferAttribute;
    const size = geometry.attributes.size as THREE.InstancedBufferAttribute;
    const alpha = geometry.attributes.alpha as THREE.InstancedBufferAttribute;
    const spin = geometry.attributes.spin as THREE.InstancedBufferAttribute;
    let count = 0;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const p = parts[i]!;
      if (p.age >= p.life && emitAcc.current >= 1) {
        emitAcc.current -= 1;
        p.x = (Math.random() - 0.5) * spread;
        p.y = 0;
        p.z = (Math.random() - 0.5) * spread;
        p.vx = (Math.random() - 0.5) * 3;
        p.vy = 7 + Math.random() * 6;
        p.vz = (Math.random() - 0.5) * 3;
        p.age = 0;
        p.life = 2.2 + Math.random() * 1.6;
      }
      if (p.age < p.life) {
        p.age += dt;
        const k = p.age / p.life;
        // Gentle curl: sideways drift that grows with height.
        p.vx += Math.sin(t * 1.3 + i) * dt * 2.2;
        p.vz += Math.cos(t * 1.1 + i * 0.7) * dt * 2.2;
        p.x += p.vx * dt;
        p.y += p.vy * dt * (1 - k * 0.5);
        p.z += p.vz * dt;
        p.spin += p.vs * dt;
        off.setXYZ(i, p.x, p.y, p.z);
        size.setX(i, 3.5 + k * 18);
        const fadeIn = Math.min(1, k * 6);
        alpha.setX(i, (dark ? 0.85 : 1.25) * fadeIn * (1 - k) * (0.6 + 0.4 * amount));
        spin.setX(i, p.spin);
        count++;
      } else {
        alpha.setX(i, 0);
      }
    }
    alive.current = count;
    off.needsUpdate = true;
    size.needsUpdate = true;
    alpha.needsUpdate = true;
    spin.needsUpdate = true;
    if (active || count > 0) invalidate();
  });
  useLayoutEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />;
}

/** Additive halo sprite around a lit LED (cheap glow, also used under bloom for a softer edge). */
export function Halo({ color, intensity, size = 16 }: { color: string; intensity: number; size?: number }) {
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        toneMapped: false,
      }),
    [color],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  material.opacity = Math.min(1, intensity);
  const s = size * (0.45 + 0.55 * Math.min(1, intensity));
  if (intensity <= 0.01) return null;
  return <sprite material={material} scale={[s, s, s]} renderOrder={12} />;
}

/** Coloured light pooling on the surface below a lit LED. */
export function LightSpill({ color, intensity, radius = 10 }: { color: string; intensity: number; radius?: number }) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [color],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  material.opacity = Math.min(1, intensity) * 0.55;
  if (intensity <= 0.01) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} material={material} renderOrder={4}>
      <planeGeometry args={[radius * 2, radius * 2]} />
    </mesh>
  );
}

function scorchTexture(): THREE.CanvasTexture {
  return canvasTexture("scorch", 256, 256, (ctx, w, h) => {
    const r = rng(99);
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * w * 0.22;
      const x = w / 2 + Math.cos(a) * d * 1.4;
      const y = h / 2 + Math.sin(a) * d * 0.7;
      const rad = w * (0.05 + r() * 0.16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(30,18,10,${0.16 + r() * 0.16})`);
      g.addColorStop(1, "rgba(30,18,10,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

/** A brown-black burn mark on the surface (dead resistors, blown parts). */
export function Scorch({ width = 12, depth = 7, opacity = 1 }: { width?: number; depth?: number; opacity?: number }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: scorchTexture(),
        transparent: true,
        depthWrite: false,
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  material.opacity = opacity;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} material={material} renderOrder={3}>
      <planeGeometry args={[width, depth]} />
    </mesh>
  );
}
