// Heat that runs along a part's leads into its body (station engine SE3). Pure and deterministic.
//
// A lumped network: the body (an LED's die and epoxy, a transistor's case) is one node; each lead is a chain of
// 1 mm segments from the body out to its end. Every node has a heat capacity and loses a little heat to the air.
// Heat comes in where something hot touches a lead (the iron's tip, or a joint being soldered at the lead's pad),
// and a heat-sink clip on a lead is a lump of metal tied to that segment and to the air. Integrated with backward
// Euler, so any step is stable (a time-lapse cools a part correctly in one stride).
//
// Numbers: a lead is about 0.5 mm square tinned steel, a 3 mm LED body about 0.05 J/K. They are a model of a hobby
// bench, calibrated to the targets in docs/curriculum/unit-3.md section 7.8 together with the simulator's LED die
// model (ledHeatDim and ledHeatRate in @ohmland/sim).

export const AMBIENT_C = 25;
/** Segment length (mm). */
const SEG = 1;
/** Lead conduction per segment (W/K), heat capacity (J/K) and loss to air (W/K) for 1 mm of lead. */
const LEAD_G = 0.017;
const LEAD_C = 0.0009;
const LEAD_AIR = 3e-5;

export type HeatMetal = "copper" | "steel";

/** A heat-sink clip: its own heat capacity, how well it grips the lead and how well it sheds heat. */
export const CLIP_METAL: Record<HeatMetal, { c: number; grip: number; air: number }> = {
  copper: { c: 0.75, grip: 0.06, air: 0.013 },
  steel: { c: 0.18, grip: 0.0035, air: 0.0015 },
};

/** Body numbers by part: heat capacity (J/K) and loss to air (W/K, the body's surface plus whatever it stands on). */
export type BodySpec = { c: number; air: number };

export const BODIES = {
  led3: { c: 0.05, air: 0.0011 },
  led5: { c: 0.08, air: 0.0016 },
  npn: { c: 0.07, air: 0.0016 },
  diode: { c: 0.04, air: 0.0012 },
  cap: { c: 0.25, air: 0.003 },
} satisfies Record<string, BodySpec>;

export type LeadDef = { name: string; mm: number };

/** Something hot on a lead: the iron's tip or a joint, at `mm` from the body. `g` is the contact (W/K). */
export type HeatSource = { lead: string; mm: number; tempC: number; g: number };

/** A clip gripping a lead `mm` from the body. */
export type HeatClip = { id: string; lead: string; mm: number; metal: HeatMetal };

type Node = { c: number; air: number };

export class LeadHeat {
  readonly leads: LeadDef[];
  /** Temperatures: [0] the body, then each lead's segments from the body outward. */
  readonly t: Float64Array;
  private readonly nodes: Node[];
  private readonly first: Record<string, number> = {};
  private readonly count: Record<string, number> = {};
  /** Clip temperatures by clip id (a clip keeps its heat while it stays clipped). */
  readonly clipT: Record<string, number> = {};
  /** Heat flowing in from sources during the last step, W (what the iron loses into the lead). */
  inflow = 0;

  constructor(
    readonly body: BodySpec,
    leads: LeadDef[],
  ) {
    this.leads = leads.map((l) => ({ name: l.name, mm: Math.max(SEG, l.mm) }));
    this.nodes = [{ c: body.c, air: body.air }];
    for (const l of this.leads) {
      const n = Math.max(1, Math.round(l.mm / SEG));
      this.first[l.name] = this.nodes.length;
      this.count[l.name] = n;
      for (let k = 0; k < n; k++) this.nodes.push({ c: LEAD_C * SEG, air: LEAD_AIR * SEG });
    }
    this.t = new Float64Array(this.nodes.length).fill(AMBIENT_C);
  }

  /** Body temperature (°C). */
  get bodyC(): number {
    return this.t[0]!;
  }

  /** Index of the segment node nearest `mm` from the body on a lead (or -1 when the lead is unknown). */
  nodeAt(lead: string, mm: number): number {
    const f = this.first[lead];
    const n = this.count[lead];
    if (f === undefined || n === undefined) return -1;
    const k = Math.min(n - 1, Math.max(0, Math.round(mm / SEG) - 1));
    return f + k;
  }

  /** Temperature on a lead `mm` from the body. */
  tempAt(lead: string, mm: number): number {
    const i = this.nodeAt(lead, mm);
    return i < 0 ? AMBIENT_C : this.t[i]!;
  }

  /** Points along each lead and their temperatures, from the body out (for the heat view). */
  profile(lead: string): { mm: number; c: number }[] {
    const f = this.first[lead];
    const n = this.count[lead] ?? 0;
    const out: { mm: number; c: number }[] = [];
    for (let k = 0; k < n; k++) out.push({ mm: (k + 1) * SEG, c: this.t[(f ?? 0) + k]! });
    return out;
  }

  /** The hottest point anywhere (body, leads, clips). */
  get peakC(): number {
    let m = AMBIENT_C;
    for (const v of this.t) m = Math.max(m, v);
    for (const v of Object.values(this.clipT)) m = Math.max(m, v);
    return m;
  }

  /** True when everything is back within a degree of the room (the network can be dropped). */
  get cold(): boolean {
    return this.peakC < AMBIENT_C + 1;
  }

  /** Advance `dt` seconds with these sources and clips (backward Euler). */
  step(dt: number, sources: readonly HeatSource[], clips: readonly HeatClip[]): void {
    if (!(dt > 0)) return;
    const N = this.nodes.length;
    const C = clips.length;
    const M = N + C;
    const A = new Float64Array(M * M);
    const b = new Float64Array(M);
    const g = (i: number, j: number, v: number) => {
      A[i * M + i]! += v;
      A[j * M + j]! += v;
      A[i * M + j]! -= v;
      A[j * M + i]! -= v;
    };
    for (let i = 0; i < N; i++) {
      const nd = this.nodes[i]!;
      A[i * M + i]! += nd.c / dt + nd.air;
      b[i]! += (nd.c / dt) * this.t[i]! + nd.air * AMBIENT_C;
    }
    // Lead chains: the body to the first segment, then segment to segment.
    for (const l of this.leads) {
      const f = this.first[l.name]!;
      const n = this.count[l.name]!;
      g(0, f, LEAD_G / SEG);
      for (let k = 1; k < n; k++) g(f + k - 1, f + k, LEAD_G / SEG);
    }
    // Sources hold a point at their temperature through a contact conductance.
    const srcAt: { i: number; s: HeatSource }[] = [];
    for (const s of sources) {
      const i = this.nodeAt(s.lead, s.mm);
      if (i < 0 || !(s.g > 0)) continue;
      A[i * M + i]! += s.g;
      b[i]! += s.g * s.tempC;
      srcAt.push({ i, s });
    }
    // Clips: a lump of metal gripping one segment.
    clips.forEach((cl, k) => {
      const m = CLIP_METAL[cl.metal];
      const j = N + k;
      const i = this.nodeAt(cl.lead, cl.mm);
      const t0 = this.clipT[cl.id] ?? AMBIENT_C;
      A[j * M + j]! += m.c / dt + m.air;
      b[j]! += (m.c / dt) * t0 + m.air * AMBIENT_C;
      if (i >= 0) g(i, j, m.grip);
    });
    const x = solve(A, b, M);
    for (let i = 0; i < N; i++) this.t[i] = x[i]!;
    const keep: Record<string, number> = {};
    clips.forEach((cl, k) => (keep[cl.id] = x[N + k]!));
    for (const id of Object.keys(this.clipT)) if (!(id in keep)) delete this.clipT[id];
    Object.assign(this.clipT, keep);
    this.inflow = srcAt.reduce((sum, { i, s }) => sum + s.g * (s.tempC - this.t[i]!), 0);
  }
}

/** Dense Gaussian elimination with partial pivoting (the networks are a few dozen nodes). */
function solve(A: Float64Array, b: Float64Array, n: number): Float64Array {
  for (let c = 0; c < n; c++) {
    let p = c;
    let best = Math.abs(A[c * n + c]!);
    for (let r = c + 1; r < n; r++) {
      const v = Math.abs(A[r * n + c]!);
      if (v > best) {
        best = v;
        p = r;
      }
    }
    if (p !== c) {
      for (let k = 0; k < n; k++) {
        const t = A[c * n + k]!;
        A[c * n + k] = A[p * n + k]!;
        A[p * n + k] = t;
      }
      const t = b[c]!;
      b[c] = b[p]!;
      b[p] = t;
    }
    const d = A[c * n + c]!;
    if (Math.abs(d) < 1e-300) continue;
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c]! / d;
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r * n + k]! -= f * A[c * n + k]!;
      b[r]! -= f * b[c]!;
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]!;
    for (let k = r + 1; k < n; k++) s -= A[r * n + k]! * x[k]!;
    const d = A[r * n + r]!;
    x[r] = Math.abs(d) < 1e-300 ? AMBIENT_C : s / d;
  }
  return x;
}
