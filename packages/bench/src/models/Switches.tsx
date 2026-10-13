// Tactile pushbutton (6 x 6 mm, four legs straddling the channel), slide switch and mini toggle switch (SPDT).

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PITCH, PUSHBUTTON, SLIDE, TOGGLE, TOGGLE_BASE } from "../dims";
import type { PartParamsMap } from "../types";
import { FONT, canvasTexture } from "../three/canvas";
import { bentTube, latheY, memoGeo, roundedBox } from "../three/geometry";
import { mat } from "../three/materials";
import { useEased } from "../three/anim";
import { IN_HOLE, type ModelProps } from "./common";

/** Upright multi-lead parts are modelled in board coordinates; on the desk they stand on their legs. */
export function UprightMount({ mount, cx, cz, children }: { mount: ModelProps<unknown>["mount"]; cx: number; cz: number; children: React.ReactNode }) {
  if (mount === "desk") return <group position={[-cx, -IN_HOLE, -cz]}>{children}</group>;
  return <group>{children}</group>;
}

/** Flat strip lead: from a point on the body down into a hole, via an optional horizontal run. */
function stripLeg(points: [number, number, number][], w = 0.7, t = 0.28): THREE.BufferGeometry {
  // A flattened tube reads as a stamped strip once scaled.
  const g = bentTube(points, 0.3, 0.35, 6);
  void w;
  void t;
  return g;
}

const CAP_HEX: Record<string, string> = { black: "#1f2023", red: "#d2352e", blue: "#2c5fc9", yellow: "#f1c22b", white: "#efede6" };

export function PushbuttonModel({ params, mount, pressed }: ModelProps<PartParamsMap["pushbutton"]>) {
  const B = PUSHBUTTON;
  const cx = PITCH;
  const cz = -1.5 * PITCH;
  const legs = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    for (const [x, z] of [
      [0, 0],
      [2 * PITCH, 0],
      [0, -3 * PITCH],
      [2 * PITCH, -3 * PITCH],
    ] as [number, number][]) {
      const zIn = z === 0 ? cz + B.body / 2 - 0.4 : cz - B.body / 2 + 0.4;
      out.push(stripLeg([[x, 0.9, zIn], [x, 0.9, z], [x, IN_HOLE, z]]));
    }
    return out;
  }, [B.body, cz]);
  const cap = useRef<THREE.Group>(null);
  useEased(pressed ? -B.travel : 0, (v) => {
    if (cap.current) cap.current.position.y = v;
  }, 30);
  return (
    <UprightMount mount={mount} cx={cx} cz={cz}>
      <group position={[cx, 0, cz]}>
        <mesh geometry={memoGeo("pb-body", () => roundedBox(B.body, B.bodyH, B.body, 0.35, 2))} material={mat.blackMatte()} position={[0, 0.2 + B.bodyH / 2, 0]} castShadow receiveShadow />
        <mesh geometry={memoGeo("pb-plate", () => roundedBox(B.body - 0.1, 0.25, B.body - 0.1, 0.1, 1))} material={mat.steel()} position={[0, 0.2 + B.bodyH + 0.12, 0]} castShadow />
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} geometry={memoGeo("pb-tab", () => new THREE.BoxGeometry(0.25, 1.6, 1.3))} material={mat.steel()} position={[sx * (B.body / 2 + 0.05), 0.2 + B.bodyH - 0.6, sz * 1.6]} />
          )),
        )}
        {/* Raised dimples on the plate corners. */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`d${sx}${sz}`} geometry={memoGeo("pb-dimple", () => new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2))} material={mat.steel()} position={[sx * 2.1, 0.2 + B.bodyH + 0.24, sz * 2.1]} />
          )),
        )}
        <group ref={cap}>
          <mesh geometry={memoGeo("pb-cap", () => latheY([[0.001, 0], [B.capDia / 2, 0], [B.capDia / 2, B.capH - 0.3], [B.capDia / 2 - 0.3, B.capH], [0.001, B.capH]], 32))} material={mat.plastic(CAP_HEX[params.cap ?? "black"] ?? "#1f2023", 0.5)} position={[0, 0.2 + B.bodyH + 0.24, 0]} castShadow />
        </group>
      </group>
      {legs.map((g, i) => (
        <mesh key={i} geometry={g} material={mat.lead()} castShadow />
      ))}
    </UprightMount>
  );
}

export function SlideSwitchModel({ params, mount }: ModelProps<PartParamsMap["slide-switch"]>) {
  const S = SLIDE;
  const cx = PITCH;
  const knob = useRef<THREE.Group>(null);
  useEased(params.to === "a" ? -S.throw / 2 : S.throw / 2, (v) => {
    if (knob.current) knob.current.position.x = v;
  }, 20);
  const legs = useMemo(
    () => [0, 1, 2].map((i) => stripLeg([[i * PITCH, 0.7, 0], [i * PITCH, IN_HOLE, 0]])),
    [],
  );
  const base = 0.5;
  return (
    <UprightMount mount={mount} cx={cx} cz={0}>
      <group position={[cx, base, 0]}>
        <mesh geometry={memoGeo("ss-base", () => roundedBox(S.len - 0.2, 1.2, S.wid - 0.2, 0.2, 2))} material={mat.blackMatte()} position={[0, 0.6, 0]} castShadow />
        <mesh geometry={memoGeo("ss-shell", () => roundedBox(S.len, S.h - 1.0, S.wid, 0.18, 2))} material={mat.steel()} position={[0, 1.0 + (S.h - 1.0) / 2, 0]} castShadow receiveShadow />
        {/* Slot in the top of the shell. */}
        <mesh position={[0, S.h + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat.darkInset()}>
          <planeGeometry args={[S.throw + S.knobL + 0.5, S.knobW + 0.3]} />
        </mesh>
        {/* Folded tabs on the ends. */}
        {[-1, 1].map((sx) => (
          <mesh key={sx} geometry={memoGeo("ss-tab", () => new THREE.BoxGeometry(0.3, 1.4, 1.6))} material={mat.steel()} position={[sx * (S.len / 2 + 0.1), 0.9, 0]} />
        ))}
        <group ref={knob}>
          <mesh geometry={memoGeo("ss-knob", () => roundedBox(S.knobL, S.knobH, S.knobW, 0.25, 2))} material={mat.plastic("#1d1e21", 0.4)} position={[0, S.h + S.knobH / 2 - 0.9, 0]} castShadow />
        </group>
      </group>
      {legs.map((g, i) => (
        <mesh key={i} geometry={g} material={mat.lead()} castShadow />
      ))}
    </UprightMount>
  );
}

function hexNut(): THREE.BufferGeometry {
  return memoGeo("tg-nut", () => {
    const g = new THREE.CylinderGeometry(4.5, 4.5, 1.9, 6);
    g.rotateY(Math.PI / 6);
    return g;
  });
}

function threadedBushing(): THREE.BufferGeometry {
  return memoGeo("tg-bushing", () => {
    const pts: [number, number][] = [[2.6, 0]];
    for (let y = 0.3; y < TOGGLE.bushingH - 0.3; y += 0.5) pts.push([3.0, y], [2.75, y + 0.25]);
    pts.push([3.0, TOGGLE.bushingH - 0.3], [2.7, TOGGLE.bushingH], [1.6, TOGGLE.bushingH]);
    return latheY(pts, 32);
  });
}

/** "ON" and "OFF" printed on the block's top plate, either side of the lever. */
function onOffTexture(): THREE.CanvasTexture {
  return canvasTexture("tg-onoff", 512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f4efe4";
    ctx.font = `700 64px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OFF", w * 0.17, h / 2);
    ctx.fillText("ON", w * 0.83, h / 2);
  });
}

/** A toggle switch panel-mounted in a small stained wooden block, with three brass screw terminals along the front. */
function BlockToggle({ to, throws = 2 }: { to: "a" | "b"; throws?: 1 | 2 }) {
  const B = TOGGLE_BASE;
  const T = TOGGLE;
  const lever = useRef<THREE.Group>(null);
  // Thrown to "b" the lever leans toward the "ON" side (com joins b, the usual wiring for an on/off switch).
  useEased(to === "b" ? -0.42 : 0.42, (v) => {
    if (lever.current) lever.current.rotation.z = v;
  }, 22);
  const top = B.h;
  return (
    <group>
      <mesh geometry={memoGeo("tgb-block", () => roundedBox(B.w, B.h, B.d, 2.2, 3))} material={mat.paint("#7a4a2a")} position={[0, B.h / 2, 0]} castShadow receiveShadow />
      {/* Black top plate with the ON and OFF marks. */}
      <mesh geometry={memoGeo("tgb-plate", () => roundedBox(B.w - 8, 0.8, 14, 1.2, 2))} material={mat.blackMatte()} position={[0, top + 0.4, B.switchZ]} receiveShadow />
      <mesh position={[0, top + 0.85, B.switchZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[B.w - 12, (B.w - 12) / 4]} />
        <meshBasicMaterial map={onOffTexture()} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group position={[0, top + 0.8, B.switchZ]}>
        <mesh geometry={memoGeo("tg-washer", () => new THREE.CylinderGeometry(4.6, 4.6, 0.45, 32))} material={mat.nickel()} position={[0, 0.25, 0]} />
        <mesh geometry={hexNut()} material={mat.chrome()} position={[0, 1.5, 0]} castShadow />
        <mesh geometry={threadedBushing()} material={mat.nickel()} position={[0, 0.4, 0]} castShadow />
        <group ref={lever} position={[0, T.bushingH - 0.8, 0]}>
          <mesh geometry={memoGeo("tgb-lever", () => latheY([[1.7, 0], [1.55, 5], [1.25, T.lever + 2], [0.001, T.lever + 2.3]], 20))} material={mat.chrome()} castShadow />
          <mesh geometry={memoGeo("tgb-tip", () => new THREE.SphereGeometry(1.7, 20, 14))} material={mat.chrome()} position={[0, T.lever + 1.9, 0]} castShadow />
        </group>
      </group>
      {/* Screw terminals: a, com, b (com and b only on an on/off switch). */}
      {(throws === 1 ? [-B.screwX / 2, B.screwX / 2] : [-B.screwX, 0, B.screwX]).map((x) => (
        <group key={x} position={[x, top, B.screwZ]}>
          <mesh geometry={memoGeo("tgb-pad", () => new THREE.BoxGeometry(7, 0.5, 6))} material={mat.brass()} position={[0, 0.25, 0]} receiveShadow />
          <mesh geometry={memoGeo("tgb-screw", () => new THREE.CylinderGeometry(2.1, 2.3, 1.6, 20))} material={mat.brass()} position={[0, 1.2, 0]} castShadow />
          <mesh geometry={memoGeo("tgb-slot", () => new THREE.BoxGeometry(3.4, 0.4, 0.6))} material={mat.darkInset()} position={[0, 2.05, 0]} />
        </group>
      ))}
    </group>
  );
}

export function ToggleSwitchModel({ params, mount }: ModelProps<PartParamsMap["toggle-switch"]>) {
  if (params.base && mount !== "board") return <BlockToggle to={params.to} throws={params.throws ?? 2} />;
  return <PanelToggle params={params} mount={mount} />;
}

function PanelToggle({ params, mount }: Pick<ModelProps<PartParamsMap["toggle-switch"]>, "params" | "mount">) {
  const T = TOGGLE;
  const cx = 2 * PITCH;
  const lever = useRef<THREE.Group>(null);
  // The lever leans away from the side it connects: pushed toward "b" it joins com to "a".
  useEased(params.to === "a" ? -0.36 : 0.36, (v) => {
    if (lever.current) lever.current.rotation.z = v;
  }, 22);
  const legs = useMemo(() => [0, 2, 4].map((i) => stripLeg([[i * PITCH, 1.2, 0], [i * PITCH, IN_HOLE, 0]])), []);
  const base = 0.8;
  const top = base + T.h;
  return (
    <UprightMount mount={mount} cx={cx} cz={0}>
      <group position={[cx, 0, 0]}>
        <mesh geometry={memoGeo("tg-body", () => roundedBox(T.len, T.h - 1.2, T.wid, 0.5, 2))} material={mat.blackGloss()} position={[0, base + (T.h - 1.2) / 2, 0]} castShadow receiveShadow />
        <mesh geometry={memoGeo("tg-frame", () => roundedBox(T.len + 0.4, 1.3, T.wid + 0.4, 0.2, 1))} material={mat.nickel()} position={[0, top - 0.6, 0]} castShadow />
        {/* Frame straps down the sides. */}
        {[-1, 1].map((sz) => (
          <mesh key={sz} geometry={memoGeo("tg-strap", () => new THREE.BoxGeometry(4.2, T.h - 1.0, 0.3))} material={mat.nickel()} position={[0, base + (T.h - 1.0) / 2, sz * (T.wid / 2 + 0.12)]} />
        ))}
        <mesh geometry={memoGeo("tg-washer", () => new THREE.CylinderGeometry(4.6, 4.6, 0.45, 32))} material={mat.nickel()} position={[0, top + 0.25, 0]} />
        <mesh geometry={hexNut()} material={mat.chrome()} position={[0, top + 1.5, 0]} castShadow />
        <mesh geometry={threadedBushing()} material={mat.nickel()} position={[0, top + 0.4, 0]} castShadow />
        <group ref={lever} position={[0, top + T.bushingH - 0.8, 0]}>
          <mesh geometry={memoGeo("tg-lever", () => latheY([[1.35, 0], [1.25, 4], [1.0, T.lever - 1.2], [0.001, T.lever - 1.0]], 20))} material={mat.chrome()} castShadow />
          <mesh geometry={memoGeo("tg-tip", () => new THREE.SphereGeometry(1.3, 20, 14))} material={mat.chrome()} position={[0, T.lever - 1.3, 0]} castShadow />
        </group>
      </group>
      {legs.map((g, i) => (
        <mesh key={i} geometry={g} material={mat.lead()} castShadow scale={[1, 1, 1]} />
      ))}
    </UprightMount>
  );
}
