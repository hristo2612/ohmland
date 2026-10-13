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
      ohms: number;
      watts?: number;
      tolerance?: number; // fraction such as 0.05; actual value = ohms x (1 + spread seeded by id). Default 0
    })
  | (Base & { kind: "battery"; pins: { pos: NodeId; neg: NodeId }; emf: number; internalOhms: number; mAh?: number })
  | (Base & { kind: "led"; pins: { anode: NodeId; cathode: NodeId }; color: LedColor; maxmA?: number })
  | (Base & { kind: "switch"; pins: { a: NodeId; b: NodeId }; closed: boolean })
  | (Base & {
      kind: "pushbutton";
      pins: { a: NodeId; b: NodeId };
      pressed?: boolean;
      normallyClosed?: boolean; // default false: connects only while pressed. true: connected until pressed
    })
  | (Base & { kind: "spdt"; pins: { com: NodeId; a: NodeId; b: NodeId }; to: "a" | "b" })
  // Two SPDT contact sets moved by one actuator (input "to"): com1 joins a1 or b1, com2 joins a2 or b2.
  | (Base & { kind: "dpdt"; pins: { com1: NodeId; a1: NodeId; b1: NodeId; com2: NodeId; a2: NodeId; b2: NodeId }; to: "a" | "b" })
  | (Base & { kind: "fuse"; pins: { a: NodeId; b: NodeId }; amps: number })
  | (Base & {
      kind: "capacitor";
      pins: { pos: NodeId; neg: NodeId };
      farads: number;
      volts?: number;
      polarized?: boolean;
      leakOhms?: number; // parallel leakage resistance; default none (polarized: 5 MΩ)
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
  | (Base & { kind: "speaker"; pins: { a: NodeId; b: NodeId }; ohms: number; henries?: number; watts?: number })
  | (Base & {
      kind: "multimeter";
      pins: { com: NodeId; vohm: NodeId; ma: NodeId; a10: NodeId };
      mode: MeterMode;
      range?: string; // "auto" or a manual range label such as "20V", "200mA", "2k"
    })
  | (Base & { kind: "probe-resistance"; pins: { a: NodeId; b: NodeId }; ohms: number })
  | (Base & { kind: "cell"; pins: { pos: NodeId; neg: NodeId }; emf: number; internalOhms: number })
  | (Base & { kind: "wire"; pins: { a: NodeId; b: NodeId } });

export type PartKind = PartSpec["kind"];

export type Netlist = { parts: PartSpec[] };

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
  | "spark"; // opening contacts arced (an inductive kick above about 300 V across the gap)

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
  | "replace";

export type InputValue = number | string | boolean;
