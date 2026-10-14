// Unit 3 in ink, top down: the solder station and its iron, spools and braid, perfboard (top and copper side, with
// legs, bends, links and every joint's shape), the plan card, heat-sink clips, hookup wire, the stripper, heat-shrink,
// the heat gun, the barrel-jack board and wall adapters. Drawn in the notebook's ink: graphite outlines, quiet washes.

import { memo, type ReactNode } from "react";
import { useStore } from "zustand";
import { useLabels } from "../../labels";
import { useBenchMaybe, useBenchStoreMaybe, type BenchStore } from "../../store";
import type { BenchState, PlacedPart, PlacedPartOf, Vec2 } from "../../types";
import { ALLOYS } from "../../solder/alloys";
import type { JointLook } from "../../solder/joint";
import { GEOM } from "../../solder/parts";
import { PERF, ROW_LETTERS, padLocal, padMetal, padsOf, parsePerfHole, perfSize, type PlanGhost } from "../../solder/perfboard";
import { tubeMm } from "../../solder/shrink";
import { ironPose, jackSocket } from "../../solder/spots";
import { readJoint } from "../../solder/station";
import { NOTCHES } from "../../solder/strip";
import { toLocal, n3 } from "../frame";
import { Upright, localLegs, rrect } from "./common";
import { WIRE_TOKEN } from "../styles";
import type { DrawProps, InkRegistry } from "./types";

const g = GEOM;

/** A slice of the bench store's live state, re-rendering only when it changes (an empty bench outside one). */
function useStation<T>(sel: (s: ReturnType<BenchStore["getState"]>) => T): T {
  return useBenchMaybe(sel);
}

// ---------------------------------------------------------------------------------------------------------------
// The iron, drawn from its tip to its grip (desk mm). Shared by the stand and the top layer.

export function IronShape({ tip, grip, tinning, bead }: { tip: Vec2; grip: Vec2; tinning: string; bead: boolean }) {
  const dx = grip[0] - tip[0];
  const dz = grip[1] - tip[1];
  const len = Math.hypot(dx, dz) || 1;
  const ang = (Math.atan2(dz, dx) * 180) / Math.PI;
  // From the tip: 9 mm of tip, a shaft, a collar, the grip.
  const k = len / 80;
  const T = 9 * k;
  const S = 30 * k;
  const C = 5 * k;
  const G = len - T - S - C;
  const tipClass = tinning === "oxidised" ? "f-black" : tinning === "tinned" ? "f-solder" : "f-metal-hi";
  return (
    <g transform={`translate(${n3(tip[0])} ${n3(tip[1])}) rotate(${n3(ang)})`}>
      <path d={`M0 0L${n3(T)} -1.6L${n3(T)} 1.6Z`} className={tipClass} />
      <path d={`M0 0L${n3(T)} -1.6L${n3(T)} 1.6Z`} className="ln" />
      {bead && <circle cx={0.6} cy={0} r={1.2} className="f-solder-hi ln-thin" />}
      <rect x={n3(T)} y={-1.9} width={n3(S)} height={3.8} rx={0.8} className="f-metal" />
      <path d={`M${n3(T + 3)} -0.9H${n3(T + S - 3)}`} className="sheen" />
      <rect x={n3(T)} y={-1.9} width={n3(S)} height={3.8} rx={0.8} className="ln" />
      <rect x={n3(T + S)} y={-3.6} width={n3(C)} height={7.2} rx={1.2} className="f-slip ln" />
      <rect x={n3(T + S + C)} y={-4.6} width={n3(G)} height={9.2} rx={4} className="f-grip" />
      <path d={`M${n3(T + S + C + 4)} -4.4v8.8M${n3(T + S + C + 8)} -4.4v8.8M${n3(T + S + C + 12)} -4.4v8.8`} className="ln-soft" />
      <rect x={n3(T + S + C)} y={-4.6} width={n3(G)} height={9.2} rx={4} className="ln" />
    </g>
  );
}

/** The iron when it is out of its stand (resting on work or lying on the desk), with its cord home. */
export const IronLayer = memo(function IronLayer({ store, bench }: { store: BenchStore; bench: BenchState }) {
  const held = useStore(store, (s) => !!s.station?.held);
  const tinning = useStore(store, (s) => s.station?.iron.tinning ?? "tinned");
  const bead = useStore(store, (s) => (s.station?.iron.bead ?? 0) > 0.1);
  const pose = ironPose(bench);
  const st = bench.parts.find((p) => p.kind === "solder-station");
  if (!pose || !st || pose.at === "stand" || held) return null;
  const tip: Vec2 = [pose.tip[0], pose.tip[2]];
  const grip: Vec2 = [pose.grip[0], pose.grip[2]];
  const home = toWorldOf(st, -2, 18);
  const dx = grip[0] - tip[0];
  const dz = grip[1] - tip[1];
  const l = Math.hypot(dx, dz) || 1;
  const end: Vec2 = [tip[0] + (dx / l) * 82, tip[1] + (dz / l) * 82];
  const cord = `M${n3(end[0])} ${n3(end[1])}C${n3(end[0] + (dx / l) * 30)} ${n3(end[1] + (dz / l) * 30 + 20)} ${n3(home[0] - 10)} ${n3(home[1] + 30)} ${n3(home[0])} ${n3(home[1])}`;
  return (
    <g data-own={st.id} className="ohi-iron">
      <path d={cord} className="edge" style={{ ["--w" as string]: "2.4px" }} />
      <path d={cord} className="core" style={{ ["--w" as string]: "2.4px", stroke: "var(--k-ink-2)" }} />
      <IronShape tip={tip} grip={end} tinning={tinning} bead={bead} />
    </g>
  );
});

/** Brown singes where a hot tip lay on the desk paper. */
export const ScorchLayer = memo(function ScorchLayer({ store }: { store: BenchStore }) {
  const marks = useStore(store, (s) => s.station?.scorch ?? EMPTY);
  if (!marks.length) return null;
  return (
    <g className="ohi-scorch" aria-hidden="true">
      {marks.map((m, i) => (
        <g key={i} opacity={Math.min(0.85, 0.25 + m.amount * 0.6)}>
          <path d={`M${n3(m.x - 5)} ${n3(m.z)}c1 -4 5 -6 9 -4c3 1 4 4 1 6c-2 3 -7 4 -9 1c-1 -1 -1 -2 -1 -3z`} className="f-singe" />
          <ellipse cx={n3(m.x + 0.6)} cy={n3(m.z - 0.4)} rx={2} ry={1.3} className="f-scorch" />
        </g>
      ))}
    </g>
  );
});
const EMPTY: { x: number; z: number; amount: number }[] = [];

function toWorldOf(p: PlacedPart, x: number, z: number): Vec2 {
  const r = (p.rot * Math.PI) / 180;
  return [p.pos[0] + x * Math.cos(r) + z * Math.sin(r), p.pos[1] - x * Math.sin(r) + z * Math.cos(r)];
}

// ---------------------------------------------------------------------------------------------------------------
// Solder station: base with display, dial and switch; the stand with sponge, brass wool and the coil.

function Station({ pi }: DrawProps<"solder-station">) {
  const labels = useLabels();
  const p = pi.part.params;
  const tip = useStation((s) => Math.round(s.station?.iron.tipC ?? 25));
  const held = useStation((s) => !!s.station?.held);
  const tinning = useStation((s) => s.station?.iron.tinning ?? p.tinning ?? "tinned");
  const bead = useStation((s) => (s.station?.iron.bead ?? 0) > 0.1);
  const S = g.station;
  const rot = pi.f.rot;
  const angle = -135 + ((p.setC - 150) / 300) * 270;
  const inStand = (p.iron ?? "stand") === "stand" && !held;
  const B = S.base;
  const ST = S.stand;
  return (
    <g>
      {/* Stand: a tray with the sponge, the brass-wool cup and the coil the iron sits in. */}
      <rect x={ST.x - ST.w / 2 + 1.4} y={ST.z - ST.d / 2 + 1.8} width={ST.w} height={ST.d} rx={6} className="f-shade" />
      <rect x={ST.x - ST.w / 2} y={ST.z - ST.d / 2} width={ST.w} height={ST.d} rx={6} className="f-black-face" />
      <rect x={ST.x - ST.w / 2} y={ST.z - ST.d / 2} width={ST.w} height={ST.d} rx={6} className="ln" />
      <rect x={S.sponge.x - S.sponge.w / 2} y={S.sponge.z - S.sponge.d / 2} width={S.sponge.w} height={S.sponge.d} rx={2} className="f-sponge" />
      <path d={`M${S.sponge.x - 8} ${S.sponge.z - 3}h0M${S.sponge.x - 2} ${S.sponge.z + 2}h0M${S.sponge.x + 5} ${S.sponge.z - 4}h0M${S.sponge.x + 9} ${S.sponge.z + 3}h0M${S.sponge.x - 6} ${S.sponge.z + 5}h0`} className="dots" />
      <rect x={S.sponge.x - S.sponge.w / 2} y={S.sponge.z - S.sponge.d / 2} width={S.sponge.w} height={S.sponge.d} rx={2} className="ln-thin" />
      <circle cx={S.wool.x} cy={S.wool.z} r={S.wool.r} className="f-metal ln" />
      <circle cx={S.wool.x} cy={S.wool.z} r={S.wool.r - 2} className="f-brass" />
      <path d={`M${S.wool.x - 5} ${S.wool.z}c2 -3 4 3 6 0s4 3 4 1M${S.wool.x - 4} ${S.wool.z - 3}c2 -2 3 2 5 0s3 2 3 1M${S.wool.x - 4} ${S.wool.z + 3}c2 -2 4 2 6 0`} className="ln-thin" />
      {/* The coil, lying diagonally to hold the iron. */}
      <g transform={`translate(${S.coil.x} ${S.coil.z}) rotate(39)`}>
        <rect x={-12} y={-6} width={24} height={12} rx={6} className="f-metal" />
        {[-9, -5, -1, 3, 7].map((x) => (
          <path key={x} d={`M${x} -6c2 4 2 8 0 12`} className="ln-thin" />
        ))}
        <rect x={-12} y={-6} width={24} height={12} rx={6} className="ln" />
      </g>
      {/* Base unit. */}
      <rect x={B.x - B.w / 2 + 1.6} y={B.z - B.d / 2 + 2} width={B.w} height={B.d} rx={5} className="f-shade" />
      <rect x={B.x - B.w / 2} y={B.z - B.d / 2} width={B.w} height={B.d} rx={5} className="f-station" />
      <rect x={B.x - B.w / 2} y={B.z - B.d / 2} width={B.w} height={B.d} rx={5} className="ln" />
      <Upright x={B.x} z={B.z - B.d / 2 + 7} rot={rot} fontSize={3.2} fontWeight={700} letterSpacing={0.6} textAnchor="middle" dominantBaseline="central" className="print">
        {labels.solder.station}
      </Upright>
      <rect x={S.display.x - S.display.w / 2} y={S.display.z - S.display.d / 2} width={S.display.w} height={S.display.d} rx={1.4} className={p.on ? "f-lcd" : "f-lcd-off"} />
      <rect x={S.display.x - S.display.w / 2} y={S.display.z - S.display.d / 2} width={S.display.w} height={S.display.d} rx={1.4} className="ln" />
      {(p.on || tip > 60) && (
        <Upright x={S.display.x + 1} z={S.display.z + 0.6} rot={rot} fontSize={7} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-lcd-ink">
          {`${tip}°`}
        </Upright>
      )}
      <circle cx={S.dial.x} cy={S.dial.z} r={S.dial.r + 2.6} className="f-slip ln-thin" />
      {[-135, -67, 0, 67, 135].map((a) => {
        const r = (a * Math.PI) / 180;
        return <path key={a} d={`M${n3(S.dial.x + Math.sin(r) * (S.dial.r + 1))} ${n3(S.dial.z - Math.cos(r) * (S.dial.r + 1))}L${n3(S.dial.x + Math.sin(r) * (S.dial.r + 2.4))} ${n3(S.dial.z - Math.cos(r) * (S.dial.r + 2.4))}`} className="ln-thin" />;
      })}
      <g className="dial-knob" transform={`translate(${S.dial.x} ${S.dial.z}) rotate(${n3(angle)})`}>
        <circle r={S.dial.r} className="f-knob" />
        <path d={`M0 ${-S.dial.r + 1.4}V-2`} style={{ stroke: "var(--k-print)", strokeWidth: 1.4, strokeLinecap: "round" }} />
        <circle r={S.dial.r} className="ln" />
      </g>
      <Upright x={S.dial.x - 11} z={S.dial.z} rot={rot} fontSize={5} textAnchor="middle" dominantBaseline="central" className="print">
        {"−"}
      </Upright>
      <Upright x={S.dial.x + 11} z={S.dial.z} rot={rot} fontSize={5} textAnchor="middle" dominantBaseline="central" className="print">
        +
      </Upright>
      {/* Power rocker. */}
      <rect x={S.power.x - 5} y={S.power.z - 4} width={10} height={8} rx={1.2} className="f-black" />
      <rect x={S.power.x - 5 + (p.on ? 5 : 0)} y={S.power.z - 4} width={5} height={8} rx={1} className={p.on ? "f-red" : "f-black-face"} />
      <rect x={S.power.x - 5} y={S.power.z - 4} width={10} height={8} rx={1.2} className="ln" />
      <Upright x={S.power.x} z={S.power.z - 6.6} rot={rot} fontSize={2.8} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print">
        {p.on ? labels.print.on : labels.print.off}
      </Upright>
      {inStand && (
        <>
          <path d={`M${B.x + B.w / 2} ${B.z + 14}C${B.x + B.w / 2 + 14} ${B.z + 30} ${S.ironGrip[0] + 10} ${S.ironGrip[1] + 24} ${S.ironGrip[0]} ${S.ironGrip[1]}`} className="edge" style={{ ["--w" as string]: "2.4px" }} />
          <path d={`M${B.x + B.w / 2} ${B.z + 14}C${B.x + B.w / 2 + 14} ${B.z + 30} ${S.ironGrip[0] + 10} ${S.ironGrip[1] + 24} ${S.ironGrip[0]} ${S.ironGrip[1]}`} className="core" style={{ ["--w" as string]: "2.4px", stroke: "var(--k-ink-2)" }} />
          <IronShape tip={S.ironTip} grip={S.ironGrip} tinning={tinning} bead={bead} />
        </>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Spools and braid.

function Spool({ pi }: DrawProps<"solder-spool">) {
  const a = pi.part.params.alloy;
  const R = g.spool.r;
  const short = a === "leaded" ? "Sn63 Pb37" : a === "lead-free" ? "SAC305" : "ACID";
  const end = g.spool.end;
  return (
    <g>
      <circle cx={1.4} cy={1.8} r={R} className="f-shade" />
      <circle r={R} className={a === "acid" ? "f-gun" : a === "leaded" ? "f-ceramic" : "f-pcb"} />
      <circle r={R - 4} className="f-solder" />
      {[R - 6, R - 8.5, R - 11].map((r) => (
        <circle key={r} r={r} className="ln-soft" />
      ))}
      <circle r={6} className="f-slip ln-thin" />
      <circle r={2.2} className="f-shade" />
      <path d={`M${R - 4} 9C${R + 2} 11 ${end[0] - 4} ${end[1] - 1} ${end[0]} ${end[1]}`} className="s-solder" style={{ strokeWidth: 1.6 }} />
      <circle cx={end[0]} cy={end[1]} r={0.9} className="f-solder-hi ln-thin" />
      <circle r={R} className="ln" />
      <rect x={-12} y={-R + 5} width={24} height={9} rx={1} className="f-slip ln-thin" />
      <Upright x={0} z={-R + 9.6} rot={pi.f.rot} fontSize={3.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print">
        {short}
      </Upright>
      <Upright x={0} z={R - 9} rot={pi.f.rot} fontSize={2.6} textAnchor="middle" dominantBaseline="central" className="print-light lod1">
        {`${ALLOYS[a].liquidus} °C`}
      </Upright>
    </g>
  );
}

function Braid({ pi }: DrawProps<"solder-braid">) {
  const used = pi.part.params.used ?? 0;
  const R = g.braid.r;
  const e = g.braid.end;
  return (
    <g>
      <circle cx={1} cy={1.4} r={R} className="f-shade" />
      <circle r={R} className="f-pcb" />
      <circle r={R - 3} className="f-copper" />
      <circle r={3} className="f-slip ln-thin" />
      <circle r={R} className="ln" />
      <path d={`M${R - 3} 1L${e[0]} ${e[1]}`} style={{ stroke: "var(--k-copper)", strokeWidth: 3, strokeLinecap: "round" }} />
      {used > 0 && <path d={`M${n3(e[0] - 5 * used)} ${n3(e[1] - 1.2 * used)}L${e[0]} ${e[1]}`} style={{ stroke: "var(--k-solder)", strokeWidth: 3, strokeLinecap: "round" }} />}
      <path d={`M${R - 3} 1L${e[0]} ${e[1]}`} className="ln-thin" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Perfboard: holes from the top; pads, legs, bends, links and joints on the copper side.

function JointMark({ at, look, toward }: { at: Vec2; look: JointLook; toward?: Vec2 | null }) {
  const [x, z] = at;
  const fill = look.finish === "dark" ? "f-solder-dull" : look.finish === "dull" ? "f-solder-dull" : look.finish === "liquid" ? "f-solder-hi" : "f-solder";
  const out: ReactNode[] = [];
  if (look.shape === "bridge" && toward) {
    out.push(<path key="neck" d={`M${n3(x)} ${n3(z)}L${n3(toward[0])} ${n3(toward[1])}`} style={{ stroke: "var(--k-solder)", strokeWidth: 1.5, strokeLinecap: "round" }} />);
    out.push(<circle key="n2" cx={n3(toward[0])} cy={n3(toward[1])} r={1.05} className="f-solder" />);
  }
  if (look.shape === "burnt") out.push(<circle key="b" cx={n3(x)} cy={n3(z)} r={1.75} className="f-flux" opacity={0.65} />);
  if (look.shape === "ring") {
    out.push(<circle key="r" cx={n3(x)} cy={n3(z)} r={1.0} className={fill} />);
    out.push(<circle key="h" cx={n3(x)} cy={n3(z)} r={0.5} className="f-copper" />);
    out.push(<circle key="s" cx={n3(x)} cy={n3(z)} r={0.3} className="f-metal" />);
  } else if (look.shape === "lump") {
    out.push(<path key="l" d={`M${n3(x - 1.2)} ${n3(z + 0.2)}c0 -1 0.8 -1.5 1.6 -1.3c0.9 0.2 1 0.9 0.8 1.6c-0.3 0.9 -1 1 -1.6 0.9c-0.6 -0.1 -0.8 -0.6 -0.8 -1.2z`} className={fill} />);
    out.push(<path key="g" d={`M${n3(x + 0.1)} ${n3(z - 0.6)}l0.3 1.1`} className="ln-thin" />);
  } else if (look.shape !== "none") {
    const r = look.shape === "ball" ? 1.42 : 1.12;
    out.push(<circle key="c" cx={n3(x)} cy={n3(z)} r={r} className={fill} />);
    if (look.shape === "frosty") out.push(<path key="cr" d={`M${n3(x - 0.7)} ${n3(z - 0.2)}l0.5 0.4l0.4 -0.5M${n3(x + 0.2)} ${n3(z + 0.5)}l0.5 -0.3`} className="ln-thin" />);
  }
  if (look.shape !== "none") {
    const r = look.shape === "ball" ? 1.42 : look.shape === "ring" ? 1.0 : 1.12;
    out.push(<circle key="o" cx={n3(x)} cy={n3(z)} r={r} className="ln-thin" />);
    if (look.finish === "bright" || look.finish === "liquid") out.push(<path key="hi" d={`M${n3(x - r * 0.55)} ${n3(z - r * 0.25)}a${n3(r * 0.6)} ${n3(r * 0.6)} 0 0 1 ${n3(r * 0.5)} ${n3(-r * 0.4)}`} className="sheen-hi" style={{ strokeWidth: 0.35 }} />);
    if (look.finish === "satin") out.push(<path key="hi" d={`M${n3(x - r * 0.55)} ${n3(z - r * 0.25)}a${n3(r * 0.6)} ${n3(r * 0.6)} 0 0 1 ${n3(r * 0.5)} ${n3(-r * 0.4)}`} className="sheen-hi" style={{ strokeWidth: 0.25, opacity: 0.5 }} />);
  }
  if (look.lifted) out.push(<circle key="lift" cx={n3(x + 0.3)} cy={n3(z - 0.3)} r={1.5} className="ghost" />);
  return <g>{out}</g>;
}

/** Which live joints are on this board (a key for re-rendering). */
function liveKey(s: ReturnType<BenchStore["getState"]>, board: string): string {
  const st = s.station;
  if (!st) return "";
  let k = "";
  for (const [id, j] of Object.entries(st.joints)) if (id.startsWith(`${board}.`)) k += `${id}:${Math.round(j.volume * 20)}:${j.phase}:${Math.round(j.wetted * 10)}:${j.bridgeTo ?? ""};`;
  return k;
}

function Perfboard({ pi }: DrawProps<"perfboard">) {
  const store = useBenchStoreMaybe();
  const fromStore = useBenchMaybe((s) => s.bench);
  useBenchMaybe((s) => liveKey(s, pi.part.id));
  // Drawn alone (a tray icon, a test), the board is its own bench.
  const bench = store ? fromStore : { ...fromStore, parts: [pi.part] };
  const station = store?.getState().station ?? null;
  const p = pi.part.params;
  const flipped = !!p.flipped;
  const { w, d } = perfSize(p);
  const rot = pi.f.rot;
  const pads = padsOf(p);
  const at = (pad: string): Vec2 => padLocal(p, pad)!;
  const out: ReactNode[] = [];
  out.push(<rect key="sh" x={-w / 2 + 1.2} y={-d / 2 + 1.6} width={w} height={d} rx={1.2} className="f-shade" />);
  out.push(<rect key="b" x={-w / 2} y={-d / 2} width={w} height={d} rx={1.2} className="f-perf" />);
  if (p.flexed) out.push(<ellipse key="press" cx={0} cy={0} rx={w * 0.22} ry={d * 0.28} className="f-blue-wash" opacity={0.7} />);
  // Row letters and column numbers along two edges (mirrored on the copper side).
  const cols = Array.from({ length: p.cols }, (_, i) => i + 1);
  for (const c of cols) {
    const x = padLocal(p, `A${c}`)![0];
    out.push(
      <Upright key={`c${c}`} x={x} z={-d / 2 + 1.3} rot={rot} fontSize={1.5} textAnchor="middle" dominantBaseline="central" className="print lod2">
        {String(c)}
      </Upright>,
    );
  }
  for (let r = 1; r <= p.rows; r++) {
    const z = padLocal(p, `${ROW_LETTERS[r - 1]}1`)![1];
    out.push(
      <Upright key={`r${r}`} x={flipped ? w / 2 - 1.3 : -w / 2 + 1.3} z={z} rot={rot} fontSize={1.5} textAnchor="middle" dominantBaseline="central" className="print lod2">
        {ROW_LETTERS[r - 1]!}
      </Upright>,
    );
  }
  if (!flipped) {
    const holes = pads.map((pad) => {
      const [x, z] = at(pad);
      return `M${n3(x - 0.45)} ${n3(z)}a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0`;
    });
    out.push(<path key="holes" d={holes.join("")} className="f-hole-in" />);
  } else {
    // Copper pads with their holes.
    const ring = pads.map((pad) => {
      const [x, z] = at(pad);
      return `M${n3(x - 0.95)} ${n3(z)}a0.95 0.95 0 1 0 1.9 0a0.95 0.95 0 1 0 -1.9 0`;
    });
    out.push(<path key="pads" d={ring.join("")} className="f-copper" />);
    out.push(<path key="padln" d={ring.join("")} className="ln-soft" />);
    const holes = pads.map((pad) => {
      const [x, z] = at(pad);
      return `M${n3(x - 0.42)} ${n3(z)}a0.42 0.42 0 1 0 0.84 0a0.42 0.42 0 1 0 -0.84 0`;
    });
    out.push(<path key="holes" d={holes.join("")} className="f-hole-in" />);
    // Links underneath.
    for (const l of p.links ?? []) {
      const a = at(l.a);
      const b = at(l.b);
      const dpath = `M${n3(a[0])} ${n3(a[1])}L${n3(b[0])} ${n3(b[1])}`;
      if (l.insulated) {
        out.push(<path key={`le${l.id}`} d={dpath} className="edge" style={{ ["--w" as string]: "1.1px" }} />);
        out.push(<path key={`lc${l.id}`} d={dpath} className="core" style={{ ["--w" as string]: "1.1px", stroke: WIRE_TOKEN(l.color ?? "blue") }} />);
      } else out.push(<path key={`l${l.id}`} d={dpath} className="lead" />);
    }
    // Leg stubs and bent legs.
    for (const [pad, m] of padMetal(bench, pi.part)) {
      for (const leg of m.legs) {
        const bentTo = p.bends?.[`${leg.part}.${leg.leg}`];
        const a = at(pad);
        if (bentTo && bentTo !== pad) {
          const b = at(bentTo);
          out.push(<path key={`b${leg.part}${leg.leg}`} d={`M${n3(a[0])} ${n3(a[1])}L${n3(b[0])} ${n3(b[1])}`} className="lead" style={{ strokeWidth: "max(.8px, calc(var(--px,.1) * 2.6px))" }} />);
        }
        if (!(p.snipped ?? []).includes(leg.part)) out.push(<circle key={`s${leg.part}${leg.leg}`} cx={n3(a[0])} cy={n3(a[1])} r={0.36} className="f-metal ln-thin" />);
      }
    }
    // Joints: as they set, or live while being made.
    for (const pad of pads) {
      const spot = `${pi.part.id}.${pad}`;
      const r = readJoint(bench, station, spot);
      if (!r || r.phase === "bare") continue;
      out.push(<JointMark key={`j${pad}`} at={at(pad)} look={r.look} toward={r.bridgeTo ? at(r.bridgeTo) : null} />);
    }
  }
  // The plan's ghosts (top) or lines (copper side).
  const plan = p.plan ? (bench.parts.find((x) => x.id === p.plan && x.kind === "plan-card") as PlacedPartOf<"plan-card"> | undefined) : undefined;
  if (plan) {
    if (!flipped) for (const gh of plan.params.ghosts ?? []) out.push(<Ghost key={`g${gh.id}`} ghost={gh} at={at} rot={rot} filled={ghostFilled(bench, pi.part.id, gh)} />);
    else
      (plan.params.lines ?? []).forEach(([a, b], i) => {
        const A = at(a);
        const B = at(b);
        out.push(<path key={`pl${i}`} d={`M${n3(A[0])} ${n3(A[1])}L${n3(B[0])} ${n3(B[1])}`} className="plan-line" />);
      });
  }
  out.push(<rect key="o" x={-w / 2} y={-d / 2} width={w} height={d} rx={1.2} className="ln" />);
  return <g>{out}</g>;
}

function ghostFilled(bench: BenchState, board: string, gh: PlanGhost): boolean {
  return bench.parts.some((p) => p.kind === gh.kind && Object.entries(gh.legs).every(([leg, pad]) => p.holes?.[leg] === `${board}:${pad}`));
}

function Ghost({ ghost, at, rot, filled }: { ghost: PlanGhost; at: (pad: string) => Vec2; rot: number; filled: boolean }) {
  const pts = Object.values(ghost.legs).map(at);
  if (!pts.length) return null;
  const xs = pts.map((q) => q[0]);
  const zs = pts.map((q) => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const wd = Math.max(...xs) - Math.min(...xs);
  const ht = Math.max(...zs) - Math.min(...zs);
  // Flying leads (a battery snap): just where each lead goes, marked + and −.
  if (ghost.kind === "battery") {
    return (
      <g opacity={filled ? 0.35 : 1}>
        {Object.entries(ghost.legs).map(([leg, pad]) => {
          const q = at(pad);
          return (
            <g key={leg}>
              <circle cx={n3(q[0])} cy={n3(q[1])} r={1.3} className="ghost" />
              <Upright x={q[0] + 2.4} z={q[1] - 1.6} rot={rot} fontSize={2} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="t-red">
                {leg === "pos" ? "+" : "−"}
              </Upright>
            </g>
          );
        })}
      </g>
    );
  }
  const body =
    ghost.kind === "led" ? (
      <circle cx={n3(cx)} cy={n3(cz)} r={2.2} className="ghost" />
    ) : ghost.kind === "resistor" || ghost.kind === "diode" ? (
      <rect x={n3(cx - Math.max(wd, ht) / 2 + 1.4)} y={n3(cz - 1.2)} width={n3(Math.max(wd, ht) - 2.8)} height={2.4} rx={1} className="ghost" transform={ht > wd ? `rotate(90 ${n3(cx)} ${n3(cz)})` : undefined} />
    ) : (
      <rect x={n3(Math.min(...xs) - 1.6)} y={n3(Math.min(...zs) - 1.6)} width={n3(wd + 3.2)} height={n3(ht + 3.2)} rx={1} className="ghost" />
    );
  return (
    <g opacity={filled ? 0.35 : 1}>
      {body}
      {pts.map((q, i) => (
        <circle key={i} cx={n3(q[0])} cy={n3(q[1])} r={0.7} className="ghost" />
      ))}
      <Upright x={cx} z={cz - 3.6} rot={rot} fontSize={1.8} textAnchor="middle" dominantBaseline="central" className="t-red lod1">
        {ghost.id}
      </Upright>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The plan card: the top view with its ghosts, and the underside mirrored with numbered lines.

function PlanCard({ pi }: DrawProps<"plan-card">) {
  const p = pi.part.params;
  const W = g.plan.w;
  const D = g.plan.d;
  const rot = pi.f.rot;
  const pitch = Math.min(4.6, (W / 2 - 10) / Math.max(1, p.cols), (D - 22) / Math.max(1, p.rows));
  const panel = (ox: number, mirror: boolean) => {
    const pos = (pad: string): Vec2 => {
      const m = /^([A-Z])(\d{1,2})$/.exec(pad);
      if (!m) return [ox, 0];
      const col = Number(m[2]);
      const row = ROW_LETTERS.indexOf(m[1]!) + 1;
      const cc = mirror ? p.cols + 1 - col : col;
      return [ox + (cc - (p.cols + 1) / 2) * pitch, 6 + (row - (p.rows + 1) / 2) * pitch];
    };
    const dots: string[] = [];
    for (let r = 1; r <= p.rows; r++) for (let c = 1; c <= p.cols; c++) {
      const [x, z] = pos(`${ROW_LETTERS[r - 1]}${c}`);
      dots.push(`M${n3(x)} ${n3(z)}h0`);
    }
    const items: ReactNode[] = [<path key="d" d={dots.join("")} className="dots" />];
    if (!mirror) for (const gh of p.ghosts ?? []) items.push(<Ghost key={gh.id} ghost={gh} at={pos} rot={rot} filled={false} />);
    else
      (p.lines ?? []).forEach(([a, b], i) => {
        const A = pos(a);
        const B = pos(b);
        items.push(<path key={`l${i}`} d={`M${n3(A[0])} ${n3(A[1])}L${n3(B[0])} ${n3(B[1])}`} className="plan-line" />);
        items.push(
          <Upright key={`n${i}`} x={(A[0] + B[0]) / 2 + 1.4} z={(A[1] + B[1]) / 2 - 1.4} rot={rot} fontSize={2.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="t-blue">
            {String(i + 1)}
          </Upright>,
        );
      });
    return items;
  };
  return (
    <g>
      <rect x={-W / 2 + 1.2} y={-D / 2 + 1.6} width={W} height={D} rx={1.5} className="f-shade" />
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={1.5} className="f-slip" />
      <path d={`M0 ${-D / 2 + 12}V${D / 2 - 4}`} className="ln-soft" strokeDasharray="2 2" />
      <Upright x={-W / 2 + 6} z={-D / 2 + 6} rot={rot} fontSize={3.6} fontWeight={700} dominantBaseline="central" className="print">
        {p.title ?? "PLAN"}
      </Upright>
      <Upright x={-W / 4} z={-D / 2 + 13} rot={rot} fontSize={2.6} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print">
        TOP
      </Upright>
      <Upright x={W / 4} z={-D / 2 + 13} rot={rot} fontSize={2.6} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print">
        UNDERSIDE
      </Upright>
      {panel(-W / 4, false)}
      {panel(W / 4, true)}
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={1.5} className="ln" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Heat-sink clip, gripping a lead or lying loose.

function Clip({ pi }: DrawProps<"heat-sink-clip">) {
  const cu = pi.part.params.metal === "copper";
  const on = !!pi.part.params.on;
  const L = g.clip.len;
  const W = g.clip.w;
  // Across the lead when gripping (the lead runs along x), its jaws in the middle.
  return (
    <g transform={on ? "rotate(90)" : undefined}>
      <rect x={-L / 2 + 0.8} y={-W / 2 + 1} width={L} height={W} rx={1.6} className="f-shade" />
      <rect x={-L / 2} y={-W / 2} width={L} height={W} rx={1.6} className={cu ? "f-copper" : "f-metal"} />
      {[-6, -3, 0, 3, 6].map((x) => (
        <path key={x} d={`M${x + 1} ${-W / 2}v${W}`} className="ln-soft" />
      ))}
      <rect x={-L / 2} y={-W / 2} width={L} height={W} rx={1.6} className="ln" />
      <path d={`M${-L / 2 + 2} ${-W / 2 + 1.2}l${L / 2 - 3} ${W / 2 - 1.2}l${L / 2 - 3} ${-W / 2 + 1.2}`} className="ln-thin" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Hookup wire: the jacket from end to end, bare copper where it is stripped.

function Wire({ pi }: DrawProps<"hookup-wire">) {
  const L = localLegs(pi);
  const a = L.a!;
  const b = L.b!;
  const p = pi.part.params;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len;
  const uz = (b[1] - a[1]) / len;
  const bare = (end: "a" | "b") => Math.min(len / 3, p.ends?.[end]?.mm ?? 0);
  const ba = bare("a");
  const bb = bare("b");
  const ja: Vec2 = [a[0] + ux * ba, a[1] + uz * ba];
  const jb: Vec2 = [b[0] - ux * bb, b[1] - uz * bb];
  const bow = Math.min(6, len * 0.06);
  const mid: Vec2 = [(ja[0] + jb[0]) / 2 - uz * bow, (ja[1] + jb[1]) / 2 + ux * bow];
  const jacket = `M${n3(ja[0])} ${n3(ja[1])}Q${n3(mid[0])} ${n3(mid[1])} ${n3(jb[0])} ${n3(jb[1])}`;
  const out: ReactNode[] = [];
  out.push(<path key="e" d={jacket} className="edge" style={{ ["--w" as string]: "1.6px" }} />);
  out.push(<path key="c" d={jacket} className="core" style={{ ["--w" as string]: "1.6px", stroke: WIRE_TOKEN(p.color) }} />);
  for (const [end, from, to] of [["a", a, ja], ["b", b, jb]] as const) {
    const e = p.ends?.[end];
    if (!e || e.mm <= 0) continue;
    out.push(<path key={`b${end}`} d={`M${n3(from[0])} ${n3(from[1])}L${n3(to[0])} ${n3(to[1])}`} className="bare" />);
    if (e.nicked) {
      const m: Vec2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      out.push(<path key={`n${end}`} d={`M${n3(m[0] - uz * 0.9)} ${n3(m[1] + ux * 0.9)}l${n3(uz * 0.7 + ux * 0.4)} ${n3(-ux * 0.7 + uz * 0.4)}`} className="ln" />);
    }
    if (p.stranded && !e.twisted) out.push(<path key={`f${end}`} d={`M${n3(from[0])} ${n3(from[1])}l${n3(-ux * 1.4 + uz * 1)} ${n3(-uz * 1.4 - ux * 1)}M${n3(from[0])} ${n3(from[1])}l${n3(-ux * 1.4 - uz * 1)} ${n3(-uz * 1.4 + ux * 1)}`} className="s-copper" style={{ strokeWidth: 0.3 }} />);
    if (e.twisted) out.push(<path key={`t${end}`} d={`M${n3(to[0])} ${n3(to[1])}L${n3(from[0])} ${n3(from[1])}`} className="ln-soft" strokeDasharray="0.6 0.6" />);
  }
  if (p.ends?.a?.slipped || p.ends?.b?.slipped) {
    const end = p.ends?.a?.slipped ? ja : jb;
    out.push(<path key="slip" d={`M${n3(end[0] - 1)} ${n3(end[1] - 1.2)}q1 0.6 2 0`} className="ln-thin" />);
  }
  for (const end of ["a", "b"] as const) {
    const j = p.joints?.[end];
    if (!j) continue;
    const at = end === "a" ? a : b;
    out.push(<ellipse key={`j${end}`} cx={n3(at[0] - ux * 2)} cy={n3(at[1] - uz * 2)} rx={3.2} ry={1.5} transform={`rotate(${n3((Math.atan2(uz, ux) * 180) / Math.PI)} ${n3(at[0] - ux * 2)} ${n3(at[1] - uz * 2)})`} className={j.verdict === "cold" || j.verdict === "disturbed" ? "f-solder-dull ln-thin" : "f-solder ln-thin"} />);
  }
  return <g>{out}</g>;
}

// ---------------------------------------------------------------------------------------------------------------
// Wire stripper: notched jaws with their numbers, red handles.

function Stripper({ pi }: DrawProps<"wire-stripper">) {
  const p = pi.part.params;
  const rot = pi.f.rot;
  const jaw0 = -60;
  return (
    <g>
      <path d="M-58 -6L-14 -5L48 -12Q60 -13 60 -8L58 -4L-12 1Z" className="f-shade" transform="translate(1.2 1.6)" />
      <path d="M-14 -4L48 -11Q58 -12 59 -7L57 -3L-12 1Z" className="f-handle" />
      <path d="M-14 4L48 11Q58 12 59 7L57 3L-12 -1Z" className="f-handle" />
      <path d="M-14 -4L48 -11Q58 -12 59 -7L57 -3L-12 1ZM-14 4L48 11Q58 12 59 7L57 3L-12 -1Z" className="ln" />
      <rect x={jaw0} y={-6} width={48} height={12} rx={2} className="f-metal" />
      <path d={`M${jaw0} 0H-12`} className="ln-thin" />
      {NOTCHES.map((n, i) => {
        const x = jaw0 + 6 + i * 5;
        const on = n === p.notch;
        return (
          <g key={n}>
            <path d={`M${x} -1.4a1.4 1.4 0 0 0 0 2.8`} className={on ? "sel" : "ln-thin"} />
            <Upright x={x} z={-3.6} rot={rot} fontSize={1.9} textAnchor="middle" dominantBaseline="central" className={on ? "t-blue lod1" : "print lod1"}>
              {String(n)}
            </Upright>
          </g>
        );
      })}
      <Upright x={jaw0 + 24} z={3.8} rot={rot} fontSize={1.8} textAnchor="middle" dominantBaseline="central" className="print lod1">
        {p.scale === "stranded" ? "STRANDED" : "SOLID"}
      </Upright>
      <rect x={jaw0} y={-6} width={48} height={12} rx={2} className="ln" />
      <circle cx={-12} cy={0} r={2.2} className="f-metal-hi ln" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Heat-shrink, heat gun.

function Tube({ pi }: DrawProps<"heat-shrink">) {
  const p = pi.part.params;
  const shrink = p.shrink ?? 0;
  const L = g.tube.len * (1 - 0.06 * shrink);
  // Drawn a little larger than life so the change reads.
  const W = Math.max(1.6, tubeMm(p.size, shrink) * 1.4);
  return (
    <g>
      <rect x={-L / 2 + 0.6} y={-W / 2 + 0.8} width={L} height={W} rx={W / 2} className="f-shade" />
      <rect x={-L / 2} y={-W / 2} width={L} height={W} rx={Math.min(W / 2, 1.4)} className="f-shrink" />
      {shrink > 0.3 && <path d={`M${-L / 2 + 2} ${-W / 4}H${L / 2 - 2}`} className="sheen" />}
      {p.split && <path d={`M-4 ${-W / 2}l2 ${W * 0.4}l-1 ${W * 0.3}l3 ${W * 0.3}`} className="crack" style={{ strokeWidth: 0.5 }} />}
      <rect x={-L / 2} y={-W / 2} width={L} height={W} rx={Math.min(W / 2, 1.4)} className="ln" />
    </g>
  );
}

function Gun({ pi }: DrawProps<"heat-gun">) {
  const on = pi.part.params.on;
  const rot = pi.f.rot;
  const N = g.gun.nozzle;
  return (
    <g>
      <path d="M-64 -7H40Q75 -7 75 0Q75 7 40 7H-64Z" className="f-shade" transform="translate(1.4 1.8)" />
      <rect x={20} y={6} width={18} height={34} rx={5} className="f-black-face ln" />
      <path d="M-40 -9H40Q75 -10 75 0Q75 10 40 9H-40Z" className="f-gun" />
      <path d="M-40 -9H40Q75 -10 75 0Q75 10 40 9H-40Z" className="ln" />
      <rect x={N[0]} y={-5} width={24} height={10} rx={1.5} className="f-metal ln" />
      <path d="M52 -6v12M58 -7v14M64 -6v12" className="ln-soft" />
      <rect x={28} y={-4} width={12} height={8} rx={1.4} className={on ? "f-red ln-thin" : "f-black ln-thin"} />
      <Upright x={34} z={9.5} rot={rot} fontSize={2.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print lod1">
        {on ? "ON" : "OFF"}
      </Upright>
      {on &&
        [-3, 0, 3].map((z) => (
          <path key={z} d={`M${N[0] - 2} ${z}c-4 -2 -6 2 -10 0s-6 2 -10 0s-6 2 -10 0`} className="air" />
        ))}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Barrel-jack board and wall adapters.

function Jack({ pi }: DrawProps<"barrel-jack">) {
  const L = localLegs(pi);
  const J = g.jack;
  const tip = L.tip ?? [0, 0];
  const sl = L.sleeve ?? [0, 2.54];
  // The socket hangs off past the pins (on the board), or lies above them (on the desk).
  const dx = sl[0] - tip[0];
  const dz = sl[1] - tip[1];
  const l = Math.hypot(dx, dz) || 1;
  const ux = dx / l;
  const uz = dz / l;
  const c: Vec2 = [tip[0] + ux * (J.socket - 2), tip[1] + uz * (J.socket - 2)];
  const desk = pi.mount === "desk";
  const center: Vec2 = desk ? [0, 0] : c;
  const ang = desk ? 0 : (Math.atan2(uz, ux) * 180) / Math.PI - 90;
  return (
    <g>
      {[tip, sl].map((q, i) => (
        <circle key={i} cx={n3(q[0])} cy={n3(q[1])} r={0.6} className="f-metal ln-thin" />
      ))}
      <g transform={`translate(${n3(center[0])} ${n3(center[1])}) rotate(${n3(ang)})`}>
        <rect x={-J.w / 2 - 1} y={-J.d / 2} width={J.w + 2} height={J.d} rx={1} className="f-pcb" />
        <rect x={-J.w / 2 + 1} y={-J.d / 2 + 2} width={J.w - 2} height={J.d - 6} rx={1.6} className="f-black" />
        <circle cx={0} cy={J.d / 2 - 6} r={3} className="f-black-face ln-thin" />
        <circle cx={0} cy={J.d / 2 - 6} r={1} className="f-metal" />
        <rect x={-J.w / 2 - 1} y={-J.d / 2} width={J.w + 2} height={J.d} rx={1} className="ln" />
      </g>
    </g>
  );
}

/** The polarity drawing on an adapter's label: a dot inside a C, the dot's line to + (centre plus) or −. */
function Polarity({ x, z, centre }: { x: number; z: number; centre: "plus" | "minus" }) {
  const plus = centre === "plus";
  return (
    <g transform={`translate(${n3(x)} ${n3(z)})`}>
      <path d="M-4.2 -1.6a2 2 0 1 0 0 3.2" className="ln-thin" />
      <circle cx={-4.6} cy={0} r={0.5} className="f-ink" />
      <path d="M-4.6 0H-1M-7 0h-2" className="ln-thin" />
      <text x={0.6} y={0.9} fontSize={2.6} fontWeight={700} className="print">
        {plus ? "+" : "−"}
      </text>
      <text x={-12.2} y={0.9} fontSize={2.6} fontWeight={700} className="print">
        {plus ? "−" : "+"}
      </text>
    </g>
  );
}

function Adapter({ pi }: DrawProps<"wall-adapter">) {
  const p = pi.part.params;
  const A = g.adapter;
  const rot = pi.f.rot;
  const end = pi.ends?.plug?.pos ?? pi.legs.plug ?? [pi.f.ox, pi.f.oz + 60];
  const e = toLocal(pi.f, end[0], end[1]);
  const cord = `M0 ${A.d / 2}C0 ${A.d / 2 + 30} ${n3(e[0])} ${n3(e[1] + 24)} ${n3(e[0])} ${n3(e[1] + 6)}`;
  const mark = p.type === "ac" ? "~" : "⎓";
  return (
    <g>
      <path d={cord} className="edge" style={{ ["--w" as string]: "1.9px" }} />
      <path d={cord} className="core" style={{ ["--w" as string]: "1.9px", stroke: "var(--k-ink-2)" }} />
      <rect x={n3(e[0] - 2.4)} y={n3(e[1] - 2)} width={4.8} height={9} rx={1} className="f-black ln" />
      <rect x={n3(e[0] - 1.4)} y={n3(e[1] - 6)} width={2.8} height={4.4} className="f-metal ln-thin" />
      <rect x={-A.w / 2 + 1.4} y={-A.d / 2 + 1.8} width={A.w} height={A.d} rx={4} className="f-shade" />
      <rect x={-A.w / 2} y={-A.d / 2} width={A.w} height={A.d} rx={4} className="f-black" />
      <rect x={-A.w / 2} y={-A.d / 2} width={A.w} height={A.d} rx={4} className="ln" />
      <rect x={-A.w / 2 + 4} y={-A.d / 2 + 4} width={A.w - 8} height={A.d - 10} rx={1} className="f-slip ln-thin" />
      <Upright x={0} z={-A.d / 2 + 9} rot={rot} fontSize={3.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print">
        {`${p.volts} V ${mark} ${p.amps >= 1 ? `${p.amps} A` : `${Math.round(p.amps * 1000)} mA`}`}
      </Upright>
      {p.type !== "ac" && <Polarity x={4} z={-A.d / 2 + 16} centre={p.centre} />}
      <Upright x={0} z={-A.d / 2 + 22} rot={rot} fontSize={2.4} textAnchor="middle" dominantBaseline="central" className="print lod1">
        {p.type === "unregulated" ? "UNREGULATED" : p.type === "ac" ? "AC OUTPUT" : "REGULATED"}
      </Upright>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export const SOLDER_INK: InkRegistry = {
  "solder-station": {
    box: () => [g.station.base.x - g.station.base.w / 2, -g.station.stand.d / 2 - 2, g.station.stand.x + g.station.stand.w / 2, g.station.base.d / 2],
    Draw: Station,
    layer: 0,
  },
  "solder-spool": { box: () => [-g.spool.r, -g.spool.r, g.spool.end[0] + 2, g.spool.r], Draw: Spool },
  "solder-braid": { box: () => [-g.braid.r, -g.braid.r, g.braid.end[0] + 2, g.braid.r], Draw: Braid },
  perfboard: {
    box: (part) => {
      const { w, d } = perfSize(part.params);
      return [-w / 2, -d / 2, w / 2, d / 2];
    },
    Draw: Perfboard,
    layer: 0,
  },
  "plan-card": { box: () => [-g.plan.w / 2, -g.plan.d / 2, g.plan.w / 2, g.plan.d / 2], Draw: PlanCard, layer: 0 },
  "heat-sink-clip": { box: (part) => (part.params.on ? [-g.clip.w / 2, -g.clip.len / 2, g.clip.w / 2, g.clip.len / 2] : [-g.clip.len / 2, -g.clip.w / 2, g.clip.len / 2, g.clip.w / 2]), Draw: Clip },
  "hookup-wire": {
    box: (part) => {
      const h = Math.min(60, part.params.len / 2);
      return [-h, -3, h, 3];
    },
    Draw: Wire,
  },
  "wire-stripper": { box: () => [-60, -12, 60, 12], Draw: Stripper },
  "heat-shrink": { box: (part) => [-g.tube.len / 2, -Math.max(2, part.params.size), g.tube.len / 2, Math.max(2, part.params.size)], Draw: Tube },
  "heat-gun": { box: () => [-64, -10, 75, 40], Draw: Gun },
  "barrel-jack": {
    box: (_part, c) => (c.mount === "board" ? [-g.jack.w / 2 - 1, -1, g.jack.w / 2 + 1, g.jack.socket + g.jack.d / 2] : [-g.jack.w / 2 - 1, -g.jack.d / 2, g.jack.w / 2 + 1, g.jack.d / 2 + 4]),
    Draw: Jack,
  },
  "wall-adapter": { box: () => [-g.adapter.w / 2, -g.adapter.d / 2, g.adapter.w / 2, g.adapter.d / 2], Draw: Adapter },
};

export { jackSocket, parsePerfHole, PERF };
