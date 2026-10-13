// Ceramic disc capacitor (with its three-digit code) and aluminium electrolytic (size by value, minus stripe,
// shorter negative lead, bulging or burst when abused).

import { useMemo } from "react";
import * as THREE from "three";
import { CERAMIC, PITCH, electrolyticSize } from "../dims";
import type { PartParamsMap } from "../types";
import { ceramicCode, formatFarads } from "../colorCode";
import { FONT, canvasTexture } from "../three/canvas";
import { bentTube, latheY, memoGeo } from "../three/geometry";
import { mat } from "../three/materials";
import { Smoke } from "../effects/effects";
import { IN_HOLE, RadialMount, healthOf, type ModelProps } from "./common";

// ---------------------------------------------------------------------------------------------------------------

function ceramicHex(farads: number): string {
  if (farads < 1e-9) return "#c97a33";
  if (farads < 1e-6) return "#3c66b4";
  return "#e2b43d";
}

function discGeometry(): THREE.BufferGeometry {
  return memoGeo("cer-disc", () => {
    const R = CERAMIC.dia / 2;
    const T = CERAMIC.thick / 2;
    const pts: [number, number][] = [[0.001, -T]];
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      pts.push([R - 0.9 + Math.cos(a) * 0.9 + (1 - Math.abs(Math.sin(a))) * 0.05, Math.sin(a) * T * 0.92]);
    }
    pts.push([0.001, T]);
    const g = latheY(pts, 40);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

function codeTexture(code: string, hex: string): THREE.Texture {
  return canvasTexture(`cer-code:${code}:${hex}`, 128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(245,240,225,0.92)";
    ctx.font = `800 ${code.length > 3 ? 34 : 44}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(code, w / 2, h / 2 - 6);
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText("50V", w / 2, h / 2 + 30);
  });
}

export function CeramicCapModel({ params, mount, span }: ModelProps<PartParamsMap["ceramic-cap"]>) {
  const hex = ceramicHex(params.farads);
  const code = ceramicCode(params.farads);
  const R = CERAMIC.dia / 2;
  // Legs bent out (or in) to reach holes `span` apart on the board.
  const half = ((mount === "board" ? span ?? 2 : 2) * PITCH) / 2;
  const splay = Math.max(0, half - PITCH);
  const base = mount === "board" ? CERAMIC.standoff + Math.min(4, splay * 0.35) : 0;
  const discY = base + 1.1 + R;
  const legs = useMemo(() => {
    const bottom = mount === "board" ? IN_HOLE - base : mount === "desk" ? -CERAMIC.deskLead : -11;
    return [-1, 1].map((s) =>
      bentTube(
        [
          [s * 1.25, discY - R + 0.6, 0],
          [s * 1.25, base + 0.9, 0],
          [s * half, base - 0.4 - Math.min(2, splay * 0.2), 0],
          [s * half, base + bottom, 0],
        ],
        0.25,
        0.5,
        8,
      ),
    );
  }, [mount, base, discY, R, half, splay]);
  const decal = useMemo(
    () => new THREE.MeshStandardMaterial({ map: codeTexture(code, hex), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
    [code, hex],
  );
  return (
    <RadialMount mount={mount} centerX={half} deskAxis={CERAMIC.thick / 2} layFlat="down">
      <mesh geometry={discGeometry()} material={mat.glossy(hex)} position={[0, discY, 0]} castShadow receiveShadow />
      {/* Coating that ran down the leads when the disc was dipped. */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={memoGeo("cer-drip", () => latheY([[0.65, 0], [0.36, 1.6], [0.26, 2.2]], 14))} material={mat.glossy(hex)} position={[s * 1.25, discY - R + 0.9, 0]} rotation={[Math.PI, 0, 0]} />
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} material={decal} position={[0, discY, s * (CERAMIC.thick / 2 - 0.02)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[3.8, 3.8]} />
        </mesh>
      ))}
      {legs.map((g, i) => (
        <mesh key={i} geometry={g} material={mat.lead()} castShadow />
      ))}
    </RadialMount>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function sleeveTexture(label: string, volts: string): THREE.Texture {
  return canvasTexture(`elec-sleeve:${label}:${volts}`, 1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#1b2b63");
    g.addColorStop(0.5, "#24387c");
    g.addColorStop(1, "#1b2b63");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Minus stripe centred at u = 0.75 (the +x side, where the negative lead is).
    const sx = w * 0.75;
    const sw = w * 0.16;
    ctx.fillStyle = "#a9bde3";
    ctx.fillRect(sx - sw / 2, 0, sw, h);
    ctx.fillStyle = "#1b2b63";
    for (let y = h * 0.12; y < h * 0.95; y += h * 0.16) ctx.fillRect(sx - sw * 0.3, y, sw * 0.6, h * 0.035);
    // Value text, written up the can on the front (u = 0.5).
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#f1f3f8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${h * 0.15}px ${FONT}`;
    ctx.fillText(label, 0, -h * 0.05);
    ctx.font = `700 ${h * 0.11}px ${FONT}`;
    ctx.fillText(volts, 0, h * 0.12);
    ctx.restore();
    ctx.save();
    ctx.translate(w * 0.25, h * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(241,243,248,0.9)";
    ctx.textAlign = "center";
    ctx.font = `700 ${h * 0.09}px ${FONT}`;
    ctx.fillText("105°C", 0, 0);
    ctx.restore();
  });
}

function topTexture(state: "ok" | "bulged" | "burst"): THREE.Texture {
  return canvasTexture(`elec-top:${state}`, 256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "#dfe2e6");
    g.addColorStop(1, "#b9bdc3");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Scored vent (a cross), so pressure splits the top along clean lines.
    ctx.strokeStyle = state === "burst" ? "#2b1c12" : "rgba(80,85,92,0.65)";
    ctx.lineWidth = state === "burst" ? 9 : 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h / 2);
    ctx.lineTo(w * 0.78, h / 2);
    ctx.moveTo(w / 2, h * 0.22);
    ctx.lineTo(w / 2, h * 0.78);
    ctx.stroke();
    if (state !== "ok") {
      const r = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.4);
      r.addColorStop(0, state === "burst" ? "rgba(70,40,15,0.9)" : "rgba(120,90,60,0.35)");
      r.addColorStop(1, "rgba(70,40,15,0)");
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

export function ElectrolyticModel({ params, mount, state, span }: ModelProps<PartParamsMap["electrolytic-cap"]>) {
  const size = electrolyticSize(params.farads, params.volts);
  const R = size.d / 2;
  const H = size.h;
  const health = healthOf(state);
  const top: "ok" | "bulged" | "burst" = health === "dead" ? "burst" : health === "smoking" ? "bulged" : "ok";
  // Legs bent out to reach holes `span` apart: the can stands a little higher the wider they splay.
  const spanP = mount === "board" ? span ?? size.pitch : size.pitch;
  const splay = Math.max(0, (spanP * PITCH) / 2 - size.lead / 2);
  const base = mount === "board" ? 0.5 + Math.min(5, splay * 0.55) : 0;
  const lead = size.lead;
  const label = formatFarads(params.farads).replace(" ", "");
  const volts = `${params.volts ?? 16}V`;
  const sleeve = useMemo(
    () => new THREE.MeshPhysicalMaterial({ map: sleeveTexture(label, volts), roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    [label, volts],
  );
  const topMat = useMemo(() => new THREE.MeshStandardMaterial({ map: topTexture(top), metalness: 0.8, roughness: 0.35 }), [top]);
  const can = memoGeo(`elec-can:${R}:${H}`, () => {
    // Sleeve wraps the can from the bottom bead to the rolled top edge.
    const g = new THREE.CylinderGeometry(R, R, H - 1.6, 48, 1, true, Math.PI);
    g.translate(0, 0.9 + (H - 1.6) / 2, 0);
    return g;
  });
  const shoulders = memoGeo(`elec-shoulder:${R}:${H}`, () =>
    latheY(
      [
        [R - 0.6, 0],
        [R - 0.2, 0.15],
        [R, 0.5],
        [R, 0.9],
        [R - 0.01, 0.95],
      ],
      48,
    ),
  );
  const rim = memoGeo(`elec-rim:${R}:${H}`, () =>
    latheY(
      [
        [R - 0.01, H - 0.75],
        [R, H - 0.7],
        [R - 0.05, H - 0.3],
        [R - 0.4, H],
        [R - 0.75, H - 0.05],
        [R - 0.8, H - 0.25],
      ],
      48,
    ),
  );
  const bead = memoGeo(`elec-bead:${R}`, () => {
    const g = new THREE.TorusGeometry(R - 0.12, 0.2, 8, 48);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const topDisc = memoGeo(`elec-top:${R}:${H}:${top}`, () => {
    const rr = R - 0.75;
    if (top === "ok") {
      const g = new THREE.CircleGeometry(rr, 40);
      g.rotateX(-Math.PI / 2);
      g.translate(0, H - 0.25, 0);
      return g;
    }
    // Domed top (bulging) or a split, torn dome (burst).
    const g = new THREE.SphereGeometry(rr * 1.6, 40, 12, 0, Math.PI * 2, 0, Math.asin(1 / 1.6));
    const lift = top === "burst" ? 1.6 : 1.0;
    const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) - rr * 1.6 * Math.cos(Math.asin(1 / 1.6));
      p.setY(i, (y / (rr * 1.6 - rr * 1.6 * Math.cos(Math.asin(1 / 1.6)))) * lift);
    }
    g.computeVertexNormals();
    g.translate(0, H - 0.25, 0);
    // UVs for the planar texture.
    const uv = g.attributes.uv!;
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * rr), 0.5 - p.getZ(i) / (2 * rr));
    return g;
  });
  const legs = useMemo(() => {
    const bottom = mount === "board" ? IN_HOLE - base : mount === "desk" ? -16 : -13;
    const bottomNeg = mount === "board" ? IN_HOLE - base : mount === "desk" ? -14 : -11;
    const half = (spanP * PITCH) / 2;
    const out = [
      [-lead / 2, -half, bottom],
      [lead / 2, half, bottomNeg],
    ] as const;
    return out.map(([x0, x1, b]) =>
      bentTube(
        [
          [x0, 0.4, 0],
          [x0, -0.3, 0],
          [x1, Math.max(b + 1.2, Math.min(-0.9, -Math.abs(x1 - x0) * 0.6 - 0.4)), 0],
          [x1, b, 0],
        ],
        0.28,
        0.6,
        8,
      ),
    );
  }, [mount, base, lead, spanP]);
  const burst = top === "burst";
  return (
    <RadialMount mount={mount} centerX={(spanP * PITCH) / 2} deskAxis={R}>
      <group position={[0, base, 0]}>
        <mesh geometry={memoGeo(`elec-seal:${R}`, () => new THREE.CylinderGeometry(R - 0.5, R - 0.6, 0.5, 40))} material={mat.blackMatte()} position={[0, 0.2, 0]} />
        <mesh geometry={shoulders} material={sleeve} castShadow />
        <mesh geometry={can} material={sleeve} castShadow receiveShadow />
        <mesh geometry={bead} material={sleeve} position={[0, 1.15, 0]} />
        <mesh geometry={rim} material={mat.aluminium()} castShadow />
        <mesh geometry={topDisc} material={topMat} castShadow />
        {burst && (
          <>
            {/* Paper separator poking out of the split vent, and brown electrolyte crust. */}
            <mesh geometry={memoGeo("elec-fluff", () => new THREE.IcosahedronGeometry(1.0, 1))} material={mat.plastic("#e9e1cf", 0.9)} position={[0.4, H + 1.4, -0.2]} scale={[1.2, 0.7, 1]} />
            <mesh geometry={memoGeo("elec-crust", () => new THREE.TorusGeometry(R * 0.55, 0.35, 6, 24))} material={mat.plastic("#5a3a1e", 0.8)} position={[0, H + 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} />
          </>
        )}
        {(health === "smoking" || burst) && (
          <group position={[0, H + 1.5, 0]}>
            <Smoke active amount={burst ? 0.2 : 0.8} spread={R} />
          </group>
        )}
        {legs.map((g, i) => (
          <mesh key={i} geometry={g} material={mat.lead()} castShadow />
        ))}
      </group>
    </RadialMount>
  );
}
