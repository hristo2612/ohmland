// Desk modules: a part mounted on a small stained wooden block with brass screw terminals along its front edge, so
// test leads clip on easily (a relay, a slide switch, a DPDT switch, a pushbutton, a panel pot). Terminal names are
// printed on the front of the block; a mystery part shows only numbers until someone peeks inside.

import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { BLOCK, blockPitch, blockWidth } from "../dims";
import { blockTerminals, partLegs, terminalNumber, wiredAs } from "../parts";
import type { PartParamsMap, Quality } from "../types";
import { FONT, canvasTexture } from "../three/canvas";
import { latheY, memoGeo, roundedBox } from "../three/geometry";
import { mat } from "../three/materials";
import { useEased } from "../three/anim";
import { RelayBody } from "./Misc";

const WOOD = "#7a4a2a";

/** Printed names along the front face of a block, one under each terminal. */
function namesTexture(width: number, xs: number[], names: string[]): THREE.Texture {
  const W = 1024;
  const H = 160;
  return canvasTexture(`blk-names:${width}:${xs.join(",")}:${names.join("|")}`, W, H, (ctx) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f4efe4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const longest = Math.max(...names.map((n) => n.length), 1);
    const size = longest > 6 ? 46 : longest > 3 ? 58 : 76;
    ctx.font = `800 ${size}px ${FONT}`;
    names.forEach((n, i) => ctx.fillText(n, (xs[i]! / width + 0.5) * W, H / 2));
  });
}

/** The block with its terminals; `children` sit on the top plate, centred over the back half. */
export function TerminalBlock({ legs, names, plateW, children }: { legs: readonly string[]; names?: string[]; plateW?: number; children?: ReactNode }) {
  const n = legs.length;
  const w = blockWidth(n);
  const pts = useMemo(() => blockTerminals(legs), [legs]);
  const xs = legs.map((l) => pts[l]![0]);
  const printed = useMemo(() => {
    if (!names || !names.some(Boolean)) return null;
    return new THREE.MeshStandardMaterial({ map: namesTexture(w, xs, names), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    // xs follow w and legs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, names?.join("|"), legs.join("|")]);
  const top = BLOCK.h;
  const pw = plateW ?? Math.min(w - 8, Math.max(26, w * 0.6));
  return (
    <group>
      <mesh geometry={memoGeo(`blk:${w}`, () => roundedBox(w, BLOCK.h, BLOCK.d, 2.2, 3))} material={mat.paint(WOOD)} position={[0, BLOCK.h / 2, 0]} castShadow receiveShadow />
      <mesh geometry={memoGeo(`blk-plate:${pw}`, () => roundedBox(pw, 0.8, 15, 1.2, 2))} material={mat.blackMatte()} position={[0, top + 0.4, BLOCK.deviceZ]} receiveShadow />
      {legs.map((l) => {
        const [x] = pts[l]!;
        return (
          <group key={l} position={[x, top, BLOCK.screwZ]}>
            <mesh geometry={memoGeo("tgb-pad", () => new THREE.BoxGeometry(7, 0.5, 6))} material={mat.brass()} position={[0, 0.25, 0]} receiveShadow />
            <mesh geometry={memoGeo("tgb-screw", () => new THREE.CylinderGeometry(2.1, 2.3, 1.6, 20))} material={mat.brass()} position={[0, 1.2, 0]} castShadow />
            <mesh geometry={memoGeo("tgb-slot", () => new THREE.BoxGeometry(3.4, 0.4, 0.6))} material={mat.darkInset()} position={[0, 2.05, 0]} />
          </group>
        );
      })}
      {printed && (
        <mesh material={printed} position={[0, BLOCK.h * 0.45, BLOCK.d / 2 + 0.05]}>
          <planeGeometry args={[w - 2, ((w - 2) * 160) / 1024]} />
        </mesh>
      )}
      <group position={[0, top + 0.8, BLOCK.deviceZ]}>{children}</group>
    </group>
  );
}

/** Names under the terminals: numbers for a mystery part (plus what each is once peeked), else the given names. */
function terminalNames(part: { kind: "relay" | "dpdt-switch"; params: Record<string, unknown> }, names: Record<string, string>): string[] {
  const legs = partLegs(part as never);
  return legs.map((leg) => {
    const num = terminalNumber(part as never, leg);
    if (num === null) return names[leg] ?? "";
    if (!part.params["peek"]) return String(num);
    return `${num} ${names[wiredAs(part as never, leg)] ?? ""}`.trim();
  });
}

const RELAY_NAMES: Record<string, string> = { coil1: "COIL", coil2: "COIL", com1: "COM", nc1: "NC", no1: "NO", com2: "COM", nc2: "NC", no2: "NO" };

export function RelayBlock({ params, closed, quality }: { params: PartParamsMap["relay"]; closed: boolean; quality?: Quality }) {
  const part = { kind: "relay" as const, params: params as Record<string, unknown> };
  const legs = partLegs({ kind: "relay", params });
  const mystery = !!params.mystery;
  return (
    <TerminalBlock legs={legs} names={terminalNames(part, RELAY_NAMES)}>
      <RelayBody closed={closed} quality={quality ?? "high"} poles={params.poles === 1 ? 1 : 2} opaque={mystery && !params.peek} printed={!mystery} />
    </TerminalBlock>
  );
}

/** A chunky slide switch for the top of a block: a chrome plate with a slot and a knob that slides to a or b. */
function BigSlider({ to, length = 24 }: { to: "a" | "b"; length?: number }) {
  const knob = useRef<THREE.Group>(null);
  const throwMm = length * 0.22;
  useEased(to === "a" ? -throwMm : throwMm, (v) => {
    if (knob.current) knob.current.position.x = v;
  }, 20);
  return (
    <group>
      <mesh geometry={memoGeo(`bs-plate:${length}`, () => roundedBox(length + 6, 3.2, 10, 0.8, 2))} material={mat.nickel()} position={[0, 1.6, 0]} castShadow receiveShadow />
      <mesh position={[0, 3.22, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat.darkInset()}>
        <planeGeometry args={[length * 0.44 + 6.4, 3.2]} />
      </mesh>
      <group ref={knob}>
        <mesh geometry={memoGeo("bs-knob", () => roundedBox(6.2, 6.0, 4.6, 1.0, 2))} material={mat.plastic("#1d1e21", 0.4)} position={[0, 5.4, 0]} castShadow />
        {/* Grip ridges. */}
        {[-1.6, 0, 1.6].map((x) => (
          <mesh key={x} geometry={memoGeo("bs-ridge", () => new THREE.BoxGeometry(0.5, 0.5, 4.2))} material={mat.plastic("#34363b", 0.5)} position={[x, 8.5, 0]} />
        ))}
      </group>
    </group>
  );
}

export function SlideBlock({ params }: { params: PartParamsMap["slide-switch"] }) {
  return (
    <TerminalBlock legs={["a", "com", "b"]}>
      <BigSlider to={params.to} />
    </TerminalBlock>
  );
}

const DPDT_NAMES: Record<string, string> = { a1: "T1", com1: "P1", b1: "T1", a2: "T2", com2: "P2", b2: "T2" };

export function DpdtBlock({ params }: { params: PartParamsMap["dpdt-switch"] }) {
  const part = { kind: "dpdt-switch" as const, params: params as Record<string, unknown> };
  const mystery = !!params.mystery;
  return (
    <TerminalBlock legs={partLegs({ kind: "dpdt-switch", params })} names={mystery ? terminalNames(part, DPDT_NAMES) : undefined}>
      <BigSlider to={params.to} length={30} />
    </TerminalBlock>
  );
}

const CAP_HEX: Record<string, string> = { black: "#1f2023", red: "#d2352e", blue: "#2c5fc9", yellow: "#f1c22b", white: "#efede6" };

/** A big round momentary button on a block (normally open or closed: they look the same). */
export function ButtonBlock({ params, pressed }: { params: PartParamsMap["pushbutton"]; pressed: boolean }) {
  const cap = useRef<THREE.Group>(null);
  useEased(pressed ? -1.6 : 0, (v) => {
    if (cap.current) cap.current.position.y = v;
  }, 30);
  return (
    <TerminalBlock legs={["a1", "b1"]} plateW={22}>
      <mesh geometry={memoGeo("bb-bezel", () => latheY([[0.001, 0], [8.4, 0], [8.4, 1.2], [7.4, 2.4], [6.1, 2.4], [6.1, 1.0], [0.001, 1.0]], 40))} material={mat.chrome()} castShadow />
      <group ref={cap}>
        <mesh
          geometry={memoGeo("bb-cap", () => latheY([[0.001, 0], [5.8, 0], [5.8, 4.2], [5.2, 5.2], [3.0, 5.7], [0.001, 5.8]], 40))}
          material={mat.plastic(CAP_HEX[params.cap ?? "black"] ?? "#1f2023", 0.35)}
          position={[0, 1.0, 0]}
          castShadow
        />
      </group>
    </TerminalBlock>
  );
}

/** Ticks round a panel pot's knob, printed on the plate. */
function dialTexture(): THREE.Texture {
  return canvasTexture("knob-dial", 256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#f4efe4";
    ctx.lineCap = "round";
    for (let i = 0; i <= 10; i++) {
      const a = (-0.75 + (i / 10) * 1.5) * Math.PI - Math.PI / 2;
      const r0 = i % 5 === 0 ? 0.78 : 0.84;
      ctx.lineWidth = i % 5 === 0 ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * r0 * (w / 2), h / 2 + Math.sin(a) * r0 * (h / 2));
      ctx.lineTo(w / 2 + Math.cos(a) * 0.97 * (w / 2), h / 2 + Math.sin(a) * 0.97 * (h / 2));
      ctx.stroke();
    }
  });
}

/** A panel potentiometer: a knob with a pointer line that turns with the wiper position (0 to 1). */
export function KnobBlock({ params }: { params: PartParamsMap["trimmer"] }) {
  const knob = useRef<THREE.Group>(null);
  const angle = -((params.position ?? 0.5) - 0.5) * (Math.PI * 1.5);
  useEased(angle, (v) => {
    if (knob.current) knob.current.rotation.y = v;
  }, 16);
  const dial = useMemo(() => new THREE.MeshBasicMaterial({ map: dialTexture(), transparent: true, depthWrite: false, toneMapped: false }), []);
  return (
    <TerminalBlock legs={["a", "wiper", "b"]} plateW={26}>
      <mesh material={dial} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[19, 19]} />
      </mesh>
      <group ref={knob}>
        <mesh geometry={memoGeo("kb-knob", () => latheY([[0.001, 0], [6.4, 0], [6.4, 1.0], [5.6, 1.4], [5.4, 7.2], [4.9, 8.0], [0.001, 8.1]], 36))} material={mat.plastic("#26282c", 0.45)} castShadow />
        <mesh geometry={memoGeo("kb-line", () => new THREE.BoxGeometry(0.9, 0.3, 4.0))} material={mat.white()} position={[0, 8.12, -2.6]} />
      </group>
    </TerminalBlock>
  );
}

/** Width of a block part, for layouts and bounds. */
export function blockSize(legs: number): { w: number; d: number; pitch: number } {
  return { w: blockWidth(legs), d: BLOCK.d, pitch: blockPitch(legs) };
}
