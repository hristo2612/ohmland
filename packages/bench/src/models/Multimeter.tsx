// Handheld digital multimeter: amber holster, 3 1/2 digit LCD, rotary dial with detents, four banana sockets.
// Original design. Local frame: origin at the base centre, display toward -z, sockets toward +z.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MeterMode, MeterSocket } from "../types";
import { DIAL_MODES, DIAL_STEP, METER } from "../layout";
import { FONT, canvasTexture, makeCanvas } from "../three/canvas";
import { drawLcd } from "../three/lcd";
import { latheY, memoGeo, roundedBox, roundedRectPlane, roundedRectShape, roundedSlab } from "../three/geometry";
import { mat } from "../three/materials";
import { useEased } from "../three/anim";

const FACE_W = 66;
const FACE_L = 140;
const PPM = 12;

/** Angle (radians, clockwise from the display direction) of a dial mode. */
export function dialAngle(mode: MeterMode): number {
  const i = Math.max(0, DIAL_MODES.indexOf(mode as (typeof DIAL_MODES)[number]));
  return (i * DIAL_STEP * Math.PI) / 180;
}

const SECTORS: { from: number; to: number; color: string }[] = [
  { from: 28, to: 107, color: "#f2b53a" },
  { from: 118, to: 242, color: "#3cc39b" },
  { from: 253, to: 332, color: "#e5534b" },
];

function dcSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const t = w * 0.12;
  ctx.fillRect(x - w / 2, y - t * 1.6, w, t);
  const dash = w / 5;
  for (let i = 0; i < 3; i++) ctx.fillRect(x - w / 2 + i * dash * 2, y + t * 0.6, dash, t);
}

function faceTexture(): THREE.CanvasTexture {
  const w = FACE_W * PPM;
  const h = FACE_L * PPM;
  return canvasTexture("meter-face", w, h, (ctx) => {
    const X = (x: number) => (x + FACE_W / 2) * PPM;
    const Z = (z: number) => (z + FACE_L / 2) * PPM;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#30343a");
    g.addColorStop(1, "#272a2f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Fine texture.
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.05)";
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
    }
    // Panel outline around the display area.
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = PPM * 0.3;
    const lcd = METER.lcd;
    ctx.beginPath();
    ctx.roundRect(X(lcd.x0 - 3.2), Z(lcd.z0 - 3.4), (lcd.x1 - lcd.x0 + 6.4) * PPM, (lcd.z1 - lcd.z0 + 6.8) * PPM, PPM * 3);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f3efe6";
    ctx.font = `800 ${PPM * 3.3}px ${FONT}`;
    if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${PPM * 0.35}px`;
    ctx.fillText("OHMLAND", X(-29), Z(-25.3));
    if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
    ctx.fillStyle = "#f2b53a";
    ctx.font = `700 ${PPM * 2.2}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText("DM-1", X(29), Z(-25.3));

    // Dial scale.
    const cx = X(0);
    const cz = Z(METER.dial.z);
    const rr = (mm: number) => mm * PPM;
    for (const s of SECTORS) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = rr(1.25);
      ctx.beginPath();
      ctx.arc(cx, cz, rr(18.9), ((s.from - 90) * Math.PI) / 180, ((s.to - 90) * Math.PI) / 180);
      ctx.stroke();
    }
    DIAL_MODES.forEach((mode, i) => {
      const a = ((i * DIAL_STEP - 90) * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ctx.strokeStyle = "#f3efe6";
      ctx.lineWidth = rr(0.55);
      ctx.beginPath();
      ctx.moveTo(cx + ca * rr(16.4), cz + sa * rr(16.4));
      ctx.lineTo(cx + ca * rr(20.6), cz + sa * rr(20.6));
      ctx.stroke();
      const lx = cx + ca * rr(METER.dial.labels);
      const lz = cz + sa * rr(METER.dial.labels);
      ctx.fillStyle = "#f3efe6";
      ctx.strokeStyle = "#f3efe6";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const big = `800 ${rr(3.6)}px ${FONT}`;
      const mid = `800 ${rr(3.0)}px ${FONT}`;
      switch (mode) {
        case "off":
          ctx.font = `800 ${rr(2.8)}px ${FONT}`;
          ctx.fillText("OFF", lx, lz);
          break;
        case "dcv":
          ctx.font = big;
          ctx.fillText("V", lx - rr(1.4), lz);
          dcSymbol(ctx, lx + rr(2.3), lz - rr(0.6), rr(2.6));
          break;
        case "acv":
          ctx.font = big;
          ctx.fillText("V", lx - rr(1.4), lz);
          ctx.font = `800 ${rr(3.2)}px ${FONT}`;
          ctx.fillText("~", lx + rr(2.2), lz - rr(0.9));
          break;
        case "ohm":
          ctx.font = big;
          ctx.fillText("Ω", lx, lz);
          break;
        case "continuity": {
          ctx.lineWidth = rr(0.5);
          ctx.beginPath();
          ctx.arc(lx - rr(1.6), lz, rr(0.55), 0, Math.PI * 2);
          ctx.fill();
          for (let k = 1; k <= 3; k++) {
            ctx.beginPath();
            ctx.arc(lx - rr(1.6), lz, rr(0.9 * k + 0.4), -0.75, 0.75);
            ctx.stroke();
          }
          break;
        }
        case "diode": {
          const s = rr(2.4);
          ctx.beginPath();
          ctx.moveTo(lx - s * 0.6, lz - s * 0.55);
          ctx.lineTo(lx + s * 0.35, lz);
          ctx.lineTo(lx - s * 0.6, lz + s * 0.55);
          ctx.closePath();
          ctx.fill();
          ctx.fillRect(lx + s * 0.35, lz - s * 0.55, rr(0.45), s * 1.1);
          ctx.fillRect(lx - s * 1.0, lz - rr(0.2), s * 1.9, rr(0.4));
          break;
        }
        case "dca-10a":
          ctx.font = mid;
          ctx.fillText("10A", lx - rr(1.1), lz);
          dcSymbol(ctx, lx + rr(3.8), lz - rr(0.6), rr(2.2));
          break;
        case "dca-ma":
          ctx.font = mid;
          ctx.fillText("mA", lx - rr(1.2), lz);
          dcSymbol(ctx, lx + rr(3.4), lz - rr(0.6), rr(2.2));
          break;
      }
    });

    // Socket labels.
    const xs = METER.sockets.xs;
    const sz = METER.sockets.z;
    const label = (s: MeterSocket, text: string, color = "#f3efe6") => {
      ctx.fillStyle = color;
      ctx.font = `800 ${rr(2.9)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(text, X(xs[s]), Z(sz + 8.6));
    };
    label("a10", "10A", "#ff8a7f");
    label("ma", "mA", "#ff8a7f");
    label("com", "COM");
    label("vohm", "VΩ", "#ff8a7f");
    ctx.font = `700 ${rr(1.75)}px ${FONT}`;
    ctx.fillStyle = "rgba(243,239,230,0.75)";
    ctx.fillText("10A MAX", X(xs.a10), Z(sz - 8.4));
    ctx.fillText("UNFUSED", X(xs.a10), Z(sz - 6.4));
    ctx.fillText("200mA MAX", X(xs.ma), Z(sz - 8.4));
    ctx.fillText("FUSED", X(xs.ma), Z(sz - 6.4));
    ctx.fillText("600V MAX", X((xs.com + xs.vohm) / 2), Z(sz - 7.4));
    // Bracket joining COM and VΩ.
    ctx.strokeStyle = "rgba(243,239,230,0.45)";
    ctx.lineWidth = rr(0.3);
    ctx.beginPath();
    ctx.moveTo(X(xs.com), Z(sz - 5.6));
    ctx.lineTo(X(xs.com), Z(sz - 5.0));
    ctx.lineTo(X(xs.vohm), Z(sz - 5.0));
    ctx.lineTo(X(xs.vohm), Z(sz - 5.6));
    ctx.stroke();
  });
}

function holsterGeometry(): THREE.BufferGeometry {
  return memoGeo("meter-holster", () => {
    const outer = roundedRectShape(METER.width - 3, METER.length - 3, 11);
    const inner = roundedRectShape(FACE_W + 0.6, FACE_L + 0.6, 7.5);
    outer.holes.push(new THREE.Path(inner.getPoints(8).reverse()));
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: METER.height - 3,
      bevelEnabled: true,
      bevelThickness: 1.5,
      bevelSize: 1.5,
      bevelSegments: 4,
      curveSegments: 10,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 1.5, 0);
    g.computeVertexNormals();
    return g;
  });
}

function knurledKnob(): THREE.BufferGeometry {
  return memoGeo("meter-knob", () => {
    const g = new THREE.CylinderGeometry(METER.dial.knob, METER.dial.knob + 0.4, 3.2, 120, 1);
    const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < METER.dial.knob - 1) continue;
      const a = Math.atan2(z, x);
      const k = 1 + (0.32 * Math.max(0, Math.cos(a * 40))) / r;
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    g.computeVertexNormals();
    g.translate(0, 1.6, 0);
    return g;
  });
}

function socketGeometry(): THREE.BufferGeometry {
  return memoGeo("meter-socket", () =>
    latheY(
      [
        [2.3, -7],
        [2.3, -0.6],
        [2.7, 0.2],
        [3.6, 1.55],
        [4.4, 1.6],
        [4.75, 1.2],
        [4.85, 0],
      ],
      40,
    ),
  );
}

function socketContact(): THREE.BufferGeometry {
  return memoGeo("meter-socket-contact", () => latheY([[2.05, -6.5], [2.05, -1.2], [2.3, -0.9]], 24));
}

/** The meter body. `mode` turns the dial; `display`/`unit` fill the LCD. */
export function MultimeterModel({ mode, display, unit }: { mode: MeterMode; display?: string; unit?: string }) {
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.62 }), []);
  useLayoutEffect(() => () => face.dispose(), [face]);

  // Live LCD texture.
  const lcd = useMemo(() => {
    const canvas = makeCanvas(640, 330);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.12 });
    return { canvas, tex, material };
  }, []);
  useLayoutEffect(() => {
    const ctx = lcd.canvas.getContext("2d")!;
    drawLcd(ctx, lcd.canvas.width, lcd.canvas.height, { text: display ?? "", unit, mode, on: mode !== "off" });
    lcd.tex.needsUpdate = true;
  }, [lcd, display, unit, mode]);
  useLayoutEffect(
    () => () => {
      lcd.tex.dispose();
      lcd.material.dispose();
    },
    [lcd],
  );
  const glass = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.12, roughness: 0.04, clearcoat: 1, depthWrite: false }),
    [],
  );
  useLayoutEffect(() => () => glass.dispose(), [glass]);

  const knob = useRef<THREE.Group>(null);
  const target = -dialAngle(mode);
  useEased(target, (v) => {
    if (knob.current) knob.current.rotation.y = v;
  }, 18, target);

  const L = METER.lcd;
  const lcdW = L.x1 - L.x0;
  const lcdD = L.z1 - L.z0;
  const faceY = METER.face;
  const sockets = Object.entries(METER.sockets.xs) as [MeterSocket, number][];
  return (
    <group>
      <mesh geometry={holsterGeometry()} material={mat.rubber("#f0a43c")} castShadow receiveShadow />
      <mesh geometry={memoGeo("meter-body", () => roundedSlab(FACE_W + 0.6, FACE_L + 0.6, faceY, 7.5, 0.6))} material={mat.greyPlastic()} />
      <mesh geometry={memoGeo("meter-face", () => roundedRectPlane(FACE_W, FACE_L, 7.2))} material={face} position={[0, faceY + 0.01, 0]} receiveShadow />
      {/* LCD: bezel, panel, glass. */}
      <mesh geometry={memoGeo("meter-bezel", () => roundedSlab(lcdW + 3.2, lcdD + 3.2, 0.7, 1.8, 0.3))} material={mat.blackMatte()} position={[0, faceY, (L.z0 + L.z1) / 2]} />
      <mesh material={lcd.material} position={[0, faceY + 0.72, (L.z0 + L.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[lcdW, lcdD]} />
      </mesh>
      <mesh material={glass} position={[0, faceY + 0.95, (L.z0 + L.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[lcdW + 2.4, lcdD + 2.4]} />
      </mesh>
      {/* Buttons. */}
      {[-17, 17].map((x, i) => (
        <group key={x} position={[x, faceY, -18.5]}>
          <mesh geometry={memoGeo("meter-btn", () => roundedBox(13, 2.2, 5, 1.1, 3))} material={mat.plastic(i === 0 ? "#454950" : "#f2b53a", 0.5)} position={[0, 1.0, 0]} castShadow />
          <mesh position={[0, 2.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[11, 3.6]} />
            <meshBasicMaterial transparent map={buttonLabel(i === 0 ? "HOLD" : "LIGHT", i === 0 ? "#f3efe6" : "#2a2a2a")} />
          </mesh>
        </group>
      ))}
      {/* Dial. */}
      <group position={[0, faceY, METER.dial.z]}>
        <mesh geometry={memoGeo("meter-dial-well", () => new THREE.CylinderGeometry(METER.dial.knob + 1.4, METER.dial.knob + 1.6, 0.6, 64))} material={mat.blackMatte()} position={[0, 0.2, 0]} />
        <group ref={knob}>
          <mesh geometry={knurledKnob()} material={mat.plastic("#2b2e33", 0.55)} castShadow />
          <mesh geometry={memoGeo("meter-knob-top", () => new THREE.CylinderGeometry(METER.dial.knob - 1.6, METER.dial.knob - 0.6, 0.8, 64))} material={mat.plastic("#33373d", 0.5)} position={[0, 3.6, 0]} />
          <mesh geometry={memoGeo("meter-knob-bar", () => roundedBox(5.6, 6.2, 27, 2.2, 4))} material={mat.plastic("#3a3e45", 0.45)} position={[0, 5.4, 0]} castShadow />
          {/* Pointer: a white stripe at the end of the bar that points at the selected mode (toward -z at rest). */}
          <mesh geometry={memoGeo("meter-knob-pointer", () => roundedBox(1.3, 0.4, 8.5, 0.18, 2))} material={mat.plastic("#f8f4ea", 0.4)} position={[0, 8.55, -8.4]} />
        </group>
      </group>
      {/* Banana sockets. */}
      {sockets.map(([s, x]) => (
        <group key={s} position={[x, faceY, METER.sockets.z]}>
          <mesh geometry={socketGeometry()} material={mat.plastic(s === "com" ? "#1d1e21" : "#cf3a33", 0.4)} castShadow />
          <mesh geometry={socketContact()} material={mat.brass()} />
          <mesh position={[0, -6.4, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat.darkInset()}>
            <circleGeometry args={[2.3, 24]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function buttonLabel(text: string, color: string): THREE.Texture {
  return canvasTexture(`meter-btn:${text}`, 220, 72, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.font = `800 34px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}
