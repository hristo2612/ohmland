// Readouts floating over parts (lab instruments): an LED's stress bar (its current as a share of its maximum) and a
// part's temperature with a touch-feel word. The temperature faces the camera in the scene; the stress bar is a small
// paper tag in the page above the part, as in the ink view, so it reads on paper in either theme.

import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import { useLabels } from "../labels";
import { partPose } from "../layout";
import { useBench, type BenchStoreState, type InspectSpec } from "../store";
import type { ScreenPoint } from "../view/controller";
import { STRESS_MARK, stressPoint } from "../view/targets";
import { FONT, makeCanvas } from "../three/canvas";
import type { BenchState, PlacedPart, Vec3 } from "../types";

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

/** Where a readout floats: a little above the part. */
function readoutAt(bench: BenchState, p: PlacedPart): Vec3 {
  const pose = partPose(bench, p);
  const lift = p.kind === "led" ? 12 : p.kind === "resistor" ? 13 : 20;
  return [pose.origin[0], pose.origin[1] + lift, pose.origin[2]];
}

/** The temperature tags, in the scene. */
export function Readouts({ bench, inspect }: { bench: BenchState; inspect: readonly InspectSpec[] }) {
  return (
    <>
      {inspect.flatMap((spec) => (spec.show === "stress" ? [] : covered(bench, spec).map((p) => <HeatTag key={`h:${p.id}`} id={p.id} at={readoutAt(bench, p)} />)))}
    </>
  );
}

/** Projects a world point to the bench element (CSS px), and tells when the view moves. */
type Projector = { project(p: Vec3): ScreenPoint | null; onViewChange(cb: () => void): () => void };

/**
 * The stress bars, as small paper tags in the page above their parts (the ink view's look): green, then orange from
 * half the maximum, red from nine tenths, grey when the part is dead. Ticks mark half and nine tenths.
 */
export function StressTags({ controller, spot, compact }: { controller: Projector; spot: readonly string[] | null; compact: boolean }) {
  const bench = useBench((s) => s.bench);
  const inspect = useBench((s) => s.inspect);
  const ids = inspect.flatMap((spec) => (spec.show === "stress" ? covered(bench, spec).map((p) => p.id) : []));
  if (!ids.length) return null;
  return (
    <div className="ohb-readouts" data-compact={compact || undefined} aria-hidden="true">
      {[...new Set(ids)].map((id) => (
        <StressTag key={id} id={id} controller={controller} spotted={!!spot?.includes(`part:${id}/${STRESS_MARK}`)} />
      ))}
    </div>
  );
}

const StressTag = memo(function StressTag({ id, controller, spotted }: { id: string; controller: Projector; spotted: boolean }) {
  const level = useBench((s) => Math.round(Math.min(1, stressOf(s, id)) * 40) / 40);
  const dead = useBench((s) => s.snapshot?.parts[id]?.health === "dead");
  const bench = useBench((s) => s.bench);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = () => {
      const el = ref.current;
      const p = bench.parts.find((x) => x.id === id);
      // At the bar's own mark (part:D1/stress), the same desk point as in ink, centred on it.
      const sp = p ? controller.project(stressPoint(bench, p)) : null;
      if (!el) return;
      el.style.visibility = sp && sp.visible ? "" : "hidden";
      if (sp) el.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%, -50%)`;
    };
    place();
    return controller.onViewChange(place);
  }, [controller, bench, id]);
  const tone = dead ? "dead" : level >= 0.9 ? "high" : level >= 0.5 ? "mid" : "low";
  return (
    <div ref={ref} className="ohb-stress" data-tone={tone} data-spot={spotted || undefined} style={{ visibility: "hidden" }}>
      <i style={{ width: `${(dead ? 1 : level) * 100}%` }} />
      <b style={{ left: "50%" }} />
      <b style={{ left: "90%" }} />
    </div>
  );
});

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
