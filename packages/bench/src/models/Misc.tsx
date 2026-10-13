// Trimmer potentiometer, DPDT signal relay (clear cover, moving armature), NPN transistor in TO-92 and the
// glass cartridge fuse in spring clips (or a holder block on the desk).

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FUSE, NPN, PITCH, RELAY, TRIMMER } from "../dims";
import type { PartParamsMap, Quality } from "../types";
import { FONT, canvasTexture } from "../three/canvas";
import { bentTube, latheY, memoGeo, roundedBox } from "../three/geometry";
import { mat } from "../three/materials";
import { useEased } from "../three/anim";
import { Scorch, Smoke } from "../effects/effects";
import { IN_HOLE, RadialMount, healthOf, type ModelProps } from "./common";
import { UprightMount } from "./Switches";

// Trimmer -----------------------------------------------------------------------------------------------------------

export function TrimmerModel({ params, mount }: ModelProps<PartParamsMap["trimmer"]>) {
  const T = TRIMMER;
  const cx = PITCH;
  const rotor = useRef<THREE.Group>(null);
  const angle = -((params.position ?? 0.5) - 0.5) * (Math.PI * 1.5);
  useEased(angle, (v) => {
    if (rotor.current) rotor.current.rotation.y = v;
  }, 16);
  const legs = useMemo(() => [0, 1, 2].map((i) => bentTube([[i * PITCH, 0.8, 0], [i * PITCH, IN_HOLE, 0]], 0.26, 0.3, 4)), []);
  const base = 0.4;
  return (
    <UprightMount mount={mount} cx={cx} cz={0}>
      <group position={[cx, base, 0]}>
        <mesh geometry={memoGeo("tr-body", () => roundedBox(T.size, T.h, T.size, 0.45, 3))} material={mat.glossy("#2f63c8")} position={[0, T.h / 2, 0]} castShadow receiveShadow />
        <group ref={rotor} position={[0, T.h, 0]}>
          <mesh geometry={memoGeo("tr-rotor", () => latheY([[0.001, -0.4], [T.rotorDia / 2, -0.4], [T.rotorDia / 2, 0.35], [T.rotorDia / 2 - 0.25, 0.55], [0.001, 0.55]], 32))} material={mat.plastic("#f1ead8", 0.45)} castShadow />
          {/* Cross slot for a screwdriver, and a pointer notch. */}
          <mesh geometry={memoGeo("tr-slot", () => new THREE.BoxGeometry(3.6, 0.5, 0.55))} material={mat.plastic("#b9ae94", 0.7)} position={[0, 0.4, 0]} />
          <mesh geometry={memoGeo("tr-slot", () => new THREE.BoxGeometry(3.6, 0.5, 0.55))} material={mat.plastic("#b9ae94", 0.7)} position={[0, 0.4, 0]} rotation={[0, Math.PI / 2, 0]} />
          <mesh geometry={memoGeo("tr-arrow", () => new THREE.ConeGeometry(0.45, 0.9, 3))} material={mat.plastic("#c43c33", 0.5)} position={[0, 0.5, -1.65]} rotation={[-Math.PI / 2, 0, 0]} />
        </group>
      </group>
      {legs.map((g, i) => (
        <mesh key={i} geometry={g} material={mat.lead()} castShadow />
      ))}
    </UprightMount>
  );
}

// Relay -------------------------------------------------------------------------------------------------------------

function relayTopTexture(): THREE.Texture {
  return canvasTexture("relay-top", 512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(250,250,250,0.92)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `800 54px ${FONT}`;
    ctx.fillText("9VDC", w * 0.06, h * 0.3);
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText("DPDT  2A 30VDC", w * 0.06, h * 0.68);
    // Coil and changeover contact symbol.
    ctx.strokeStyle = "rgba(250,250,250,0.92)";
    ctx.lineWidth = 5;
    const x0 = w * 0.7;
    ctx.strokeRect(x0, h * 0.2, w * 0.08, h * 0.6);
    ctx.beginPath();
    ctx.moveTo(x0, h * 0.2);
    ctx.lineTo(x0 + w * 0.08, h * 0.8);
    ctx.moveTo(x0 + w * 0.13, h * 0.75);
    ctx.lineTo(x0 + w * 0.25, h * 0.3);
    ctx.stroke();
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.08, h * 0.5);
    ctx.lineTo(x0 + w * 0.19, h * 0.5);
    ctx.stroke();
  });
}

function coverMaterial(quality: Quality): THREE.Material {
  if (quality === "high") {
    return new THREE.MeshPhysicalMaterial({ color: "#d9e0e8", roughness: 0.22, transmission: 0.82, thickness: 0.8, ior: 1.45, clearcoat: 0.6 });
  }
  return new THREE.MeshPhysicalMaterial({ color: "#a9b4c0", roughness: 0.25, transparent: true, opacity: 0.32, depthWrite: false, clearcoat: 0.6 });
}

export function RelayModel({ mount, state, quality = "high" }: ModelProps<PartParamsMap["relay"]>) {
  const R = RELAY;
  const cx = 3.5 * PITCH;
  const cz = -1.5 * PITCH;
  const closed = !!state?.closed;
  const cover = useMemo(() => coverMaterial(quality), [quality]);
  useLayoutEffect(() => () => cover.dispose(), [cover]);
  const label = useMemo(() => new THREE.MeshBasicMaterial({ map: relayTopTexture(), transparent: true, depthWrite: false }), []);
  useLayoutEffect(() => () => label.dispose(), [label]);
  const armature = useRef<THREE.Group>(null);
  const blades = useRef<THREE.Group>(null);
  useEased(closed ? 1 : 0, (v) => {
    if (armature.current) armature.current.rotation.z = -0.2 * v;
    if (blades.current) blades.current.rotation.z = -0.13 * v;
  }, 26);
  const legs = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    for (const dz of [0, -3]) for (const dx of [0, 3, 5, 7]) out.push(bentTube([[dx * PITCH, 0.9, dz * PITCH], [dx * PITCH, IN_HOLE, dz * PITCH]], 0.26, 0.3, 4));
    return out;
  }, []);
  const base = 0.4;
  const inner = R.h - 0.6;
  return (
    <UprightMount mount={mount} cx={cx} cz={cz}>
      <group position={[cx, base, cz]}>
        <mesh geometry={memoGeo("rl-base", () => roundedBox(R.len, 1.6, R.wid, 0.3, 2))} material={mat.blackMatte()} position={[0, 0.8, 0]} castShadow receiveShadow />
        {/* Coil on the pin-1 end. */}
        <group position={[-4.6, 5.6, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh geometry={memoGeo("rl-wind", () => new THREE.CylinderGeometry(3.0, 3.0, 7.6, 36))} material={mat.copperBright()} castShadow />
          <mesh geometry={memoGeo("rl-flange", () => new THREE.CylinderGeometry(3.7, 3.7, 0.6, 36))} material={mat.blackMatte()} position={[0, 4.0, 0]} />
          <mesh geometry={memoGeo("rl-flange", () => new THREE.CylinderGeometry(3.7, 3.7, 0.6, 36))} material={mat.blackMatte()} position={[0, -4.0, 0]} />
          <mesh geometry={memoGeo("rl-core", () => new THREE.CylinderGeometry(1.4, 1.4, 1.0, 24))} material={mat.steel()} position={[0, -4.6, 0]} />
        </group>
        {/* Yoke: L bracket behind and over the coil. */}
        <mesh geometry={memoGeo("rl-yoke-v", () => new THREE.BoxGeometry(0.8, 8.4, 5.2))} material={mat.steel()} position={[-9.0, 5.3, 0]} castShadow />
        <mesh geometry={memoGeo("rl-yoke-h", () => new THREE.BoxGeometry(10.6, 0.8, 5.2))} material={mat.steel()} position={[-4.1, 9.5, 0]} castShadow />
        {/* Armature hinged at the yoke end, with the plastic card that pushes the contact blades. */}
        <group ref={armature} position={[1.0, 9.6, 0]}>
          <mesh geometry={memoGeo("rl-arm", () => new THREE.BoxGeometry(0.75, 7.6, 5.0))} material={mat.steel()} position={[0.4, -3.9, 0]} castShadow />
          <mesh geometry={memoGeo("rl-card", () => new THREE.BoxGeometry(5.6, 0.9, 6.6))} material={mat.plastic("#f0e6c8", 0.5)} position={[3.4, -4.6, 0]} />
        </group>
        {/* Contact sets for both poles. */}
        {[-2.4, 2.4].map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh geometry={memoGeo("rl-fixed", () => new THREE.BoxGeometry(6.0, 0.3, 1.4))} material={mat.brass()} position={[6.5, 7.7, 0]} />
            <mesh geometry={memoGeo("rl-fixed", () => new THREE.BoxGeometry(6.0, 0.3, 1.4))} material={mat.brass()} position={[6.5, 4.1, 0]} />
            <mesh geometry={memoGeo("rl-post", () => new THREE.BoxGeometry(0.5, 7.8, 1.4))} material={mat.brass()} position={[9.4, 4.4, 0]} />
            <mesh geometry={memoGeo("rl-dot", () => new THREE.CylinderGeometry(0.55, 0.55, 0.35, 16))} material={mat.nickel()} position={[6.6, 7.42, 0]} />
            <mesh geometry={memoGeo("rl-dot", () => new THREE.CylinderGeometry(0.55, 0.55, 0.35, 16))} material={mat.nickel()} position={[6.6, 4.38, 0]} />
          </group>
        ))}
        <group ref={blades} position={[3.0, 6.0, 0]}>
          {[-2.4, 2.4].map((z) => (
            <group key={z} position={[0, 0, z]}>
              <mesh geometry={memoGeo("rl-blade", () => new THREE.BoxGeometry(5.0, 0.22, 1.2))} material={mat.copper()} position={[2.5, 0.8, 0]} />
              <mesh geometry={memoGeo("rl-dot2", () => new THREE.CylinderGeometry(0.5, 0.5, 1.0, 16))} material={mat.nickel()} position={[3.6, 0.8, 0]} />
            </group>
          ))}
        </group>
        {/* Clear cover with printed top. */}
        <mesh geometry={memoGeo("rl-cover", () => roundedBox(R.len, inner, R.wid, 0.5, 3))} material={cover} position={[0, 1.4 + inner / 2, 0]} castShadow renderOrder={2} />
        <mesh material={label} position={[0, 1.4 + inner + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <planeGeometry args={[R.len - 2, R.wid - 2]} />
        </mesh>
      </group>
      {legs.map((g, i) => (
        <mesh key={i} geometry={g} material={mat.lead()} castShadow />
      ))}
    </UprightMount>
  );
}

// NPN transistor ----------------------------------------------------------------------------------------------------

function to92Geometry(): THREE.BufferGeometry {
  return memoGeo("to92", () => {
    const r = NPN.dia / 2;
    const flat = 1.05;
    const a = Math.asin(flat / r);
    const s = new THREE.Shape();
    // D shape in x-z (shape y maps to -z after rotation); flat face toward +z (shape -y).
    // Arc round the back from the right end of the flat chord to its left end, then close along the flat.
    s.absarc(0, 0, r, -a, Math.PI + a, false);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: NPN.height - 0.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.22, bevelSegments: 3, curveSegments: 36 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.25, 0);
    return g;
  });
}

function markingTexture(model: string): THREE.Texture {
  return canvasTexture(`to92-mark:${model}`, 192, 192, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(215,215,212,0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(model.slice(0, 2), w / 2, h * 0.26);
    ctx.font = `700 46px ${FONT}`;
    ctx.fillText(model.slice(2), w / 2, h * 0.52);
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText("C331", w / 2, h * 0.78);
  });
}

export function NpnModel({ params, mount, state }: ModelProps<PartParamsMap["npn"]>) {
  const model = params.model ?? "2N3904";
  const base = mount === "board" ? NPN.standoff : 0;
  const decal = useMemo(
    () => new THREE.MeshStandardMaterial({ map: markingTexture(model), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    [model],
  );
  useLayoutEffect(() => () => decal.dispose(), [decal]);
  const legs = useMemo(() => {
    const bottom = mount === "board" ? IN_HOLE - base : mount === "desk" ? -NPN.deskLead : -11;
    return [-1, 0, 1].map((s) =>
      bentTube(
        [
          [s * 1.27, 0.5, 0],
          [s * 1.27, -0.9, 0],
          [s * PITCH, -2.4, 0],
          [s * PITCH, bottom, 0],
        ],
        0.22,
        0.5,
        4,
      ),
    );
  }, [mount, base]);
  const dead = healthOf(state) === "dead";
  return (
    <RadialMount mount={mount} centerX={PITCH} deskAxis={NPN.dia / 2} layFlat="up">
      <group position={[0, base, 0]}>
        <mesh geometry={to92Geometry()} material={dead ? mat.plastic("#0e0d0c", 0.7) : mat.plastic("#18191b", 0.5)} castShadow receiveShadow />
        <mesh material={decal} position={[0, NPN.height * 0.55, 1.06]}>
          <planeGeometry args={[3.6, 3.6]} />
        </mesh>
        {legs.map((g, i) => (
          <mesh key={i} geometry={g} material={mat.lead()} castShadow />
        ))}
        {healthOf(state) === "smoking" && (
          <group position={[0, NPN.height, 0]}>
            <Smoke active amount={0.5} spread={2} />
          </group>
        )}
      </group>
    </RadialMount>
  );
}

// Fuse ----------------------------------------------------------------------------------------------------------------

function capLabel(amps: number): THREE.Texture {
  return canvasTexture(`fuse-cap:${amps}`, 256, 64, (ctx, w, h) => {
    ctx.fillStyle = "#d4d6d4";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(60,60,60,0.75)";
    ctx.font = `700 34px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const x of [0.25, 0.75]) ctx.fillText(`${amps}A 250V`, w * x, h / 2);
  });
}

function smudgeTexture(): THREE.Texture {
  return canvasTexture("fuse-smudge", 256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = w * (0.35 + Math.random() * 0.3);
      const y = h * (0.2 + Math.random() * 0.6);
      const r = 10 + Math.random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(40,30,25,0.35)");
      g.addColorStop(1, "rgba(40,30,25,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

function FuseCartridge({ amps, blown, quality }: { amps: number; blown: boolean; quality: Quality }) {
  const F = FUSE;
  const r = F.dia / 2;
  const glass = useMemo(
    () =>
      quality === "high"
        ? new THREE.MeshPhysicalMaterial({ color: "#f3fbf6", roughness: 0.04, transmission: 1, thickness: 0.6, ior: 1.5, clearcoat: 1 })
        : new THREE.MeshPhysicalMaterial({ color: "#e8f2ee", roughness: 0.06, transparent: true, opacity: 0.25, depthWrite: false, clearcoat: 1 }),
    [quality],
  );
  useLayoutEffect(() => () => glass.dispose(), [glass]);
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ map: capLabel(amps), metalness: 0.95, roughness: 0.28 }), [amps]);
  useLayoutEffect(() => () => capMat.dispose(), [capMat]);
  const smudge = useMemo(() => new THREE.MeshBasicMaterial({ map: smudgeTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide }), []);
  useLayoutEffect(() => () => smudge.dispose(), [smudge]);
  const glassLen = F.len - 2 * F.capLen + 0.6;
  const filament = useMemo(() => {
    const L = glassLen / 2 + 0.2;
    if (!blown) return [bentTube([[-L, -0.55, 0], [0, -0.75, 0.1], [L, 0.55, 0]], 0.065, 2, 5)];
    return [
      bentTube([[-L, -0.55, 0], [-1.2, -0.85, 0.1]], 0.065, 2, 5),
      bentTube([[1.0, 0.05, 0.1], [L, 0.55, 0]], 0.065, 2, 5),
    ];
  }, [blown, glassLen]);
  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh geometry={memoGeo(`fuse-glass`, () => new THREE.CylinderGeometry(r - 0.05, r - 0.05, glassLen, 32, 1, true))} material={glass} renderOrder={2} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={memoGeo("fuse-cap", () => latheY([[r - 0.4, -F.capLen / 2], [r + 0.08, -F.capLen / 2 + 0.25], [r + 0.08, F.capLen / 2 - 0.25], [r - 0.2, F.capLen / 2], [0.001, F.capLen / 2]], 32))} material={capMat} position={[0, s * (F.len / 2 - F.capLen / 2), 0]} rotation={[s > 0 ? 0 : Math.PI, 0, 0]} castShadow />
      ))}
      <group rotation={[0, 0, Math.PI / 2]}>
        {filament.map((g, i) => (
          <mesh key={i} geometry={g} material={mat.nickel()} />
        ))}
        {blown && (
          <>
            <mesh geometry={memoGeo("fuse-bead", () => new THREE.SphereGeometry(0.16, 10, 8))} material={mat.nickel()} position={[-1.2, -0.85, 0.1]} />
            <mesh geometry={memoGeo("fuse-bead", () => new THREE.SphereGeometry(0.16, 10, 8))} material={mat.nickel()} position={[1.0, 0.05, 0.1]} />
          </>
        )}
      </group>
      {blown && (
        <mesh geometry={memoGeo("fuse-smudge", () => new THREE.CylinderGeometry(r - 0.12, r - 0.12, glassLen * 0.9, 32, 1, true))} material={smudge} renderOrder={3} />
      )}
    </group>
  );
}

/** Spring clip that holds one end cap (pin down into the hole at the origin). */
function FuseClip({ toward }: { toward: 1 | -1 }) {
  const r = FUSE.dia / 2;
  const axisY = 1.0 + r;
  return (
    <group>
      <mesh geometry={memoGeo("fclip-base", () => new THREE.BoxGeometry(3.6, 0.35, 5.4))} material={mat.brass()} position={[toward * 1.9, 0.85, 0]} castShadow />
      {[-1, 1].map((sz) => (
        <mesh key={sz} geometry={memoGeo("fclip-arm", () => new THREE.BoxGeometry(3.2, axisY + 0.6, 0.35))} material={mat.brass()} position={[toward * 1.9, 0.85 + (axisY + 0.6) / 2, sz * (r + 0.25)]} rotation={[sz * 0.1, 0, 0]} castShadow />
      ))}
      <mesh geometry={memoGeo("fclip-stop", () => new THREE.BoxGeometry(0.35, 1.6, 2.4))} material={mat.brass()} position={[toward * 0.05 - toward * 0.1, 1.6, 0]} />
      <mesh geometry={memoGeo("fclip-pin", () => bentTube([[0, 0.9, 0], [0, IN_HOLE, 0]], 0.32, 0.2, 6))} material={mat.brass()} castShadow />
    </group>
  );
}

export function FuseModel({ params, mount, state, quality = "high" }: ModelProps<PartParamsMap["fuse"]>) {
  const blown = healthOf(state) === "dead";
  const span = FUSE.clipPitch * PITCH;
  const r = FUSE.dia / 2;
  if (mount === "desk") {
    return (
      <group>
        <mesh geometry={memoGeo("fuse-block", () => roundedBox(25, 3, 9, 0.8, 2))} material={mat.plastic("#2d3035", 0.6)} position={[0, 1.5, 0]} castShadow receiveShadow />
        {/* Solder lugs out of each end. */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={memoGeo("fuse-lug", () => roundedBox(5.5, 0.4, 3.2, 0.15, 1))} material={mat.brass()} position={[s * 14.2, 1.6, 0]} castShadow />
        ))}
        <group position={[-span / 2, 3.0 - 0.85, 0]}>
          <FuseClip toward={1} />
        </group>
        <group position={[span / 2, 3.0 - 0.85, 0]}>
          <FuseClip toward={-1} />
        </group>
        <group position={[0, 3.0 + 0.15 + r, 0]}>
          <FuseCartridge amps={params.amps} blown={blown} quality={quality} />
        </group>
      </group>
    );
  }
  return (
    <group>
      <FuseClip toward={1} />
      <group position={[span, 0, 0]}>
        <FuseClip toward={-1} />
      </group>
      <group position={[span / 2, 1.0 + r, 0]}>
        <FuseCartridge amps={params.amps} blown={blown} quality={quality} />
      </group>
      {blown && mount === "board" && (
        <group position={[span / 2, 0, 0]}>
          <Scorch width={9} depth={6} opacity={0.35} />
        </group>
      )}
    </group>
  );
}
