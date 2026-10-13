// Readouts floating over parts (lab instruments): an LED's stress bar (its current as a share of its maximum) and a
// part's temperature with a touch-feel word. They face the camera and read their part's state from the store.

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import { useLabels } from "../labels";
import { partPose } from "../layout";
import { useBench, type BenchStoreState, type InspectSpec } from "../store";
import { FONT, makeCanvas } from "../three/canvas";
import type { BenchState, PlacedPart } from "../types";

/** Parts a readout spec covers: by id or by kind. */
function covered(bench: BenchState, spec: InspectSpec): PlacedPart[] {
  return bench.parts.filter((p) => spec.parts.includes(p.id) || spec.parts.includes(p.kind));
}

const stressOf = (s: BenchStoreState, id: string) => {
  const p = s.snapshot?.parts[id];
  if (!p) return 0;
  return typeof p.extra?.["stress"] === "number" ? (p.extra["stress"] as number) : 0;
};

/** What the readouts show, as a string: unchanged means nothing to redraw. */
export function inspectKey(s: BenchStoreState): string {
  let out = "";
  for (const spec of s.inspect) {
    for (const p of covered(s.bench, spec)) {
      const st = s.snapshot?.parts[p.id];
      out += spec.show === "stress" ? `${p.id}:${Math.round(stressOf(s, p.id) * 40)}:${st?.health}` : `${p.id}:${Math.round(st?.temp ?? 25)}`;
    }
  }
  return out;
}

export function Readouts({ bench, inspect }: { bench: BenchState; inspect: readonly InspectSpec[] }) {
  return (
    <>
      {inspect.flatMap((spec) =>
        covered(bench, spec).map((p) => {
          const pose = partPose(bench, p);
          const lift = p.kind === "led" ? 16 : p.kind === "resistor" ? 13 : 20;
          const at: [number, number, number] = [pose.origin[0], pose.origin[1] + lift, pose.origin[2]];
          return spec.show === "stress" ? <StressBar key={`s:${p.id}`} id={p.id} at={at} /> : <HeatTag key={`h:${p.id}`} id={p.id} at={at} />;
        }),
      )}
    </>
  );
}

const BAR_W = 24;
const BAR_H = 3.6;

function StressBar({ id, at }: { id: string; at: [number, number, number] }) {
  const level = useBench((s) => Math.round(Math.min(1, stressOf(s, id)) * 40) / 40);
  const dead = useBench((s) => s.snapshot?.parts[id]?.health === "dead");
  const back = useMemo(() => new THREE.MeshBasicMaterial({ color: "#1d2128", transparent: true, opacity: 0.8, depthTest: false, toneMapped: false }), []);
  const fill = useMemo(() => new THREE.MeshBasicMaterial({ color: "#3cb862", depthTest: false, toneMapped: false }), []);
  useLayoutEffect(
    () => () => {
      back.dispose();
      fill.dispose();
    },
    [back, fill],
  );
  fill.color.set(dead ? "#7d8088" : level >= 0.9 ? "#e5483b" : level >= 0.5 ? "#f2a33a" : "#3cb862");
  const w = Math.max(0.001, (BAR_W - 1) * (dead ? 1 : level));
  return (
    <Billboard position={at}>
      <mesh material={back} renderOrder={40}>
        <planeGeometry args={[BAR_W + 1.2, BAR_H + 1.2]} />
      </mesh>
      <mesh material={fill} position={[-(BAR_W - 1) / 2 + w / 2, 0, 0.01]} renderOrder={41}>
        <planeGeometry args={[w, BAR_H - 0.6]} />
      </mesh>
      {/* Ticks at half and nine tenths of the maximum. */}
      {[0.5, 0.9].map((k) => (
        <mesh key={k} material={back} position={[-(BAR_W - 1) / 2 + (BAR_W - 1) * k, 0, 0.02]} renderOrder={42}>
          <planeGeometry args={[0.35, BAR_H - 0.4]} />
        </mesh>
      ))}
    </Billboard>
  );
}

function feel(temp: number): "cool" | "warm" | "hot" | "ouch" {
  return temp < 35 ? "cool" : temp < 50 ? "warm" : temp < 70 ? "hot" : "ouch";
}

const FEEL_HEX = { cool: "#2f6fd6", warm: "#c98a12", hot: "#e0622a", ouch: "#d3282b" };

function HeatTag({ id, at }: { id: string; at: [number, number, number] }) {
  const labels = useLabels();
  const temp = useBench((s) => Math.round(s.snapshot?.parts[id]?.temp ?? 25));
  const { canvas: c, texture } = useMemo(() => {
    const canvas = makeCanvas(320, 96);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture: t };
  }, []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false }), [texture]);
  useLayoutEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );
  useLayoutEffect(() => {
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const f = feel(temp);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(255,253,247,0.94)";
    const r = 40;
    ctx.beginPath();
    ctx.roundRect(4, 4, c.width - 8, c.height - 8, r);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = FEEL_HEX[f];
    ctx.stroke();
    ctx.fillStyle = "#1f2a44";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText(`${temp} °C`, 26, c.height / 2 + 2);
    ctx.fillStyle = FEEL_HEX[f];
    ctx.textAlign = "right";
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(labels.heat[f], c.width - 26, c.height / 2 + 2);
    texture.needsUpdate = true;
  }, [temp, c, texture, labels]);
  return (
    <Billboard position={at}>
      <mesh material={material} renderOrder={40}>
        <planeGeometry args={[30, 9]} />
      </mesh>
    </Billboard>
  );
}
