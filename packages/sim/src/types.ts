// Netlist and snapshot contract shared by the simulator, the workbench and the labs.
// See docs/ARCHITECTURE.md. Adding kinds or optional fields is fine; renaming is not.

export type NodeId = string; // "gnd" is the reference node

export type LedColor = "red" | "yellow" | "green" | "blue" | "white" | "orange";

export type MeterMode = "off" | "dcv" | "acv" | "dca-ma" | "dca-10a" | "ohm" | "continuity" | "diode";

type Base = { id: string };

export type PartSpec =
  | (Base & {
      kind: "resistor";
      pins: { a: NodeId; b: NodeId };
      ohms: number; // nominal value (what the colour bands say)
      watts?: number;
      // Fraction such as 0.05: the part's actual value is fixed by its id (and Netlist.seed) and lies within
      // 0.9 x tolerance of nominal, usually much closer. Default 0.05. Use 0 for an exact part.
      tolerance?: number;
      actualOhms?: number; // forces the actual value, for example a part that is out of tolerance on purpose
    })
  | (Base & { kind: "battery"; pins: { pos: NodeId; neg: NodeId }; emf: number; internalOhms: number; mAh?: number })
  | (Base & { kind: "led"; pins: { anode: NodeId; cathode: NodeId }; color: LedColor; maxmA?: number })
  | (Base & { kind: "switch"; pins: { a: NodeId; b: NodeId }; closed: boolean; bounce?: Bounce })
  | (Base & {
      kind: "pushbutton";
      pins: { a: NodeId; b: NodeId };
      pressed?: boolean;
      normallyClosed?: boolean; // default false: connects only while pressed. true: connected until pressed
      bounce?: Bounce;
    })
  | (Base & { kind: "spdt"; pins: { com: NodeId; a: NodeId; b: NodeId }; to: "a" | "b"; bounce?: Bounce })
  // Two SPDT contact sets moved by one actuator (input "to"): com1 joins a1 or b1, com2 joins a2 or b2.
  | (Base & {
      kind: "dpdt";
      pins: { com1: NodeId; a1: NodeId; b1: NodeId; com2: NodeId; a2: NodeId; b2: NodeId };
      to: "a" | "b";
      bounce?: Bounce;
    })
  | (Base & { kind: "fuse"; pins: { a: NodeId; b: NodeId }; amps: number })
  | (Base & {
      kind: "capacitor";
      pins: { pos: NodeId; neg: NodeId };
      farads: number;
      volts?: number;
      polarized?: boolean;
      leakOhms?: number; // parallel leakage resistance; default none (polarized: 1 MΩ)
      esrOhms?: number; // series resistance; default 0 (polarized: 0.1 Ω for 1000 µF up to 2 Ω for small ones)
      tolerance?: number; // like resistor.tolerance; default 0.2 for polarized parts, 0.1 otherwise
      actualFarads?: number; // forces the actual value
    })
  | (Base & { kind: "pot"; pins: { a: NodeId; wiper: NodeId; b: NodeId }; ohms: number; position: number })
  | (Base & {
      kind: "relay";
      // com2, no2, nc2: optional second contact set on the same armature (DPDT relay).
      pins: { coilA: NodeId; coilB: NodeId; com: NodeId; no: NodeId; nc: NodeId; com2?: NodeId; no2?: NodeId; nc2?: NodeId };
      coilOhms: number;
      pullIn: number;
      dropOut: number;
      coilHenries?: number; // default 0.1
      operateMs?: number; // default 5
      releaseMs?: number; // default 3
      tolerance?: number; // spread of each relay's actual pullIn and dropOut, seeded by id; default 0.05
    })
  | (Base & { kind: "npn"; pins: { c: NodeId; b: NodeId; e: NodeId }; model?: "2N3904" })
  | (Base & { kind: "phototransistor"; pins: { c: NodeId; e: NodeId }; light?: number })
  | (Base & { kind: "diode"; pins: { anode: NodeId; cathode: NodeId }; model?: "1N4001" | "1N4148" })
  | (Base & {
      kind: "speaker";
      pins: { a: NodeId; b: NodeId };
      ohms: number;
      henries?: number;
      watts?: number; // default 0.5; sustained power above it cooks the voice coil
      enclosure?: boolean; // sound: false (default) loses bass below about 300 Hz, true goes down to about 100 Hz
    })
  | (Base & {
      kind: "multimeter";
      pins: { com: NodeId; vohm: NodeId; ma: NodeId; a10: NodeId };
      mode: MeterMode;
      range?: string; // "auto" or a manual range label such as "20V", "200mA", "2k"
    })
  | (Base & { kind: "probe-resistance"; pins: { a: NodeId; b: NodeId }; ohms: number })
  | (Base & { kind: "cell"; pins: { pos: NodeId; neg: NodeId }; emf: number; internalOhms: number })
  // ohms > 0 makes a real (unmerged) resistance, for clip leads and test leads (about 0.1 to 0.15 Ω).
  | (Base & { kind: "wire"; pins: { a: NodeId; b: NodeId }; ohms?: number })
  // A coil: inductance in series with its winding resistance (default 1 Ω). watts: what the winding takes
  // continuously (default 1 W); far more cooks it open.
  | (Base & { kind: "inductor"; pins: { a: NodeId; b: NodeId }; henries: number; ohms?: number; watts?: number })
  // NE555 timer, pins in pin-number order 1 to 8. cmos: a 7555-style part (rail-to-rail output, tiny supply
  // current, weaker output, 2 to 18 V). Unconnected pins may be left out.
  | (Base & { kind: "timer555"; pins: Pins<Timer555Pin>; cmos?: boolean })
  // Logic chips (74HC and 4000B families). Pins by datasheet name; LOGIC_PINOUTS[model] lists them in pin-number
  // order. Unconnected pins may be left out (an unconnected input floats: it reads noise, not 0).
  | (Base & { kind: "logic"; model: "74HC00" | "74HC02" | "74HC08" | "74HC32" | "74HC86"; pins: Pins<Quad2Pin> })
  | (Base & { kind: "logic"; model: "74HC04" | "74HC14"; pins: Pins<Hex1Pin> })
  | (Base & { kind: "logic"; model: "74HC27"; pins: Pins<Triple3Pin> })
  | (Base & { kind: "logic"; model: "74HC74"; pins: Pins<DualDPin> })
  | (Base & { kind: "logic"; model: "74HC393"; pins: Pins<Dual393Pin> })
  | (Base & { kind: "logic"; model: "4026B"; pins: Pins<Counter4026Pin> })
  // 7-segment LED display: segments a to g and the decimal point, each an LED of the given colour, sharing a
  // common cathode or anode. com2 is the second common pin of real 10-pin displays (joined inside).
  | (Base & {
      kind: "sevenseg";
      pins: Pins<SevenSegPin>;
      common: "cathode" | "anode";
      color?: LedColor; // default red
      maxmA?: number; // per segment, default 25
    })
  // 7805 linear regulator (TO-220: in, gnd, out). heatsink: bolted to a heat sink (default false, free air).
  | (Base & { kind: "regulator7805"; pins: { in: NodeId; gnd: NodeId; out: NodeId }; heatsink?: boolean });

/**
 * Contact bounce for switches and pushbuttons: true chatters for 1 to 5 ms on every make and break (seeded by
 * id, the netlist seed and the press count, so each press differs but runs repeat), a number is the longest
 * chatter in milliseconds. Off by default.
 */
export type Bounce = boolean | number;

type Pins<K extends string> = Partial<Record<K, NodeId>>;

export type Timer555Pin = "gnd" | "trig" | "out" | "reset" | "ctrl" | "thresh" | "dis" | "vcc";
/** Quad 2-input gates (00, 02, 08, 32, 86): gate n has inputs an, bn and output yn. */
export type Quad2Pin = "a1" | "b1" | "y1" | "a2" | "b2" | "y2" | "a3" | "b3" | "y3" | "a4" | "b4" | "y4" | "vcc" | "gnd";
/** Hex inverters (04, 14): an in, yn out. */
export type Hex1Pin = "a1" | "y1" | "a2" | "y2" | "a3" | "y3" | "a4" | "y4" | "a5" | "y5" | "a6" | "y6" | "vcc" | "gnd";
/** Triple 3-input gates (27). */
export type Triple3Pin = "a1" | "b1" | "c1" | "y1" | "a2" | "b2" | "c2" | "y2" | "a3" | "b3" | "c3" | "y3" | "vcc" | "gnd";
/** Dual D flip-flop (74): clear and preset are active low, qn is the inverted output. */
export type DualDPin = "clr1" | "d1" | "clk1" | "pre1" | "q1" | "qn1" | "clr2" | "d2" | "clk2" | "pre2" | "q2" | "qn2" | "vcc" | "gnd";
/** Dual 4-bit binary ripple counter (393): falling-edge clocks, active-high level clears, qa is the lowest bit. */
export type Dual393Pin = "clk1" | "clr1" | "qa1" | "qb1" | "qc1" | "qd1" | "clk2" | "clr2" | "qa2" | "qb2" | "qc2" | "qd2" | "vcc" | "gnd";
/**
 * 4026B decade counter with 7-segment outputs: clk (rising edge), inh (clock inhibit, active high), dei and deo
 * (display enable in and out), co (carry out), segments a to g, ucs (ungated c segment), rst (active high).
 */
export type Counter4026Pin = "clk" | "inh" | "dei" | "deo" | "co" | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "ucs" | "rst" | "vdd" | "vss";
export type SevenSegPin = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "dp" | "com" | "com2";
export type LogicModel = Extract<PartSpec, { kind: "logic" }>["model"];

export type PartKind = PartSpec["kind"];

export type Netlist = {
  parts: PartSpec[];
  // Mixed into every per-part spread (tolerances, fuse ratings, relay thresholds, transistor gain), so a lab can
  // give each learner a different but repeatable bag of parts. Without it, spreads depend on part ids only.
  seed?: string;
};

export type Health = "ok" | "hot" | "smoking" | "dead";

export type PartState = {
  i: number; // amps through the part, first pin to second pin in its pins order
  v: number; // volts across the part, first pin minus second pin
  p: number; // watts dissipated
  temp: number; // degrees C
  health: Health;
  glow?: number; // LEDs: perceived brightness 0..1
  closed?: boolean; // switches, relays
  display?: string; // multimeter display text, e.g. "9.12", "OL", "-0.42"
  unit?: string; // multimeter annunciator, e.g. "V", "mA", "kΩ"
  extra?: Record<string, number | string | boolean>;
};

export type SimEventType =
  | "damaged"
  | "died"
  | "blown"
  | "clicked"
  | "shorted"
  | "reversed"
  | "smoke"
  | "meter-fuse"
  | "spark" // opening contacts arced (an inductive kick above about 300 V across the gap)
  | "warning"; // no damage yet, for example the meter's 10 A input running hot

export type SimEvent = { t: number; partId: string; type: SimEventType; message: string; data?: Record<string, number | string> };

export type Snapshot = {
  t: number; // simulated seconds
  nodes: Record<NodeId, number>; // volts
  parts: Record<string, PartState>;
  events: SimEvent[]; // since the previous snapshot
  lag?: number; // 0..1, how far the sim is behind real time
};

// "replaceFuse" (multimeter): fit a new internal mA fuse. "replace" (any part): swap in a fresh part with the same
// id, clearing damage, heat, charge history and blown state.
export type InputKey =
  | "pressed"
  | "closed"
  | "position"
  | "light"
  | "mode"
  | "range"
  | "to"
  | "ohms"
  | "replaceFuse"
  | "replace"
  | "bounce" // switches and pushbuttons: Bounce (true, false or the longest chatter in ms)
  | "proximity"; // timer555, logic: how close a hand is to the chip, 0..1 (floating inputs pick up more hum)

export type InputValue = number | string | boolean;
