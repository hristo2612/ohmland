// Every part side by side on the desk, with name cards. Used by the playground and handy for the parts bin.

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import type { PartState } from "@ohmland/sim";
import { PartModel } from "../models/PartModel";
import { MultimeterModel } from "../models/Multimeter";
import { AlligatorClip, BananaPlug, Probe } from "../models/Leads";
import { defaultParams } from "../parts";
import { Desk, StudioEnvironment, StudioLights } from "../scene/Studio";
import { PaletteContext, useReadPalette } from "../scene/palette";
import { PaperRenderer, PaperUpkeep, SoftShadows } from "../scene/Render";
import { canvasTexture } from "../three/canvas";
import { installPaperTone, type PaperPalette } from "../three/paper";
import { Spotlight } from "../three/post";
import { AutoLift } from "./PartPreview";
import type { BenchPartKind, MeterMode, Quality } from "../types";

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
  ...unit4Gallery(),
];

/** Unit 4 parts: chips, a socket, displays, the regulator, DIP switches, the logic probe, packs and the supply. */
function unit4Gallery(): GalleryItem[][] {
  return [
    [
      { kind: "chip", params: { model: "555" }, label: "NE555" },
      { kind: "chip", params: { model: "555-cmos" }, label: "7555" },
      { kind: "chip", params: { model: "74HC00" }, label: "74HC00" },
      { kind: "chip", params: { model: "4026B" }, label: "CD4026B" },
      { kind: "chip", params: { model: "74HC86", hidden: true, label: "?1" }, label: "Mystery" },
      { kind: "chip", params: { model: "74HC04" }, label: "Hot", state: { ...ok(), temp: 120, health: "hot" } },
      { kind: "chip", params: { model: "74HC32" }, label: "Burnt", state: { ...ok(), temp: 160, health: "dead" } },
      { kind: "chip", params: { model: "74HC08", package: "soic" }, label: "SOIC" },
    ],
    [
      { kind: "ic-socket", params: { pins: 8 }, label: "8-pin socket" },
      { kind: "ic-socket", params: { pins: 16 }, label: "16-pin socket" },
      { kind: "sevenseg", params: { common: "cathode" }, label: "7-segment" },
      { kind: "sevenseg", params: { common: "cathode" }, label: "Showing 4", state: { ...ok(0.8), extra: { a: 0, b: 0.8, c: 0.8, d: 0, e: 0, f: 0.8, g: 0.8, dp: 0, lit: "bcfg" } } },
      { kind: "sevenseg", params: { common: "cathode", carrier: true }, label: "On its carrier", state: { ...ok(0.7), extra: { a: 0.7, b: 0.7, c: 0.7, d: 0, e: 0, f: 0, g: 0, dp: 0.7, lit: "abc" } } },
      { kind: "dip-switch", params: { positions: 8, s1: true, s4: true, s5: true }, label: "DIP switch" },
      { kind: "dip-switch", params: { positions: 4, s2: true }, label: "4-way" },
    ],
    [
      { kind: "regulator7805", label: "7805" },
      { kind: "regulator7805", params: { heatsink: true }, label: "Heat sink", state: { ...ok(), temp: 90, extra: { caseTemp: 85 } } },
      { kind: "diode", params: { model: "1N4148" }, label: "1N4148" },
      { kind: "logic-probe", label: "Logic probe", state: { ...ok(), extra: { powered: true, level: "H", pulse: true } } },
    ],
    [
      { kind: "battery-pack", params: { cells: 3 }, label: "4.5 V pack" },
      { kind: "battery-pack", params: { cells: 4 }, label: "6 V pack" },
      { kind: "bench-supply", params: { position: 0.75 }, label: "Bench supply" },
    ],
  ];
}

/** The Unit 4 rows of the gallery (the last four of `DEFAULT_GALLERY`). */
export const UNIT4_GALLERY: GalleryItem[][] = unit4Gallery();

const FOV = 22;

/** Kinds shown lying on the desk rather than standing on their legs. */
const DESK_KINDS = new Set<string>(["battery", "speaker", "cup", "lemon", "logic-probe", "battery-pack", "bench-supply"]);


const SERIF = `"Literata", Georgia, "Times New Roman", serif`;

/** A name written on the page under the part, in pencil. */
function cardTexture(text: string, p: PaperPalette): THREE.Texture {
  return canvasTexture(`card:${text}:${p.ink}`, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = p.ink;
    // As large as fits the card.
    let size = 72;
    ctx.font = `600 ${size}px ${SERIF}`;
    const fit = (w - 16) / Math.max(1, ctx.measureText(text).width);
    if (fit < 1) size = Math.floor(size * fit);
    ctx.font = `600 ${size}px ${SERIF}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
}

function Card({ text, width, palette }: { text: string; width: number; palette: PaperPalette }) {
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ map: cardTexture(text, palette), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 });
    m.userData.keepColor = true;
    return m;
  }, [text, palette]);
  return (
    <mesh material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
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
    case "bench-supply":
      return 70;
    case "battery-pack":
      return 66;
    case "logic-probe":
      return 112;
    case "chip":
    case "ic-socket":
    case "dip-switch":
    case "sevenseg":
      return 28;
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
    case "logic-probe":
      return 14;
    case "battery-pack":
    case "bench-supply":
      return 74;
    case "sevenseg":
      return 26;
    default:
      return 14;
  }
}

function ItemModel({ item, quality }: { item: GalleryItem; quality: Quality }) {
  if (item.kind === "multimeter") return <MultimeterModel mode={item.mode ?? "dcv"} display={item.display} unit={item.unit} />;
  if (item.kind === "test-lead")
    return (
      <group rotation={[0, -0.75, 0]} position={[-9, 0, -9]}>
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
  const model = (
    <PartModel
      kind={item.kind}
      params={{ ...defaultParams(item.kind), ...(item.params ?? {}) } as never}
      mount={item.pose === "desk" || DESK_KINDS.has(item.kind) ? "desk" : "preview"}
      state={item.state ?? null}
      quality={quality}
    />
  );
  // The logic probe's origin is its tip: lay the pen across its cell, centred.
  if (item.kind === "logic-probe") return <group position={[-54, 0, 0]} rotation={[0, Math.PI / 2, 0]}>{model}</group>;
  return model;
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
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const palette = useReadPalette(el);
  const spot = useMemo(() => new Spotlight({ amount: 0, color: new THREE.Color(palette.paper) }), []);
  useEffect(() => () => spot.dispose(), [spot]);
  installPaperTone();
  const span = Math.max(260, rowWidth * 0.62);
  return (
    <div ref={setEl} className={className} style={{ position: "relative", width: "100%", height: "100%", background: palette.paper, ...style }}>
      <Canvas
        frameloop="demand"
        shadows={quality === "high" ? "percentage" : false}
        dpr={[1, 2]}
        camera={{ fov: FOV, position: v.position, near: 4, far: 8000 }}
        gl={{ antialias: quality === "low", alpha: false, toneMapping: THREE.CustomToneMapping, preserveDrawingBuffer: true }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(palette.paper);
          if (!ready) {
            setReady(true);
            onReady?.();
          }
        }}
      >
        <PaletteContext.Provider value={palette}>
          <StudioEnvironment intensity={palette.dark ? 0.14 : 0.22} />
          <StudioLights quality={quality} shadowSpan={span} palette={palette} />
          <Desk quality={quality} palette={palette} />
          <SoftShadows
            areas={[{ key: "desk", center: [0, cz - 10], size: [Math.min(1400, rowWidth + 120), Math.min(1000, depth + 120)], y: 0, far: 34, opacity: palette.dark ? 0.8 : 0.5, blur: 2.2, resolution: 1024 }]}
            version={cells}
            palette={palette}
          />
          <PaperUpkeep version={cells} dark={palette.dark} shadows={quality === "high"} />
          {cells.map(({ item, x, z, w }, i) => (
            <Fragment key={i}>
              <group position={[x, 0, z]}>
                <AutoLift deps={i} onSize={i === focus ? (b) => setFocusBox((p) => (p && p.equals(b) ? p : b)) : undefined}>
                  <ItemModel item={item} quality={quality} />
                </AutoLift>
              </group>
              <group position={[x, 0, z + cellDepth(item) / 2 + 7]}>
                <Card text={item.label} width={item.kind === "multimeter" ? 48 : Math.min(w + 4, 30)} palette={palette} />
              </group>
            </Fragment>
          ))}
          <CameraControls key={v.position.join(",")} makeDefault ref={(c) => void c?.setLookAt(...v.position, ...v.target, false)} />
          <PaperRenderer quality={quality} palette={palette} spot={spot} bloom={1.0} />
        </PaletteContext.Provider>
      </Canvas>
    </div>
  );
}
