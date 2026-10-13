/**
 * Builds the LabView goals read. Pure: the runtime and the headless solution replay both feed it the bench, the latest
 * snapshot, the recent snapshot history and the notebook.
 */
import { partDef, type BenchNetlist, type BenchState, type MeterSocket, type PlacedPart } from "@ohmland/bench/core";
import type { NodeId, PartState, SimEvent, SimEventType, Snapshot } from "@ohmland/sim";
import { resolveAttach } from "./anchors";
import type { LabView, MeterView, Reading, TaskStatus } from "./define";

export type LabViewInput = {
  bench: BenchState;
  /** The bench's metal connectivity as a netlist (benchToNetlist with leadOhms 0), for topology checks. */
  net: BenchNetlist | null;
  /** The netlist the simulator runs, whose node names key `snapshot.nodes` (defaults to `net`). */
  simNet?: BenchNetlist | null;
  snapshot: Snapshot | null;
  /** Events since the lab started (or the last reset), oldest first. */
  events: readonly SimEvent[];
  /** Recent snapshots, oldest first (the runtime keeps about 20 s). */
  history?: readonly Snapshot[];
  readings?: readonly Reading[];
  notes?: Readonly<Record<string, number | null>>;
  controls?: Readonly<Record<string, number>>;
  /** Per-task scratch space; the session swaps it before each goal. */
  memory?: Record<string, unknown>;
  status?: Readonly<Record<string, TaskStatus>>;
  /** Named nodes from the lab's bench config. */
  nodes?: Readonly<Record<string, string>>;
  /** Pitch of the speaker sound, from the audio stream. */
  tone?: number | null;
  onTrigger?: (name: string) => void;
  /** When each task was done in this visit, with the meter as it read then. */
  doneAt?: Readonly<Record<string, { t: number; meter: MeterView | null }>>;
};

const SPDT = new Set(["slide-switch", "toggle-switch"]);

/** The simulator kind of a bench part, as the Hall of Fried Parts and achievements name it. */
export function hallKind(part: PlacedPart | undefined, partId: string): string {
  if (!part) return partId.startsWith("M") ? "meter-fuse" : "part";
  switch (part.kind) {
    case "ceramic-cap":
    case "electrolytic-cap":
      return "capacitor";
    case "trimmer":
      return "pot";
    case "slide-switch":
    case "toggle-switch":
      return "switch";
    case "lemon":
      return "cell";
    default:
      return part.kind;
  }
}

/** The two pins a part is measured "across": first and second for two-lead parts, com and b for switches. */
export function acrossPins(part: PlacedPart): [string, string] {
  if (SPDT.has(part.kind)) return ["com", "b"];
  if (part.kind === "pushbutton") return ["a1", "b1"];
  const legs = partDef(part.kind).legs;
  return [legs[0] ?? "", legs[1] ?? ""];
}

/** Parses a meter display into a number in its own unit: "OL" is Infinity, blank is null. */
export function parseDisplay(display: string | undefined | null): number | null {
  if (!display) return null;
  const d = display.replace(/\s+/g, "");
  if (!d) return null;
  if (/^-?OL$/i.test(d)) return d.startsWith("-") ? -Infinity : Infinity;
  const n = Number(d.startsWith(".") || d.startsWith("-.") ? d.replace(".", "0.") : d);
  return Number.isFinite(n) ? n : null;
}

const PREFIX: Record<string, number> = { µ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6 };

/** The factor from a display unit ("mA", "kΩ", "V") to base units. */
export function unitFactor(unit: string | null | undefined): number {
  if (!unit || unit.length < 2) return 1;
  return PREFIX[unit[0]!] ?? 1;
}

function meterView(bench: BenchState, snapshot: Snapshot | null): MeterView | null {
  const m = bench.meter;
  if (!m) return null;
  const s = snapshot?.parts[m.id];
  const off = m.mode === "off";
  const display = off ? null : s?.display?.trim() ? s.display : null;
  const unit = off ? null : s?.unit ?? null;
  const value = parseDisplay(display);
  const x = s?.extra ?? {};
  const range = typeof x["range"] === "string" ? (x["range"] as string) : m.range && m.range !== "auto" ? m.range : null;
  const si = value === null ? null : typeof x["value"] === "number" && Number.isFinite(value) ? (x["value"] as number) : value * unitFactor(unit);
  return {
    mode: m.mode,
    range,
    auto: !m.range || m.range === "auto",
    red: m.probes.red.socket,
    black: m.probes.black.socket,
    redAt: m.probes.red.tip.to,
    blackAt: m.probes.black.tip.to,
    display,
    unit,
    value,
    si,
    fuse: x["fuse"] === "blown" ? "blown" : "ok",
    beep: x["beep"] === true,
  };
}

const CURRENT_MODES = new Set(["dca-ma", "dca-10a"]);

export function createLabView(input: LabViewInput): LabView {
  const { bench, net, snapshot } = input;
  const events = input.events;
  const t = snapshot?.t ?? 0;
  const meter = meterView(bench, snapshot);
  const partOf = (id: string) => bench.parts.find((p) => p.id === id);
  const nodeOf = (anchor: string | null): NodeId | null => (anchor && net ? net.nodeOf(anchor) : null);
  const simNet = input.simNet ?? net;
  const simNodeOf = (anchor: string | null): NodeId | null => (anchor && simNet ? simNet.nodeOf(anchor) : null);
  const pinNode = (id: string, leg: string) => nodeOf(`pin:${id}.${leg}`);
  const readings = input.readings ?? [];
  const history = input.history ?? (snapshot ? [snapshot] : []);

  const closedOf = (id: string): boolean => {
    const p = partOf(id);
    if (p && SPDT.has(p.kind)) return (p.params as { to?: string }).to === "b";
    const s = snapshot?.parts[id];
    if (p?.kind === "fuse") return s?.closed !== false && s?.health !== "dead";
    return s?.closed === true;
  };

  /** The simulator node of a named node or attach point (for voltages). */
  const resolveNode = (name: string): NodeId | null => {
    const named = input.nodes?.[name];
    if (named) return simNodeOf(resolveAttach(bench, named));
    if (name === "gnd") return "gnd";
    const a = resolveAttach(bench, name);
    if (a) return simNodeOf(a);
    // A raw netlist node name.
    return snapshot && name in snapshot.nodes ? name : null;
  };

  const voltsAt = (s: Snapshot | null, node: NodeId | null): number | undefined => {
    if (!s || !node) return undefined;
    if (node === "gnd") return 0;
    return s.nodes[node];
  };

  const deadIds = (): string[] => {
    const ids = new Set<string>();
    for (const e of events) if (e.type === "died" || e.type === "blown") ids.add(e.partId.replace(/:\d+$/, ""));
    if (snapshot) for (const [id, p] of Object.entries(snapshot.parts)) if (p.health === "dead") ids.add(id.replace(/:\d+$/, ""));
    return [...ids];
  };

  const sample = (s: Snapshot, source: string): number | undefined => {
    const i = source.indexOf(":");
    const key = source.slice(0, i);
    const target = source.slice(i + 1);
    if (key === "volts") return voltsAt(s, resolveNode(target));
    const p = s.parts[target];
    if (!p) return undefined;
    switch (key) {
      case "glow":
        return p.glow ?? 0;
      case "i":
        return p.i;
      case "v":
        return p.v;
      case "temp":
        return p.temp;
      case "p":
        return p.p;
      default:
        return undefined;
    }
  };

  const across = (partId: string, dir?: "rev" | "either"): boolean => {
    const p = partOf(partId);
    if (!p || !bench.meter || !net) return false;
    const [a, b] = acrossPins(p);
    if (!a || !b) return false;
    const na = pinNode(partId, a);
    const nb = pinNode(partId, b);
    const red = nodeOf("probe:red");
    const black = nodeOf("probe:black");
    if (!bench.meter.probes.red.tip.to || !bench.meter.probes.black.tip.to || na === nb) return false;
    const fwd = red === na && black === nb;
    const rev = red === nb && black === na;
    return dir === "rev" ? rev : dir === "either" ? fwd || rev : fwd;
  };

  const inSeries = (partId: string): boolean => {
    if (!meter || !CURRENT_MODES.has(meter.mode) || !snapshot || !bench.meter) return false;
    const want: MeterSocket = meter.mode === "dca-10a" ? "a10" : "ma";
    if (meter.red !== want || meter.black !== "com") return false;
    const p = partOf(partId);
    if (!p) return false;
    const mi = Math.abs(snapshot.parts[bench.meter.id]?.i ?? 0);
    const pi = Math.abs(snapshot.parts[partId]?.i ?? 0);
    if (mi < 1e-6 || pi < 1e-6 || Math.abs(mi - pi) > Math.max(pi, mi) * 0.03) return false;
    // The meter's leads must sit on the part's own nodes or on a node in its loop.
    const red = nodeOf("probe:red");
    const black = nodeOf("probe:black");
    const legs = partDef(p.kind).legs.map((l) => pinNode(partId, l));
    return legs.includes(red) || legs.includes(black) || mi > 0;
  };

  /** Distinct parts with a lead on each node (the meter counts only on a current range). */
  const partsAtNodes = (): Map<NodeId, Set<string>> => {
    const out = new Map<NodeId, Set<string>>();
    const add = (n: NodeId | null, id: string) => {
      if (!n) return;
      let s = out.get(n);
      if (!s) out.set(n, (s = new Set()));
      s.add(id);
    };
    for (const p of bench.parts) for (const leg of partDef(p.kind).legs) add(pinNode(p.id, leg), p.id);
    if (bench.meter && meter && CURRENT_MODES.has(meter.mode)) {
      add(nodeOf("probe:red"), bench.meter.id);
      add(nodeOf("probe:black"), bench.meter.id);
    }
    return out;
  };

  /** Given the node current enters a part by, the node it leaves by (two-way paths only). */
  const through = (id: string, inNode: NodeId): { inPin: string; out: NodeId | null } | null => {
    if (bench.meter && id === bench.meter.id) {
      const r = nodeOf("probe:red");
      const b = nodeOf("probe:black");
      if (r === inNode) return { inPin: "red", out: b };
      if (b === inNode) return { inPin: "black", out: r };
      return null;
    }
    const p = partOf(id);
    if (!p) return null;
    const legs = partDef(p.kind).legs;
    const at = legs.filter((l) => pinNode(id, l) === inNode);
    if (at.length === 0) return null;
    const leg = at[0]!;
    let outLeg: string | undefined;
    if (SPDT.has(p.kind)) {
      const to = (p.params as { to: "a" | "b" }).to;
      outLeg = leg === "com" ? to : leg === to ? "com" : undefined;
    } else if (p.kind === "pushbutton") {
      outLeg = leg.startsWith("a") ? "b1" : "a1";
    } else if (legs.length === 2) {
      outLeg = legs.find((l) => l !== leg);
    }
    if (!outLeg) return null;
    return { inPin: leg, out: pinNode(id, outLeg) };
  };

  const seriesLoop = (ids: readonly string[]): boolean => {
    if (ids.length < 2 || !net) return false;
    const first = partOf(ids[0]!);
    const at = partsAtNodes();
    let startOut: NodeId | null;
    let startIn: NodeId | null;
    if (first && (first.kind === "battery" || first.kind === "lemon")) {
      startOut = pinNode(first.id, "pos");
      startIn = pinNode(first.id, "neg");
    } else {
      // Not a source: try both directions.
      const legs = first ? acrossPins(first) : null;
      if (!legs) return false;
      return [legs, [legs[1], legs[0]] as [string, string]].some(([o, i]) => walk(ids, at, pinNode(ids[0]!, o), pinNode(ids[0]!, i)));
    }
    return walk(ids, at, startOut, startIn);
  };

  const walk = (ids: readonly string[], at: Map<NodeId, Set<string>>, out0: NodeId | null, in0: NodeId | null): boolean => {
    if (!out0 || !in0 || out0 === in0) return false;
    let out: NodeId | null = out0;
    for (let k = 1; k < ids.length; k++) {
      if (!out) return false;
      const id = ids[k]!;
      const there = at.get(out);
      if (!there || there.size !== 2 || !there.has(id) || !there.has(ids[k - 1]!)) return false;
      const next = through(id, out);
      if (!next || next.out === out) return false;
      out = next.out;
    }
    if (out !== in0) return false;
    const last = at.get(in0);
    return !!last && last.size === 2 && last.has(ids[0]!) && last.has(ids[ids.length - 1]!);
  };

  /** The two-lead parts linked end to end, in any order; see LabView.chain. */
  const chain = (ids: readonly string[]): { ends: [string, string]; flipped: string[] } | null => {
    if (!ids.length || !net) return null;
    type Edge = { id: string; legs: [string, string]; nodes: [NodeId, NodeId] };
    const edges: Edge[] = [];
    for (const id of ids) {
      const p = partOf(id);
      if (!p) return null;
      const legs = acrossPins(p);
      const na = pinNode(id, legs[0]);
      const nb = pinNode(id, legs[1]);
      if (!legs[0] || !legs[1] || !na || !nb || na === nb) return null;
      edges.push({ id, legs, nodes: [na, nb] });
    }
    const degree = new Map<NodeId, number>();
    for (const e of edges) for (const n of e.nodes) degree.set(n, (degree.get(n) ?? 0) + 1);
    const ends = [...degree].filter(([, d]) => d === 1).map(([n]) => n);
    if (ends.length !== 2 || [...degree.values()].some((d) => d > 2) || degree.size !== edges.length + 1) return null;
    // Nothing else may hang on a link between two of the parts.
    const at = partsAtNodes();
    for (const [n, d] of degree) if (d === 2 && (at.get(n)?.size ?? 0) !== 2) return null;
    const walk = (start: NodeId) => {
      const order: { e: Edge; forward: boolean }[] = [];
      const used = new Set<string>();
      let node = start;
      for (;;) {
        const e = edges.find((x) => !used.has(x.id) && x.nodes.includes(node));
        if (!e) break;
        used.add(e.id);
        const forward = e.nodes[0] === node;
        order.push({ e, forward });
        node = forward ? e.nodes[1] : e.nodes[0];
      }
      return order;
    };
    let order = walk(ends[0]!);
    if (order.length !== edges.length) return null;
    if (order.filter((o) => o.forward).length < order.filter((o) => !o.forward).length) order = walk(ends[1]!);
    const first = order[0]!;
    const last = order[order.length - 1]!;
    const startLeg = first.forward ? first.e.legs[0] : first.e.legs[1];
    const endLeg = last.forward ? last.e.legs[1] : last.e.legs[0];
    return { ends: [`${first.e.id}.${startLeg}`, `${last.e.id}.${endLeg}`], flipped: order.filter((o) => !o.forward).map((o) => o.e.id) };
  };

  const heldMap = (id: string): Record<string, string | undefined> => ((partOf(id)?.params as { held?: Record<string, string | undefined> } | undefined)?.held ?? {});

  const view: LabView = {
    t,
    bench: Object.assign(Object.create(null) as object, bench, {
      get detachedLeadEnds() {
        let n = 0;
        for (const l of bench.leads) n += (l.a.to ? 0 : 1) + (l.b.to ? 0 : 1);
        return n;
      },
    }) as LabView["bench"],
    snapshot,
    events,
    meter,
    get memory() {
      return (input.memory ??= {});
    },

    part(id) {
      const s = snapshot?.parts[id];
      if (!s) return undefined;
      const p = partOf(id);
      if (p && SPDT.has(p.kind)) return { ...s, closed: closedOf(id) };
      if (bench.meter && id === bench.meter.id) return { ...s, extra: { ...(s.extra ?? {}), red: bench.meter.probes.red.socket ?? "none", black: bench.meter.probes.black.socket ?? "none" } };
      return s as PartState;
    },
    benchPart: (id) => partOf(id),
    prop: (id) => partOf(id)?.params as Record<string, unknown> | undefined,

    isLit(id, min = 0.1) {
      const p = snapshot?.parts[id];
      return !!p && p.health !== "dead" && (p.glow ?? 0) >= min;
    },
    fried(kind) {
      return deadIds().some((id) => !kind || hallKind(partOf(id), id) === kind || partOf(id)?.kind === kind) || (!!kind && kind === "meter-fuse" && events.some((e) => e.type === "meter-fuse")) || (!kind && events.some((e) => e.type === "meter-fuse"));
    },
    died: (id) => deadIds().includes(id),
    closed: closedOf,
    event: (type: SimEventType, partId?: string) => events.some((e) => e.type === type && (partId === undefined || e.partId === partId)),
    count(type, partId, seconds) {
      let n = 0;
      for (const e of events) {
        if (e.type !== type || (partId !== undefined && e.partId !== partId)) continue;
        if (seconds !== undefined && e.t < t - seconds) continue;
        n += typeof e.data?.["count"] === "number" ? (e.data["count"] as number) : 1;
      }
      return n;
    },

    volts(node, ref) {
      const v = voltsAt(snapshot, resolveNode(node));
      if (v === undefined) return undefined;
      if (!ref) return v;
      const r = voltsAt(snapshot, resolveNode(ref));
      return r === undefined ? undefined : v - r;
    },
    amps: (id) => Math.abs(snapshot?.parts[id]?.i ?? 0),
    connected(a, b) {
      const na = nodeOf(resolveAttach(bench, a));
      const nb = nodeOf(resolveAttach(bench, b));
      return !!na && na === nb;
    },
    seriesLoop,
    chain,
    parallel(a, b) {
      const pa = partOf(a);
      const pb = partOf(b);
      if (!pa || !pb || a === b) return false;
      const [a0, a1] = acrossPins(pa).map((l) => pinNode(a, l));
      const [b0, b1] = acrossPins(pb).map((l) => pinNode(b, l));
      if (!a0 || !a1 || !b0 || !b1 || a0 === a1) return false;
      return (a0 === b0 && a1 === b1) || (a0 === b1 && a1 === b0);
    },
    probed(a, b, dir) {
      const m = bench.meter;
      if (!m || !m.probes.red.tip.to || !m.probes.black.tip.to || !net) return false;
      const na = nodeOf(resolveAttach(bench, a));
      const nb = nodeOf(resolveAttach(bench, b));
      if (!na || !nb || na === nb) return false;
      const red = nodeOf("probe:red");
      const black = nodeOf("probe:black");
      const fwd = red === na && black === nb;
      const rev = red === nb && black === na;
      return dir === "rev" ? rev : dir === "either" ? fwd || rev : fwd;
    },
    holds: (holderId) => Object.values(heldMap(holderId)).filter((x): x is string => !!x),
    heldBy(partId) {
      for (const p of bench.parts) if (Object.values(heldMap(p.id)).includes(partId)) return p.id;
      return null;
    },
    distance(a, b) {
      const pa = partOf(a);
      const pb = partOf(b);
      return pa && pb ? Math.hypot(pa.pos[0] - pb.pos[0], pa.pos[1] - pb.pos[1]) : Infinity;
    },
    doneAt: (taskId) => input.doneAt?.[taskId],
    loopOpen(partId) {
      if (partId) return Math.abs(snapshot?.parts[partId]?.i ?? 0) < 1e-6;
      for (const p of bench.parts) {
        if (p.kind !== "battery" && p.kind !== "lemon") continue;
        if (Math.abs(snapshot?.parts[p.id]?.i ?? 0) >= 2e-6) return false;
      }
      return true;
    },

    across,
    probesAcross: (partId, opts) => across(partId, opts?.either ? "either" : opts?.reversed ? "rev" : undefined),
    inSeries: (_meterId, partId) => inSeries(partId),
    meterInSeriesWith: inSeries,
    meterReads(value, opts) {
      if (!meter || meter.value === null || !Number.isFinite(meter.value)) return false;
      const tol = opts?.tol ?? 0.05;
      const shown = opts?.unit ? (meter.si ?? meter.value * unitFactor(meter.unit)) / unitFactor(opts.unit) : meter.value;
      return Math.abs(shown - value) <= Math.abs(value) * tol + 1e-9;
    },

    heldFor(seconds, cond, key = "held") {
      const mem = (input.memory ??= {});
      const k = `heldFor:${key}`;
      if (!cond) {
        delete mem[k];
        return false;
      }
      const since = typeof mem[k] === "number" ? (mem[k] as number) : (mem[k] = t);
      return t - (since as number) >= seconds - 1e-9;
    },
    history(source, seconds = 10) {
      const out: [number, number][] = [];
      for (const s of history) {
        if (s.t < t - seconds) continue;
        const v = sample(s, source);
        if (v !== undefined) out.push([s.t, v]);
      }
      return out;
    },
    blinkPeriod(ledId) {
      const h = view.history(`glow:${ledId}`, 12);
      if (h.length < 8) return null;
      let lo = Infinity;
      let hi = -Infinity;
      for (const [, v] of h) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      if (hi - lo < 0.15) return null;
      const mid = (hi + lo) / 2;
      const rises: number[] = [];
      for (let i = 1; i < h.length; i++) if (h[i - 1]![1] < mid && h[i]![1] >= mid) rises.push(h[i]![0]);
      if (rises.length < 3) return null;
      const periods = rises.slice(1).map((x, i) => x - rises[i]!).slice(-3);
      periods.sort((a, b) => a - b);
      return periods[Math.floor(periods.length / 2)]!;
    },
    toneHz(speakerId) {
      const p = snapshot?.parts[speakerId];
      if (!p || p.health === "dead") return null;
      return input.tone ?? null;
    },
    relayClicks: (id, seconds) => view.count("clicked", id, seconds),
    relayClicked: (id) => view.count("clicked", id) > 0,

    readingsLog: readings,
    logged(tag) {
      for (let i = readings.length - 1; i >= 0; i--) if (readings[i]!.tags.includes(tag)) return readings[i];
      return undefined;
    },
    readings: (tag) => (tag ? readings.filter((r) => r.tags.includes(tag)) : [...readings]),
    note: (id) => input.notes?.[id] ?? null,
    control: (id) => input.controls?.[id],
    task: (id) => input.status?.[id] ?? "todo",
    trigger: (name) => input.onTrigger?.(name),
  };
  return view;
}

/** Tags for a stable reading: what the probes are across, what the meter is in series with. */
export function readingTags(view: LabView): string[] {
  const tags: string[] = [];
  const bench = view.bench;
  if (!view.meter) return tags;
  const current = CURRENT_MODES.has(view.meter.mode);
  for (const p of bench.parts) {
    if (!current) {
      if (view.across(p.id)) tags.push(p.id, `across:${p.id}`);
      else if (view.across(p.id, "rev")) tags.push(`rev:${p.id}`);
    } else if (view.meterInSeriesWith(p.id)) tags.push(`series:${p.id}`);
  }
  return tags;
}
