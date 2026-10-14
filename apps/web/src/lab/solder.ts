/**
 * What a Unit 3 goal can read about soldering, perfboard, wire and power from the wall (`lab.solder`, see
 * docs/LABS.md and docs/curriculum/unit-3.md section 7.2). Pure: built from the bench and the solder station's live
 * state (null in headless replays, where joints read from what the bench keeps once they have set).
 */
import {
  ALLOYS,
  connectivity,
  ghostsFilled,
  jointRecordAt,
  padMetal,
  parsePerfHole,
  readJoint,
  spoolOf,
  splices,
  stationOf,
  stationSpots,
  tubeGrips,
  tubePose,
  crossings,
  type Alloy,
  type BenchState,
  type JointReading,
  type PlacedPartOf,
  type StationState,
  type StripEnd,
  type StripTry,
  type Tinning,
  type TugResult,
  type Verdict,
} from "@ohmland/bench/core";

export type SolderJoint = {
  state: JointReading["phase"];
  verdict: Verdict | null;
  /** Share of the work the solder has wetted, 0..1. */
  wetted: number;
  /** Solder relative to a good fillet (1 is ideal). */
  volume: number;
  peakC: number;
  tempC: number;
  /** Where the solder first came from: fed at the work, or carried on the tip. */
  fedAt: "work" | "tip" | null;
  moved: boolean;
  bridgeTo: string | null;
  /** Solder was held to it while it was too cold to melt it. */
  coldTouch: boolean;
};

export type SolderBoard = {
  flipped: boolean;
  flexed: boolean;
  tack: boolean;
  /** Bare legs or links lying across each other underneath. */
  crossings: number;
  /** Each leg through the board: its pad, and the pad it is bent to. */
  legs: { part: string; leg: string; pad: string; bentTo: string | null }[];
  /** Verdicts of the joints that have set, by pad. */
  joints: Record<string, Verdict | null>;
  /** Every listed part's legs are snipped underneath. */
  snipped(ids: string[]): boolean;
  /** Every ghost on the plan is filled the right way round, and every plan line is joined by metal. */
  matchesPlan(planId: string): boolean;
};

export type SolderLab = {
  /** The iron, or null without a solder station. `at` is the spot it rests on (null in its stand or on the desk). */
  iron: { on: boolean; setC: number; tipC: number; tinned: Tinning; at: string | null; inStand: boolean; onDesk: boolean; held: boolean } | null;
  /** The spool in use and its full-melt temperature (183 leaded, 220 lead-free). */
  solderKind: Alloy | null;
  meltC: number;
  /** A spool: its alloy, and whether (and at what tip temperature) it first melted on the tip. */
  spool(id: string): { kind: Alloy; melted: boolean; firstMeltTipC: number | null } | null;
  /** A joint at a spot: "PB1.C4" (a perfboard pad) or "HW1.b" (a splice). Null where nothing has been soldered. */
  joint(spot: string): SolderJoint | null;
  /** The last tug or wiggle at a spot ("held", "loose", "pulled"), or null. */
  tug(spot: string): TugResult | null;
  /** °C at a station point: "tip", "die:D1", "clip:HS1", "joint:PB1.C4", "lead:D1.anode@6", "tube:T1" (25 when cool). */
  temp(anchor: string): number;
  /** A heat-sink clip: the lead it grips ("D1.anode") and how far from the body (mm). */
  clip(id: string): { on: string | null; mm: number | null; metal: "copper" | "steel" } | null;
  /** A hookup wire's stripped end (end a unless only b is stripped), with every try. */
  strip(wire: string, end?: "a" | "b"): (StripEnd & { end: "a" | "b"; tries: StripTry[] }) | null;
  /** A heat-shrink tube: the wire it is on, the splice it covers, how far it has shrunk, split, gripping. */
  tube(id: string): { on: string | null; over: string | null; shrink: number; split: boolean; grip: boolean } | null;
  /** A wall adapter: the jack its plug is in, and what its label says. */
  adapter(id: string): { into: string | null; type: "regulated" | "unregulated" | "ac"; centre: "plus" | "minus"; volts: number } | null;
  board(id: string): SolderBoard | null;
  /** A plan card: how many lines it has, and which of them (numbered from 1) are joined on its board now. */
  plan(id: string, board?: string): { lines: number; joined: number[] } | null;
  /** Looked at under the magnifier. */
  viewed(spot: string): boolean;
  heatView: boolean;
  quickMode: boolean;
  /** Every spot the iron or solder can go to now. */
  spots(): string[];
};

const AMBIENT = 25;

export function solderLab(bench: BenchState, station: StationState | null): SolderLab {
  const st = stationOf(bench);
  const spool = spoolOf(bench);
  const where = st?.params.iron ?? "stand";
  let conn: ReturnType<typeof connectivity> | null = null;
  const metal = () => (conn ??= connectivity(bench));
  const part = (id: string) => bench.parts.find((p) => p.id === id);

  const board = (id: string): SolderBoard | null => {
    const b = part(id);
    if (!b || b.kind !== "perfboard") return null;
    const legs: SolderBoard["legs"] = [];
    for (const p of bench.parts) {
      for (const [leg, h] of Object.entries(p.holes ?? {})) {
        const q = parsePerfHole(h);
        if (q?.board !== id) continue;
        legs.push({ part: p.id, leg, pad: q.pad, bentTo: b.params.bends?.[`${p.id}.${leg}`] ?? null });
      }
    }
    const joints: Record<string, Verdict | null> = {};
    for (const [pad, rec] of Object.entries(b.params.joints ?? {})) joints[pad] = rec?.verdict ?? null;
    return {
      flipped: !!b.params.flipped,
      flexed: !!b.params.flexed,
      tack: !!b.params.tack,
      crossings: crossings(bench, b).length,
      legs,
      joints,
      snipped: (ids) => ids.every((x) => (b.params.snipped ?? []).includes(x)),
      matchesPlan: (planId) => {
        const plan = part(planId);
        if (!plan || plan.kind !== "plan-card") return false;
        if (!ghostsFilled(bench, b, plan.params.ghosts ?? [])) return false;
        return (plan.params.lines ?? []).every(([a, c]) => metal().same(`pin:${id}.${a}`, `pin:${id}.${c}`));
      },
    };
  };

  return {
    iron: st
      ? {
          on: st.params.on,
          setC: st.params.setC,
          tipC: station?.iron.tipC ?? (st.params.on ? st.params.setC : AMBIENT),
          tinned: station?.iron.tinning ?? st.params.tinning ?? "tinned",
          at: where !== "stand" && where !== "desk" ? where : null,
          inStand: where === "stand" && !station?.held,
          onDesk: where === "desk",
          held: !!station?.held,
        }
      : null,
    solderKind: spool?.params.alloy ?? null,
    meltC: ALLOYS[spool?.params.alloy ?? "lead-free"].liquidus,
    spool(id) {
      const s = part(id);
      if (!s || s.kind !== "solder-spool") return null;
      const first = station?.melted[id];
      return { kind: s.params.alloy, melted: first !== undefined, firstMeltTipC: first ?? null };
    },
    joint(spot) {
      const r = readJoint(bench, station, spot);
      if (!r) return null;
      return {
        state: r.phase,
        verdict: r.verdict,
        wetted: r.wetted,
        volume: r.volume,
        peakC: r.peakC,
        tempC: r.tempC,
        fedAt: r.fedAt,
        moved: r.moved,
        bridgeTo: r.bridgeTo,
        coldTouch: r.coldTouch || !!station?.coldTouches.includes(spot),
      };
    },
    tug: (spot) => station?.tugs[spot] ?? null,
    temp(anchor) {
      if (anchor === "tip") return station?.iron.tipC ?? (st?.params.on ? st.params.setC : AMBIENT);
      return station?.temps[anchor] ?? AMBIENT;
    },
    clip(id) {
      const c = part(id);
      if (!c || c.kind !== "heat-sink-clip") return null;
      return { on: c.params.on ?? null, mm: c.params.on ? (c.params.mm ?? 6) : null, metal: c.params.metal };
    },
    strip(wire, end) {
      const w = part(wire);
      if (!w || w.kind !== "hookup-wire") return null;
      const e = end ?? (w.params.ends?.a ? "a" : "b");
      const s = w.params.ends?.[e];
      return s ? { ...s, end: e, tries: w.params.tries ?? [] } : null;
    },
    tube(id) {
      const t = part(id);
      if (!t || t.kind !== "heat-shrink") return null;
      const pose = tubePose(bench, t);
      let over: string | null = null;
      if (pose) {
        for (const s of splices(bench)) if (Math.hypot(s.pos[0] - pose.origin[0], s.pos[2] - pose.origin[2]) < 12) over = s.id;
      }
      const shrink = t.params.shrink ?? 0;
      // A splice of two 22 AWG wires with its solder is about 1.9 mm across.
      return { on: t.params.on ?? null, over, shrink, split: !!t.params.split, grip: !!over && tubeGrips(t.params.size, shrink, 1.9) };
    },
    adapter(id) {
      const a = part(id);
      if (!a || a.kind !== "wall-adapter") return null;
      return { into: a.params.into ?? null, type: a.params.type, centre: a.params.centre, volts: a.params.volts };
    },
    board,
    plan(id, boardId) {
      const plan = part(id);
      if (!plan || plan.kind !== "plan-card") return null;
      const b = (boardId ? part(boardId) : bench.parts.find((p) => p.kind === "perfboard" && p.params.plan === id)) as PlacedPartOf<"perfboard"> | undefined;
      const lines = plan.params.lines ?? [];
      const joined: number[] = [];
      if (b) lines.forEach(([a, c], i) => metal().same(`pin:${b.id}.${a}`, `pin:${b.id}.${c}`) && joined.push(i + 1));
      return { lines: lines.length, joined };
    },
    viewed: (spot) => !!station?.viewed.includes(spot),
    heatView: !!station?.heatView,
    quickMode: !!station?.quickMode,
    spots: () => stationSpots(bench).map((s) => s.id),
  };
}

/** True when the joint at a spot has set and is sound (good, or too much solder that still holds). */
export function soundJoint(lab: { solder: SolderLab }, spot: string): boolean {
  const j = lab.solder.joint(spot);
  return !!j && j.state === "set" && j.verdict === "good";
}

/** The pads where a part's legs go through a board, for checking its joints one by one. */
export function padsOf(bench: BenchState, partId: string): string[] {
  const out: string[] = [];
  for (const p of bench.parts) {
    if (p.kind !== "perfboard") continue;
    for (const [pad, m] of padMetal(bench, p)) if (m.legs.some((l) => l.part === partId)) out.push(`${p.id}.${pad}`);
  }
  return out;
}

export { jointRecordAt };
