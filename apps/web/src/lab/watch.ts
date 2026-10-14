/**
 * Which nodes a lab asks the simulator to watch for edges (Netlist.watch), and the key each watch goes by, so
 * `lab.edges("U1.trig")`, a timing diagram channel on "U1.2" and a stopwatch trigger on the same pin all find one
 * edge log. Pure.
 */
import type { BenchNetlist, BenchState } from "@ohmland/bench/core";
import type { Netlist, NodeId, WatchSpec } from "@ohmland/sim";
import { resolveAttach } from "./anchors";
import { chipPinNode, chipPinRef, specChip } from "./chips";
import type { LabDefinition, ScopeConfig, StopwatchConfig, WatchConfig } from "./define";

/**
 * The key of a watched node: a chip pin as "U1.2" (whatever it was called), a named node as the attach point it names,
 * anything else as written; with "@<volts>" for a fixed level.
 */
export function watchKey(bench: BenchState, netlist: Netlist | null, nodes: Readonly<Record<string, string>>, s: string, level?: number): string {
  const named = nodes[s];
  const base = named ?? s.trim();
  const chip = chipPinRef(base, bench, netlist);
  const key = chip ? `${chip.id}.${chip.n}` : base;
  return level === undefined ? key : `${key}@${level}`;
}

/** The supply pin node of the chip with a pin on `node`, for a threshold that follows that chip's supply. */
export function supplyNodeOf(netlist: Netlist, node: NodeId): NodeId | null {
  for (const spec of netlist.parts) {
    const info = specChip(spec);
    if (!info) continue;
    const pins = spec.pins as Record<string, NodeId | undefined>;
    if (Object.values(pins).includes(node)) return pins[info.vcc] ?? null;
  }
  return null;
}

/** Resolves one watch request against the netlist the simulator runs. */
export function watchSpec(bench: BenchState, net: BenchNetlist, nodes: Readonly<Record<string, string>>, s: string, level?: number): WatchSpec | null {
  const netlist = net.netlist;
  const base = nodes[s] ?? s;
  const chip = chipPinRef(base, bench, netlist);
  let node: NodeId | null = null;
  if (chip) node = chipPinNode(netlist, chip.id, chip.n);
  if (!node) {
    const a = resolveAttach(bench, base);
    node = a ? net.nodeOf(a) : null;
  }
  if (!node) return null;
  const id = watchKey(bench, netlist, nodes, s, level);
  if (level !== undefined) return { id, node, level };
  const of = supplyNodeOf(netlist, node);
  return of ? { id, node, of } : { id, node };
}

/** Everything a lab watches: its `watch` list, timing diagram channels, stopwatch node triggers and the scope's duty trace. */
export function watchRequests(lab: LabDefinition, scope: ScopeConfig | null, stopwatch: StopwatchConfig | null): { node: string; level?: number }[] {
  const out: { node: string; level?: number }[] = [];
  const add = (w: WatchConfig) => out.push(typeof w === "string" ? { node: w } : { node: w.node, ...(w.level !== undefined ? { level: w.level } : {}) });
  for (const w of lab.bench.watch ?? []) add(w);
  for (const p of lab.panels ?? []) {
    if (p.kind !== "timing") continue;
    for (const c of p.channels) if ("node" in c) add({ node: c.node, ...(c.level !== undefined ? { level: c.level } : {}) });
  }
  for (const t of stopwatch ? [stopwatch.start, stopwatch.stop] : []) {
    if ("node" in t) add({ node: t.node, level: "above" in t ? t.above : t.below });
  }
  if (scope?.duty !== undefined && scope.duty !== false) {
    const tr = scope.traces[scope.duty === true ? 0 : scope.duty];
    if (tr && "volts" in tr && !tr.ref) add(tr.volts);
  }
  return out;
}

/** The watch specs for a bench (unresolvable requests and duplicates left out). */
export function watchSpecs(bench: BenchState, net: BenchNetlist, nodes: Readonly<Record<string, string>>, requests: readonly { node: string; level?: number }[]): WatchSpec[] {
  const out: WatchSpec[] = [];
  const seen = new Set<string>();
  for (const r of requests) {
    const spec = watchSpec(bench, net, nodes, r.node, r.level);
    if (!spec || seen.has(spec.id)) continue;
    seen.add(spec.id);
    out.push(spec);
  }
  return out;
}
