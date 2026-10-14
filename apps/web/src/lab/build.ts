/**
 * Lab bench config -> BenchState. Pure. Resolves the shorthand in docs/LABS.md (holes, rails, desk spots, clip
 * leads such as "B1.pos -> S1.a") and the first-draft conventions the Unit 1 and 2 stubs used (simulator kinds,
 * `props`, "wire" parts), so every lab loads while authors move them over.
 */
import {
  PITCH,
  benchOps,
  boardGeometry,
  defaultMeter,
  defaultParams,
  emptyBench,
  footprintOf,
  holeWorld,
  isFlying,
  mysteryOrder,
  partDef,
  partLegs,
  shuffleFor,
  trayUsed,
  type BenchPartKind,
  type BenchState,
  type InspectSpec,
  type LeadColor,
  type MeterSocket,
  type PlacedPart,
  type TrayItem,
  type Vec2,
  type WireColor,
} from "@ohmland/bench/core";
import type { InputKey, InputValue } from "@ohmland/sim";
import { deskSpot, resolveAttach, resolveHole, splitHoles } from "./anchors";
import { partChip } from "./chips";
import type { BenchConfig, ControlConfig, LabPart, LabTrayItem, LeadSpec, LoggerConfig, MeterConfig, OverlayName, ScopeConfig, StopwatchConfig, TapperConfig, WireSpec } from "./define";

export type SimInput = { id: string; key: InputKey; value: InputValue };

export type BuiltBench = {
  bench: BenchState;
  /** Part ids the learner cannot move or remove. */
  locked: string[];
  /** Tray items for <Bench tray>. */
  tray: TrayItem[];
  meter: MeterConfig | null;
  scope: ScopeConfig | null;
  logger: LoggerConfig | null;
  stopwatch: StopwatchConfig | null;
  tapper: TapperConfig | null;
  controls: ControlConfig[];
  nodes: Record<string, string>;
  /** Friendly names set by the lab. */
  labels: Record<string, string>;
  /** Simulator inputs to send once the circuit is loaded (control sliders, legacy `light`, `pressed`). */
  inputs: SimInput[];
  /** Spare meter fuses, or null for unlimited. */
  spareFuses: number | null;
  /** The desk rectangle the camera frames, [x0, z0, x1, z1] in mm, or null for the whole bench. */
  frame: [number, number, number, number] | null;
  /** Readouts over parts (stress bars, temperatures). */
  inspect?: InspectSpec[];
  warnings: string[];
  /** The overlays on at the start, and the toggles the lab offers. */
  overlays?: { flow: "off" | "current" | "electrons"; push: boolean; offer: readonly OverlayName[] };
};

const LEAD_COLORS: LeadColor[] = ["red", "black", "green", "yellow", "blue", "white"];
const WIRE_COLORS: WireColor[] = ["red", "black", "blue", "green", "yellow", "orange", "white", "purple"];
const SOCKETS = new Set<string>(["com", "vohm", "ma", "a10"]);

/** Rough desk footprint widths, for laying parts out in a row. */
const DESK_WIDTH: Partial<Record<BenchPartKind, number>> = {
  battery: 34,
  resistor: 46,
  diode: 46,
  led: 26,
  fuse: 40,
  cup: 66,
  lemon: 64,
  speaker: 48,
  relay: 30,
  "toggle-switch": 50,
  holder: 62,
  station: 104,
  fruit: 64,
  electrode: 22,
  skin: 100,
  sample: 120,
  card: 132,
  tag: 24,
  bin: 74,
  chart: 100,
  clock: 54,
  showcase: 124,
  gate: 28,
  box: 110,
  schematic: 110,
  piece: 26,
  balloon: 34,
  scarf: 110,
  paper: 34,
  comb: 70,
  wall: 150,
};

type Normal = {
  kind: BenchPartKind;
  params: Record<string, unknown>;
  /** Legacy pin names -> bench lead names ("S1.a" -> "S1.com"). */
  pins?: Record<string, string>;
  inputs?: SimInput[];
};

type Built = { kind: "part"; n: Normal } | { kind: "meter"; m: MeterConfig } | { kind: "lead"; spec: LeadSpec } | { kind: "wire"; spec: WireSpec } | { kind: "skip"; why: string };

const WATER = ["distilled", "tap", "salty"] as const;

/** Maps one lab part (new or first-draft form) to what the bench needs. */
function normalize(p: LabPart, board: boolean): Built {
  const params: Record<string, unknown> = { ...("props" in p && p.props ? p.props : {}), ...("params" in p && p.params ? p.params : {}) };
  const bool = (k: string) => params[k] === true;
  // The bench form (typed `params`, a bench kind) passes straight through: the cases below translate first drafts.
  if (!("props" in p && p.props) && partDef(p.kind as BenchPartKind)) return { kind: "part", n: { kind: p.kind as BenchPartKind, params } };
  switch (p.kind) {
    case "switch": {
      // A plain on/off switch: closed means thrown to b; its two pins are com and b.
      const to = bool("closed") ? "b" : "a";
      const onBoard = board && !!p.at && splitHoles(p.at).length > 0;
      return { kind: "part", n: { kind: onBoard ? "slide-switch" : "toggle-switch", params: onBoard ? { to } : { to, base: true }, pins: { a: "com", b: "b" } } };
    }
    case "spdt":
      return { kind: "part", n: { kind: "slide-switch", params: { to: params["to"] === "b" ? "b" : "a" } } };
    case "capacitor": {
      const polar = params["polarized"] !== false && (params["polarized"] === true || Number(params["farads"]) >= 1e-6);
      const out: Record<string, unknown> = { farads: Number(params["farads"] ?? 1e-6) };
      if (params["volts"] !== undefined) out["volts"] = params["volts"];
      if (params["actualFarads"] !== undefined) out["actualFarads"] = params["actualFarads"];
      return polar ? { kind: "part", n: { kind: "electrolytic-cap", params: out } } : { kind: "part", n: { kind: "ceramic-cap", params: out, pins: { pos: "a", neg: "b" } } };
    }
    case "pot":
      return { kind: "part", n: { kind: "trimmer", params: { ohms: Number(params["ohms"] ?? 10_000), position: Number(params["position"] ?? 0.5) } } };
    case "cell":
      return { kind: "part", n: { kind: "lemon", params: { emf: Number(params["emf"] ?? 0.9), internalOhms: Number(params["internalOhms"] ?? 1000) } } };
    case "probe-resistance": {
      const name = (p.at ?? "").replace(/^prop:/, "");
      const water = WATER.find((w) => name.includes(w)) ?? (name.startsWith("cup") ? "tap" : null);
      if (!water) return { kind: "skip", why: `${p.id}: the "${name || "probe"}" prop is not on the bench yet` };
      const out: Record<string, unknown> = { water };
      if (typeof params["ohms"] === "number") out["ohms"] = params["ohms"];
      return { kind: "part", n: { kind: "cup", params: out } };
    }
    case "multimeter": {
      const sock = (k: string): MeterSocket | null | undefined => {
        const v = params[k];
        if (v === undefined) return undefined;
        return typeof v === "string" && SOCKETS.has(v) ? (v as MeterSocket) : null;
      };
      const m: MeterConfig = { kind: "meter" };
      if (typeof params["mode"] === "string") m.mode = params["mode"] as MeterConfig["mode"] & string;
      if (typeof params["range"] === "string") m.range = params["range"];
      const red = sock("red");
      const black = sock("black");
      if (red !== undefined) m.red = red;
      if (black !== undefined) m.black = black;
      if (p.at && p.at.startsWith("desk:")) m.at = p.at;
      return { kind: "meter", m };
    }
    case "wire": {
      const at = p.at ?? "";
      const color = typeof params["color"] === "string" ? (params["color"] as string) : undefined;
      if (/[A-Za-z][A-Za-z0-9_]*\.[A-Za-z0-9]+/.test(at) || at.includes("slot:")) {
        const [from, to] = at.split(/\s*(?:\||->|→| to |-(?=[A-Za-z]+\d*\.|rail|top|[a-j]\d))\s*/);
        return { kind: "lead", spec: { id: p.id, from: from ?? null, to: to ?? null, ...(color ? { color: color as LeadColor } : {}) } };
      }
      const holes = splitHoles(at);
      if (holes.length === 2) return { kind: "wire", spec: { id: p.id, from: holes[0]!, to: holes[1]!, ...(color ? { color: color as WireColor } : {}) } };
      return { kind: "skip", why: `${p.id}: cannot read the wire "${at}"` };
    }
    case "npn":
      return { kind: "part", n: { kind: "npn", params: { model: "2N3904" } } };
    case "phototransistor": {
      const inputs: SimInput[] = typeof params["light"] === "number" ? [{ id: p.id, key: "light", value: params["light"] }] : [];
      return { kind: "part", n: { kind: "phototransistor", params: {}, inputs } };
    }
    case "pushbutton": {
      const inputs: SimInput[] = params["pressed"] === true ? [{ id: p.id, key: "pressed", value: true }] : [];
      const out: Record<string, unknown> = {};
      if (params["normallyClosed"] === true) out["normallyClosed"] = true;
      if (typeof params["cap"] === "string") out["cap"] = params["cap"];
      return { kind: "part", n: { kind: "pushbutton", params: out, inputs, pins: { a: "a1", b: "b1" } } };
    }
    case "relay": {
      const out: Record<string, unknown> = {};
      for (const k of ["coilOhms", "pullIn", "dropOut", "coilVolts"]) if (params[k] !== undefined) out[k] = params[k];
      return { kind: "part", n: { kind: "relay", params: out, pins: { coilA: "coil1", coilB: "coil2", com: "com1", no: "no1", nc: "nc1" } } };
    }
    case "speaker":
      return { kind: "part", n: { kind: "speaker", params: { ohms: Number(params["ohms"] ?? 8) } } };
    case "dpdt":
      return { kind: "part", n: { kind: "dpdt-switch", params: { to: params["to"] === "b" ? "b" : "a" } } };
    default: {
      const kind = p.kind as BenchPartKind;
      if (!partDef(kind)) return { kind: "skip", why: `${p.id}: unknown kind "${p.kind}"` };
      return { kind: "part", n: { kind, params } };
    }
  }
}

/** Holes for a part whose first lead goes into `hole`, following its footprint at `rot`. */
function fitAt(bench: BenchState, part: PlacedPart, hole: string, rot: number): Record<string, string> | null {
  if (!bench.board) return null;
  const at = holeWorld(bench.board, hole);
  if (!at) return null;
  const fp = footprintOf(part);
  if (!fp.length) return null;
  const r = (rot * Math.PI) / 180;
  const rotXZ = (x: number, z: number): [number, number] => [x * Math.cos(r) + z * Math.sin(r), -x * Math.sin(r) + z * Math.cos(r)];
  const pts = fp.map((f) => rotXZ(f.dx, f.dz));
  const cx = (Math.min(...pts.map((q) => q[0])) + Math.max(...pts.map((q) => q[0]))) / 2;
  const cz = (Math.min(...pts.map((q) => q[1])) + Math.max(...pts.map((q) => q[1]))) / 2;
  return benchOps.fitOnBoard(bench, part.kind, part.params, rot, [at[0] + cx * PITCH, at[1] + cz * PITCH], { exceptId: part.id, reach: 2.2 });
}

export type PlaceResult = { part: PlacedPart; desk: boolean; warning?: string };

/** A part put into board holes sits where its legs are (as a drag leaves it), not at the desk spot it came from. */
function onBoard(bench: BenchState, part: PlacedPart): PlacedPart {
  return { ...part, pos: benchOps.partCenter({ ...bench, parts: [part] }, part) } as PlacedPart;
}

/**
 * Puts a part where `at` says on the bench (without adding it). Desk parts without a spot get `deskAuto`.
 */
export function placePart(bench: BenchState, part: PlacedPart, at: string | undefined, holes: Record<string, string> | undefined, deskAuto: () => Vec2): PlaceResult {
  const legs = partLegs(part);
  const flying = isFlying(part);
  if (holes) {
    const resolved: Record<string, string> = {};
    for (const [leg, h] of Object.entries(holes)) {
      const id = resolveHole(bench.board, h);
      if (id) resolved[leg] = id;
    }
    // A part on flying leads (a speaker, a battery snap) sits at its desk spot, if given, with its leads in the holes;
    // a probe pen stands at its tip.
    const spot = flying && at ? deskSpot(at) : null;
    return { part: flying ? onFlyingLeads(bench, part, resolved, spot ?? sideOfBoard(bench)) : ({ ...part, holes: resolved } as PlacedPart), desk: false };
  }
  if (at === "rails" && part.kind === "battery" && bench.board) {
    const col = boardGeometry(bench.board).railCols[0]!;
    const params = { ...part.params, snap: true };
    return { part: { ...part, params, holes: { pos: `bp${col}`, neg: `bn${col}` }, pos: sideOfBoard(bench) } as PlacedPart, desk: false };
  }
  const spot = at ? deskSpot(at) : null;
  if (spot) return { part: { ...part, pos: spot }, desk: true };
  // A gate on a clip lead: "lead:TL3", or "lead:TL3@0.3" for how far along it (from clip a).
  const onLead = at ? /^lead:([A-Za-z][A-Za-z0-9_-]*)(?:@([\d.]+))?$/.exec(at.trim()) : null;
  if (onLead && part.kind === "gate") {
    if (!bench.leads.some((l) => l.id === onLead[1])) return { part: { ...part, pos: deskAuto() }, desk: true, warning: `${part.id}: no lead "${onLead[1]}" to clip onto` };
    const withGate = { ...bench, parts: [...bench.parts.filter((p) => p.id !== part.id), part] };
    const clipped = benchOps.clipGate(withGate, part.id, null, { lead: onLead[1]!, at: onLead[2] ? Number(onLead[2]) : 0.5 });
    return { part: clipped.parts.find((p) => p.id === part.id)!, desk: true };
  }
  const tokens = at && bench.board ? splitHoles(at).map((h) => resolveHole(bench.board, h)) : [];
  if (tokens.length && tokens.every(Boolean)) {
    const ids = tokens as string[];
    if (flying || ids.length >= 2) {
      // Explicit holes for the leads, in order (stretchable parts, flying leads, or a bent-lead placement).
      if (flying || partDef(part.kind).span || ids.length === legs.length) {
        const h: Record<string, string> = {};
        legs.forEach((leg, i) => {
          if (ids[i]) h[leg] = ids[i]!;
        });
        if (Object.keys(h).length === legs.length || flying) return { part: flying ? onFlyingLeads(bench, part, h, sideOfBoard(bench)) : onBoard(bench, { ...part, holes: h } as PlacedPart), desk: false };
      }
    }
    const fit = fitAt(bench, part, ids[0]!, part.rot);
    if (fit) return { part: onBoard(bench, { ...part, holes: fit } as PlacedPart), desk: false };
    return { part: { ...part, pos: deskAuto() }, desk: true, warning: `${part.id}: does not fit at "${at}", left on the desk` };
  }
  return { part: { ...part, pos: deskAuto() }, desk: true };
}

/**
 * A part on flying leads with these leads in holes. A part whose tip is one of them (a logic probe's pen, PartDef
 * `nose`) stands at the tip's hole, as a drag puts it, and that lead has no loose end; anything else (a battery snap,
 * a speaker) lies at `desk`.
 */
function onFlyingLeads(bench: BenchState, part: PlacedPart, holes: Record<string, string>, desk: Vec2): PlacedPart {
  const nose = noseOf(part);
  const tip = nose && holes[nose] && bench.board ? holeWorld(bench.board, holes[nose]!) : null;
  if (!tip || !nose) return { ...part, holes, pos: desk } as PlacedPart;
  const { [nose]: _end, ...ends } = (part as { ends?: Record<string, Vec2> }).ends ?? {};
  return { ...part, holes, ends, pos: [tip[0], tip[1]] } as PlacedPart;
}

/**
 * A part on flying leads with only the named leads moved (null takes one out of its hole), the rest left where they
 * are. A probe pen pulled out of its hole lies on the desk just in front of the board, below that hole.
 */
export function replugLeads(bench: BenchState, part: PlacedPart, moves: Record<string, string | null>): PlacedPart {
  const holes: Record<string, string> = {};
  for (const [leg, h] of Object.entries(part.holes ?? {})) if (h) holes[leg] = h;
  for (const [leg, h] of Object.entries(moves)) {
    if (h) holes[leg] = h;
    else delete holes[leg];
  }
  const nose = noseOf(part);
  const left = nose && !holes[nose] && part.holes?.[nose] && bench.board ? holeWorld(bench.board, part.holes[nose]!) : null;
  const desk: Vec2 = left && bench.board ? [left[0], (bench.board.pos?.[1] ?? 0) + boardGeometry(bench.board).depth / 2 + 12] : part.pos;
  return onFlyingLeads(bench, part, holes, desk);
}

function noseOf(part: PlacedPart): string | undefined {
  return (partDef(part.kind) as { nose?: string }).nose;
}

/** A desk spot just left of the board, for batteries and flying leads. */
function sideOfBoard(bench: BenchState): Vec2 {
  if (!bench.board) return [-120, 0];
  const g = boardGeometry(bench.board);
  const [ox, oz] = bench.board.pos ?? [0, 0];
  return [ox - g.width / 2 - 34, oz + 10];
}

/** Resolves a lead end, following legacy pin aliases. */
function attach(bench: BenchState, s: string | null, aliases: Record<string, Record<string, string>>): string | null {
  if (!s) return null;
  const dot = s.lastIndexOf(".");
  if (dot > 0 && !s.includes(":")) {
    const id = s.slice(0, dot);
    const leg = s.slice(dot + 1);
    const alias = aliases[id]?.[leg];
    if (alias) return resolveAttach(bench, `${id}.${alias}`);
  }
  return resolveAttach(bench, s);
}

function parseLead(spec: LeadSpec): { id?: string; from: string | null; to: string | null; color?: LeadColor } {
  if (typeof spec !== "string") return spec;
  const [from, to] = spec.split(/\s*(?:->|→|\|| to )\s*/);
  return { from: from || null, to: to || null };
}

function parseWire(spec: WireSpec): { id?: string; from: string; to: string; color?: WireColor } | null {
  if (typeof spec !== "string") return spec;
  const h = splitHoles(spec);
  return h.length === 2 ? { from: h[0]!, to: h[1]! } : null;
}

/** Adds a clip lead between two attach points (either may be null: that clip lies on the desk). */
export function addLeadBetween(bench: BenchState, from: string | null, to: string | null, color: LeadColor, id?: string): [BenchState, string] {
  const [b, lid] = benchOps.addLead(bench, color, [0, 60], id);
  let out = b;
  if (from) out = benchOps.clipLead(out, lid, "a", from);
  if (to) out = benchOps.clipLead(out, lid, "b", to);
  return [out, lid];
}

export type BuildOptions = {
  /** Seeds the shuffle of mystery parts (`mystery: "shuffle"`), so each learner gets their own. */
  seed?: string;
};

/** Builds the starting bench of a lab. */
export function buildBench(config: BenchConfig, opts: BuildOptions = {}): BuiltBench {
  const warnings: string[] = [];
  const boardKind = config.board === "half" ? "bb400" : config.board === "none" ? null : "bb830";
  let bench = emptyBench(boardKind ? { kind: boardKind, ...(config.splitRails && boardKind === "bb830" ? { splitRails: true } : {}) } : null);
  const locked: string[] = [];
  const labels: Record<string, string> = {};
  const inputs: SimInput[] = [];
  const aliases: Record<string, Record<string, string>> = {};
  let meter: MeterConfig | null = null;
  let scope: ScopeConfig | null = null;
  let logger: LoggerConfig | null = null;
  let stopwatch: StopwatchConfig | null = null;
  let tapper: TapperConfig | null = null;
  const leads: LeadSpec[] = [];
  const wires: WireSpec[] = [];

  const inspect: InspectSpec[] = [];
  for (const ins of config.instruments) {
    if (ins === "meter") meter = { kind: "meter", ...(meter ?? {}) };
    else if (ins === "scope") warnings.push('scope: list its traces with { kind: "scope", traces: [...] }');
    else if (ins.kind === "meter") meter = { ...(meter ?? {}), ...ins };
    else if (ins.kind === "scope") scope = ins;
    else if (ins.kind === "logger") logger = ins;
    else if (ins.kind === "stopwatch") stopwatch = ins;
    else if (ins.kind === "tapper") tapper = ins;
    else if (ins.kind === "inspect") inspect.push({ show: ins.show, parts: ins.parts });
  }

  // Parts: board placements first, then the desk in rows (front row, then the shelf at the back).
  type Pending = { id: string; n: Normal; at: string | undefined; holes: Record<string, string> | undefined; rot: number };
  const pending: Pending[] = [];
  for (const p of config.parts) {
    const b = normalize(p, !!boardKind);
    if (b.kind === "skip") {
      warnings.push(b.why);
      continue;
    }
    if (b.kind === "meter") {
      meter = { ...(meter ?? { kind: "meter" }), ...b.m };
      continue;
    }
    if (b.kind === "lead") {
      leads.push(b.spec);
      continue;
    }
    if (b.kind === "wire") {
      wires.push(b.spec);
      continue;
    }
    if (p.label) labels[p.id] = p.label;
    if (p.locked) locked.push(p.id);
    if (b.n.pins) aliases[p.id] = b.n.pins;
    if (b.n.inputs) inputs.push(...b.n.inputs);
    pending.push({ id: p.id, n: b.n, at: p.at, holes: p.holes, rot: p.rot ?? 0 });
  }
  leads.push(...(config.leads ?? []));
  wires.push(...(config.wires ?? []));

  const front: PlacedPart[] = [];
  const back: PlacedPart[] = [];
  const seats: { id: string; holder: string; seat?: string }[] = [];
  // Gates that start clipped on a lead ("lead:TL3"): clipped on once the leads are on the bench.
  const onLeads: { id: string; at: string }[] = [];
  for (const q of pending) {
    const params: Record<string, unknown> = { ...defaultParams(q.n.kind), ...q.n.params };
    // A mystery part's legs are shuffled per learner: "shuffle" becomes a permutation seeded by the learner and the id.
    if (params["mystery"] === "shuffle") params["mystery"] = shuffleFor(`${opts.seed ?? ""}:${q.id}`, partLegs({ kind: q.n.kind, params } as PlacedPart).length);
    const part = { id: q.id, kind: q.n.kind, params, pos: [0, 0], rot: q.rot } as PlacedPart;
    if (params["mystery"] !== undefined && !mysteryOrder(part)) warnings.push(`${q.id}: "mystery" must be "shuffle" or a permutation of its legs`);
    const seat = q.at ? seatSpot(q.at) : null;
    if (seat) {
      // Seated once every part is on the bench (the holder may come later in the list).
      seats.push({ id: q.id, ...seat });
      bench = { ...bench, parts: [...bench.parts, part] };
      continue;
    }
    if (q.n.kind === "gate" && q.at?.startsWith("lead:")) {
      onLeads.push({ id: q.id, at: q.at });
      front.push(part);
      bench = { ...bench, parts: [...bench.parts, part] };
      continue;
    }
    const shelf = q.at === "shelf";
    const res = placePart(bench, part, q.at, q.holes, () => [Number.NaN, Number.NaN]);
    if (res.warning) warnings.push(res.warning);
    const placed = res.part;
    if (res.desk && Number.isNaN(placed.pos[0])) (shelf ? back : front).push(placed);
    bench = { ...bench, parts: [...bench.parts, placed] };
  }

  // Lay out desk parts that have no spot: a centred row in front (or beside the board), the shelf behind.
  const row = (parts: PlacedPart[], z: number) => {
    const widths = parts.map((p) => DESK_WIDTH[p.kind] ?? 30);
    const gap = 26;
    const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, parts.length - 1);
    let x = -total / 2;
    const g = bench.board ? boardGeometry(bench.board) : null;
    parts.forEach((p, i) => {
      const w = widths[i]!;
      const pos: Vec2 = [x + w / 2, z];
      x += w + gap;
      bench = { ...bench, parts: bench.parts.map((q) => (q.id === p.id ? ({ ...q, pos } as PlacedPart) : q)) };
    });
    void g;
  };
  const g = bench.board ? boardGeometry(bench.board) : null;
  row(front, g ? g.depth / 2 + 40 : 10);
  row(back, g ? -g.depth / 2 - 50 : -80);
  for (const s of seats) {
    if (!bench.parts.some((p) => p.id === s.holder)) {
      warnings.push(`${s.id}: no holder "${s.holder}"`);
      continue;
    }
    const before = bench;
    bench = benchOps.seatPart(bench, s.id, s.holder, s.seat);
    if (bench === before) warnings.push(`${s.id}: does not fit in ${s.holder}${s.seat ? `.${s.seat}` : ""}`);
  }

  // Jumper wires and clip leads.
  wires.forEach((w, i) => {
    const s = parseWire(w);
    if (!s) return warnings.push(`wire ${i + 1}: cannot read "${String(w)}"`);
    const a = resolveHole(bench.board, s.from);
    const b = resolveHole(bench.board, s.to);
    if (!a || !b) return warnings.push(`wire ${s.id ?? i + 1}: no hole "${!a ? s.from : s.to}"`);
    const [next, id] = benchOps.addWire(bench, a, b, s.color ?? WIRE_COLORS[i % WIRE_COLORS.length]!, s.id);
    if (!id) warnings.push(`wire ${s.id ?? i + 1}: ${a} or ${b} is taken`);
    bench = next;
  });
  leads.forEach((l, i) => {
    const s = parseLead(l);
    const from = attach(bench, s.from, aliases);
    const to = attach(bench, s.to, aliases);
    if (s.from && !from) warnings.push(`lead ${s.id ?? i + 1}: nothing at "${s.from}", that clip lies on the desk`);
    if (s.to && !to) warnings.push(`lead ${s.id ?? i + 1}: nothing at "${s.to}", that clip lies on the desk`);
    bench = addLeadBetween(bench, from, to, s.color ?? LEAD_COLORS[i % LEAD_COLORS.length]!, s.id)[0];
  });

  for (const g of onLeads) {
    const part = bench.parts.find((p) => p.id === g.id)!;
    const res = placePart({ ...bench, parts: bench.parts.filter((p) => p.id !== g.id) }, part, g.at, undefined, () => part.pos);
    if (res.warning) warnings.push(res.warning);
    bench = { ...bench, parts: bench.parts.map((p) => (p.id === g.id ? res.part : p)) };
  }

  // The meter: to the right of the work area, turned a little toward it.
  if (meter) {
    const spot = meter.at ? deskSpot(meter.at) : null;
    const pos: Vec2 = spot ?? defaultMeterSpot(bench);
    const m = defaultMeter(pos, meter.rot ?? -12);
    m.mode = meter.mode ?? "off";
    if (meter.range) m.range = meter.range;
    if (meter.red !== undefined) m.probes.red.socket = meter.red;
    if (meter.black !== undefined) m.probes.black.socket = meter.black;
    if (m.probes.red.socket && m.probes.red.socket === m.probes.black.socket) m.probes.black.socket = null;
    for (const c of ["red", "black"] as const) {
      const spot = meter.tips?.[c] ? deskSpot(meter.tips[c]!) : null;
      if (spot) m.probes[c].tip.pos = spot;
    }
    bench = { ...bench, meter: m };
    for (const c of ["red", "black"] as const) {
      const tip = meter.probes?.[c];
      if (tip) bench = benchOps.touchProbe(bench, c, resolveAttach(bench, tip));
    }
  }

  // The tray. `count` means how many the tray holds, so add what is already on the bench that the bench counts
  // against the item (leads of its colour, parts of its kind with its params: trayUsed).
  let spareFuses: number | null = null;
  const tray: TrayItem[] = [];
  for (const item of config.tray) {
    const t = trayItem(item);
    if (t === "meter-fuse") {
      spareFuses = (spareFuses ?? 0) + (item.count ?? 1);
      continue;
    }
    if (!t) {
      warnings.push(`tray: cannot offer "${item.kind}"`);
      continue;
    }
    if (t.count !== undefined) {
      t.count += trayUsed(t, bench);
    }
    tray.push(t);
  }
  if (meter?.spareFuses !== undefined) spareFuses = meter.spareFuses;

  for (const c of config.controls ?? []) for (const id of controlTargets(bench, c)) inputs.push({ id, key: c.key as InputKey, value: c.value });

  const frame = frameOf(bench, config.frame, warnings);
  const overlays = { flow: config.overlays?.flow ?? "off", push: !!config.overlays?.push, offer: config.overlays?.offer ?? [] } as const;
  return { bench, locked, tray, meter, scope, logger, stopwatch, tapper, controls: config.controls ?? [], nodes: config.nodes ?? {}, labels, inputs, spareFuses, inspect, warnings, frame, overlays };
}

/** The rectangle spanned by holes and desk spots, with a little margin. */
function frameOf(bench: BenchState, spots: string[] | undefined, warnings: string[]): [number, number, number, number] | null {
  if (!spots?.length) return null;
  const pts: Vec2[] = [];
  for (const s of spots) {
    const desk = deskSpot(s);
    const hole = !desk && bench.board ? resolveHole(bench.board, s) : null;
    const p = desk ?? (hole && bench.board ? holeWorld(bench.board, hole) : null);
    if (p) pts.push(p);
    else warnings.push(`frame: cannot place "${s}"`);
  }
  if (!pts.length) return null;
  const m = 6;
  return [Math.min(...pts.map((p) => p[0])) - m, Math.min(...pts.map((p) => p[1])) - m, Math.max(...pts.map((p) => p[0])) + m, Math.max(...pts.map((p) => p[1])) + m];
}

const CONTROL_KINDS: Record<string, BenchPartKind[]> = { light: ["phototransistor"], ohms: ["touch-pads", "cup"], position: ["trimmer"] };

/**
 * The parts a control drives: its part, with part "*" every part on the bench that takes its input (for the hand,
 * `proximity`, every chip: a part with a 555 or logic `model`), or none (speed, room).
 */
export function controlTargets(bench: BenchState, c: ControlConfig): string[] {
  if (c.part === undefined) return [];
  if (c.part !== "*") return [c.part];
  if (c.key === "proximity") return bench.parts.filter((p) => partChip(p)).map((p) => p.id);
  const kinds = CONTROL_KINDS[c.key] ?? [];
  return bench.parts.filter((p) => kinds.includes(p.kind)).map((p) => p.id);
}

/** "in:H1" or "in:H1.r": a holder (and seat) a part starts in or is moved to. */
export function seatSpot(at: string): { holder: string; seat?: string } | null {
  const m = /^in:([A-Za-z][A-Za-z0-9_-]*)(?:\.([A-Za-z0-9_-]+))?$/.exec(at.trim());
  if (!m) return null;
  return m[2] ? { holder: m[1]!, seat: m[2] } : { holder: m[1]! };
}

function defaultMeterSpot(bench: BenchState): Vec2 {
  let x1 = -Infinity;
  let z = 0;
  if (bench.board) {
    const g = boardGeometry(bench.board);
    const [ox, oz] = bench.board.pos ?? [0, 0];
    x1 = ox + g.width / 2;
    z = oz + 4;
  }
  for (const p of bench.parts) {
    if (p.holes && Object.keys(p.holes).length && !isFlying(p)) continue;
    x1 = Math.max(x1, p.pos[0] + (DESK_WIDTH[p.kind] ?? 30) / 2);
  }
  if (!Number.isFinite(x1)) x1 = 60;
  return [x1 + 62, z];
}

/** A bench tray item from a lab tray item (new or first-draft form). */
function trayItem(item: LabTrayItem): TrayItem | "meter-fuse" | null {
  const params: Record<string, unknown> = { ...("props" in item && item.props ? item.props : {}), ...("params" in item && item.params ? item.params : {}) };
  const base = { ...(item.count !== undefined ? { count: item.count } : {}), ...(item.label ? { label: item.label } : {}), ...(item.id ? { id: item.id } : {}) };
  switch (item.kind) {
    case "lead":
    case "wire": {
      const color = typeof params["color"] === "string" ? (params["color"] as LeadColor) : undefined;
      return { kind: "lead", ...(color ? { params: { color } } : {}), ...base };
    }
    case "fuse":
      if (params["forMeter"]) return "meter-fuse";
      return { kind: "fuse", params: { amps: Number(params["amps"] ?? 1) }, ...base };
    case "multimeter":
      return null;
    default: {
      const n = normalize({ id: "T", kind: item.kind, props: params as Record<string, number | string | boolean> }, false);
      if (n.kind !== "part") return null;
      return { kind: n.n.kind, params: n.n.params, ...base };
    }
  }
}
