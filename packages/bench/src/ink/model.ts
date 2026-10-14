// Where everything is in the ink drawing, in desk millimetres (x right, z down the page). Pure: built once per bench
// change and shared by the renderer, hit testing, snapping, project() and focus().
//
// Teaching scale: small parts lying on the desk are drawn larger than life, but every lead end, hole, clip point and
// socket is exactly where the shared layout puts it (`partPose`, `anchorPosition`), so the drawing shows the same
// connections as BenchState and the 3D view.

import { parseAnchor } from "../anchors";
import { boardGeometry, boardOrigin, holeWorld } from "../board";
import { DIAL_MODES, METER, anchorPosition, partPose, probeTip, socketWorld, workCenter, type PartPose } from "../layout";
import { partDef, partMarks, rotateXZ, type Hotspot } from "../parts";
import { GATE } from "../dims";
import { hiddenParts } from "../seats";
import type { Anchor, BenchState, MeterMode, MeterSocket, MeterState, PartParamsMap, PlacedPart, ProbeColor, TestLead, Vec2, Wire } from "../types";
import { rectOfPoints, unionRect, type Rect } from "./camera";
import { INK, boxCorners, toLocal, toWorld, type Box, type Frame } from "./frame";
import { inkKind } from "./kinds";
import { resistorBandX } from "./kinds/axial";
import { STRESS_MARK, parseTarget, stressPoint } from "../view/targets";
import { perfMount } from "../solder/perfboard";
import type { CableStyle } from "../cables/style";
import { clipHeadings, routeCables, type ClipSite, type RouteCable, type RouteObstacle } from "../cables/route";
import { svgPath } from "../cables/geom";

export { INK, boxCorners, frameTransform, toLocal, toWorld, type Box, type Frame } from "./frame";

export type Shape =
  | { t: "box"; f: Frame; b: Box }
  | { t: "circle"; x: number; z: number; r: number }
  | { t: "capsule"; ax: number; az: number; bx: number; bz: number; r: number };

export type InkPick =
  | { type: "part"; id: string }
  | { type: "leg"; id: string; leg: string; flying: boolean }
  | { type: "press"; id: string }
  | { type: "flip"; id: string }
  | { type: "rotor"; id: string }
  /** The drawing strip of a pencil card: dragging along it draws (or shades over) the line. */
  | { type: "draw"; id: string }
  /** A setting printed on a prop (a moisture tab, a load switch): clicking sets `key` to `value`. */
  | { type: "setting"; id: string; key: string; value: string | number | boolean }
  | { type: "wire"; id: string }
  | { type: "wireEnd"; id: string; end: "a" | "b" }
  | { type: "clip"; id: string; end: "a" | "b" }
  | { type: "meter" }
  | { type: "dial" }
  | { type: "dialMode"; mode: MeterMode }
  | { type: "plug"; color: ProbeColor }
  /** `tip`: the probe's metal tip end, which a pencil card's drawing strip under it beats (the grip still wins). */
  | { type: "probe"; color: ProbeColor; tip?: true };

/** Handles beat bodies: a lead end or a button inside a part body wins over the body. */
export const PRIORITY: Record<InkPick["type"], number> = {
  press: 3,
  flip: 3,
  rotor: 3,
  setting: 3,
  leg: 3,
  wireEnd: 3,
  dialMode: 3,
  clip: 2,
  plug: 2,
  probe: 2,
  dial: 2,
  draw: 1.5,
  part: 1,
  wire: 1,
  meter: 0,
};

/** A probe's tip end: above bodies, below a pencil card's drawing strip (`draw`). */
export const PROBE_TIP_RANK = 1.4;

/** How strongly a pick claims the pointer (PRIORITY, with a probe's tip end just under a drawing strip). */
export function pickRank(p: InkPick): number {
  return p.type === "probe" && p.tip ? PROBE_TIP_RANK : PRIORITY[p.type];
}

export type HitItem = { pick: InkPick; shape: Shape; order: number };

export type PartInk = {
  part: PlacedPart;
  pose: PartPose;
  /** Drawing frame: first lead's hole on the board, body origin on the desk or in a seat. */
  f: Frame;
  mount: "board" | "desk";
  /** Body outline in the frame (for hit testing, selection marks and framing). */
  box: Box;
  /** Clip point of every lead on the desk. */
  legs: Record<string, Vec2>;
  /** Flexible lead ends (battery snap, speaker): where they are and whether they sit in a hole. */
  ends?: Record<string, { pos: Vec2; inHole: boolean }>;
  /** Lead spacing in pitches for stretchable parts on the board. */
  span?: number;
  /** Draw order: furniture and holders first, then parts, then parts sitting in holders. */
  layer: number;
  /** A gate on a clip lead: the cable's heading where it sits (degrees, as the page's x axis turns to it). */
  along?: number;
};

export type WireInk = { wire: Wire; a: Vec2; b: Vec2; ctrl: Vec2 };

export type ClipEnd = {
  /** Where the jaws bite (the anchor, or where the clip lies). */
  tip: Vec2;
  /** Unit direction from the jaws toward the tail. */
  dir: Vec2;
  /** Where the cable leaves the clip. */
  tail: Vec2;
  attached: boolean;
};

export type LeadInk = {
  lead: TestLead;
  a: ClipEnd;
  b: ClipEnd;
  /** SVG path data of the cable, from clip a's tail to clip b's. */
  path: string;
  /** The same cable as points (flow dots, gates, the tracer and hit tests ride it). */
  cable: Vec2[];
};

export type ProbeInk = {
  color: ProbeColor;
  tip: Vec2;
  /** Unit direction from the tip up the probe toward its cable. */
  dir: Vec2;
  back: Vec2;
  /** Drawn length, tip to cable. */
  len: number;
  attached: boolean;
  plug: { at: Vec2; inSocket: boolean; dir: Vec2; top: Vec2 };
  cable: string;
  /** The cable as points, from the probe's back to the plug. */
  cablePts: Vec2[];
};

export type MeterInk = { meter: MeterState; f: Frame; probes: Record<ProbeColor, ProbeInk> };

export type InkModel = {
  bench: BenchState;
  /** In draw order. */
  parts: Map<string, PartInk>;
  wires: Map<string, WireInk>;
  leads: Map<string, LeadInk>;
  meter: MeterInk | null;
  hits: HitItem[];
  /** Everything drawn (desk mm). */
  bounds: Rect;
  /** The work area: the board and the parts, without the meter and loose cables, for framing. */
  work: Rect;
};

// ---------------------------------------------------------------------------------------------------------------
// Parts. A part's ink depends only on the part, the board and (for a seated part) its holder, so it is cached by
// object identity: during a drag only the moving part is rebuilt.

const cache = new WeakMap<PlacedPart, { board: BenchState["board"]; holder: PlacedPart | null; pi: PartInk }>();

function holderMap(bench: BenchState): Map<string, PlacedPart> {
  const out = new Map<string, PlacedPart>();
  for (const h of bench.parts) {
    const held = (h.params as { held?: Record<string, string | undefined> }).held;
    if (held) for (const id of Object.values(held)) if (id) out.set(id, h);
  }
  // A part through a perfboard's holes follows the board (its pose changes when the board moves or flips).
  for (const p of bench.parts) {
    const board = perfMount(bench, p);
    if (board) out.set(p.id, board);
  }
  // A clip on a lead or a tube on a wire follows its host.
  for (const p of bench.parts) {
    const host =
      p.kind === "heat-sink-clip" && p.params.on
        ? p.params.on.slice(0, p.params.on.lastIndexOf("."))
        : p.kind === "heat-shrink" && p.params.on
          ? p.params.on
          : p.kind === "wall-adapter" && p.params.into
            ? p.params.into
            : null;
    const h = host ? bench.parts.find((x) => x.id === host) : undefined;
    if (h) out.set(p.id, h);
  }
  return out;
}

function partInk(bench: BenchState, part: PlacedPart, holder: PlacedPart | null): PartInk {
  const hit = cache.get(part);
  if (hit && hit.board === bench.board && hit.holder === holder) return hit.pi;
  const pose = partPose(bench, part);
  const f: Frame = { ox: pose.origin[0], oz: pose.origin[2], rot: pose.rot };
  const legs: Record<string, Vec2> = {};
  for (const [leg, p] of Object.entries(pose.legs)) legs[leg] = [p[0], p[2]];
  const kind = inkKind(part.kind);
  const held = !!pose.heldBy;
  const ctx = { mount: pose.mount, held, ...(pose.lie ? { lie: true } : {}), ...(pose.span !== undefined ? { span: pose.span } : {}) };
  const out: PartInk = {
    part,
    pose,
    f,
    mount: pose.mount,
    box: kind.box(part as never, ctx),
    legs,
    layer: held ? 2 : pose.mount === "board" ? 1 : (kind.layer ?? 1),
  };
  if (pose.span !== undefined) out.span = pose.span;
  if (pose.ends) {
    out.ends = {};
    for (const [leg, e] of Object.entries(pose.ends)) out.ends[leg] = { pos: [e.pos[0], e.pos[2]], inHole: e.inHole };
  }
  cache.set(part, { board: bench.board, holder, pi: out });
  return out;
}

/** Desk bounds of a part as drawn: body, leads and flexible lead ends. */
export function partBounds(pi: PartInk): Rect {
  const pts: Vec2[] = [...boxCorners(pi.f, pi.box), ...Object.values(pi.legs)];
  if (pi.ends) for (const e of Object.values(pi.ends)) pts.push(e.pos);
  return rectOfPoints(pts, 1)!;
}

/** Centre of a part's actuator (a trimmer's rotor, a panel pot's knob) in its frame, else the body's centre. */
export function actuatorFrame(pi: PartInk): Vec2 {
  const act = inkKind(pi.part.kind).actuator?.(pi.part as never, { mount: pi.mount, held: !!pi.pose.heldBy, ...(pi.span !== undefined ? { span: pi.span } : {}) });
  return act ? [act.x, act.z] : [(pi.box[0] + pi.box[2]) / 2, (pi.box[1] + pi.box[3]) / 2];
}

/** Clickable spots of a part (settings, the card's drawing strip), in its frame. */
export function hotspotsOf(part: PlacedPart, mount: "board" | "desk" = "desk"): Hotspot[] {
  const d = partDef(part.kind) as { hotspots?: (p: unknown, m: "board" | "desk") => Hotspot[] };
  return d.hotspots ? d.hotspots(part.params, mount) : [];
}

// ---------------------------------------------------------------------------------------------------------------
// Jumper wires.

function wireInk(bench: BenchState, w: Wire): WireInk | null {
  if (!bench.board) return null;
  const a = holeWorld(bench.board, w.a);
  const b = holeWorld(bench.board, w.b);
  if (!a || !b) return null;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  // A gentle bow keeps parallel wires apart and both ends readable; short hops lie flat.
  const bow = len <= 3.2 ? 0 : Math.min(len * 0.12, 3.2);
  const nx = len ? -dz / len : 0;
  const nz = len ? dx / len : 0;
  // Always bow toward the same side of the page so neighbours stay parallel.
  const sgn = nz < 0 || (nz === 0 && nx < 0) ? -1 : 1;
  const ctrl: Vec2 = [(a[0] + b[0]) / 2 + nx * bow * sgn * 2, (a[1] + b[1]) / 2 + nz * bow * sgn * 2];
  return { wire: w, a, b, ctrl };
}

// ---------------------------------------------------------------------------------------------------------------
// Clip leads.

const norm = (x: number, z: number): Vec2 => {
  const l = Math.hypot(x, z);
  return l < 1e-9 ? [1, 0] : [x / l, z / l];
};
const rot2 = (v: Vec2, a: number): Vec2 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

/** For an anchor on a lead of a part lying on the desk: the direction out along that lead (or off a terminal). */
function deskLeadHeading(parts: Map<string, PartInk>, anchor: Anchor): Vec2 | null {
  const a = parseAnchor(anchor);
  if (a?.type !== "pin") return null;
  const pi = parts.get(a.part);
  if (!pi || pi.mount !== "desk") return null;
  if (pi.ends?.[a.leg]?.inHole) return null;
  const pin = pi.legs[a.leg];
  if (!pin) return null;
  const local = toLocal(pi.f, pin[0], pin[1]);
  const k = pi.part.kind;
  // Terminals on top of a body (9 V battery, screw blocks, probe marks, strips in a cup or lemon): straight off it,
  // toward the nearer side.
  if (k === "battery" && (pi.part.params.size ?? "9v") === "9v" && !pi.part.params.snap && !pi.pose.heldBy) return norm(...rotateXZ(Math.sign(local[0]) * 0.35, -1, pi.f.rot));
  if ((k === "toggle-switch" && pi.part.params.base) || k === "skin" || k === "card") return norm(...rotateXZ(Math.sign(local[0]) * 0.3 || 0.3, 1, pi.f.rot));
  if (k === "cup" || k === "lemon" || k === "station" || k === "electrode" || k === "sample") {
    if (k === "electrode" && pi.pose.heldBy) return norm(...rotateXZ(0, -1, pi.f.rot));
    return norm(...rotateXZ(Math.sign(local[0]) || 1, 0.55, pi.f.rot));
  }
  const cx = (pi.box[0] + pi.box[2]) / 2;
  const cz = (pi.box[1] + pi.box[3]) / 2;
  if (Math.hypot(local[0] - cx, local[1] - cz) < 1) return null;
  // Leads that leave the body side by side (an LED, a transistor): fan their clips apart so they do not stack.
  const legs = Object.values(pi.legs).map(([x, z]) => toLocal(pi.f, x, z));
  const mx = legs.reduce((a, l) => a + l[0], 0) / legs.length - cx;
  const mz = legs.reduce((a, l) => a + l[1], 0) / legs.length - cz;
  if (legs.length >= 2 && Math.hypot(mx, mz) > 3) {
    const axis = norm(mx, mz);
    const side = axis[0] * (local[1] - cz) - axis[1] * (local[0] - cx);
    const turn = Math.abs(side) < 0.6 ? 0 : Math.sign(side) * 0.42;
    return norm(...rotateXZ(...rot2(axis, turn), pi.f.rot));
  }
  return norm(...rotateXZ(local[0] - cx, local[1] - cz, pi.f.rot));
}

/** Direction a clip or probe should leave a point on or near the board: out to the side, away from the work. */
function outward(bench: BenchState, at: Vec2, toward: Vec2 | null, side: number): Vec2 {
  const [cx, cz] = workCenter(bench);
  const ox = at[0] - cx;
  const oz = at[1] - cz;
  let hx = Math.abs(ox) < 6 ? side : Math.sign(ox);
  let hz = (oz / (Math.hypot(ox, oz) || 1)) * 0.6;
  if (toward) {
    const t = norm(toward[0] - at[0], toward[1] - at[1]);
    hx += t[0] * 0.35;
    hz += t[1] * 0.35;
  }
  return norm(hx, hz);
}

/** The cubic curve a cable makes from `a` (leaving along `da`) to `b` (arriving against `db`), sagging a little. */
export function cableCurve(a: Vec2, da: Vec2, b: Vec2, db: Vec2, sag = 0.08): [Vec2, Vec2, Vec2, Vec2] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const k = Math.min(70, Math.max(10, len * 0.42));
  const drop = len * sag;
  return [a, [a[0] + da[0] * k, a[1] + da[1] * k + drop], [b[0] + db[0] * k, b[1] + db[1] * k + drop], b];
}

export function cablePath(a: Vec2, da: Vec2, b: Vec2, db: Vec2, sag = 0.08): string {
  const [, c1, c2] = cableCurve(a, da, b, db, sag);
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M${f(a[0])} ${f(a[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(b[0])} ${f(b[1])}`;
}

function bezier(c: [Vec2, Vec2, Vec2, Vec2], t: number): Vec2 {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [w[0]! * c[0][0] + w[1]! * c[1][0] + w[2]! * c[2][0] + w[3]! * c[3][0], w[0]! * c[0][1] + w[1]! * c[1][1] + w[2]! * c[2][1] + w[3]! * c[3][1]];
}

/** Points along a cubic, `n` even steps of its parameter. */
export function cubicPoints(c: [Vec2, Vec2, Vec2, Vec2], n = 32): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) out.push(bezier(c, i / n));
  return out;
}

/** A point `t` of the way along a polyline by its points (the parameter of the curve it samples), and the heading. */
function byIndex(pts: readonly Vec2[], t: number): { at: Vec2; dir: Vec2 } {
  const n = pts.length - 1;
  if (n < 1) return { at: pts[0] ?? [0, 0], dir: [1, 0] };
  const x = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const k = x - i;
  const a = pts[i]!;
  const b = pts[i + 1]!;
  const at: Vec2 = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const ahead = byIndexAt(pts, Math.min(1, t + 0.02));
  const behind = byIndexAt(pts, Math.max(0, t - 0.02));
  return { at, dir: norm(ahead[0] - behind[0], ahead[1] - behind[1]) };
}

function byIndexAt(pts: readonly Vec2[], t: number): Vec2 {
  const n = pts.length - 1;
  const x = t * n;
  const i = Math.min(n - 1, Math.floor(x));
  const k = x - i;
  const a = pts[i]!;
  const b = pts[i + 1]!;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/** A point `t` of the way along a clip lead's cable (between the two clips), and the cable's heading there. */
export function leadPoint(li: LeadInk, t: number): { at: Vec2; dir: Vec2 } {
  return byIndex(li.cable, t);
}

/** The whole lead as a polyline from clip a's jaws to clip b's, along the cable (for dots, hatching, the tracer). */
export function leadPolyline(li: LeadInk, _n = 32): Vec2[] {
  return [li.a.tip, ...li.cable, li.b.tip];
}

function leadsInk(bench: BenchState, parts: Map<string, PartInk>, probes: Map<string, { at: Vec2; dir: Vec2 }>, style: CableStyle = "classic", meter: MeterInk | null = null): Map<string, LeadInk> {
  if (style !== "classic") return styledLeads(bench, parts, probes, style, meter);
  // How many clips bite each anchor, so several on one lead fan out instead of stacking.
  const count = new Map<string, number>();
  const slot = new Map<string, number>();
  for (const l of bench.leads) {
    for (const end of ["a", "b"] as const) {
      const to = l[end].to;
      if (!to) continue;
      const n = count.get(to) ?? 0;
      slot.set(`${l.id}.${end}`, n);
      count.set(to, n + 1);
    }
  }
  const out = new Map<string, LeadInk>();
  const where = (l: TestLead, end: "a" | "b"): { at: Vec2; to: Anchor | null } => {
    const e = l[end];
    if (e.to) {
      const pr = e.to.startsWith("probe:") ? probes.get(e.to) : null;
      if (pr) return { at: pr.at, to: e.to };
      const p = anchorPosition(bench, e.to);
      if (p) return { at: [p[0], p[2]], to: e.to };
    }
    return { at: e.pos, to: null };
  };
  for (const l of bench.leads) {
    const A = where(l, "a");
    const B = where(l, "b");
    const endOf = (me: { at: Vec2; to: Anchor | null }, other: { at: Vec2 }, end: "a" | "b"): ClipEnd => {
      let dir: Vec2;
      if (me.to) {
        const probe = me.to.startsWith("probe:") ? probes.get(me.to)?.dir : null;
        dir = probe ? rot2(probe, end === "a" ? 0.6 : -0.6) : (deskLeadHeading(parts, me.to) ?? outward(bench, me.at, other.at, end === "a" ? -1 : 1));
        const n = slot.get(`${l.id}.${end}`) ?? 0;
        if (n) dir = rot2(dir, (n % 2 ? 1 : -1) * 0.5 * Math.ceil(n / 2));
      } else {
        // Lying loose: the tail points toward the other end.
        dir = Math.hypot(other.at[0] - me.at[0], other.at[1] - me.at[1]) < 2 ? [1, 0] : norm(other.at[0] - me.at[0], other.at[1] - me.at[1]);
      }
      // The jaws bite a little past the lead.
      const tip: Vec2 = me.to ? [me.at[0] - dir[0] * 1.2, me.at[1] - dir[1] * 1.2] : me.at;
      const tail: Vec2 = [tip[0] + dir[0] * INK.clipLen, tip[1] + dir[1] * INK.clipLen];
      return { tip, dir, tail, attached: !!me.to };
    };
    const a = endOf(A, B, "a");
    const b = endOf(B, A, "b");
    out.set(l.id, { lead: l, a, b, path: cablePath(a.tail, a.dir, b.tail, b.dir), cable: cubicPoints(cableCurve(a.tail, a.dir, b.tail, b.dir)) });
  }
  return out;
}

/** Straight out of a part at one of its pins, for a clip there to clear the part (null for a hole). */
function outOf(parts: Map<string, PartInk>, anchor: Anchor): Vec2 | null {
  const desk = deskLeadHeading(parts, anchor);
  if (desk) return desk;
  const a = parseAnchor(anchor);
  if (a?.type !== "pin") return null;
  const pi = parts.get(a.part);
  const pin = pi?.legs[a.leg];
  if (!pi || !pin || pi.ends?.[a.leg]?.inHole) return null;
  const [cx, cz] = toWorld(pi.f, (pi.box[0] + pi.box[2]) / 2, (pi.box[1] + pi.box[3]) / 2);
  return Math.hypot(pin[0] - cx, pin[1] - cz) < 1 ? null : norm(pin[0] - cx, pin[1] - cz);
}

/** Part outlines cables go round in the ink drawing (what is drawn: teaching scale on the desk). */
function inkObstacles(parts: Map<string, PartInk>, meter: MeterInk | null): RouteObstacle[] {
  const out: RouteObstacle[] = [];
  for (const pi of parts.values()) {
    if (pi.pose.under || pi.part.kind === "gate" || pi.pose.heldBy) continue;
    out.push({ id: pi.part.id, poly: boxCorners(pi.f, pi.box) });
  }
  if (meter) out.push({ id: meter.meter.id, poly: boxCorners(meter.f, [-METER.width / 2, -METER.length / 2, METER.width / 2, METER.length / 2]) });
  return out;
}

/** Clip leads (and the meter's probe cords) for the drape, taped and tidy styles: headings, then routes. */
function styledLeads(bench: BenchState, parts: Map<string, PartInk>, probes: Map<string, { at: Vec2; dir: Vec2 }>, style: Exclude<CableStyle, "classic">, meter: MeterInk | null): Map<string, LeadInk> {
  const where = (l: TestLead, end: "a" | "b"): { at: Vec2; to: Anchor | null } => {
    const e = l[end];
    if (e.to) {
      const pr = e.to.startsWith("probe:") ? probes.get(e.to) : null;
      if (pr) return { at: pr.at, to: e.to };
      const p = anchorPosition(bench, e.to);
      if (p) return { at: [p[0], p[2]], to: e.to };
    }
    return { at: e.pos, to: null };
  };
  const spots = new Map(bench.leads.map((l) => [l.id, { a: where(l, "a"), b: where(l, "b") }]));
  const sites: ClipSite[] = [];
  for (const l of bench.leads) {
    const s = spots.get(l.id)!;
    for (const end of ["a", "b"] as const) {
      const me = s[end];
      const other = end === "a" ? s.b : s.a;
      if (!me.to || me.to.startsWith("probe:")) continue;
      sites.push({ key: `${l.id}.${end}`, at: me.at, toward: other.at, out: outOf(parts, me.to) });
    }
  }
  const headings = clipHeadings(style, sites);
  const ends = new Map<string, { a: ClipEnd; b: ClipEnd }>();
  for (const l of bench.leads) {
    const s = spots.get(l.id)!;
    const endOf = (me: { at: Vec2; to: Anchor | null }, other: { at: Vec2 }, end: "a" | "b"): ClipEnd => {
      let dir: Vec2;
      if (me.to) {
        const probe = me.to.startsWith("probe:") ? probes.get(me.to)?.dir : null;
        dir = probe ? rot2(probe, end === "a" ? 0.6 : -0.6) : (headings.get(`${l.id}.${end}`) ?? [1, 0]);
      } else dir = Math.hypot(other.at[0] - me.at[0], other.at[1] - me.at[1]) < 2 ? [1, 0] : norm(other.at[0] - me.at[0], other.at[1] - me.at[1]);
      const tip: Vec2 = me.to ? [me.at[0] - dir[0] * 1.2, me.at[1] - dir[1] * 1.2] : me.at;
      const tail: Vec2 = [tip[0] + dir[0] * INK.clipLen, tip[1] + dir[1] * INK.clipLen];
      return { tip, dir, tail, attached: !!me.to };
    };
    ends.set(l.id, { a: endOf(s.a, s.b, "a"), b: endOf(s.b, s.a, "b") });
  }
  const cables: RouteCable[] = [...ends].map(([id, e]) => ({ id, a: e.a, b: e.b }));
  if (meter) {
    for (const c of ["red", "black"] as const) {
      const pr = meter.probes[c];
      cables.push({ id: `probe:${c}`, a: { tip: pr.tip, dir: pr.dir, tail: pr.back, attached: pr.attached }, b: { tip: pr.plug.at, dir: pr.plug.dir, tail: pr.plug.top, attached: pr.plug.inSocket }, pass: [meter.meter.id], free: true });
    }
  }
  const routes = routeCables(style, cables, inkObstacles(parts, meter), { center: workCenter(bench) });
  if (meter) {
    for (const c of ["red", "black"] as const) {
      const r = routes.get(`probe:${c}`);
      if (r) Object.assign(meter.probes[c], { cable: svgPath(r), cablePts: r });
    }
  }
  const out = new Map<string, LeadInk>();
  for (const l of bench.leads) {
    const e = ends.get(l.id)!;
    const cable = routes.get(l.id) ?? cubicPoints(cableCurve(e.a.tail, e.a.dir, e.b.tail, e.b.dir));
    out.set(l.id, { lead: l, a: e.a, b: e.b, path: svgPath(cable), cable });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Meter.

export const meterFrame = (m: MeterState): Frame => ({ ox: m.pos[0], oz: m.pos[1], rot: m.rot });

/** Dial label position for a mode (or its index), in the meter frame. */
export function dialLabelLocal(mode: MeterMode | number): Vec2 {
  const i = typeof mode === "number" ? mode : DIAL_MODES.indexOf(mode as (typeof DIAL_MODES)[number]);
  const r = (i * 2 * Math.PI) / DIAL_MODES.length;
  return [Math.sin(r) * METER.dial.labels, METER.dial.z - Math.cos(r) * METER.dial.labels];
}

function meterInk(bench: BenchState): MeterInk | null {
  const m = bench.meter;
  if (!m) return null;
  const f = meterFrame(m);
  const probes = {} as Record<ProbeColor, ProbeInk>;
  for (const color of ["red", "black"] as const) {
    const pr = m.probes[color];
    const t = probeTip(bench, color);
    const tip: Vec2 = [t[0], t[2]];
    const sock: Vec2 = pr.socket ? (([x, , z]) => [x, z] as Vec2)(socketWorld(m, pr.socket)) : pr.plugPos;
    const far = Math.hypot(sock[0] - tip[0], sock[1] - tip[1]) >= 4;
    // On something, the probe leans back toward the meter, the two a little apart; lying loose it points at its plug.
    let dir: Vec2 = far ? norm(sock[0] - tip[0], sock[1] - tip[1]) : [1, 0];
    if (pr.tip.to && far) dir = rot2(dir, color === "red" ? -0.3 : 0.3);
    const len = pr.tip.to ? INK.probeHeld : INK.probeLen;
    const back: Vec2 = [tip[0] + dir[0] * len, tip[1] + dir[1] * len];
    let plug: ProbeInk["plug"];
    if (pr.socket) {
      plug = { at: sock, inSocket: true, dir: norm(...rotateXZ(0, 1, m.rot)), top: sock };
    } else {
      const pd: Vec2 = Math.hypot(back[0] - pr.plugPos[0], back[1] - pr.plugPos[1]) < 2 ? [1, 0] : norm(back[0] - pr.plugPos[0], back[1] - pr.plugPos[1]);
      plug = { at: pr.plugPos, inSocket: false, dir: pd, top: [pr.plugPos[0] + pd[0] * INK.plugLen, pr.plugPos[1] + pd[1] * INK.plugLen] };
    }
    probes[color] = { color, tip, dir, back, len, attached: !!pr.tip.to, plug, cable: cablePath(back, dir, plug.top, plug.dir, 0.12), cablePts: cubicPoints(cableCurve(back, dir, plug.top, plug.dir, 0.12)) };
  }
  return { meter: m, f, probes };
}

// ---------------------------------------------------------------------------------------------------------------
// The model.

export function buildModel(bench: BenchState, cableStyle: CableStyle = "classic"): InkModel {
  const holders = holderMap(bench);
  // Parts shut inside a box are out of sight and out of reach: not drawn, not picked.
  const hidden = hiddenParts(bench);
  const list = bench.parts.filter((p) => !hidden.has(p.id)).map((p, i) => ({ pi: partInk(bench, p, holders.get(p.id) ?? null), i }));
  list.sort((a, b) => a.pi.layer - b.pi.layer || a.i - b.i);
  const parts = new Map<string, PartInk>();
  for (const { pi } of list) parts.set(pi.part.id, pi);
  const wires = new Map<string, WireInk>();
  for (const w of bench.wires) {
    const wi = wireInk(bench, w);
    if (wi) wires.set(w.id, wi);
  }
  const meter = meterInk(bench);
  const probes = new Map<string, { at: Vec2; dir: Vec2 }>();
  if (meter) for (const c of ["red", "black"] as const) probes.set(`probe:${c}`, { at: meter.probes[c].tip, dir: meter.probes[c].dir });
  const leads = leadsInk(bench, parts, probes, cableStyle, meter);
  // A gate rides its lead's cable as drawn here: its frame is that point, upright on the page.
  for (const [id, pi] of parts) {
    if (pi.part.kind !== "gate" || !pi.part.params.on) continue;
    const li = leads.get(pi.part.params.on);
    if (!li) continue;
    const { at, dir } = leadPoint(li, Math.max(0.08, Math.min(0.92, pi.part.params.at ?? 0.5)));
    parts.set(id, { ...pi, f: { ox: at[0], oz: at[1], rot: 0 }, along: (Math.atan2(dir[1], dir[0]) * 180) / Math.PI, layer: 3 });
  }

  // Hit items in draw order (later is on top).
  const hits: HitItem[] = [];
  let order = 0;
  const push = (pick: InkPick, shape: Shape) => hits.push({ pick, shape, order: order++ });
  for (const pi of parts.values()) {
    const id = pi.part.id;
    const kind = inkKind(pi.part.kind);
    // Under a flipped perfboard: out of reach until the board is turned back.
    if (pi.pose.under) continue;
    push({ type: "part", id }, { t: "box", f: pi.f, b: pi.box });
    for (const h of hotspotsOf(pi.part, pi.mount)) {
      const box: Box = [h.at[0] - h.size[0] / 2, h.at[2] - h.size[2] / 2, h.at[0] + h.size[0] / 2, h.at[2] + h.size[2] / 2];
      push(h.pick.type === "draw" ? { type: "draw", id } : { type: "setting", id, key: h.pick.key, value: h.pick.value }, { t: "box", f: pi.f, b: box });
    }
    const act = kind.actuator?.(pi.part as never, { mount: pi.mount, held: !!pi.pose.heldBy, ...(pi.span !== undefined ? { span: pi.span } : {}) });
    if (act) {
      const [x, z] = toWorld(pi.f, act.x, act.z);
      push({ type: act.type, id }, { t: "circle", x, z, r: act.r });
    }
    const def = partDef(pi.part.kind);
    if (def.span && pi.mount === "board") {
      for (const leg of def.span.legs) {
        const p = pi.legs[leg];
        if (p) push({ type: "leg", id, leg, flying: false }, { t: "circle", x: p[0], z: p[1], r: 1.3 });
      }
    }
    if (pi.ends) {
      // A part's own tip (the logic probe's) moves with the part, not on its own.
      const nose = (def as { nose?: string }).nose;
      for (const [leg, e] of Object.entries(pi.ends)) if (leg !== nose) push({ type: "leg", id, leg, flying: true }, { t: "circle", x: e.pos[0], z: e.pos[1], r: 2.2 });
    }
  }
  for (const wi of wires.values()) {
    push({ type: "wire", id: wi.wire.id }, { t: "capsule", ax: wi.a[0], az: wi.a[1], bx: wi.b[0], bz: wi.b[1], r: 1.1 });
    push({ type: "wireEnd", id: wi.wire.id, end: "a" }, { t: "circle", x: wi.a[0], z: wi.a[1], r: 1.2 });
    push({ type: "wireEnd", id: wi.wire.id, end: "b" }, { t: "circle", x: wi.b[0], z: wi.b[1], r: 1.2 });
  }
  if (meter) {
    const { f } = meter;
    push({ type: "meter" }, { t: "box", f, b: [-METER.width / 2, -METER.length / 2, METER.width / 2, METER.length / 2] });
    const [dx, dz] = toWorld(f, 0, METER.dial.z);
    push({ type: "dial" }, { t: "circle", x: dx, z: dz, r: METER.dial.knob });
    DIAL_MODES.forEach((mode, i) => {
      const [lx, lz] = dialLabelLocal(i);
      const [x, z] = toWorld(f, lx, lz);
      push({ type: "dialMode", mode }, { t: "circle", x, z, r: 4.2 });
    });
  }
  for (const li of leads.values()) {
    for (const end of ["a", "b"] as const) {
      const e = li[end];
      push({ type: "clip", id: li.lead.id, end }, { t: "capsule", ax: e.tip[0], az: e.tip[1], bx: e.tail[0], bz: e.tail[1], r: INK.clipW / 2 + 0.6 });
    }
  }
  if (meter) {
    for (const c of ["black", "red"] as const) {
      const pr = meter.probes[c];
      push({ type: "plug", color: c }, pr.plug.inSocket ? { t: "circle", x: pr.plug.at[0], z: pr.plug.at[1], r: INK.plugR + 1 } : { t: "capsule", ax: pr.plug.at[0], az: pr.plug.at[1], bx: pr.plug.top[0], bz: pr.plug.top[1], r: 3.2 });
      // The metal tip end and the grip: a stroke started on a pencil card under a resting tip draws; the grip is the
      // probe's handle everywhere.
      const len = Math.hypot(pr.back[0] - pr.tip[0], pr.back[1] - pr.tip[1]) || 1;
      const k = Math.min(0.5, INK.probeTip / len);
      const mx = pr.tip[0] + (pr.back[0] - pr.tip[0]) * k;
      const mz = pr.tip[1] + (pr.back[1] - pr.tip[1]) * k;
      push({ type: "probe", color: c, tip: true }, { t: "capsule", ax: pr.tip[0], az: pr.tip[1], bx: mx, bz: mz, r: 3 });
      push({ type: "probe", color: c }, { t: "capsule", ax: mx, az: mz, bx: pr.back[0], bz: pr.back[1], r: 3 });
    }
  }

  // Bounds.
  let work: Rect | null = null;
  if (bench.board) {
    const g = boardGeometry(bench.board);
    const [ox, oz] = boardOrigin(bench.board);
    work = [ox - g.width / 2, oz - g.depth / 2, ox + g.width / 2, oz + g.depth / 2];
  }
  for (const pi of parts.values()) work = unionRect(work, partBounds(pi));
  let all = work;
  if (meter) {
    const mr = rectOfPoints(boxCorners(meter.f, [-METER.width / 2, -METER.length / 2, METER.width / 2, METER.length / 2]))!;
    all = unionRect(all, mr);
    if (!work) work = mr;
  }
  for (const li of leads.values()) {
    for (const e of [li.a, li.b]) if (e.attached) all = unionRect(all, rectOfPoints([e.tip, e.tail], 2));
  }
  if (!work) work = [-110, -60, 110, 60];
  if (!all) all = work;
  return { bench, parts, wires, leads, meter, hits, bounds: all, work };
}

// ---------------------------------------------------------------------------------------------------------------
// Targets: anchors, part ids and named sub-parts, for project(), focus() and spotlight().

/** Named spots on the meter for `part:M1/<name>`, in the meter frame. */
export const METER_SPOTS: Record<string, Box> = {
  display: [METER.lcd.x0, METER.lcd.z0, METER.lcd.x1, METER.lcd.z1],
  dial: [-METER.dial.knob, METER.dial.z - METER.dial.knob, METER.dial.knob, METER.dial.z + METER.dial.knob],
  dialFace: [-METER.dial.labels - 6, METER.dial.z - METER.dial.labels - 6, METER.dial.labels + 6, METER.dial.z + METER.dial.labels + 6],
  sockets: [METER.sockets.xs.a10 - 6, METER.sockets.z - 6, METER.sockets.xs.vohm + 6, METER.sockets.z + 6],
  // Each dial position's letter (`dcv`, `ohm`, `dca-ma` ...), where the dial prints it round the knob.
  ...Object.fromEntries(
    DIAL_MODES.map((mode, i): [string, Box] => {
      const [x, z] = dialLabelLocal(i);
      return [mode, [x - 4.5, z - 3.5, x + 4.5, z + 3.5]];
    }),
  ),
};

/**
 * The desk rectangle a target names. Everything `parseTarget` takes (`part:D1`, `part:M1/display`, `part:M1/dial`,
 * `part:M1/com`, `lead:TL1`, `wire:W1`, any anchor), plus a bare id ("D1"), `part:R1/a` (a lead), the meter's
 * `dialFace` and `sockets`, `board` and `strip:14a-e`.
 */
export function targetRect(model: InkModel, target: string): Rect | null {
  const t = target.trim();
  const { bench } = model;
  if (t === "board" && bench.board) {
    const g = boardGeometry(bench.board);
    const [ox, oz] = boardOrigin(bench.board);
    return [ox - g.width / 2, oz - g.depth / 2, ox + g.width / 2, oz + g.depth / 2];
  }
  if (t.startsWith("strip:") && bench.board) {
    const s = boardGeometry(bench.board).strips.get(t.slice(6));
    if (!s) return null;
    const [ox, oz] = boardOrigin(bench.board);
    return [ox + s.x0 - 1, oz + s.z0 - 1, ox + s.x1 + 1, oz + s.z1 + 1];
  }
  const parsed = t.includes(":") ? parseTarget(t) : ({ type: "part", id: t, sub: null } as const);
  if (!parsed) return null;
  if (parsed.type === "lead") {
    const li = model.leads.get(parsed.id);
    return li ? rectOfPoints([li.a.tip, li.a.tail, li.b.tip, li.b.tail], 2) : null;
  }
  if (parsed.type === "wire") {
    const wi = model.wires.get(parsed.id);
    return wi ? rectOfPoints([wi.a, wi.b, wi.ctrl], 1.5) : null;
  }
  if (parsed.type === "anchor") {
    const p = anchorInk(model, parsed.anchor);
    return p ? [p[0] - 1.5, p[1] - 1.5, p[0] + 1.5, p[1] + 1.5] : null;
  }
  const { id, sub } = parsed;
  const pi = model.parts.get(id);
  if (pi) {
    if (!sub) return partBounds(pi);
    if (sub === STRESS_MARK && pi.part.kind === "led") {
      const [x, , z] = stressPoint(bench, pi.part);
      return [x - 1.5, z - 1.5, x + 1.5, z + 1.5];
    }
    const p = pi.legs[sub];
    if (p) return [p[0] - 1.5, p[1] - 1.5, p[0] + 1.5, p[1] + 1.5];
    // A resistor's band, where this view draws it (desk parts are drawn larger than life).
    const band = pi.part.kind === "resistor" ? /^band([1-5])$/.exec(sub) : null;
    if (band) {
      const x = resistorBandX(pi.part.params as PartParamsMap["resistor"], pi, Number(band[1]) - 1);
      if (x === null) return null;
      const [bx, bz] = toWorld(pi.f, x, 0);
      return [bx - 1, bz - 1.5, bx + 1, bz + 1.5];
    }
    // A named mark: a drawing's symbol, a box's lid or knob, a gate's flag (in the drawing's own frame).
    const m = partMarks(pi.part, { mount: pi.mount, ...(pi.span !== undefined ? { span: pi.span } : {}) })[sub];
    if (!m) return null;
    const [x, z] = toWorld(pi.f, m[0], pi.part.kind === "gate" ? -GATE.lift : m[2]);
    return [x - 3, z - 3, x + 3, z + 3];
  }
  // A bare id may also name a jumper or a test lead.
  if (!t.includes(":")) {
    const wi = model.wires.get(id);
    if (wi) return rectOfPoints([wi.a, wi.b, wi.ctrl], 1.5);
    const li = model.leads.get(id);
    if (li) return rectOfPoints([li.a.tip, li.a.tail, li.b.tip, li.b.tail], 2);
  }
  if (model.meter && model.meter.meter.id === id) {
    const f = model.meter.f;
    if (sub) {
      const spot = METER_SPOTS[sub];
      if (spot) return rectOfPoints(boxCorners(f, spot));
      if (sub in METER.sockets.xs) {
        const [x, , z] = socketWorld(model.meter.meter, sub as MeterSocket);
        return [x - 5, z - 5, x + 5, z + 5];
      }
      return null;
    }
    return rectOfPoints(boxCorners(f, [-METER.width / 2, -METER.length / 2, METER.width / 2, METER.length / 2]));
  }
  return null;
}

/** The point a target names on the desk (the middle of a part, the jaws of a clip, a hole). */
export function targetPoint(model: InkModel, target: string): Vec2 | null {
  const t = target.trim();
  const parsed = t.includes(":") && !t.startsWith("strip:") ? parseTarget(t) : null;
  if (parsed?.type === "anchor") return anchorInk(model, parsed.anchor);
  const r = targetRect(model, t);
  return r ? [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2] : null;
}

/** Desk position of a bench anchor as drawn. */
export function anchorInk(model: InkModel, anchor: Anchor): Vec2 | null {
  const a = parseAnchor(anchor);
  if (!a) return null;
  if (a.type === "lead") return model.leads.get(a.lead)?.[a.end].tip ?? null;
  if (a.type === "probe") return model.meter ? model.meter.probes[a.color].tip : null;
  const p = anchorPosition(model.bench, anchor);
  return p ? [p[0], p[2]] : null;
}

export function targetsRect(model: InkModel, targets: readonly string[]): Rect | null {
  let r: Rect | null = null;
  for (const t of targets) r = unionRect(r, targetRect(model, t));
  return r;
}

/** Part, wire, lead and meter ids a target list names (for spotlight dimming); "board" for holes and strips. */
export function targetOwners(model: InkModel, targets: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of targets) {
    const t = raw.trim();
    if (t === "board" || t.startsWith("hole:") || t.startsWith("strip:")) {
      out.add("board");
      continue;
    }
    const whole = t.includes(":") ? parseTarget(t) : null;
    if (whole?.type === "lead" || whole?.type === "wire") {
      out.add(whole.id);
      continue;
    }
    const body = t.startsWith("part:") ? t.slice(5).split("/")[0]! : t.includes(":") ? null : t;
    if (body) {
      out.add(body);
      // A holder brings what it holds, and a seated part its holder.
      const pi = model.parts.get(body);
      const held = (pi?.part.params as { held?: Record<string, string | undefined> } | undefined)?.held;
      if (held) for (const v of Object.values(held)) if (v) out.add(v);
      if (pi?.pose.heldBy) out.add(pi.pose.heldBy);
      continue;
    }
    const a = parseAnchor(t);
    if (!a) continue;
    if (a.type === "pin") out.add(a.part);
    else if (a.type === "wire") out.add(a.wire);
    else if (a.type === "lead") out.add(a.lead);
    else if ((a.type === "probe" || a.type === "socket") && model.meter) out.add(model.meter.meter.id);
  }
  return out;
}

export { DIAL_MODES, METER };
