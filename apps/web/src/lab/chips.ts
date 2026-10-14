/**
 * Chips on the bench, the pure half: chip models and their pins (numbers, datasheet names and friendly aliases),
 * which bench or netlist part is a chip, how a chip sits on the board (`chipSeat`), logic levels, what the 555 map
 * and the chip x-ray draw for the pins a lesson has named, and where a gate chip's gates sit.
 *
 * It reads bench parts by their `params.model` and `holes` only, so it works whatever leg names the bench gives a
 * chip ("1" to "16", or the datasheet names), and netlist parts by their simulator kind (`timer555`, `logic`).
 */
import { boardGeometry, parseHole, partLegs, type BenchState, type PlacedPart } from "@ohmland/bench/core";
import { LOGIC_PINOUTS, TIMER555_PINS, type LogicModel, type Netlist, type NodeId, type PartSpec } from "@ohmland/sim";

export type ChipModel = "555" | "555-cmos" | LogicModel;

export type ChipInfo = {
  model: ChipModel;
  /** The simulator kind it runs as. */
  sim: "timer555" | "logic";
  /** Simulator pin names in pin-number order (pin 1 first). */
  pins: readonly string[];
  /** The supply pins' simulator names. */
  vcc: string;
  gnd: string;
};

const LOGIC_MODELS = Object.keys(LOGIC_PINOUTS) as LogicModel[];

/** A chip model's pins, or null for a model that is not a chip ("NE555" and "LM555" read as "555"). */
export function chipInfo(model: unknown): ChipInfo | null {
  if (typeof model !== "string") return null;
  const m = model.trim().toUpperCase();
  if (/^(NE|LM|SE)?555$/.test(m)) return { model: "555", sim: "timer555", pins: TIMER555_PINS, vcc: "vcc", gnd: "gnd" };
  if (/^(555-?CMOS|7555|TLC555|LMC555)$/.test(m)) return { model: "555-cmos", sim: "timer555", pins: TIMER555_PINS, vcc: "vcc", gnd: "gnd" };
  const logic = LOGIC_MODELS.find((x) => x.toUpperCase() === m || x.replace("74HC", "") === m || `CD${x}` === m);
  if (!logic) return null;
  const four = logic === "4026B";
  return { model: logic, sim: "logic", pins: LOGIC_PINOUTS[logic], vcc: four ? "vdd" : "vcc", gnd: four ? "vss" : "gnd" };
}

/** The chip model of a netlist part (a 555 or a logic chip), or null. */
export function specChip(spec: PartSpec | undefined): ChipInfo | null {
  if (!spec) return null;
  if (spec.kind === "timer555") return chipInfo(spec.cmos ? "555-cmos" : "555");
  if (spec.kind === "logic") return chipInfo(spec.model);
  return null;
}

/** The chip model of a bench part (its `params.model`), or null. */
export function partChip(part: Pick<PlacedPart, "params"> | undefined): ChipInfo | null {
  return part ? chipInfo((part.params as { model?: unknown } | undefined)?.model) : null;
}

const ALIASES_555: Record<string, number> = {
  gnd: 1, ground: 1, minus: 1, "-": 1, "−": 1,
  trig: 2, trigger: 2,
  out: 3, output: 3,
  reset: 4, rst: 4,
  ctrl: 5, control: 5, cv: 5,
  thresh: 6, threshold: 6, thr: 6,
  dis: 7, discharge: 7, drain: 7,
  vcc: 8, plus: 8, supply: 8, "+": 8,
};

/** A pin's number from a number, "6", a datasheet name ("thresh", "1A", "QA", "CO") or a friendly name ("threshold"). */
export function pinNumber(info: ChipInfo, ref: number | string): number | null {
  if (typeof ref === "number") return Number.isInteger(ref) && ref >= 1 && ref <= info.pins.length ? ref : null;
  const s = ref.trim().toLowerCase();
  if (/^\d+$/.test(s)) return pinNumber(info, Number(s));
  if (info.sim === "timer555") return ALIASES_555[s] ?? null;
  const direct = info.pins.indexOf(s);
  if (direct >= 0) return direct + 1;
  // Datasheet style: "1A" -> a1, "2QB" -> qb2, "1CLK" -> clk1.
  const ds = /^(\d)([a-z]+)$/.exec(s);
  if (ds) {
    const k = info.pins.indexOf(`${ds[2]}${ds[1]}`);
    if (k >= 0) return k + 1;
  }
  if (s === "plus" || s === "+" || s === "vdd" || s === "vcc") return info.pins.indexOf(info.vcc) + 1;
  if (s === "minus" || s === "-" || s === "−" || s === "vss" || s === "gnd") return info.pins.indexOf(info.gnd) + 1;
  return null;
}

/** A short datasheet label for a pin: "1A", "1Y", "QA", "CLK", "VCC" (logic chips), or the 555's names. */
export function pinCode(info: ChipInfo, n: number): string {
  const name = info.pins[n - 1] ?? "";
  if (info.sim === "timer555") return name.toUpperCase();
  const m = /^([a-z]+)(\d)$/.exec(name);
  if (m && info.model !== "4026B") return `${m[2]}${m[1]!.toUpperCase()}`;
  return name.toUpperCase();
}

/** The leads a bench part has, without failing on a kind the bench does not know yet. */
function legsOf(part: PlacedPart): readonly string[] {
  try {
    const legs = partLegs(part);
    if (legs?.length) return legs;
  } catch {
    // A kind this bench build does not know: fall back to the holes it sits in.
  }
  return Object.keys(part.holes ?? {});
}

/** The bench lead name for pin `n` of a chip part: "6", the datasheet name, or the n-th lead. */
export function chipLeg(part: PlacedPart, info: ChipInfo, n: number): string {
  const legs = legsOf(part);
  if (legs.includes(String(n))) return String(n);
  const sim = info.pins[n - 1];
  if (sim && legs.includes(sim)) return sim;
  if (legs.length === info.pins.length) return legs[n - 1]!;
  return String(n);
}

/** The pin number a bench lead name stands for. */
export function legPin(info: ChipInfo, leg: string): number | null {
  return pinNumber(info, leg);
}

export type ChipRef = { id: string; info: ChipInfo; n: number };

/**
 * "U1.6", "U1.trig", "DM1.CO": a chip pin, when the part before the dot is a chip on the bench or in the netlist and
 * the rest names one of its pins. Null for anything else (so ordinary attach points pass through untouched).
 */
export function chipPinRef(s: string, bench: BenchState | null, netlist: Netlist | null): ChipRef | null {
  const t = s.trim().replace(/^pin:/, "");
  const dot = t.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = t.slice(0, dot);
  const info = partChip(bench?.parts.find((p) => p.id === id)) ?? specChip(netlist?.parts.find((p) => p.id === id));
  if (!info) return null;
  const n = pinNumber(info, t.slice(dot + 1));
  return n === null ? null : { id, info, n };
}

/** The netlist node of a chip's pin n, or null when the pin is left out (floating) or the chip is not there. */
export function chipPinNode(netlist: Netlist | null, id: string, n: number): NodeId | null {
  const spec = netlist?.parts.find((p) => p.id === id);
  const info = specChip(spec);
  if (!spec || !info) return null;
  const name = info.pins[n - 1];
  const node = name ? (spec.pins as Record<string, NodeId | undefined>)[name] : undefined;
  return node ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Seating

export type ChipSeat = {
  /** Every pin sits in a hole. */
  seated: boolean;
  /** Seated across the channel: one row of pins each side, every pin on its own strip. */
  straddles: boolean;
  /** Where the notch (pin 1's end) points: pin 1 at the lower column ("left") or the higher one ("right"). */
  pin1: "left" | "right" | null;
  /** Notch to the right: the chip turned round from the usual way (notch left). */
  turned: boolean;
  /** The lowest and highest columns its pins use. */
  columns: [number, number] | null;
  /** Both rows of pins on the same side of the channel (pins facing each other share strips). */
  oneSide: boolean;
  /** Pairs of pins that share a strip (joined by the board). */
  shorted: [number, number][];
  /** Each pin's hole, by pin number. */
  holes: Record<number, string>;
};

/** How a chip sits on the board, or null when it is not a chip or not on the board at all. */
export function chipSeat(bench: BenchState, id: string): ChipSeat | null {
  const part = bench.parts.find((p) => p.id === id);
  const info = partChip(part);
  if (!part || !info || !bench.board) return null;
  const geom = boardGeometry(bench.board);
  const holes: Record<number, string> = {};
  for (const [leg, hole] of Object.entries(part.holes ?? {})) {
    if (!hole) continue;
    const n = legPin(info, leg) ?? (/^\d+$/.test(leg) ? Number(leg) : null);
    if (n !== null) holes[n] = hole;
  }
  const n = info.pins.length;
  const placed = Object.keys(holes).map(Number);
  if (!placed.length) return null;
  const seated = placed.length === n;
  const half = (hole: string): "near" | "far" | "rail" => {
    const p = parseHole(hole);
    if (!p) return "rail";
    if ("abcde".includes(p.row) && p.row.length === 1) return "near";
    if ("fghij".includes(p.row) && p.row.length === 1) return "far";
    return "rail";
  };
  const col = (k: number) => parseHole(holes[k] ?? "")?.col ?? NaN;
  const strip = (k: number) => geom.holes.get(holes[k] ?? "")?.strip ?? `?${k}`;
  const cols = placed.map(col).filter(Number.isFinite);
  const columns: [number, number] | null = cols.length ? [Math.min(...cols), Math.max(...cols)] : null;
  const shorted: [number, number][] = [];
  for (let a = 0; a < placed.length; a++)
    for (let b = a + 1; b < placed.length; b++) if (strip(placed[a]!) === strip(placed[b]!)) shorted.push([placed[a]!, placed[b]!].sort((x, y) => x - y) as [number, number]);
  const lower = Array.from({ length: n / 2 }, (_, k) => k + 1);
  const upper = Array.from({ length: n / 2 }, (_, k) => n / 2 + k + 1);
  const sideOf = (pins: number[]) => {
    const s = new Set(pins.map((k) => (holes[k] ? half(holes[k]!) : "rail")));
    return s.size === 1 ? [...s][0]! : null;
  };
  const sideA = seated ? sideOf(lower) : null;
  const sideB = seated ? sideOf(upper) : null;
  const straddles = seated && !!sideA && !!sideB && sideA !== "rail" && sideB !== "rail" && sideA !== sideB && shorted.length === 0;
  const oneSide = seated && !!sideA && sideA === sideB && sideA !== "rail";
  let pin1: "left" | "right" | null = null;
  if (holes[1] && holes[n / 2]) {
    const c1 = col(1);
    const cn = col(n / 2);
    if (c1 < cn) pin1 = "left";
    else if (c1 > cn) pin1 = "right";
  }
  return { seated, straddles, pin1, turned: pin1 === "right", columns, oneSide, shorted, holes };
}

// ---------------------------------------------------------------------------------------------------------------
// Logic levels

export type Level = "H" | "L" | "X" | "Z";

/** A logic level from a voltage and its supply: low below 30%, high above 70%, undefined between; Z when unpowered. */
export function levelOf(volts: number | undefined, supply: number | undefined): Level {
  if (volts === undefined || supply === undefined || !Number.isFinite(volts) || supply < 1) return "Z";
  if (volts < 0.3 * supply) return "L";
  if (volts > 0.7 * supply) return "H";
  return "X";
}

// ---------------------------------------------------------------------------------------------------------------
// The 555 map: the inside, block by block, as pins are named

/** The blocks the x-ray and the 555 map draw. */
export type Block555 = "rails" | "low" | "latch" | "output" | "high" | "drain" | "reset" | "ladder";

/** Which blocks each pin brings in (section 2.4 of the Unit 4 blueprint). */
const PIN_BLOCKS: Record<number, Block555[]> = {
  1: ["rails"],
  8: ["rails"],
  2: ["low", "latch"],
  3: ["output", "latch"],
  6: ["high", "latch"],
  7: ["drain"],
  4: ["reset", "latch"],
  5: ["ladder"],
};

/** The blocks to draw for the pins named so far. */
export function blocks555(pins: readonly number[]): Set<Block555> {
  const out = new Set<Block555>();
  for (const p of pins) for (const b of PIN_BLOCKS[p] ?? []) out.add(b);
  return out;
}

/** The inside switch is called the latch once pin 4 (reset) is named. */
export const latchNamed = (pins: readonly number[]): boolean => pins.includes(4);

/** Every pin named: the map is complete. */
export const mapComplete = (pins: readonly number[]): boolean => [1, 2, 3, 4, 5, 6, 7, 8].every((p) => pins.includes(p));

/** What the x-ray shows of a 555 at one moment (from its snapshot `extra` and its pins' node voltages). */
export type Live555 = {
  powered: boolean;
  /** Supply (pin 8 minus pin 1). */
  supply: number;
  /** Each pin's volts above pin 1, by pin number; missing for a pin left floating. */
  pins: Partial<Record<number, number>>;
  upper: number;
  lower: number;
  /** The watchers firing: pin 2 under the 1/3 line, pin 6 over the 2/3 line. */
  trigger: boolean;
  threshold: boolean;
  reset: boolean;
  latch: boolean;
  discharge: boolean;
  output: "high" | "low" | "off";
};

/** Reads a 555's live state, or null when the snapshot has no such chip. */
export function live555(netlist: Netlist | null, nodes: Record<string, number> | undefined, extra: Record<string, unknown> | undefined, id: string): Live555 | null {
  if (!extra || !nodes) return null;
  const node = (n: number) => chipPinNode(netlist, id, n);
  const at = (k: NodeId | null): number | undefined => (k === null ? undefined : k === "gnd" ? 0 : nodes[k]);
  const g = at(node(1)) ?? 0;
  const pins: Partial<Record<number, number>> = {};
  for (let n = 1; n <= 8; n++) {
    const v = at(node(n));
    if (v !== undefined) pins[n] = v - g;
  }
  const num = (k: string) => (typeof extra[k] === "number" ? (extra[k] as number) : 0);
  const out = extra["output"];
  return {
    powered: extra["powered"] === true,
    supply: num("supply"),
    pins,
    upper: num("upper"),
    lower: num("lower"),
    trigger: extra["trigger"] === true,
    threshold: extra["threshold"] === true,
    reset: extra["reset"] === true,
    latch: extra["latch"] === true,
    discharge: extra["discharge"] === true,
    output: out === "high" || out === "low" ? out : "off",
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Gate chips: which gate is which

export type GateKind = "and" | "or" | "nand" | "nor" | "xor" | "not";

export type Gate = { kind: GateKind; schmitt?: boolean; inputs: number[]; output: number; n: number };

const GATE_KIND: Partial<Record<LogicModel, GateKind>> = {
  "74HC00": "nand",
  "74HC02": "nor",
  "74HC04": "not",
  "74HC08": "and",
  "74HC14": "not",
  "74HC27": "nor",
  "74HC32": "or",
  "74HC86": "xor",
};

/** The gates of a gate chip with their pins (inputs in order), or [] for counters and flip-flops. */
export function gatesOf(info: ChipInfo): Gate[] {
  const kind = info.sim === "logic" ? GATE_KIND[info.model as LogicModel] : undefined;
  if (!kind) return [];
  const byGate = new Map<number, Gate>();
  info.pins.forEach((name, i) => {
    const m = /^([abcy])(\d)$/.exec(name);
    if (!m) return;
    const g = Number(m[2]);
    let gate = byGate.get(g);
    if (!gate) byGate.set(g, (gate = { kind, inputs: [], output: 0, n: g, ...(info.model === "74HC14" ? { schmitt: true } : {}) }));
    if (m[1] === "y") gate.output = i + 1;
    else gate.inputs.push(i + 1);
  });
  return [...byGate.values()].sort((a, b) => a.n - b.n);
}

/** The pins of a DIP outline seen from above, notch left: pin 1 bottom left, counting round anticlockwise. */
export function dipPosition(n: number, count: number): { side: "bottom" | "top"; slot: number } {
  const half = count / 2;
  return n <= half ? { side: "bottom", slot: n - 1 } : { side: "top", slot: count - n };
}
