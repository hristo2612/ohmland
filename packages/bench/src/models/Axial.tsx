// Axial parts: the 1/4 W resistor (colour bands from its value) and the 1N4001 / 1N4148 diodes.

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { BAND_HEX, resistorBands, type BandColor } from "../colorCode";
import { DIODE, LEAD_R, PITCH, RESISTOR, RESISTOR_1W, RESISTOR_5W } from "../dims";
import type { PartParamsMap } from "../types";
import { Scorch, Smoke } from "../effects/effects";
import { FONT, canvasTexture, rng } from "../three/canvas";
import { bentTube, latheY, memoGeo, roundedBox } from "../three/geometry";
import { mat } from "../three/materials";
import { keepColor } from "../three/paper";
import { IN_HOLE, healthOf, mix, type ModelProps } from "./common";

const HALF = RESISTOR.len / 2;
const CAP_R = RESISTOR.dia / 2;
const BODY_R = 1.06;
const TAIL = 0.32;

/** Dog-bone profile of a carbon film resistor, radius at position t along the axis. */
function resistorRadius(y: number): number {
  const t = Math.abs(y);
  if (t <= 1.7) return BODY_R;
  if (t <= 2.15) {
    const k = (t - 1.7) / 0.45;
    return BODY_R + (CAP_R - BODY_R) * k * k * (3 - 2 * k);
  }
  if (t <= 2.72) return CAP_R;
  if (t <= HALF) {
    const k = (t - 2.72) / (HALF - 2.72);
    return Math.max(0.46, CAP_R * Math.sqrt(Math.max(0, 1 - k * k * 0.92)));
  }
  // Lacquer meniscus where the lead leaves the cap.
  const k = Math.min(1, (t - HALF) / TAIL);
  return 0.46 + (LEAD_R + 0.01 - 0.46) * k;
}

/** Lathe along +y between y0 and y1 following the resistor profile, pushed out by `grow`. */
function resistorLathe(y0: number, y1: number, grow: number, n: number): THREE.LatheGeometry {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    pts.push([resistorRadius(y) + grow, y]);
  }
  return latheY(pts, 36);
}

/** Band centres along the body for 4 and 5 band parts; the tolerance band sits alone on the far cap. */
function bandLayout(n: number): { c: number; w: number }[] {
  if (n === 5) return [-2.42, -1.55, -0.72, 0.12, 2.42].map((c) => ({ c, w: 0.5 }));
  return [-2.36, -1.32, -0.42, 2.36].map((c, i) => ({ c, w: i === 3 ? 0.55 : 0.62 }));
}

function bandMaterial(color: BandColor, burnt: number): THREE.Material {
  const metal = color === "gold" || color === "silver";
  const hex = burnt > 0 ? mix(BAND_HEX[color], "#1d1510", burnt) : BAND_HEX[color];
  // The code must read exactly: the paper look leaves band colours alone.
  return keepColor(mat.paint(hex, metal && burnt < 0.5));
}

const BODY_HEX = { carbon: "#dcc49c", metal: "#86b2da" };

/** The part's real value (labs set `actualOhms`) lies outside its tolerance. */
const offSpec = (p: PartParamsMap["resistor"]): boolean =>
  p.actualOhms !== undefined && Math.abs(p.actualOhms - p.ohms) > (p.ohms * (p.tolerance ?? 5)) / 100;

/**
 * Resistor body (with bands) centred at the origin, axis along +x. A part whose real value is outside its tolerance
 * (`offSpec`, most likely overheated once) has a slightly darkened body.
 */
function ResistorBody({ ohms, bands, tolerance, burnt, offSpec = false }: { ohms: number; bands: 4 | 5; tolerance?: number; burnt: number; offSpec?: boolean }) {
  const colors = useMemo(() => {
    try {
      return resistorBands(ohms, bands, tolerance);
    } catch {
      return [] as BandColor[];
    }
  }, [ohms, bands, tolerance]);
  const layout = bandLayout(bands);
  const base = mix(bands === 5 ? BODY_HEX.metal : BODY_HEX.carbon, "#7d5a3a", offSpec ? 0.22 : 0);
  const bodyHex = burnt > 0 ? mix(base, burnt > 0.8 ? "#2a1e16" : "#6b4a2e", Math.min(1, burnt * 1.35)) : base;
  const body = memoGeo("res-body", () => resistorLathe(-HALF - TAIL, HALF + TAIL, 0, 90));
  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh geometry={body} material={mat.paint(bodyHex)} castShadow receiveShadow />
      {colors.map((c, i) => {
        const b = layout[i];
        if (!b) return null;
        const g = memoGeo(`res-band:${bands}:${i}`, () => resistorLathe(b.c - b.w / 2, b.c + b.w / 2, 0.022, 10));
        return <mesh key={i} geometry={g} material={bandMaterial(c, burnt)} castShadow />;
      })}
      {burnt > 0.8 && (
        // A hairline crack around the charred body.
        <mesh geometry={memoGeo("res-crack", () => resistorLathe(0.55, 0.68, 0.03, 4))} material={mat.basic("#0c0806")} />
      )}
    </group>
  );
}

/** Black epoxy DO-41 (1N4001) or glass DO-35 (1N4148) diode body centred at the origin, axis along +x. */
function DiodeBody({ model }: { model: "1N4001" | "1N4148" }) {
  if (model === "1N4148") {
    const L = 3.8;
    const R = 0.9;
    const glass = memoGeo("d35-glass", () =>
      latheY(
        [
          [LEAD_R * 0.9, -L / 2 - 0.25],
          [R * 0.75, -L / 2],
          [R, -L / 2 + 0.35],
          [R, L / 2 - 0.35],
          [R * 0.75, L / 2],
          [LEAD_R * 0.9, L / 2 + 0.25],
        ],
        28,
      ),
    );
    const band = memoGeo("d35-band", () => latheY([[R + 0.02, L / 2 - 1.0], [R + 0.02, L / 2 - 0.45]], 28));
    return (
      <group rotation={[0, 0, -Math.PI / 2]}>
        <mesh geometry={glass} material={mat.glossy("#e0703a")} castShadow />
        <mesh geometry={band} material={mat.paint("#151515")} />
      </group>
    );
  }
  const L = DIODE.len;
  const R = DIODE.dia / 2;
  const body = memoGeo("do41", () => {
    const pts: [number, number][] = [[DIODE.leadR + 0.05, -L / 2 - 0.15]];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      pts.push([R - 0.35 + Math.sin(a) * 0.35, -L / 2 + 0.35 - Math.cos(a) * 0.35]);
    }
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      pts.push([R - 0.35 + Math.cos(a) * 0.35, L / 2 - 0.35 + Math.sin(a) * 0.35]);
    }
    pts.push([DIODE.leadR + 0.05, L / 2 + 0.15]);
    return latheY(pts, 32);
  });
  const band = memoGeo("do41-band", () => latheY([[R + 0.012, L / 2 - 1.45], [R + 0.012, L / 2 - 0.6]], 32));
  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh geometry={body} material={mat.blackGloss()} castShadow receiveShadow />
      <mesh geometry={band} material={mat.paint("#b8bcc2", true)} />
    </group>
  );
}

type AxialSpec = { half: number; axisLift: number; deskLead: number; leadR: number };

/** Leads for an axial body centred between two holes `span` pitches apart, at height `axisY`. */
function AxialLeads({ spec, mount, span }: { spec: AxialSpec; mount: ModelProps<unknown>["mount"]; span: number }) {
  const L = span * PITCH;
  const r = spec.leadR;
  const geos = useMemo(() => {
    if (mount === "desk") {
      const ends = spec.half + spec.deskLead;
      return [
        bentTube([[-spec.half + 0.05, 0, 0], [-ends, 0, 0]], r, 0.5, 8),
        bentTube([[spec.half - 0.05, 0, 0], [ends, 0, 0]], r, 0.5, 8),
      ];
    }
    const y = spec.axisLift;
    const bottom = mount === "board" ? IN_HOLE : -9;
    if (L < spec.half * 2 + 1.6) {
      // Too short to lie flat: stand the part up over the first hole, second lead looped over the top.
      const top = spec.half * 2 + 0.9;
      return [
        bentTube([[0, 0.9, 0], [0, bottom, 0]], r, 0.5, 8),
        bentTube([[0, top - 0.1, 0], [0, top + 1.4, 0], [L, top + 1.4, 0], [L, bottom, 0]], r, Math.min(1.6, L / 2.2), 8),
      ];
    }
    const cx = L / 2;
    return [
      bentTube([[cx - spec.half + 0.05, y, 0], [0, y, 0], [0, bottom, 0]], r, 0.75, 8),
      bentTube([[cx + spec.half - 0.05, y, 0], [L, y, 0], [L, bottom, 0]], r, 0.75, 8),
    ];
  }, [mount, L, spec, r]);
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mat.lead()} castShadow />
      ))}
    </>
  );
}

function bodyPose(spec: AxialSpec, mount: ModelProps<unknown>["mount"], span: number): { pos: [number, number, number]; rot: [number, number, number] } {
  if (mount === "desk") return { pos: [0, spec.axisLift, 0], rot: [0, 0, 0] };
  const L = span * PITCH;
  if (L < spec.half * 2 + 1.6) return { pos: [0, 0.9 + spec.half, 0], rot: [0, 0, Math.PI / 2] };
  return { pos: [L / 2, spec.axisLift, 0], rot: [0, 0, 0] };
}

function ceramicTexture(ohms: number, watts: number): THREE.CanvasTexture {
  const value = ohms >= 1000 ? `${Number((ohms / 1000).toPrecision(3))}K` : `${Number(ohms.toPrecision(3))}R`;
  return canvasTexture(`ceramic-res:${ohms}:${watts}`, 512, 220, (ctx, w, h) => {
    ctx.fillStyle = "#f1eee6";
    ctx.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(120,110,95,${r() * 0.12})`;
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
    ctx.fillStyle = "#2b2f3a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 84px ${FONT}`;
    ctx.fillText(`${watts}W ${value}J`, w / 2, h / 2 + 4);
  });
}

/** A ceramic (cement) power resistor: a white block with its rating printed on top, leads out of the ends. */
function CeramicResistor({ params, burnt, health }: { params: PartParamsMap["resistor"]; burnt: number; health: string }) {
  const L = RESISTOR_5W.len;
  const W = RESISTOR_5W.w;
  const top = useMemo(() => new THREE.MeshStandardMaterial({ map: ceramicTexture(params.ohms, Math.round(params.watts ?? 5)), roughness: 0.9 }), [params.ohms, params.watts]);
  useLayoutEffect(() => () => top.dispose(), [top]);
  const ends = RESISTOR_5W.len / 2 + RESISTOR_5W.deskLead;
  return (
    <group>
      <group position={[0, W / 2, 0]}>
        <mesh geometry={memoGeo("ceramic-res", () => roundedBox(L, W, W, 0.9, 2))} material={mat.plastic(burnt > 0 ? mix("#efece4", "#4a3a2c", burnt * 0.8) : "#efece4", 0.92)} castShadow receiveShadow />
        <mesh material={top} position={[0, W / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[L - 2, (L - 2) * (220 / 512)]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={memoGeo("ceramic-lead", () => bentTube([[L / 2 - 0.5, 0, 0], [ends, 0, 0]], 0.4, 0.5, 8))} material={mat.lead()} scale={[s, 1, 1]} castShadow />
        ))}
        {(health === "smoking" || health === "dead") && (
          <group position={[0, W / 2, 0]}>
            <Smoke active amount={health === "smoking" ? 1 : 0.15} spread={8} />
          </group>
        )}
      </group>
    </group>
  );
}

export function ResistorModel({ params, mount, span = 4, state }: ModelProps<PartParamsMap["resistor"]>) {
  const health = healthOf(state);
  const burnt = health === "dead" ? 1 : health === "smoking" ? 0.55 : health === "hot" ? 0.18 : 0;
  const watts = params.watts ?? 0.25;
  if (mount === "desk" && watts >= 2) return <CeramicResistor params={params} burnt={burnt} health={health} />;
  if (mount === "desk" && watts >= 0.75) {
    // A 1 W film resistor: the same shape, bigger, with longer, thicker leads.
    const k = RESISTOR_1W.len / RESISTOR.len;
    const spec: AxialSpec = { half: (HALF + TAIL) * k, axisLift: RESISTOR_1W.dia / 2, deskLead: RESISTOR_1W.deskLead, leadR: LEAD_R * 1.4 };
    return (
      <group>
        <group position={[0, spec.axisLift, 0]} scale={[k, k, k]}>
          <ResistorBody ohms={params.ohms} bands={params.bands ?? 4} tolerance={params.tolerance} burnt={burnt} offSpec={offSpec(params)} />
        </group>
        {(health === "smoking" || health === "dead") && (
          <group position={[0, spec.axisLift * 2, 0]}>
            <Smoke active amount={health === "smoking" ? 1 : 0.15} spread={6} />
          </group>
        )}
        <group position={[0, spec.axisLift, 0]}>
          <AxialLeads spec={spec} mount={mount} span={span} />
        </group>
      </group>
    );
  }
  const spec: AxialSpec = {
    half: HALF + TAIL,
    axisLift: mount === "desk" ? CAP_R : RESISTOR.lift + CAP_R,
    deskLead: RESISTOR.deskLead,
    leadR: LEAD_R,
  };
  const pose = bodyPose(spec, mount, span);
  return (
    <group>
      <group position={pose.pos} rotation={pose.rot}>
        <ResistorBody ohms={params.ohms} bands={params.bands ?? 4} tolerance={params.tolerance} burnt={burnt} offSpec={offSpec(params)} />
        {(health === "smoking" || health === "dead") && (
          <group position={[0, CAP_R, 0]}>
            <Smoke active amount={health === "smoking" ? 1 : 0.15} spread={4} />
          </group>
        )}
      </group>
      {mount === "board" && health === "dead" && (
        <group position={[pose.pos[0], 0, 0]}>
          <Scorch width={13} depth={7} />
        </group>
      )}
      <group position={mount === "desk" ? [0, spec.axisLift, 0] : [0, 0, 0]}>
        <AxialLeads spec={spec} mount={mount} span={span} />
      </group>
    </group>
  );
}

export function DiodeModel({ params, mount, span = 4 }: ModelProps<PartParamsMap["diode"]>) {
  const model = params.model ?? "1N4001";
  const glass = model === "1N4148";
  const R = glass ? 0.9 : DIODE.dia / 2;
  const spec: AxialSpec = {
    half: (glass ? 3.8 : DIODE.len) / 2 + 0.15,
    axisLift: mount === "desk" ? R : DIODE.lift + R,
    deskLead: DIODE.deskLead,
    leadR: glass ? 0.25 : DIODE.leadR,
  };
  const pose = bodyPose(spec, mount, span);
  return (
    <group>
      <group position={pose.pos} rotation={pose.rot}>
        <DiodeBody model={model} />
      </group>
      <group position={mount === "desk" ? [0, spec.axisLift, 0] : [0, 0, 0]}>
        <AxialLeads spec={spec} mount={mount} span={span} />
      </group>
    </group>
  );
}
