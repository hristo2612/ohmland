// The live layers of the ink bench: parts (each listening to its own simulator state), jumper wires, clip leads,
// LED glow and smoke. Static things never re-render on a snapshot; a part re-renders only when its look changes.

import { memo } from "react";
import { useStore } from "zustand";
import type { BenchStore } from "../../store";
import type { Vec2 } from "../../types";
import { INK, frameTransform, toWorld } from "../frame";
import type { ClipEnd, LeadInk, PartInk, WireInk } from "../model";
import { FlyingLeads, PartDrawing, inkKind } from "../kinds";
import { ledLightLocal } from "../kinds/radial";
import { WIRE_TOKEN } from "../styles";
import { n3, useLive } from "./shared";

const deg = (v: Vec2) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;

/** One placed part: its drawing in its frame, its flexible leads, fed its own simulator state. */
export const PartView = memo(function PartView({ pi, store, name }: { pi: PartInk; store: BenchStore; name: string }) {
  const st = useLive(store, pi.part.id);
  const pressed = useStore(store, (s) => !!s.ui.pressed[pi.part.id]);
  // The desk clock shows simulated time; nothing else re-renders as it passes.
  const clock = !!inkKind(pi.part.kind).clock;
  const minutes = useStore(store, (s) => (clock ? Math.floor((s.snapshot?.t ?? 0) / 60) : 0));
  return (
    <g data-own={pi.part.id} data-kb={`part:${pi.part.id}`} tabIndex={0} role="button" aria-label={name}>
      <FlyingLeads pi={pi} />
      <g transform={frameTransform(pi.f)}>
        <PartDrawing pi={pi} st={st} pressed={pressed} minutes={minutes} />
      </g>
    </g>
  );
});

export const WireView = memo(function WireView({ wi, name }: { wi: WireInk; name: string }) {
  const { a, b, ctrl } = wi;
  const d = `M${n3(a[0])} ${n3(a[1])}Q${n3(ctrl[0])} ${n3(ctrl[1])} ${n3(b[0])} ${n3(b[1])}`;
  const w = { ["--w" as string]: `${INK.jumperW}px` };
  return (
    <g data-own={wi.wire.id} data-kb={`wire:${wi.wire.id}`} tabIndex={-1} role="button" aria-label={name}>
      <path d={d} className="edge" style={w} />
      <path d={d} className="core" style={{ ...w, stroke: WIRE_TOKEN(wi.wire.color) }} />
      <circle cx={n3(a[0])} cy={n3(a[1])} r={0.62} className="f-metal ln-thin" />
      <circle cx={n3(b[0])} cy={n3(b[1])} r={0.62} className="f-metal ln-thin" />
    </g>
  );
});

/** A crocodile clip: metal jaws at the tip, a coloured boot toward the tail. */
function Clip({ e, color, held, kb, name }: { e: ClipEnd; color: string; held: boolean; kb: string; name: string }) {
  const L = INK.clipLen;
  const J = INK.clipJaw;
  const w = INK.clipW / 2;
  const open = held ? 0.9 : 0;
  return (
    <g transform={`translate(${n3(e.tip[0])} ${n3(e.tip[1])}) rotate(${n3(deg(e.dir))})`} data-kb={kb} tabIndex={0} role="button" aria-label={name}>
      <path d={`M-0.4 ${-w * 0.55 - open}L${J} ${-w * 0.85}V${w * 0.85}L-0.4 ${w * 0.55 + open}Z`} className="f-metal ln" />
      <path d={`M0.8 ${-w * 0.25}l1 ${-w * 0.4}M2.6 ${-w * 0.3}l1 ${-w * 0.42}M4.4 ${-w * 0.36}l1 ${-w * 0.42}`} className="ln-thin" />
      <path d={`M${J} ${-w}H${L - 1.8}Q${L} ${-w} ${L} ${-w + 1.8}V${w - 1.8}Q${L} ${w} ${L - 1.8} ${w}H${J}Z`} style={{ fill: WIRE_TOKEN(color) }} />
      <path d={`M${J + 2.6} ${-w}V${w}M${J + 4.4} ${-w}V${w}`} className="ln-soft" />
      <path d={`M${J} ${-w}H${L - 1.8}Q${L} ${-w} ${L} ${-w + 1.8}V${w - 1.8}Q${L} ${w} ${L - 1.8} ${w}H${J}Z`} className={held ? "snap" : "ln"} strokeDasharray={held ? "3 3" : undefined} />
    </g>
  );
}

export const LeadView = memo(function LeadView({ li, held, names }: { li: LeadInk; held: "a" | "b" | null; names: [string, string] }) {
  const w = { ["--w" as string]: `${INK.cableW}px` };
  return (
    <g data-own={li.lead.id}>
      <path d={li.path} className="edge" style={w} />
      <path d={li.path} className="core" style={{ ...w, stroke: WIRE_TOKEN(li.lead.color) }} />
      <Clip e={li.a} color={li.lead.color} held={held === "a"} kb={`clip:${li.lead.id}.a`} name={names[0]} />
      <Clip e={li.b} color={li.lead.color} held={held === "b"} kb={`clip:${li.lead.id}.b`} name={names[1]} />
    </g>
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Light and smoke.

/** Where an LED's light comes from, and how big its halo is at full brightness. */
function ledLight(pi: PartInk): { at: Vec2; r: number; rim: number } {
  const l = ledLightLocal((pi.part.params as { size?: 3 | 5 }).size ?? 5, pi.mount);
  return { at: toWorld(pi.f, l.c[0], l.c[1]), r: l.reach, rim: l.rim + (pi.mount === "board" ? 0.8 : 1.4) };
}

const LedGlow = memo(function LedGlow({ pi, store, defs, rays: allowRays }: { pi: PartInk; store: BenchStore; defs: string; rays: boolean }) {
  const st = useLive(store, pi.part.id);
  // In a dim room even a faint glow stands out.
  const room = useStore(store, (s) => Math.round(Math.max(0.05, Math.min(1, s.ambient)) * 20) / 20);
  const raw = st && st.health !== "dead" ? Math.max(0, Math.min(1, st.glow ?? 0)) : 0;
  if (raw < 0.02) return null;
  const glow = Math.min(1, raw * (1 + (1 - room) * 2));
  const { at, r, rim } = ledLight(pi);
  const color = (pi.part.params as { color: string }).color;
  const R = r * (0.45 + glow * 0.65) * (1 + (1 - room) * 0.6);
  const rays = allowRays && glow > 0.12;
  return (
    <g className="glow" data-own={pi.part.id}>
      <circle cx={n3(at[0])} cy={n3(at[1])} r={n3(R)} fill={`url(#${defs}-glow-${color})`} opacity={Math.min(1, 0.35 + glow * 0.75)} />
      {rays && (
        <g opacity={Math.min(1, glow * 1.3)} style={{ stroke: `var(--k-lit-${color})` }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const t = (a * Math.PI) / 180;
            const r0 = rim + 1.2;
            const r1 = r0 + rim * 0.55 * (0.6 + glow * 0.6);
            return <path key={a} d={`M${n3(at[0] + Math.cos(t) * r0)} ${n3(at[1] + Math.sin(t) * r0)}L${n3(at[0] + Math.cos(t) * r1)} ${n3(at[1] + Math.sin(t) * r1)}`} className="ray" />;
          })}
        </g>
      )}
    </g>
  );
});

export function GlowLayer({ parts, store, defs, quality }: { parts: PartInk[]; store: BenchStore; defs: string; quality: "high" | "low" }) {
  return (
    <g>
      {parts
        .filter((p) => p.part.kind === "led")
        .map((p) => (
          <LedGlow key={p.part.id} pi={p} store={store} defs={defs} rays={quality === "high"} />
        ))}
    </g>
  );
}

/** Smoke rising from an overloaded part: drifting wisps, or still ones under reduced motion. */
const Smoke = memo(function Smoke({ pi, store }: { pi: PartInk; store: BenchStore }) {
  const st = useLive(store, pi.part.id);
  const hp = st?.health ?? "ok";
  if (hp !== "smoking" && hp !== "dead") return null;
  if (pi.part.kind === "battery" && hp === "dead") return null;
  const c = toWorld(pi.f, (pi.box[0] + pi.box[2]) / 2, (pi.box[1] + pi.box[3]) / 2);
  const top = Math.min(...[0, 1, 2, 3].map((i) => toWorld(pi.f, i % 2 ? pi.box[2] : pi.box[0], i < 2 ? pi.box[1] : pi.box[3])[1]));
  const s = pi.mount === "board" ? 1 : 1.8;
  const x = c[0];
  const z = top - 0.6;
  const wisp = (dx: number, h: number) => `M${n3(x + dx)} ${n3(z)}c${n3(-2 * s)} ${n3(-h * 0.25)} ${n3(2 * s)} ${n3(-h * 0.45)} 0 ${n3(-h * 0.7)}s${n3(-1.2 * s)} ${n3(-h * 0.25)} ${n3(0.6 * s)} ${n3(-h * 0.4)}`;
  const smoking = hp === "smoking";
  return (
    <g className={smoking ? "smoke smoke-anim" : "smoke"} data-own={pi.part.id} opacity={smoking ? 1 : 0.55}>
      <path d={wisp(-1.6 * s, 7 * s)} />
      {smoking && <path d={wisp(1.2 * s, 9 * s)} />}
      {smoking && <path d={wisp(0, 6 * s)} />}
    </g>
  );
});

export function SmokeLayer({ parts, store }: { parts: PartInk[]; store: BenchStore }) {
  return (
    <g>
      {parts.map((p) => (
        <Smoke key={p.part.id} pi={p} store={store} />
      ))}
    </g>
  );
}
