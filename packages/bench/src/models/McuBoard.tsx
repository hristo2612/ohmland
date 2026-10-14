// The microcontroller board: our own Uno-sized layout (no logo, no copied artwork). A green board on rubber feet,
// black header sockets along both long edges with their names printed beside them, a USB-C socket and a barrel jack
// on the left edge, a reset button, a square chip, a crystal, a regulator, and two small lamps: L (pin 13) and ON.
// The lamps glow from the board's simulator state (`extra.L`, `extra.ON`).

import { useContext, useMemo } from "react";
import * as THREE from "three";
import { PITCH } from "../board";
import { Halo } from "../effects/effects";
import { MCU_BOARD as B, MCU_HEADERS, MCU_PIN_LABEL, MCU_PIN_XZ, MCU_TITLES, MCU_TOP, mcuLabelSize, mcuLabelZ, mcuLamps } from "../mcuBoard";
import type { PartParamsMap } from "../types";
import { FONT, canvasTexture } from "../three/canvas";
import { memoGeo, roundedBox, roundedRectPlane, roundedSlab } from "../three/geometry";
import { mat } from "../three/materials";
import { RoomLight, healthOf, type ModelProps } from "./common";

const PCB = "#2b5d4f";
const SILK = "#eef2ea";
/** Texture pixels per millimetre. */
const S = 20;

/** The printed layer: names by the sockets, group titles, outlines, a few traces and the mounting rings. */
function silkTexture(): THREE.Texture {
  const W = B.w * S;
  const H = B.d * S;
  return canvasTexture("mcu-silk", W, H, (ctx) => {
    const px = (x: number) => (x + B.w / 2) * S;
    const pz = (z: number) => (z + B.d / 2) * S;
    ctx.clearRect(0, 0, W, H);
    // Traces: faint lighter lines from the sockets toward the chip.
    ctx.strokeStyle = "rgba(160, 205, 180, 0.22)";
    ctx.lineWidth = 0.35 * S;
    ctx.lineCap = "round";
    for (const leg of Object.keys(MCU_PIN_XZ) as (keyof typeof MCU_PIN_XZ)[]) {
      const [x, z] = MCU_PIN_XZ[leg];
      const tz = z < 0 ? -8 : 9;
      const cx = B.chip.x + (x - B.chip.x) * 0.25;
      ctx.beginPath();
      ctx.moveTo(px(x), pz(z + (z < 0 ? 2.2 : -2.2)));
      ctx.lineTo(px(x), pz(tz));
      ctx.lineTo(px(cx), pz(B.chip.z + (z < 0 ? -B.chip.size / 2 - 0.8 : B.chip.size / 2 + 0.8)));
      ctx.stroke();
    }
    // Mounting holes: a gold ring around a dark hole.
    for (const [x, z] of B.holes) {
      ctx.fillStyle = "#d8b45a";
      ctx.beginPath();
      ctx.arc(px(x), pz(z), 2.4 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b1d1c";
      ctx.beginPath();
      ctx.arc(px(x), pz(z), 1.5 * S, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = SILK;
    ctx.strokeStyle = SILK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Socket names, then RX and TX under 0 and 1, then the group titles.
    for (const g of MCU_HEADERS) {
      for (const leg of g.legs) {
        const [x, z] = MCU_PIN_XZ[leg];
        const label = MCU_PIN_LABEL[leg];
        ctx.font = `700 ${mcuLabelSize(label) * S}px ${FONT}`;
        ctx.fillText(label, px(x), pz(mcuLabelZ(z)));
      }
    }
    ctx.font = `700 ${1.0 * S}px ${FONT}`;
    ctx.fillText("RX", px(MCU_PIN_XZ.d0[0]), pz(mcuLabelZ(B.topZ) + 1.6));
    ctx.fillText("TX", px(MCU_PIN_XZ.d1[0]), pz(mcuLabelZ(B.topZ) + 1.6));
    ctx.font = `800 ${1.45 * S}px ${FONT}`;
    for (const t of MCU_TITLES) ctx.fillText(t.text, px(t.x), pz(t.z));
    // Small names by the parts.
    ctx.font = `700 ${1.35 * S}px ${FONT}`;
    ctx.fillText("RESET", px(B.reset.x), pz(B.reset.z + 4.6));
    ctx.fillText("USB", px(B.usb.x + 7.2), pz(B.usb.z));
    ctx.fillText("7-12V", px(B.jack.x + 11.6), pz(B.jack.z - 2.6));
    ctx.font = `800 ${1.6 * S}px ${FONT}`;
    ctx.fillText("L", px(B.lampL.x - 2.6), pz(B.lampL.z));
    ctx.fillText("ON", px(B.lampOn.x - 3.4), pz(B.lampOn.z));
    // The board's own name.
    ctx.font = `800 ${1.9 * S}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("ohmland", px(16.2), pz(-4.5));
    ctx.font = `600 ${1.25 * S}px ${FONT}`;
    ctx.fillText("5 V BOARD", px(16.2), pz(-1.6));
    // Outline of the chip's footprint and pin 1.
    ctx.lineWidth = 0.15 * S;
    const c = B.chip;
    ctx.strokeRect(px(c.x - c.size / 2 - 1.4), pz(c.z - c.size / 2 - 1.4), (c.size + 2.8) * S, (c.size + 2.8) * S);
    ctx.beginPath();
    ctx.arc(px(c.x - c.size / 2 - 2.2), pz(c.z - c.size / 2 - 2.2), 0.45 * S, 0, Math.PI * 2);
    ctx.fill();
  });
}


/** A small lamp on the board: a tiny lens that glows, with a halo when lit. */
function Lamp({ x, z, color, emit, glow }: { x: number; z: number; color: string; emit: string; glow: number }) {
  const room = useContext(RoomLight);
  const boost = 1 + (1 - Math.max(0, Math.min(1, room))) * 4;
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.3, emissive: new THREE.Color(emit), emissiveIntensity: 0 }), [color, emit]);
  m.emissiveIntensity = glow > 0.01 ? 0.3 + glow * 1.6 : 0;
  m.color.set(glow > 0.01 ? emit : color);
  return (
    <group position={[x, MCU_TOP, z]}>
      <mesh geometry={memoGeo("mcu-lamp-pad", () => new THREE.BoxGeometry(2.4, 0.15, 1.5))} material={mat.nickel()} position={[0, 0.08, 0]} />
      <mesh geometry={memoGeo("mcu-lamp", () => roundedBox(1.7, 0.75, 1.0, 0.2, 2))} material={m} position={[0, 0.5, 0]} />
      {glow > 0.01 && (
        <group position={[0, 1.4, 0]}>
          <Halo color={emit} intensity={glow * 0.9 * boost} size={10} />
        </group>
      )}
    </group>
  );
}

function Header({ n, x0, z }: { n: number; x0: number; z: number }) {
  const len = n * PITCH;
  const cx = x0 + ((n - 1) * PITCH) / 2;
  return (
    <group position={[cx, MCU_TOP, z]}>
      <mesh geometry={memoGeo(`mcu-hdr:${n}`, () => roundedBox(len, B.headerH, B.headerW, 0.25, 2))} material={mat.blackMatte()} position={[0, B.headerH / 2, 0]} castShadow receiveShadow />
      {Array.from({ length: n }, (_, k) => (
        <mesh key={k} geometry={memoGeo("mcu-socket", () => new THREE.BoxGeometry(1.0, 0.05, 1.0))} material={mat.darkInset()} position={[(k - (n - 1) / 2) * PITCH, B.headerH + 0.03, 0]} />
      ))}
    </group>
  );
}

/** The square chip: a black body with gull-wing pins on four sides and a pin-1 dimple. */
function Chip() {
  const c = B.chip;
  const pins: [number, number, number][] = [];
  const per = 8;
  const pitch = (c.size - 2) / (per - 1);
  for (let k = 0; k < per; k++) {
    const o = -((per - 1) * pitch) / 2 + k * pitch;
    pins.push([o, -c.size / 2 - 0.5, 0], [o, c.size / 2 + 0.5, 0], [-c.size / 2 - 0.5, o, 1], [c.size / 2 + 0.5, o, 1]);
  }
  return (
    <group position={[c.x, MCU_TOP, c.z]}>
      <mesh geometry={memoGeo("mcu-chip", () => roundedBox(c.size, 1.3, c.size, 0.2, 2))} material={mat.blackMatte()} position={[0, 0.85, 0]} castShadow />
      <mesh geometry={memoGeo("mcu-dimple", () => new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16))} material={mat.darkInset()} position={[-c.size / 2 + 1.2, 1.52, -c.size / 2 + 1.2]} />
      {pins.map(([a, b, side], k) => (
        <mesh
          key={k}
          geometry={memoGeo(side ? "mcu-pin-z" : "mcu-pin-x", () => (side ? new THREE.BoxGeometry(1.1, 0.25, 0.35) : new THREE.BoxGeometry(0.35, 0.25, 1.1)))}
          material={mat.lead()}
          position={side ? [a, 0.25, b] : [a, 0.25, b]}
        />
      ))}
    </group>
  );
}

export function McuBoardModel({ state }: ModelProps<PartParamsMap["mcu-board"]>) {
  const silk = useMemo(
    () => new THREE.MeshStandardMaterial({ map: silkTexture(), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    [],
  );
  const dead = healthOf(state) === "dead";
  const { L, ON } = mcuLamps(state?.extra);
  const u = B.usb;
  const j = B.jack;
  const r = B.reset;
  return (
    <group>
      {/* Rubber feet and the board. */}
      {B.holes.map(([x, z], k) => (
        <mesh key={k} geometry={memoGeo("mcu-foot", () => new THREE.CylinderGeometry(2.2, 2.4, B.lift, 18))} material={mat.rubber("#2a2a2a")} position={[x, B.lift / 2, z]} />
      ))}
      <mesh geometry={memoGeo("mcu-pcb", () => roundedSlab(B.w, B.d, B.pcb, B.corner, 0.25))} material={mat.paint(PCB)} position={[0, B.lift, 0]} castShadow receiveShadow />
      <mesh geometry={memoGeo("mcu-silk-plane", () => roundedRectPlane(B.w, B.d, B.corner))} material={silk} position={[0, MCU_TOP + 0.02, 0]} />

      {MCU_HEADERS.map((g, k) => (
        <Header key={k} n={g.legs.length} x0={g.x0} z={g.z} />
      ))}

      {/* USB-C socket: a rounded metal shell with a dark slot, past the left edge. */}
      <group position={[u.x, MCU_TOP, u.z]}>
        <mesh geometry={memoGeo("mcu-usb", () => roundedBox(u.w, u.h, u.d, 1.4, 4))} material={mat.nickel()} position={[0, u.h / 2, 0]} castShadow />
        <mesh geometry={memoGeo("mcu-usb-slot", () => roundedBox(0.4, u.h * 0.45, u.d * 0.78, 0.18, 2))} material={mat.darkInset()} position={[-u.w / 2, u.h / 2, 0]} />
      </group>

      {/* Barrel jack: a black block with a round opening facing left. */}
      <group position={[j.x, MCU_TOP, j.z]}>
        <mesh geometry={memoGeo("mcu-jack", () => roundedBox(j.w, j.h, j.d, 0.6, 2))} material={mat.blackPlastic()} position={[0, j.h / 2, 0]} castShadow />
        <mesh geometry={memoGeo("mcu-jack-hole", () => new THREE.CylinderGeometry(3.2, 3.2, 0.3, 24))} material={mat.darkInset()} rotation={[0, 0, Math.PI / 2]} position={[-j.w / 2 - 0.05, j.h * 0.55, 0]} />
        <mesh geometry={memoGeo("mcu-jack-pin", () => new THREE.CylinderGeometry(1.0, 1.0, 0.5, 16))} material={mat.nickel()} rotation={[0, 0, Math.PI / 2]} position={[-j.w / 2 - 0.1, j.h * 0.55, 0]} />
      </group>

      {/* Reset button. */}
      <group position={[r.x, MCU_TOP, r.z]}>
        <mesh geometry={memoGeo("mcu-reset-base", () => roundedBox(r.size, 1.6, r.size, 0.3, 2))} material={mat.nickel()} position={[0, 0.8, 0]} castShadow />
        <mesh geometry={memoGeo("mcu-reset-cap", () => new THREE.CylinderGeometry(1.75, 1.85, 1.3, 24))} material={mat.plastic("#e9e2d2", 0.5)} position={[0, 2.2, 0]} castShadow />
      </group>

      <Chip />

      {/* Crystal, regulator and a few small parts. */}
      <mesh
        geometry={memoGeo("mcu-xtal", () => {
          const g = new THREE.CylinderGeometry(1, 1, 1.2, 24);
          g.scale(B.crystal.w / 2, 1, B.crystal.d / 2);
          return g;
        })}
        material={mat.nickel()}
        position={[B.crystal.x, MCU_TOP + 0.6, B.crystal.z]}
        castShadow
      />
      <group position={[B.regulator.x, MCU_TOP, B.regulator.z]}>
        <mesh geometry={memoGeo("mcu-reg", () => roundedBox(B.regulator.w, 1.6, B.regulator.d, 0.2, 2))} material={mat.blackMatte()} position={[0, 0.8, 0]} castShadow />
        <mesh geometry={memoGeo("mcu-reg-tab", () => new THREE.BoxGeometry(3.2, 0.25, 1.4))} material={mat.lead()} position={[0, 0.15, -B.regulator.d / 2 - 0.6]} />
      </group>
      {[
        [-12, 9],
        [-12, 12],
        [2, 9],
        [2, -6],
        [21, 6],
        [21, 9],
      ].map(([x, z], k) => (
        <mesh key={k} geometry={memoGeo("mcu-cap", () => roundedBox(1.6, 0.9, 0.85, 0.15, 2))} material={mat.plastic(k % 2 ? "#b88b55" : "#2a2a2a", 0.5)} position={[x!, MCU_TOP + 0.45, z!]} />
      ))}

      <Lamp x={B.lampL.x} z={B.lampL.z} color="#e9c690" emit="#ffae33" glow={dead ? 0 : L} />
      <Lamp x={B.lampOn.x} z={B.lampOn.z} color="#b9dcc0" emit="#3dff7a" glow={ON} />
    </group>
  );
}
