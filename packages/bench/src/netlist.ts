// Bench state -> simulator netlist. Union-find over everything that is metal-to-metal connected:
// breadboard strips and rails, leads in holes, jumper wires, alligator clips and meter probes.

import type { Netlist, NodeId, PartSpec } from "@ohmland/sim";
import { holeAnchor, leadAnchor, parseAnchor, pinAnchor, probeAnchor, socketAnchor, wireAnchor } from "./anchors";
import { RAILS, boardGeometry } from "./board";
import { partDef, partLegs, physicalLeg, type NetContext } from "./parts";
import { heldOf, seatsOf } from "./seats";
import type { Anchor, BenchState, MeterSocket, PartParamsMap, PlacedPart } from "./types";

export class UnionFind {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  add(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  has(x: string): boolean {
    return this.parent.has(x);
  }

  find(x: string): string {
    this.add(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // Path compression.
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const ka = this.rank.get(ra)!;
    const kb = this.rank.get(rb)!;
    if (ka < kb) this.parent.set(ra, rb);
    else if (ka > kb) this.parent.set(rb, ra);
    else {
      this.parent.set(rb, ra);
      this.rank.set(ra, ka + 1);
    }
  }

  keys(): IterableIterator<string> {
    return this.parent.keys();
  }
}

export const SOCKETS: readonly MeterSocket[] = ["com", "vohm", "ma", "a10"];

export type Connectivity = {
  uf: UnionFind;
  /** Anchors that exist on this bench (holes, part leads, wire and clip ends, probes, sockets). */
  known: Set<Anchor>;
  warnings: string[];
  /** All anchors joined to this one by metal (not through parts). */
  members(anchor: Anchor): Anchor[];
  same(a: Anchor, b: Anchor): boolean;
};

/**
 * Build the metal-contact connectivity of the bench (no parts conduct here). With `splitLeads`, the two clips of a
 * test lead stay separate groups (the netlist then joins them with a small resistance); with `splitProbes`, so do
 * each meter probe's tip and socket.
 */
export function connectivity(bench: BenchState, opts: { splitLeads?: boolean; splitProbes?: boolean } = {}): Connectivity {
  const uf = new UnionFind();
  const known = new Set<Anchor>();
  const warnings: string[] = [];
  const add = (a: Anchor) => {
    known.add(a);
    uf.add(a);
  };

  // 1. Breadboard strips and rails.
  const geom = bench.board ? boardGeometry(bench.board) : null;
  if (geom) {
    for (const strip of geom.strips.values()) {
      const first = holeAnchor(strip.holes[0]!);
      for (const h of strip.holes) {
        add(holeAnchor(h));
        uf.union(first, holeAnchor(h));
      }
    }
  }

  // 2. Part leads, seated in holes, plus leads joined inside the part.
  const occupied = new Map<string, string>();
  const occupy = (hole: string, who: string) => {
    const prev = occupied.get(hole);
    if (prev) warnings.push(`hole-shared: ${hole} (${prev}, ${who})`);
    else occupied.set(hole, who);
  };
  const seat = (anchor: Anchor, hole: string | undefined, who: string) => {
    if (!hole) return;
    if (!geom || !geom.holes.has(hole)) {
      warnings.push(`hole-missing: ${who} -> ${hole}`);
      return;
    }
    occupy(hole, who);
    uf.union(anchor, holeAnchor(hole));
  };
  for (const part of bench.parts) {
    const def = partDef(part.kind);
    for (const leg of partLegs(part)) add(pinAnchor(part.id, leg));
    for (const [leg, hole] of Object.entries(part.holes ?? {})) seat(pinAnchor(part.id, leg), hole, `${part.id}.${leg}`);
    for (const [x, y] of def.bridges ?? []) uf.union(pinAnchor(part.id, x), pinAnchor(part.id, y));
  }
  // Holders: a seated part's leads touch the holder's contacts (resistor clips, a test station's terminals).
  for (const holder of bench.parts) {
    const held = heldOf(holder);
    for (const s of seatsOf(holder)) {
      const id = held[s.name];
      const part = id ? bench.parts.find((p) => p.id === id) : undefined;
      if (!part || !s.joins) continue;
      const legs = partDef(part.kind).legs;
      for (const [leg, own] of Object.entries(s.joins)) if (legs.includes(leg)) uf.union(pinAnchor(part.id, leg), pinAnchor(holder.id, own));
    }
  }

  // 3. Jumper wires.
  for (const w of bench.wires) {
    const a = wireAnchor(w.id, "a");
    const b = wireAnchor(w.id, "b");
    add(a);
    add(b);
    uf.union(a, b);
    seat(a, w.a, `${w.id}.a`);
    seat(b, w.b, `${w.id}.b`);
  }

  // 4. Meter sockets and probes (before clips so clips may grab a probe tip). With `splitProbes` each probe tip stays
  //    apart from its socket (the netlist joins them with the probe lead's resistance).
  if (bench.meter) {
    for (const s of SOCKETS) add(socketAnchor(s));
    for (const color of ["red", "black"] as const) {
      add(probeAnchor(color));
      const pr = bench.meter.probes[color];
      if (pr.socket && !opts.splitProbes) uf.union(socketAnchor(pr.socket), probeAnchor(color));
    }
  }

  // 5. Test leads: a lead is one conductor from clip to clip.
  for (const l of bench.leads) {
    add(leadAnchor(l.id, "a"));
    add(leadAnchor(l.id, "b"));
    if (!opts.splitLeads) uf.union(leadAnchor(l.id, "a"), leadAnchor(l.id, "b"));
  }
  const attach = (from: Anchor, to: Anchor | null) => {
    if (!to) return;
    if (!known.has(to)) {
      warnings.push(`clip-missing: ${from} -> ${to}`);
      return;
    }
    uf.union(from, to);
  };
  for (const l of bench.leads) {
    attach(leadAnchor(l.id, "a"), l.a.to);
    attach(leadAnchor(l.id, "b"), l.b.to);
  }
  if (bench.meter) {
    for (const color of ["red", "black"] as const) attach(probeAnchor(color), bench.meter.probes[color].tip.to);
  }

  const groups = new Map<string, Anchor[]>();
  let grouped = false;
  const members = (anchor: Anchor): Anchor[] => {
    if (!uf.has(anchor)) return [anchor];
    if (!grouped) {
      for (const k of uf.keys()) {
        const r = uf.find(k);
        const g = groups.get(r);
        if (g) g.push(k);
        else groups.set(r, [k]);
      }
      grouped = true;
    }
    return groups.get(uf.find(anchor)) ?? [anchor];
  };

  return { uf, known, warnings, members, same: (a, b) => uf.has(a) && uf.has(b) && uf.find(a) === uf.find(b) };
}

export type BenchNetlist = {
  netlist: Netlist;
  /** Node of any anchor: "hole:a12", "pin:R1.a", "probe:red", ... Unknown anchors get a unique floating node. */
  nodeOf: (anchor: Anchor) => NodeId;
  warnings: string[];
};

export type BenchNetlistOptions = {
  /** Part id for the multimeter in the netlist. Defaults to the meter's id. */
  meterId?: string;
  /**
   * Resistance of each crocodile test lead, clip to clip, in ohms (default 0.15). Each lead becomes a simulator
   * `wire` part with this resistance, so high-current circuits see realistic totals. 0 merges the two clips into one
   * node (an ideal conductor).
   */
  leadOhms?: number;
  /**
   * Resistance of each meter probe lead, socket to tip (default 0.1 Ω, or 0 when `leadOhms` is 0). Each plugged-in
   * probe becomes a `wire` part "<meter>:red" / "<meter>:black", so touching the tips together reads about 0.2 Ω.
   */
  probeOhms?: number;
};

const railOrder = (strip: string) => {
  const i = RAILS.findIndex((r) => strip.startsWith(r));
  return i >= 0 ? i : 99;
};

/**
 * Turn the bench into a simulator netlist. Every lead becomes a node by union-find over the board strips, rails,
 * lead-to-hole contacts, wire ends, clips and probes. The first battery's minus terminal (else the first cell's)
 * is the reference node "gnd". Leads that touch nothing get their own floating node.
 */
export function benchToNetlist(bench: BenchState, opts: BenchNetlistOptions = {}): BenchNetlist {
  const leadOhms = opts.leadOhms ?? 0.15;
  const probeOhms = opts.probeOhms ?? (leadOhms > 0 ? 0.1 : 0);
  const conn = connectivity(bench, { splitLeads: leadOhms > 0, splitProbes: probeOhms > 0 });
  const { uf } = conn;
  const warnings = [...conn.warnings];
  const geom = bench.board ? boardGeometry(bench.board) : null;

  // Reference node.
  const groundPart = bench.parts.find((p) => p.kind === "battery") ?? bench.parts.find((p) => p.kind === "lemon");
  const groundRoot = groundPart ? uf.find(pinAnchor(groundPart.id, "neg")) : null;
  if (!groundPart) warnings.push("no-ground: no battery or cell on the bench");

  // Name each set after the most readable thing in it.
  const names = new Map<string, NodeId>();
  const rank = new Map<string, [number, number, string]>();
  const consider = (anchor: Anchor, score: [number, number, string]) => {
    const r = uf.find(anchor);
    const cur = rank.get(r);
    if (!cur || score[0] < cur[0] || (score[0] === cur[0] && (score[1] < cur[1] || (score[1] === cur[1] && score[2] < cur[2])))) {
      rank.set(r, score);
    }
  };
  if (geom) {
    for (const strip of geom.strips.values()) {
      const col = strip.rail ? 0 : parseInt(strip.id, 10);
      consider(holeAnchor(strip.holes[0]!), [strip.rail ? 0 : 1, strip.rail ? railOrder(strip.id) : col, strip.id]);
    }
  }
  bench.parts.forEach((p, i) => {
    for (const leg of partLegs(p)) consider(pinAnchor(p.id, leg), [2, i, `${p.id}.${leg}`]);
  });
  for (const k of uf.keys()) {
    const parsed = parseAnchor(k);
    const label = parsed ? k.replace(":", "-") : k;
    consider(k, [3, 0, label]);
  }
  const nodeOfRoot = (root: string): NodeId => {
    if (groundRoot && root === groundRoot) return "gnd";
    let n = names.get(root);
    if (!n) {
      n = rank.get(root)?.[2] ?? root;
      names.set(root, n);
    }
    return n;
  };
  const nodeOf = (anchor: Anchor): NodeId => {
    if (!uf.has(anchor)) return `float-${anchor.replace(":", "-")}`;
    return nodeOfRoot(uf.find(anchor));
  };

  const specs: PartSpec[] = [];
  const ctx: NetContext = { part: (id) => bench.parts.find((p) => p.id === id), pin: (id, leg) => nodeOf(pinAnchor(id, leg)) };
  for (const part of bench.parts) {
    const def = partDef(part.kind);
    // Mystery parts are wired inside in a shuffled order: leg `fn` of the model is whichever terminal carries it.
    const node = (leg: string) => nodeOf(pinAnchor(part.id, physicalLeg(part, leg)));
    specs.push(...(def.toSpecs as (p: PlacedPart, n: (leg: string) => NodeId, c: NetContext) => PartSpec[])(part, node, ctx));
  }

  if (leadOhms > 0) {
    for (const l of bench.leads) {
      specs.push({ id: l.id, kind: "wire", pins: { a: nodeOf(leadAnchor(l.id, "a")), b: nodeOf(leadAnchor(l.id, "b")) }, ohms: leadOhms });
    }
  }

  if (bench.meter) {
    const m = bench.meter;
    const spec: PartSpec = {
      id: opts.meterId ?? m.id,
      kind: "multimeter",
      pins: {
        com: nodeOf(socketAnchor("com")),
        vohm: nodeOf(socketAnchor("vohm")),
        ma: nodeOf(socketAnchor("ma")),
        a10: nodeOf(socketAnchor("a10")),
      },
      mode: m.mode,
    };
    if (m.range !== undefined) spec.range = m.range;
    specs.push(spec);
    if (probeOhms > 0) {
      for (const color of ["red", "black"] as const) {
        const socket = m.probes[color].socket;
        if (!socket) continue;
        specs.push({ id: `${spec.id}:${color}`, kind: "wire", pins: { a: nodeOf(socketAnchor(socket)), b: nodeOf(probeAnchor(color)) }, ohms: probeOhms });
      }
    }
  }

  return { netlist: { parts: specs }, nodeOf, warnings };
}

/** Parameters with defaults filled in, typed by kind. */
export function paramsWithDefaults<K extends keyof PartParamsMap>(kind: K, params: Partial<PartParamsMap[K]>): PartParamsMap[K] {
  return { ...partDef(kind).defaults, ...params } as PartParamsMap[K];
}
