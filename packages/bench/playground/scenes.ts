// Ready-made benches for the playground and the screenshot script.

import { defaultMeter, emptyBench, type BenchState, type TrayItem } from "../src/core";

/** A red LED with a 470 ohm resistor on the board, fed by a 9 V battery, with the meter across the LED. */
export function demoBench(): BenchState {
  const b = emptyBench({ kind: "bb830" });
  b.parts = [
    { id: "B1", kind: "battery", params: { snap: true }, pos: [-150, 26], rot: 0, holes: { pos: "bp3", neg: "bn3" } },
    { id: "R1", kind: "resistor", params: { ohms: 470 }, pos: [0, 0], rot: 0, holes: { a: "e10", b: "e14" } },
    { id: "D1", kind: "led", params: { color: "red" }, pos: [0, 0], rot: 0, holes: { anode: "d14", cathode: "d15" } },
    { id: "S1", kind: "pushbutton", params: {}, pos: [0, 0], rot: 0, holes: { a1: "e24", b1: "e26", a2: "f24", b2: "f26" } },
    { id: "C1", kind: "electrolytic-cap", params: { farads: 100e-6 }, pos: [0, 0], rot: 0, holes: { pos: "c30", neg: "c31" } },
    { id: "Q1", kind: "npn", params: {}, pos: [0, 0], rot: 0, holes: { e: "h34", b: "h35", c: "h36" } },
    { id: "K1", kind: "relay", params: {}, pos: [0, 0], rot: 0, holes: { coil1: "e44", com1: "e47", nc1: "e49", no1: "e51", coil2: "f44", com2: "f47", nc2: "f49", no2: "f51" } },
    { id: "RV1", kind: "trimmer", params: { ohms: 10000, position: 0.3 }, pos: [0, 0], rot: 0, holes: { a: "i38", wiper: "i39", b: "i40" } },
  ];
  b.wires = [
    { id: "W1", a: "bp10", b: "a10", color: "red" },
    { id: "W2", a: "a15", b: "bn15", color: "black" },
    { id: "W3", a: "bp22", b: "a24", color: "red" },
    { id: "W4", a: "j26", b: "tn27", color: "blue" },
    { id: "W5", a: "bn57", b: "tn57", color: "black" },
    { id: "W6", a: "bp58", b: "tp58", color: "red" },
  ];
  b.meter = defaultMeter([158, -6], -10);
  b.meter.mode = "dcv";
  b.meter.probes.red.tip = { to: "pin:D1.anode", pos: [40, 60] };
  b.meter.probes.black.tip = { to: "pin:D1.cathode", pos: [60, 70] };
  b.leads = [{ id: "TL1", color: "green", a: { to: "pin:C1.pos", pos: [0, 0] }, b: { to: null, pos: [70, 66] } }];
  return b;
}

/** Section-one style bench: no board, everything joined with crocodile leads. */
export function clipBench(): BenchState {
  const b = emptyBench(null);
  b.parts = [
    { id: "B1", kind: "battery", params: {}, pos: [-110, 0], rot: 0 },
    { id: "R1", kind: "resistor", params: { ohms: 1500 }, pos: [-10, 40], rot: 0 },
    { id: "D1", kind: "led", params: { color: "red" }, pos: [60, 30], rot: 0 },
    { id: "LC1", kind: "lemon", params: {}, pos: [-30, -70], rot: 0 },
    { id: "WC1", kind: "cup", params: { water: "salty" }, pos: [80, -80], rot: 0 },
    { id: "F1", kind: "fuse", params: { amps: 1 }, pos: [-40, 100], rot: 0 },
  ];
  b.leads = [
    { id: "TL1", color: "red", a: { to: "pin:B1.pos", pos: [0, 0] }, b: { to: "pin:R1.a", pos: [0, 0] } },
    { id: "TL2", color: "yellow", a: { to: "pin:R1.b", pos: [0, 0] }, b: { to: "pin:D1.anode", pos: [0, 0] } },
    { id: "TL3", color: "black", a: { to: "pin:D1.cathode", pos: [0, 0] }, b: { to: "pin:B1.neg", pos: [0, 0] } },
  ];
  b.meter = defaultMeter([200, 10], -12);
  b.meter.mode = "ohm";
  b.meter.probes.red.tip = { to: "pin:WC1.a", pos: [0, 0] };
  b.meter.probes.black.tip = { to: "pin:WC1.b", pos: [0, 0] };
  return b;
}

/** Every lab prop on one desk, for a look at the models (`?scene=props`). */
export function propsBench(): BenchState {
  const b = emptyBench(null);
  const p = (id: string, kind: BenchState["parts"][number]["kind"], params: Record<string, unknown>, pos: [number, number], rot = 0) =>
    ({ id, kind, params, pos, rot }) as BenchState["parts"][number];
  b.parts = [
    p("H1", "holder", { held: { r: "R1" } }, [-200, -90]),
    p("R1", "resistor", { ohms: 1500 }, [-200, -90]),
    p("H2", "holder", { held: { r: "R5" } }, [-200, -20]),
    p("R5", "resistor", { ohms: 15, watts: 5 }, [-200, -20]),
    p("R4", "resistor", { ohms: 15, watts: 1 }, [-200, 40]),
    p("T1", "station", { held: { cell: "B2" }, load: true }, [-80, -90]),
    p("B2", "battery", { emf: 9.4 }, [-80, -96]),
    p("X1", "battery", { size: "aa", chem: "alkaline" }, [-110, 10]),
    p("X2", "battery", { size: "aa", chem: "nimh" }, [-110, 50]),
    p("X3", "battery", { size: "coin" }, [-50, 30]),
    p("B3", "battery", { worn: true }, [-30, -20], 270),
    p("FC1", "fruit", { held: { left: "E1", right: "E2" } }, [40, -90]),
    p("E1", "electrode", { metal: "copper" }, [29, -90]),
    p("E2", "electrode", { metal: "zinc" }, [51, -90]),
    p("E3", "electrode", { metal: "copper" }, [20, 0]),
    p("E4", "electrode", { metal: "zinc" }, [50, 10]),
    p("P1", "skin", { moisture: "wet", pressure: "light" }, [150, -90]),
    p("P2", "sample", { material: "copper" }, [150, 10]),
    p("P3", "sample", { material: "plastic" }, [150, 50]),
    p("P4", "card", { length: 5, layers: 2, wide: false }, [20, 80]),
    p("L1", "tag", { text: "470 Ω" }, [-40, 90]),
    p("BIN1", "bin", { held: { s1: "R2" } }, [-140, 120]),
    p("R2", "resistor", { ohms: 2200 }, [-164, 120]),
    p("CH1", "chart", {}, [260, -80]),
    p("CK1", "clock", {}, [260, 20]),
    p("SC1", "showcase", {}, [270, 110]),
  ];
  return b;
}

/** Unit 2 desk modules and board odds and ends (`?scene=blocks`). */
export function blocksBench(): BenchState {
  const b = emptyBench({ kind: "bb400", pos: [0, 70] });
  const p = (id: string, kind: BenchState["parts"][number]["kind"], params: Record<string, unknown>, pos: [number, number], rot = 0, holes?: Record<string, string>) =>
    ({ id, kind, params, pos, rot, ...(holes ? { holes } : {}) }) as BenchState["parts"][number];
  b.parts = [
    p("K1", "relay", { base: true, tag: "K1" }, [-120, -40]),
    p("K2", "relay", { base: true, poles: 1, mystery: "31402", tag: "K2" }, [-30, -40]),
    p("K3", "relay", { base: true, poles: 1, mystery: "31402", peek: true, tag: "K3" }, [55, -40]),
    p("S1", "slide-switch", { base: true, to: "b", tag: "S1" }, [-120, -90]),
    p("S2", "dpdt-switch", { to: "a", tag: "S2" }, [-40, -90]),
    p("S3", "pushbutton", { base: true, cap: "red", tag: "S3" }, [40, -90]),
    p("RV1", "trimmer", { base: true, ohms: 10000, position: 0.7, tag: "RV1" }, [110, -90]),
    p("S4", "toggle-switch", { base: true, to: "b", throws: 1, tag: "S4" }, [130, -40]),
    p("C1", "ceramic-cap", { farads: 100e-9 }, [0, 0], 0, { a: "c5", b: "c10" }),
    p("C2", "electrolytic-cap", { farads: 470e-6 }, [0, 0], 0, { pos: "h6", neg: "h11" }),
    p("TP1", "touch-pads", {}, [0, 0], 0, { a: "c16", b: "c18" }),
    p("K4", "relay", { poles: 1 }, [0, 0], 0, { coil1: "e21", com1: "e24", nc1: "e26", no1: "e28", coil2: "f21" }),
  ];
  return b;
}

export const FULL_TRAY: TrayItem[] = [
  { kind: "resistor", params: { ohms: 470 } },
  { kind: "resistor", params: { ohms: 1000 } },
  { kind: "resistor", params: { ohms: 4700, bands: 5, tolerance: 1 } },
  { kind: "led", params: { color: "red" } },
  { kind: "led", params: { color: "green" } },
  { kind: "led", params: { color: "blue", lens: "clear" } },
  { kind: "led", params: { color: "yellow", size: 3 } },
  { kind: "diode", params: { model: "1N4001" } },
  { kind: "npn" },
  { kind: "phototransistor" },
  { kind: "ceramic-cap", params: { farads: 100e-9 } },
  { kind: "electrolytic-cap", params: { farads: 100e-6 } },
  { kind: "electrolytic-cap", params: { farads: 1000e-6 } },
  { kind: "trimmer", params: { ohms: 10000 } },
  { kind: "pushbutton" },
  { kind: "slide-switch" },
  { kind: "toggle-switch" },
  { kind: "relay" },
  { kind: "fuse", params: { amps: 1 } },
  { kind: "battery", params: { snap: true } },
  { kind: "battery" },
  { kind: "speaker" },
  { kind: "lemon" },
  { kind: "cup", params: { water: "tap" } },
  { kind: "lead", params: { color: "red" } },
  { kind: "lead", params: { color: "black" } },
];

/** A resistor far past its power rating, for the smoke and damage visuals. */
export function smokeBench(): BenchState {
  const b = emptyBench({ kind: "bb400" });
  b.parts = [
    { id: "B1", kind: "battery", params: { snap: true }, pos: [-78, 4], rot: 0, holes: { pos: "bp2", neg: "bn2" } },
    { id: "R1", kind: "resistor", params: { ohms: 15 }, pos: [0, 0], rot: 0, holes: { a: "a8", b: "a12" } },
    { id: "D1", kind: "led", params: { color: "red" }, pos: [0, 0], rot: 0, holes: { anode: "c12", cathode: "c13" } },
    { id: "R2", kind: "resistor", params: { ohms: 150 }, pos: [0, 0], rot: 0, holes: { a: "c18", b: "c22" } },
  ];
  b.wires = [
    { id: "W1", a: "bp8", b: "b8", color: "red" },
    { id: "W2", a: "a13", b: "bn14", color: "black" },
  ];
  return b;
}

/**
 * The first lab with a light in it (first-glow): a 9 V battery, a 1.5 kOhm resistor and a red LED on the desk,
 * joined in one loop by three clip leads (or still loose, with `wired` false).
 */
export function glowBench(wired = true): BenchState {
  const b = emptyBench(null);
  b.parts = [
    { id: "B1", kind: "battery", params: { emf: 9.4 }, pos: [-74, 6], rot: 0 },
    { id: "R1", kind: "resistor", params: { ohms: 1500 }, pos: [0, -20], rot: 0 },
    { id: "D1", kind: "led", params: { color: "red" }, pos: [58, 12], rot: 180 },
  ];
  if (wired) {
    b.leads = [
      { id: "TL1", color: "red", a: { to: "pin:B1.pos", pos: [0, 0] }, b: { to: "pin:R1.a", pos: [0, 0] } },
      { id: "TL2", color: "green", a: { to: "pin:R1.b", pos: [0, 0] }, b: { to: "pin:D1.anode", pos: [0, 0] } },
      { id: "TL3", color: "black", a: { to: "pin:D1.cathode", pos: [0, 0] }, b: { to: "pin:B1.neg", pos: [0, 0] } },
    ];
  }
  return b;
}

/** Desk modules (switches, a trimmer and relays on wooden blocks), a mystery relay, touch pads and bent capacitor legs. */
export function modulesBench(): BenchState {
  const b = emptyBench({ kind: "bb400", pos: [80, 80] });
  const p = (id: string, kind: BenchState["parts"][number]["kind"], params: Record<string, unknown>, pos: [number, number], extra: Partial<BenchState["parts"][number]> = {}) =>
    ({ id, kind, params, pos, rot: 0, ...extra }) as BenchState["parts"][number];
  b.parts = [
    p("S1", "pushbutton", { base: true, tag: "S1" }, [-230, -50]),
    p("S2", "slide-switch", { base: true, to: "a", tag: "S2" }, [-160, -50]),
    p("S3", "toggle-switch", { base: true, to: "b", tag: "S3" }, [-90, -50]),
    p("RV1", "trimmer", { base: true, ohms: 10000, position: 0.4 }, [-20, -50]),
    p("K1", "relay", { base: true }, [95, -50]),
    p("S4", "dpdt-switch", { to: "a", tag: "S4" }, [230, -50]),
    p("K2", "relay", { base: true, mystery: "31402" }, [-150, 60]),
    p("TP1", "touch-pads", {}, [0, 0], { holes: { a: "e5", b: "e7" } }),
    p("C1", "electrolytic-cap", { farads: 100e-6, span: 4 }, [0, 0], { holes: { pos: "c12", neg: "c16" } }),
    p("C2", "ceramic-cap", { farads: 100e-9 }, [0, 0], { holes: { a: "h20", b: "h22" } }),
  ];
  return b;
}

// ---------------------------------------------------------------------------------------------------------------
// Start here (docs/curriculum/start-here.md). Run them with `sim=1` for live flow dots, gates and push.

type P = BenchState["parts"][number];
const q = (k: string) => (typeof location !== "undefined" ? new URLSearchParams(location.search).get(k) : null);
const pp = (id: string, kind: P["kind"], params: Record<string, unknown>, pos: [number, number], rot = 0): P => ({ id, kind, params, pos, rot }) as P;
const clip = (id: string, color: BenchState["leads"][number]["color"], a: string | null, b: string | null, apos: [number, number] = [0, 0], bpos: [number, number] = [0, 0]) => ({
  id,
  color,
  a: { to: a, pos: apos },
  b: { to: b, pos: bpos },
});

/** Seats `id` in a holder's seat (sets the holder's `held`; the bench places it from there). */
function held(b: BenchState, holder: string, seat: string, id: string): BenchState {
  return { ...b, parts: b.parts.map((p) => (p.id === holder ? ({ ...p, params: { ...p.params, held: { ...((p.params as { held?: object }).held ?? {}), [seat]: id } } } as P) : p)) };
}

/**
 * The lamp loop on the desk (SH1, SH4): the bench battery, the switch on its block, 1 kΩ and the red lamp, four clip
 * leads. `wrap` puts TL1's clip on the battery's wrapper (the case's gap); `gates` clips G1 and G2 either side of the
 * lamp; `off` leaves the switch off.
 */
export function lampBench(opts: { wrap?: boolean; gates?: boolean; off?: boolean; charge?: number } = {}): BenchState {
  const b = emptyBench(null);
  b.parts = [
    pp("B1", "battery", { emf: 9.4, internalOhms: 1.7, mAh: 500, ...(opts.charge !== undefined ? { charge: opts.charge } : {}) }, [-92, -12]),
    pp("S1", "toggle-switch", { base: true, to: opts.off ? "a" : "b", tag: "S1" }, [-18, -66]),
    pp("R1", "resistor", { ohms: 1000 }, [58, -48]),
    pp("D1", "led", { color: "red", maxmA: 50 }, [62, 30], 180),
  ];
  b.leads = [
    clip("TL1", "red", opts.wrap ? "pin:B1.wrap" : "pin:B1.pos", "pin:S1.com"),
    clip("TL2", "yellow", "pin:S1.b", "pin:R1.a"),
    clip("TL3", "green", "pin:R1.b", "pin:D1.anode"),
    clip("TL4", "black", "pin:D1.cathode", "pin:B1.neg"),
  ];
  if (opts.gates) b.parts.push(pp("G1", "gate", { on: "TL3", at: 0.45 }, [0, 0]), pp("G2", "gate", { on: "TL4", at: 0.5 }, [0, 0]));
  return b;
}

/** The junk drawer (SH2): the lamp with its gap bridged by the key, the other objects lying by two sorting trays. */
export function drawerBench(): BenchState {
  const b = emptyBench(null);
  b.parts = [
    pp("B1", "battery", { emf: 9.4, internalOhms: 1.7 }, [-150, -40]),
    pp("R1", "resistor", { ohms: 1000 }, [-80, -70]),
    pp("D1", "led", { color: "red", maxmA: 50 }, [-20, -60], 180),
    pp("K1", "sample", { material: "key" }, [-70, 10]),
    pp("YES", "bin", { style: "tray", label: "LETS FLOW THROUGH" }, [110, -70]),
    pp("NO", "bin", { style: "tray", label: "STOPS FLOW" }, [110, 60]),
    pp("CN1", "sample", { material: "coin" }, [-150, 60]),
    pp("SP1", "sample", { material: "spoon" }, [-50, 70]),
    pp("E1", "sample", { material: "eraser" }, [-140, 105]),
    pp("F1", "sample", { material: "foil" }, [-60, 120]),
    pp("MB1", "sample", { material: "marble" }, [-100, 60]),
    pp("WS1", "sample", { material: "wood" }, [10, 125]),
    pp("P1", "sample", { material: "pencil" }, [20, 80]),
    pp("ST1", "sample", { material: "string" }, [-130, 150]),
    pp("PC1", "sample", { material: "clip" }, [20, 40]),
  ];
  b.leads = [
    clip("TL1", "red", "pin:B1.pos", "pin:R1.a"),
    clip("TL2", "yellow", "pin:R1.b", "pin:K1.a"),
    clip("TL3", "green", "pin:K1.b", "pin:D1.anode"),
    clip("TL4", "black", "pin:D1.cathode", "pin:B1.neg"),
    clip("TL5", "blue", "pin:PC1.coat", null, [0, 0], [70, 20]),
  ];
  return held(held(b, "NO", "s1", "SP1"), "YES", "s1", "CN1");
}

/**
 * Two sealed boxes, one lamp (SH5): box A holds an AA cell, box B a 9 V battery; the lamp module is clipped to B. The
 * knob box (SH6) with its tag sits behind them. `open` lifts every lid.
 */
export function boxesBench(open = false): BenchState {
  let b = emptyBench(null);
  b.parts = [
    pp("BOXA", "box", { lid: open, label: "A", wiring: { "s1.pos": "t1", "s1.neg": "t2" } }, [-120, 10]),
    pp("X1", "battery", { size: "aa", emf: 1.58, internalOhms: 0.15 }, [0, 0]),
    pp("BOXB", "box", { lid: open, label: "B", wiring: { "s1.pos": "t1", "s1.neg": "t2" } }, [0, 10]),
    pp("B1", "battery", { emf: 9.4, internalOhms: 1.7 }, [0, 0]),
    pp("R1", "resistor", { ohms: 1000 }, [100, -20]),
    pp("D1", "led", { color: "red", maxmA: 50 }, [120, 50], 180),
    pp("KB", "box", { lid: open, knob: true, tag: "10 kΩ", wiring: { "s1.a": "t1", "s1.wiper": "j1", "s2.a": "j1", "s2.b": "t2" } }, [-70, -110]),
    pp("RV1", "trimmer", { ohms: 10000, position: 0.3, base: true }, [0, 0]),
    pp("RK", "resistor", { ohms: 470 }, [0, 0]),
  ];
  b.leads = [
    clip("TL1", "red", "pin:BOXB.t1", "pin:R1.a"),
    clip("TL2", "green", "pin:R1.b", "pin:D1.anode"),
    clip("TL3", "black", "pin:D1.cathode", "pin:BOXB.t2"),
  ];
  b = held(b, "BOXA", "s1", "X1");
  b = held(b, "BOXB", "s1", "B1");
  b = held(b, "KB", "s1", "RV1");
  return held(b, "KB", "s2", "RK");
}

/** The tired battery (SH7): the lamp on a battery at 8%, the desk clock, an AA cut open beside it. */
export function tiredBench(): BenchState {
  const b = lampBench({ charge: 0.08 });
  b.parts.push(pp("CK1", "clock", {}, [-80, -80]), pp("XA", "battery", { size: "aa", emf: 1.58, internalOhms: 0.15, xray: q("xray") !== "0" }, [-170, 70]));
  return b;
}

/** Prefixes and symbols (SH9, SH11, SH12): the cabinet and its padlock, value tags, drawers, the torn blueprint. */
export function symbolsBench(): BenchState {
  const b = emptyBench(null);
  b.parts = [
    pp("CAB", "box", { style: "cabinet", lock: { wheels: ["4,700 Ω", "0.02 A", "9,000 mV"], set: [true, true, false] } }, [-120, -110]),
    pp("L1", "tag", { text: "4.7 kΩ" }, [20, -130]),
    pp("L2", "tag", { text: "20 mA", alt: true }, [60, -130]),
    pp("L3", "tag", { text: "9 V" }, [100, -130]),
    pp("DR-BAT", "bin", { style: "drawer", face: "battery" }, [-170, 20]),
    pp("DR-SW", "bin", { style: "drawer", face: "switch" }, [-90, 20]),
    pp("DR-RES", "bin", { style: "drawer", face: "resistor" }, [-10, 20]),
    pp("DR-LED", "bin", { style: "drawer", face: "led" }, [70, 20]),
    pp("RB", "resistor", { ohms: 10000 }, [0, 0]),
    pp("SD1", "schematic", { title: "Blueprint", symbols: [{ kind: "battery", part: "B1" }, { kind: "resistor", part: "R1", text: "1 kΩ" }, { kind: "led", part: "D1" }], torn: 2 }, [-110, 130]),
    pp("PC", "piece", { symbol: "led", turn: 0 }, [10, 130]),
    pp("SD2", "schematic", { symbols: [{ kind: "battery" }, { kind: "switch" }, { kind: "resistor" }, { kind: "led" }] }, [140, 130]),
  ];
  return held(b, "DR-RES", "s1", "RB");
}

/** The static toy (SH3, wave 2): balloons, a wool scarf, paper bits, a comb, a spoon and a strip of wall. */
export function staticBench(): BenchState {
  const b = emptyBench(null);
  b.parts = [
    pp("WL1", "wall", {}, [0, -90]),
    // Stuck to the wall's face: charged.
    pp("BL0", "balloon", { color: "yellow", charge: -6 }, [-40, -90 + 5 + 17]),
    pp("BL1", "balloon", { color: "red", charge: -7 }, [40, 30]),
    pp("BL2", "balloon", { color: "blue" }, [100, -20]),
    pp("SF1", "scarf", { charge: 7 }, [-70, 80]),
    pp("PB1", "paper", {}, [42, 62]),
    pp("CB1", "comb", { charge: -3 }, [110, 100]),
    pp("MS1", "sample", { material: "metal-spoon" }, [150, 40]),
  ];
  return b;
}
