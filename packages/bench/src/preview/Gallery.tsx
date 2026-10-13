// Every part side by side on the desk, with name cards. Used by the playground and handy for the parts bin.

import { Fragment, useMemo, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import type { PartState } from "@ohmland/sim";
import { PartModel } from "../models/PartModel";
import { MultimeterModel } from "../models/Multimeter";
import { AlligatorClip, BananaPlug, Probe } from "../models/Leads";
import { defaultParams } from "../parts";
import { BACKGROUND, Desk, StudioEnvironment, StudioLights } from "../scene/Studio";
import { FONT, canvasTexture } from "../three/canvas";
import { AutoLift } from "./PartPreview";
import type { BenchPartKind, MeterMode, Quality } from "../types";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export type GalleryItem =
  | { kind: BenchPartKind; params?: Record<string, unknown>; label: string; state?: PartState | null; pose?: "stand" | "desk" }
  | { kind: "multimeter"; label: string; mode?: MeterMode; display?: string; unit?: string }
  | { kind: "test-lead"; label: string; color?: string }
  | { kind: "probe"; label: string; color?: "red" | "black" };

const ok = (glow = 0): PartState => ({ i: 0, v: 0, p: 0, temp: 25, health: "ok", glow });

export const DEFAULT_GALLERY: GalleryItem[][] = [
  [
    { kind: "resistor", params: { ohms: 470 }, label: "470 Ω" },
    { kind: "resistor", params: { ohms: 4700, bands: 5, tolerance: 1 }, label: "4.7 kΩ 1%" },
    { kind: "resistor", params: { ohms: 15 }, label: "Smoking", state: { ...ok(), health: "smoking" } },
    { kind: "resistor", params: { ohms: 150 }, label: "Burnt", state: { ...ok(), health: "dead" } },
    { kind: "diode", params: { model: "1N4001" }, label: "1N4001" },
    { kind: "diode", params: { model: "1N4148" }, label: "1N4148" },
    { kind: "npn", label: "2N3904" },
  ],
  [
    { kind: "led", params: { color: "red" }, label: "Red, lit", state: ok(0.85) },
    { kind: "led", params: { color: "red" }, label: "Dead LED", state: { ...ok(), health: "dead" } },
    { kind: "led", params: { color: "green", lens: "clear" }, label: "Green clear" },
    { kind: "led", params: { color: "yellow", size: 3 }, label: "3 mm yellow", state: ok(0.6) },
    { kind: "led", params: { color: "blue", lens: "clear" }, label: "Blue, lit", state: ok(0.7) },
    { kind: "led", params: { color: "white", lens: "clear", size: 3 }, label: "3 mm white" },
    { kind: "phototransistor", params: { size: 5 }, label: "Phototransistor" },
  ],
  [
    { kind: "ceramic-cap", params: { farads: 100e-9 }, label: "100 nF" },
    { kind: "ceramic-cap", params: { farads: 22e-12 }, label: "22 pF" },
    { kind: "electrolytic-cap", params: { farads: 10e-6 }, label: "10 µF" },
    { kind: "electrolytic-cap", params: { farads: 100e-6 }, label: "100 µF" },
    { kind: "electrolytic-cap", params: { farads: 1000e-6 }, label: "1000 µF" },
    { kind: "electrolytic-cap", params: { farads: 470e-6 }, label: "Burst", state: { ...ok(), health: "dead" } },
    { kind: "trimmer", label: "Trimmer" },
  ],
  [
    { kind: "pushbutton", label: "Pushbutton" },
    { kind: "slide-switch", label: "Slide switch" },
    { kind: "toggle-switch", label: "Toggle" },
    { kind: "relay", label: "DPDT relay" },
    { kind: "relay", label: "Energised", state: { ...ok(), closed: true } },
    { kind: "fuse", params: { amps: 1 }, label: "1 A fuse", pose: "desk" },
    { kind: "fuse", params: { amps: 3 }, label: "Blown fuse", pose: "desk", state: { ...ok(), health: "dead" } },
  ],
  [
    { kind: "battery", label: "9 V battery" },
    { kind: "battery", params: { snap: true }, label: "With snap" },
    { kind: "speaker", label: "8 Ω speaker" },
    { kind: "lemon", label: "Lemon cell" },
    { kind: "cup", params: { water: "tap" }, label: "Tap water" },
  ],
  [
    { kind: "multimeter", label: "Multimeter", mode: "dcv", display: "9.12", unit: "V" },
    { kind: "test-lead", label: "Test lead", color: "red" },
    { kind: "test-lead", label: "Test lead", color: "black" },
    { kind: "probe", label: "Probe", color: "red" },
  ],
];

const FOV = 22;

function cardTexture(text: string): THREE.Texture {
  return canvasTexture(`card:${text}`, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = "#efe8da";
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 26);
    ctx.fill();
    ctx.fillStyle = "#2c2620";
    ctx.font = `700 ${text.length > 14 ? 46 : 56}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
}

function Card({ text, width }: { text: string; width: number }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: cardTexture(text), transparent: true, roughness: 0.8 }), [text]);
  return (
    <mesh material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} receiveShadow>
      <planeGeometry args={[width, width / 4]} />
    </mesh>
  );
}

function cellWidth(item: GalleryItem): number {
  switch (item.kind) {
    case "multimeter":
      return 100;
    case "cup":
    case "lemon":
      return 80;
    case "battery":
    case "speaker":
      return 58;
    case "test-lead":
    case "probe":
      return 50;
    case "relay":
    case "fuse":
      return 36;
    default:
      return 24;
  }
}

function cellDepth(item: GalleryItem): number {
  switch (item.kind) {
    case "multimeter":
      return 150;
    case "cup":
    case "lemon":
      return 62;
    case "speaker":
      return 48;
    case "battery":
      return 20;
    case "test-lead":
      return 40;
    case "probe":
      return 120;
    default:
      return 14;
  }
}

function ItemModel({ item, quality }: { item: GalleryItem; quality: Quality }) {
  if (item.kind === "multimeter") return <MultimeterModel mode={item.mode ?? "dcv"} display={item.display} unit={item.unit} />;
  if (item.kind === "test-lead")
    return (
      <group rotation={[Math.PI / 2, Math.PI / 2, 0]} position={[0, 4.6, -18]}>
        <AlligatorClip color={item.color ?? "red"} open={0.5} />
      </group>
    );
  if (item.kind === "probe")
    return (
      <group>
        <group rotation={[Math.PI / 2, 0, 0]} position={[-6, 6.6, -58]}>
          <Probe color={item.color ?? "red"} />
        </group>
        <group rotation={[0, 0, Math.PI / 2]} position={[12, 4.4, 30]}>
          <BananaPlug color={item.color ?? "red"} />
        </group>
      </group>
    );
  return (
    <PartModel
      kind={item.kind}
      params={{ ...defaultParams(item.kind), ...(item.params ?? {}) } as never}
      mount={item.pose === "desk" ? "desk" : item.kind === "battery" || item.kind === "speaker" || item.kind === "cup" || item.kind === "lemon" ? "desk" : "preview"}
      state={item.state ?? null}
      quality={quality}
    />
  );
}

/** Lay rows out front to back, each row centred, cells sized by the part. */
function layout(rows: GalleryItem[][]): { item: GalleryItem; x: number; z: number; w: number }[] {
  const out: { item: GalleryItem; x: number; z: number; w: number }[] = [];
  let z = 0;
  for (const row of rows) {
    const widths = row.map(cellWidth);
    const total = widths.reduce((a, b) => a + b, 0) + (row.length - 1) * 6;
    const depth = Math.max(...widths) * 0.75;
    let x = -total / 2;
    row.forEach((item, i) => {
      const w = widths[i]!;
      out.push({ item, x: x + w / 2, z: z + depth / 2, w });
      x += w + 6;
    });
    z += depth + 40;
  }
  return out.map((r) => ({ ...r, z: r.z - z / 2 }));
}

export type PartGalleryProps = {
  /** Rows of items, front row last. */
  items?: GalleryItem[][];
  quality?: Quality;
  className?: string;
  style?: CSSProperties;
  /** Camera position and target, for screenshots. */
  view?: { position: [number, number, number]; target: [number, number, number] };
  /** Frame one item (index across all rows) up close. */
  focus?: number;
  onReady?: () => void;
};

/** All parts in rows on the desk, each with a name card. */
export function PartGallery({ items = DEFAULT_GALLERY, quality = "high", className, style, view, focus, onReady }: PartGalleryProps) {
  const cells = useMemo(() => layout(items), [items]);
  const rowWidth = Math.max(...cells.map((c) => Math.abs(c.x) + c.w / 2)) * 2;
  const [ready, setReady] = useState(false);
  const zs = cells.map((c) => c.z);
  const depth = Math.max(...zs) - Math.min(...zs) + Math.max(...cells.map((c) => c.w)) * 0.9 + 30;
  const [aspect] = useState(() => (typeof window === "undefined" ? 1.6 : window.innerWidth / Math.max(1, window.innerHeight)));
  const half = (FOV / 2) * (Math.PI / 180);
  const fitW = (rowWidth * 0.52) / (Math.tan(half) * aspect);
  // The camera looks down at about 50 degrees, so depth on the desk is foreshortened.
  const fitD = (depth * 0.42) / Math.tan(half);
  const reach = Math.max(fitW, fitD) * 1.02;
  const cz = (Math.max(...zs) + Math.min(...zs)) / 2 + 10;
  const [focusBox, setFocusBox] = useState<THREE.Box3 | null>(null);
  const f = focus !== undefined ? cells[focus] : undefined;
  let v = view ?? { position: [0, reach * 0.78, cz + reach * 0.63] as [number, number, number], target: [0, 0, cz] as [number, number, number] };
  if (!view && f && focusBox) {
    const size = focusBox.getSize(new THREE.Vector3());
    const c = focusBox.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y * 1.1, size.z) * 0.5 + 3;
    const d = (r / Math.tan((FOV / 2) * (Math.PI / 180))) * 1.05;
    v = { position: [f.x + c.x + d * 0.22, c.y + d * 0.55, f.z + c.z + d * 0.8], target: [f.x + c.x, c.y, f.z + c.z] };
  }
  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", ...style }}>
      <Canvas
        frameloop="demand"
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: FOV, position: v.position, near: 4, far: 8000 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, preserveDrawingBuffer: true }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(BACKGROUND);
          scene.fog = new THREE.Fog(BACKGROUND, 1400, 3200);
          if (!ready) {
            setReady(true);
            onReady?.();
          }
        }}
      >
        <StudioEnvironment />
        <StudioLights quality={quality} shadowSpan={Math.max(260, rowWidth * 0.62)} />
        <Desk quality={quality} />
        {cells.map(({ item, x, z, w }, i) => (
          <Fragment key={i}>
            <group position={[x, 0, z]}>
              <AutoLift deps={i} onSize={i === focus ? (b) => setFocusBox((p) => (p && p.equals(b) ? p : b)) : undefined}>
                <ItemModel item={item} quality={quality} />
              </AutoLift>
            </group>
            <group position={[x, 0, z + cellDepth(item) / 2 + 7]}>
              <Card text={item.label} width={item.kind === "multimeter" ? 40 : Math.min(w, 28)} />
            </group>
          </Fragment>
        ))}
        <CameraControls key={v.position.join(",")} makeDefault ref={(c) => void c?.setLookAt(...v.position, ...v.target, false)} />
        {quality === "high" && (
          <EffectComposer multisampling={4}>
            <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={0.7} radius={0.6} />
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
