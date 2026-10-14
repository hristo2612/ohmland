// The station engine: runs the iron, the joints under it, the heat creeping up leads and the heat-shrink beside the
// circuit simulator, on the same clock. Pure: (bench, station, dt) in, (bench, station, simulator inputs) out.
//
// What is physical and lasting goes in BenchState (where the iron rests, a joint once it has set, a tube's shrink),
// so both views, undo and the netlist see it. What changes thirty times a second lives here (temperatures, molten
// solder, the feed held right now).

import type { InputKey } from "@ohmland/sim";
import type { BenchState, PlacedPart, PlacedPartOf, Vec2 } from "../types";
import { ALLOYS, FEED_RATE, type Alloy } from "./alloys";
import { IRON, feedTip, freshIron, stepIron, takeBead, tinFactor, wipeTip, type IronState, type TipLoad } from "./iron";
import { WORK, jointLook, meltOf, newJoint, stepJoint, tugResult, verdictOf, type Joint, type JointLook, type TugResult, type Verdict } from "./joint";
import { AMBIENT_C, BODIES, LeadHeat, type BodySpec, type HeatClip, type HeatSource } from "./leadheat";
import { GEOM } from "./parts";
import { padMetal, padNeighbours, parsePerfHole, perfMount, type JointRecord } from "./perfboard";
import { freshTube, gunAirC, stepTube, type TubeState } from "./shrink";
import { clipPose, jointRecordAt, leadLine, local, spotById, tubePose, writeJointRecord, type Spot } from "./spots";
import { partPose } from "../layout";

export type SimInput = { id: string; key: InputKey; value: number };

export type StationState = {
  /** Station time (s). */
  t: number;
  iron: IronState;
  /** Live joints by spot: heated, molten or still cooling. */
  joints: Record<string, Joint>;
  /** Heat creeping up leads, by part id. */
  heat: Record<string, LeadHeat>;
  /** Temperatures for the heat view and the lab: "tip", "joint:PB1.B4", "die:D1", "lead:D1.anode@6", "clip:HS1", "tube:T1". */
  temps: Record<string, number>;
  /** Solder held to a spot or to the tip ("tip") right now. */
  feed: string | null;
  /** Quick mode is on (press and hold a joint to solder it). */
  quickMode: boolean;
  /** The joint held in quick mode right now. */
  quick: string | null;
  /** Desoldering braid laid on a spot. */
  braid: string | null;
  /** The last tug or wiggle at each spot. */
  tugs: Record<string, TugResult>;
  /** Spots tugged since the last step (a tug while setting disturbs the joint). */
  moving: string[];
  /** Spots looked at under the magnifier, in order. */
  viewed: string[];
  heatView: boolean;
  /** The iron is in the learner's hand (being dragged): the views hide the drawn one. */
  held: boolean;
  /** Seconds the tip has lain on the desk, and the scorch marks it left. */
  deskTime: number;
  scorch: { x: number; z: number; amount: number }[];
  tubes: Record<string, TubeState>;
  /** Spools that melted on the tip, with the tip temperature when each first did (MP2). */
  melted: Record<string, number>;
  /** Solder on the tip melted for the first time on each spool, or was fed where nothing melted. */
  coldTouches: string[];
  /** Outside heat last sent to the simulator, by part id. */
  sent: Record<string, number>;
};

export function createStation(bench: BenchState): StationState {
  const st = stationOf(bench);
  const iron = freshIron(st?.params.tinning ?? "tinned", st?.params.on ? st.params.setC : AMBIENT_C);
  return {
    t: 0,
    iron,
    joints: {},
    heat: {},
    temps: { tip: iron.tipC },
    feed: null,
    quickMode: false,
    quick: null,
    braid: null,
    tugs: {},
    moving: [],
    viewed: [],
    heatView: false,
    held: false,
    deskTime: 0,
    scorch: [],
    tubes: {},
    melted: {},
    coldTouches: [],
    sent: {},
  };
}

export function stationOf(bench: BenchState): PlacedPartOf<"solder-station"> | null {
  return (bench.parts.find((p) => p.kind === "solder-station") as PlacedPartOf<"solder-station"> | undefined) ?? null;
}

/** The spool in use: the station's pick, else the first on the bench. */
export function spoolOf(bench: BenchState): PlacedPartOf<"solder-spool"> | null {
  const st = stationOf(bench);
  const picked = st?.params.spool ? bench.parts.find((p) => p.id === st.params.spool && p.kind === "solder-spool") : undefined;
  return ((picked ?? bench.parts.find((p) => p.kind === "solder-spool")) as PlacedPartOf<"solder-spool"> | undefined) ?? null;
}

const replacePart = (bench: BenchState, part: PlacedPart): BenchState => ({ ...bench, parts: bench.parts.map((p) => (p.id === part.id ? part : p)) });

function setStation(bench: BenchState, params: Partial<PlacedPartOf<"solder-station">["params"]>): BenchState {
  const st = stationOf(bench);
  return st ? replacePart(bench, { ...st, params: { ...st.params, ...params } } as PlacedPart) : bench;
}

/** A joint as live state, from its record (or new). */
function liveJoint(bench: BenchState, st: StationState, spot: Spot): Joint {
  const live = st.joints[spot.id];
  if (live) return live;
  const rec = jointRecordAt(bench, spot.id);
  const kind = spot.work ?? "pad";
  if (!rec) return newJoint(kind);
  return { ...newJoint(kind), ...rec, kind, tempC: AMBIENT_C, phase: rec.verdict ? "set" : "bare" };
}

/** The record the bench keeps of a joint. */
export function jointRecord(j: Joint): JointRecord {
  return {
    kind: j.kind,
    alloy: j.alloy,
    volume: Math.round(j.volume * 1000) / 1000,
    wetted: Math.round(j.wetted * 1000) / 1000,
    peakC: Math.round(j.peakC * 10) / 10,
    moved: j.moved,
    fedAt: j.fedAt,
    bridgeTo: j.bridgeTo,
    lifted: j.lifted,
    coldTouch: j.coldTouch,
    flux: Math.round(j.flux * 1000) / 1000,
    verdict: j.verdict,
  };
}

const sameRecord = (a: JointRecord | null, b: JointRecord) => !!a && JSON.stringify(a) === JSON.stringify(b);

/** Pads next to a pad, busiest first (solder runs to the pad that has metal on it). */
function neighboursOf(bench: BenchState, spot: Spot): string[] {
  if (spot.kind !== "pad" || !spot.pad) return [];
  const board = bench.parts.find((p) => p.id === spot.host) as PlacedPartOf<"perfboard"> | undefined;
  if (!board) return [];
  const metal = padMetal(bench, board);
  const joints = board.params.joints ?? {};
  return padNeighbours(board.params, spot.pad).sort((a, b) => Number(!!joints[b] || metal.has(b)) - Number(!!joints[a] || metal.has(a)));
}

/** Body numbers for a part whose leads can carry heat in. */
function bodyFor(part: PlacedPart): BodySpec | null {
  switch (part.kind) {
    case "led":
      return (part.params.size ?? 5) === 3 ? BODIES.led3 : BODIES.led5;
    case "npn":
    case "phototransistor":
      return BODIES.npn;
    case "diode":
      return BODIES.diode;
    case "electrolytic-cap":
    case "ceramic-cap":
      return BODIES.cap;
    default:
      return null;
  }
}

/** Heat sources on a part's leads: the iron on a lead, and hot joints where its legs go through pads. */
function heatSources(bench: BenchState, st: StationState, part: PlacedPart, ironSpot: Spot | null): HeatSource[] {
  const out: HeatSource[] = [];
  const tin = tinFactor(st.iron.tinning);
  if (ironSpot?.kind === "lead" && ironSpot.host === part.id && ironSpot.leg) {
    out.push({ lead: ironSpot.leg, mm: ironSpot.mm ?? 12, tempC: st.iron.tipC, g: 0.02 * tin });
  }
  const board = perfMount(bench, part);
  if (board) {
    for (const [leg, h] of Object.entries(part.holes ?? {})) {
      const q = parsePerfHole(h);
      const j = q ? st.joints[`${board.id}.${q.pad}`] : undefined;
      if (!j || j.tempC < AMBIENT_C + 2) continue;
      // The pad's heat enters the leg where it goes through the hole, at the far end of the lead's network.
      out.push({ lead: leg, mm: boardLeadMm(bench, part, leg), tempC: j.tempC, g: 0.01 });
    }
  }
  return out;
}

function clipsOn(bench: BenchState, partId: string): HeatClip[] {
  const out: HeatClip[] = [];
  for (const p of bench.parts) {
    if (p.kind !== "heat-sink-clip" || !p.params.on) continue;
    const c = clipPose(bench, p);
    if (c && c.part === partId) out.push({ id: p.id, lead: c.leg, mm: c.mm, metal: p.params.metal });
  }
  return out;
}

/**
 * Lead lengths for a part's heat network: to the pad for a part standing in a board, else the whole lead as bought
 * (about 20 mm past the body; the drawing shows less of it).
 */
function leadDefs(bench: BenchState, part: PlacedPart): { name: string; mm: number }[] {
  const pose = partPose(bench, part);
  return Object.keys(pose.legs).map((leg) => {
    const len = leadLine(bench, part, leg)?.len ?? 12;
    return { name: leg, mm: pose.mount === "board" ? boardLeadMm(bench, part, leg) : Math.max(2, Math.round(Math.max(20, len))) };
  });
}

/**
 * Lead from the body to the pad for a part standing in a board: the standoff, the board's thickness and the bit
 * under the pad (about 6 mm at least), so a 3 s joint warms an LED and only a joint held far too long cooks it.
 */
function boardLeadMm(bench: BenchState, part: PlacedPart, leg: string): number {
  return Math.max(6, Math.round((leadLine(bench, part, leg)?.len ?? 3) + 3));
}

/** Where a tube is (desk mm): on its wire, or where it lies. */
function tubeAt(bench: BenchState, tube: PlacedPartOf<"heat-shrink">): Vec2 {
  const p = tubePose(bench, tube);
  return p ? [p.origin[0], p.origin[2]] : tube.pos;
}

/** The heat gun's nozzle on the desk. */
export function gunNozzle(gun: PlacedPart): Vec2 {
  const p = local(gun, GEOM.gun.nozzle[0], 0, GEOM.gun.nozzle[1]);
  return [p[0], p[2]];
}

const SUB = 0.05;

export type StationStep = { station: StationState; bench: BenchState; inputs: SimInput[] };

/** Advance the station `dt` seconds. */
export function stepStation(bench0: BenchState, st0: StationState, dt: number): StationStep {
  let bench = bench0;
  const st: StationState = { ...st0, joints: { ...st0.joints }, temps: {}, tugs: { ...st0.tugs }, tubes: { ...st0.tubes }, melted: { ...st0.melted }, sent: { ...st0.sent }, scorch: st0.scorch };
  const station = stationOf(bench);
  const on = !!station?.params.on;
  const setC = station?.params.setC ?? 330;
  const where = station?.params.iron ?? "stand";
  const ironSpot = !st.held && where !== "stand" && where !== "desk" ? spotById(bench, where) : null;
  const spool = spoolOf(bench);
  const alloy: Alloy = spool?.params.alloy ?? "lead-free";
  const moving = new Set(st.moving);
  st.moving = [];
  const steps = Math.max(1, Math.ceil(dt / SUB));
  const h = dt / steps;
  const spotCache = new Map<string, Spot | null>();
  const spotOf = (id: string) => {
    if (!spotCache.has(id)) spotCache.set(id, spotById(bench, id));
    return spotCache.get(id)!;
  };

  for (let k = 0; k < steps; k++) {
    const loads: TipLoad[] = [];
    // Which joints change this step: the one under the iron, the one being fed, and every live one cooling.
    const ids = new Set(Object.keys(st.joints));
    if (ironSpot?.work) ids.add(ironSpot.id);
    if (st.feed && st.feed !== "tip") ids.add(st.feed);
    for (const id of ids) {
      const spot = spotOf(id);
      if (!spot?.work) {
        delete st.joints[id];
        continue;
      }
      const j = liveJoint(bench, st, spot);
      const under = ironSpot?.id === id;
      const quickFeed = st.quick === id && under && (j.tempC >= meltOf(j, alloy) || (j.volume > 0.05 && st.iron.tipC >= meltOf(j, alloy)));
      const fed = st.feed === id || quickFeed;
      const r = stepJoint(j, h, {
        tipC: under ? st.iron.tipC : null,
        tin: tinFactor(st.iron.tinning),
        feed: fed ? FEED_RATE * h : 0,
        alloy,
        braid: st.braid === id,
        neighbours: neighboursOf(bench, spot),
        moved: moving.has(id),
      });
      moving.delete(id);
      st.joints[id] = r.joint;
      if (under) loads.push({ g: r.contact, tempC: r.joint.tempC });
      if (r.wicked > 0) {
        const braid = bench.parts.find((p) => p.kind === "solder-braid") as PlacedPartOf<"solder-braid"> | undefined;
        if (braid) bench = replacePart(bench, { ...braid, params: { ...braid.params, used: Math.min(1, (braid.params.used ?? 0) + r.wicked / 12) } });
      }
      if (fed && r.joint.coldTouch && !st.coldTouches.includes(id)) st.coldTouches = [...st.coldTouches, id];
    }
    // Solder held to the tip in the air (or the tip resting somewhere that is not a joint).
    if (st.feed === "tip" && spool) {
      const before = st.iron.bead;
      st.iron = feedTip(st.iron, FEED_RATE * h, alloy);
      if (st.iron.bead > before && st.melted[spool.id] === undefined) st.melted[spool.id] = Math.round(st.iron.tipC);
    }
    // Everything else the tip can touch.
    if (!st.held) {
      if (where === "desk") loads.push({ g: 0.004, tempC: AMBIENT_C + 20 });
      else if (ironSpot?.kind === "sponge") loads.push({ g: 0.12, tempC: 40 });
      else if (ironSpot?.kind === "wool") loads.push({ g: 0.01, tempC: AMBIENT_C });
      else if (ironSpot?.kind === "lead" && ironSpot.leg) {
        const net = st.heat[ironSpot.host];
        loads.push({ g: 0.02 * tinFactor(st.iron.tinning), tempC: net ? net.tempAt(ironSpot.leg, ironSpot.mm ?? 12) : AMBIENT_C });
      }
    }
    st.iron = stepIron(st.iron, h, on, setC, loads);

    // Heat up the leads of parts the iron or a hot joint touches.
    for (const part of bench.parts) {
      const body = bodyFor(part);
      if (!body) continue;
      const sources = heatSources(bench, st, part, ironSpot);
      let net = st.heat[part.id];
      if (!net && !sources.length) continue;
      if (!net) {
        net = new LeadHeat(body, leadDefs(bench, part));
        st.heat[part.id] = net;
      }
      net.step(h, sources, clipsOn(bench, part.id));
    }

    // Heat-shrink in front of the gun.
    const guns = bench.parts.filter((p) => p.kind === "heat-gun" && p.params.on);
    for (const tube of bench.parts) {
      if (tube.kind !== "heat-shrink") continue;
      const at = tubeAt(bench, tube);
      let air = AMBIENT_C;
      for (const g of guns) {
        const n = gunNozzle(g);
        air = Math.max(air, gunAirC(Math.hypot(at[0] - n[0], at[1] - n[1])));
      }
      const cur = st.tubes[tube.id] ?? { ...freshTube(), shrink: tube.params.shrink ?? 0, split: !!tube.params.split };
      if (air <= AMBIENT_C + 0.5 && cur.tempC <= AMBIENT_C + 0.5) continue;
      st.tubes[tube.id] = stepTube(cur, h, air);
    }
  }
  // Tugs on joints that are not live any more have nothing left to disturb.
  st.moving = [...moving].filter((id) => !!st.joints[id]);

  // The tip on the desk paper scorches it after a couple of seconds, then the iron slides home.
  if (!st.held && where === "desk" && station) {
    st.deskTime += dt;
    const at = station.params.ironAt ?? [station.pos[0] - 60, station.pos[1] + 40];
    if (st.deskTime > 2 && st.iron.tipC > 250) {
      const amount = Math.min(1, (st.deskTime - 2) / 2);
      const rest = st.scorch.filter((s) => Math.hypot(s.x - at[0], s.z - at[1]) > 3);
      const prev = st.scorch.find((s) => Math.hypot(s.x - at[0], s.z - at[1]) <= 3);
      st.scorch = [...rest, { x: at[0], z: at[1], amount: Math.max(prev?.amount ?? 0, amount) }];
    }
    if (st.deskTime > 4) bench = setStation(bench, { iron: "stand" });
  } else st.deskTime = 0;

  // Joints that have set go into the bench; cold ones leave the live set.
  for (const [id, j] of Object.entries(st.joints)) {
    const spot = spotOf(id);
    if (!spot) continue;
    if (j.phase === "set" || (j.phase === "bare" && j.volume <= 0.05 && jointRecordAt(bench, id))) {
      const rec = j.phase === "bare" ? null : jointRecord(j);
      if (rec ? !sameRecord(jointRecordAt(bench, id), rec) : true) bench = writeJointRecord(bench, spot, rec);
    }
    if (j.phase !== "molten" && j.tempC < AMBIENT_C + 15 && ironSpot?.id !== id && st.feed !== id) delete st.joints[id];
  }
  // Tubes: shrink and splits go into the bench.
  for (const [id, t] of Object.entries(st.tubes)) {
    const tube = bench.parts.find((p) => p.id === id) as PlacedPartOf<"heat-shrink"> | undefined;
    if (!tube) {
      delete st.tubes[id];
      continue;
    }
    const shrink = Math.round(t.shrink * 100) / 100;
    if (Math.abs((tube.params.shrink ?? 0) - shrink) >= 0.05 || (t.split && !tube.params.split)) {
      bench = replacePart(bench, { ...tube, params: { ...tube.params, shrink, split: t.split } });
    }
    if (t.tempC < AMBIENT_C + 1) delete st.tubes[id];
  }

  // What the views and the lab read; what the simulator hears.
  const inputs: SimInput[] = [];
  st.temps.tip = st.iron.tipC;
  for (const [id, j] of Object.entries(st.joints)) st.temps[`joint:${id}`] = j.tempC;
  for (const [id, net] of Object.entries(st.heat)) {
    const part = bench.parts.find((p) => p.id === id);
    if (!part) {
      delete st.heat[id];
      continue;
    }
    const body = net.bodyC;
    st.temps[`die:${id}`] = body;
    for (const l of net.leads) for (const p of net.profile(l.name)) if (p.mm % 3 === 0) st.temps[`lead:${id}.${l.name}@${p.mm}`] = p.c;
    for (const [cid, c] of Object.entries(net.clipT)) st.temps[`clip:${cid}`] = c;
    const last = st.sent[id] ?? AMBIENT_C;
    if (Math.abs(body - last) >= 0.5 || (net.cold && last !== AMBIENT_C)) {
      const v = net.cold ? AMBIENT_C : Math.round(body * 10) / 10;
      inputs.push({ id, key: "bodyC", value: v });
      st.sent[id] = v;
    }
    if (net.cold && !heatSources(bench, st, part, ironSpot).length) delete st.heat[id];
  }
  for (const [id, t] of Object.entries(st.tubes)) st.temps[`tube:${id}`] = t.tempC;
  st.t = st0.t + dt;
  return { station: st, bench, inputs };
}

// ---------------------------------------------------------------------------------------------------------------
// What the learner does. Each returns the next bench and station.

export type StationAct = { bench: BenchState; station: StationState };

/**
 * Put the iron down: in its stand, on a spot (it rests there), or on the desk at a point (it scorches the paper,
 * then slides home). A bead carried on the tip goes onto the work it lands on.
 */
export function placeIron(bench: BenchState, st: StationState, to: string, deskAt?: Vec2): StationAct {
  const station = stationOf(bench);
  if (!station) return { bench, station: st };
  let next: StationState = { ...st, held: false };
  if (to === "desk") return { bench: setStation(bench, { iron: "desk", ironAt: deskAt ?? station.params.ironAt ?? [station.pos[0] - 60, station.pos[1] + 40] }), station: { ...next, deskTime: 0 } };
  if (to === "stand" || to === `${station.id}.stand`) return { bench: setStation(bench, { iron: "stand" }), station: next };
  const spot = spotById(bench, to);
  if (!spot) return { bench: setStation(bench, { iron: "stand" }), station: next };
  if (spot.kind === "stand") return { bench: setStation(bench, { iron: "stand" }), station: next };
  if (spot.kind === "wool" || spot.kind === "sponge") next = { ...next, iron: wipeTip(next.iron) };
  if (spot.work && next.iron.bead > 0) {
    const taken = takeBead(next.iron);
    const j = liveJoint(bench, next, spot);
    const landed = stepJoint(j, 1e-4, { tipC: null, bead: { mm3: taken.mm3, flux: taken.flux, alloy: taken.alloy } }).joint;
    next = { ...next, iron: taken.iron, joints: { ...next.joints, [spot.id]: landed } };
  }
  return { bench: setStation(bench, { iron: spot.id }), station: next };
}

/** Pick the iron up (it follows the learner's hand until placed). */
export function holdIron(st: StationState): StationState {
  return { ...st, held: true };
}

/** Hold the solder to a spot, to the tip ("tip"), or take it away (null). */
export function feedAt(st: StationState, target: string | null): StationState {
  return { ...st, feed: target };
}

/** Wipe the tip in the brass wool. */
export function wipe(st: StationState): StationState {
  return { ...st, iron: wipeTip(st.iron) };
}

/** Quick mode: press on a joint (the iron rests there and feeds once hot), or release (both lift). */
export function quickPress(bench: BenchState, st: StationState, spot: string | null): StationAct {
  if (spot) {
    const placed = placeIron(bench, st, spot);
    return { bench: placed.bench, station: { ...placed.station, quick: spot } };
  }
  if (!st.quick) return { bench, station: st };
  const lifted = placeIron(bench, { ...st, quick: null, feed: null }, "stand");
  return lifted;
}

/** Lay the braid on a joint (or take it off). */
export function layBraid(st: StationState, spot: string | null): StationState {
  return { ...st, braid: spot };
}

/** Tug or wiggle the leg or wire at a joint: moves it if it is setting; tells how it holds. */
export function tug(bench: BenchState, st: StationState, spot: string): { station: StationState; result: TugResult } {
  const live = st.joints[spot];
  const rec = jointRecordAt(bench, spot);
  const j = live ?? (rec ? { ...newJoint(rec.kind), ...rec, phase: rec.verdict ? ("set" as const) : ("bare" as const) } : null);
  const result: TugResult = j ? tugResult(j) : "pulled";
  const moving = live && (live.phase === "molten" || live.setting > 0) ? [...st.moving, spot] : st.moving;
  return { station: { ...st, moving, tugs: { ...st.tugs, [spot]: result } }, result };
}

/** Look at a joint under the magnifier. */
export function magnify(st: StationState, spot: string): StationState {
  return st.viewed.includes(spot) ? st : { ...st, viewed: [...st.viewed, spot] };
}

// ---------------------------------------------------------------------------------------------------------------
// Reading a joint, live or from the bench.

export type JointReading = {
  phase: "bare" | "molten" | "set";
  verdict: Verdict | null;
  look: JointLook;
  tempC: number;
  wetted: number;
  volume: number;
  peakC: number;
  fedAt: "work" | "tip" | null;
  moved: boolean;
  bridgeTo: string | null;
  coldTouch: boolean;
};

export function readJoint(bench: BenchState, st: StationState | null, spot: string): JointReading | null {
  const live = st?.joints[spot];
  const rec = jointRecordAt(bench, spot);
  const j: Joint | null = live ?? (rec ? { ...newJoint(rec.kind), ...rec, phase: rec.verdict ? "set" : "bare" } : null);
  if (!j) return null;
  return {
    phase: j.phase,
    verdict: verdictOf(j),
    look: jointLook(j),
    tempC: j.tempC,
    wetted: j.wetted,
    volume: j.volume / WORK[j.kind].ideal,
    peakC: j.peakC,
    fedAt: j.fedAt,
    moved: j.moved,
    bridgeTo: j.bridgeTo,
    coldTouch: j.coldTouch,
  };
}

/** The melting point of the spool in use. */
export function meltC(bench: BenchState): number {
  return ALLOYS[spoolOf(bench)?.params.alloy ?? "lead-free"].liquidus;
}

export { IRON };
