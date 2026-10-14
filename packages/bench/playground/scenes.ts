// Ready-made benches for the playground and the screenshot script.

import { defaultMeter, emptyBench, holeWorld, type BenchState, type TrayItem } from "../src/core";

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
// Unit 4: chips.

type Part = BenchState["parts"][number];
const part = (id: string, kind: Part["kind"], params: Record<string, unknown>, holes?: Record<string, string>, pos: [number, number] = [0, 0], rot = 0): Part =>
  ({ id, kind, params, pos, rot, ...(holes ? { holes } : {}) }) as Part;

/** Holes for a DIP with pin 1 in row e at `col` (rot 0): pins 1 to n/2 along row e, the rest back along row f. */
export function dipHoles(n: number, col: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let k = 1; k <= n; k++) out[String(k)] = k <= n / 2 ? `e${col + k - 1}` : `f${col + n - k}`;
  return out;
}

/** The same holes with the chip turned round: pin 1 in row f at the right-hand end. */
export function dipHolesTurned(n: number, col: number): Record<string, string> {
  const out: Record<string, string> = {};
  const last = col + n / 2 - 1;
  for (let k = 1; k <= n; k++) out[String(k)] = k <= n / 2 ? `f${last - (k - 1)}` : `e${col + k - n / 2 - 1}`;
  return out;
}

/**
 * Unit 4's counting demo on a full board (`?scene=chips`): a 555 blinker (10 kOhm, 68 kOhm, 10 uF, about 1 Hz) lights
 * an LED and clocks a 4026B, whose outputs drive a 7-segment display on its carrier board (3.3 kOhm a bar).
 */
export function chipsBench(): BenchState {
  const b = emptyBench({ kind: "bb830" });
  const seg = { e: "c50", d: "c51", com: "c52", c: "c53", dp: "c54", g: "g50", f: "g51", com2: "g52", a: "g53", b: "g54" };
  b.parts = [
    part("B1", "battery", { snap: true, emf: 9.4 }, { pos: "bp3", neg: "bn3" }, [-150, 30]),
    part("U1", "chip", { model: "555" }, dipHoles(8, 20)),
    part("R1", "resistor", { ohms: 10_000 }, { a: "tp21", b: "h21" }),
    part("R2", "resistor", { ohms: 68_000 }, { a: "g21", b: "g26" }),
    part("C1", "electrolytic-cap", { farads: 10e-6, volts: 16 }, { pos: "b21", neg: "bn21" }),
    part("R3", "resistor", { ohms: 470 }, { a: "c22", b: "c26" }),
    part("D1", "led", { color: "red" }, { anode: "d26", cathode: "d27" }),
    part("U2", "chip", { model: "4026B" }, dipHoles(16, 35)),
    part("DS1", "sevenseg", { common: "cathode", carrier: true, segmentOhms: 3300 }, seg),
  ];
  const w = (id: string, a: string, to: string, color: BenchState["wires"][number]["color"]) => ({ id, a, b: to, color });
  b.wires = [
    // Rails: the far pair joins the near pair.
    w("W1", "tp58", "bp58", "red"),
    w("W2", "tn60", "bn60", "black"),
    // The 555: ground, supply, reset held high, trigger round the chip's end to threshold, threshold over to R2.
    w("W3", "a20", "bn19", "black"),
    w("W4", "j20", "tp19", "red"),
    w("W5", "a23", "bp23", "red"),
    w("W6", "d21", "d17", "yellow"),
    w("W23", "c17", "h17", "yellow"),
    w("W24", "i17", "i22", "yellow"),
    w("W7", "h22", "h26", "yellow"),
    w("W8", "a27", "bn27", "black"),
    // The blinker clocks the counter.
    w("W9", "b22", "b35", "orange"),
    // The 4026B: supply, clock enabled (inhibit low), display enabled, reset held low.
    w("W10", "j35", "tp35", "red"),
    w("W11", "a42", "bn42", "black"),
    w("W12", "a36", "bn36", "black"),
    w("W13", "a37", "bp37", "red"),
    w("W14", "j36", "tn36", "black"),
    // Segments a to g to the display; its common cathode to minus.
    w("W15", "d40", "h51", "green"),
    w("W16", "c41", "i50", "green"),
    w("W17", "g40", "b50", "blue"),
    w("W18", "h41", "j53", "blue"),
    w("W19", "i42", "a51", "blue"),
    w("W20", "j39", "f54", "blue"),
    w("W21", "g38", "d53", "blue"),
    w("W22", "a52", "bn52", "black"),
  ];
  return b;
}

/** Every Unit 4 part on one bench (`?scene=chipparts`): on the board and on the desk. */
export function chipPartsBench(): BenchState {
  const b = emptyBench({ kind: "bb830" });
  const probeAt = holeWorld(b.board!, "a5")!;
  b.parts = [
    part("U1", "chip", { model: "555" }, dipHoles(8, 3)),
    part("DS1", "sevenseg", { common: "cathode" }, { e: "c9", d: "c10", com: "c11", c: "c12", dp: "c13", g: "g9", f: "g10", com2: "g11", a: "g12", b: "g13" }),
    part("D2", "diode", { model: "1N4148" }, { anode: "a16", cathode: "a20" }),
    // Turned round: pin 1 at the far right of the same holes.
    part("U2", "chip", { model: "74HC00" }, dipHolesTurned(14, 16), [0, 0], 180),
    part("U5", "chip", { model: "74HC08", package: "soic" }, undefined, [-22, -11], 0),
    part("U3", "chip", { model: "4026B" }, dipHoles(16, 25)),
    part("U4", "chip", { model: "74HC86", hidden: true, label: "?1" }, dipHoles(14, 35)),
    part("XU1", "ic-socket", { pins: 8, held: { chip: "U6" } }, dipHoles(8, 44)),
    part("U6", "chip", { model: "555-cmos" }),
    part("DIP1", "dip-switch", { positions: 8, s1: true, s2: true, s3: true, s7: true, tags: ["a", "b", "c", "d", "e", "f", "g", "dp"] }, dipHoles(16, 50)),
    part("VR1", "regulator7805", { heatsink: true }, { in: "j59", gnd: "j60", out: "j61" }),
    part("LP1", "logic-probe", {}, { tip: "a5", vcc: "bp9", gnd: "bn9" }, probeAt),
    part("BT1", "battery-pack", { cells: 3 }, undefined, [-215, 95]),
    part("BT2", "battery-pack", { cells: 4 }, undefined, [-150, 95]),
    part("VR2", "regulator7805", {}, undefined, [-35, 62]),
    part("DS2", "sevenseg", { common: "anode", carrier: true, color: "green" }, undefined, [-5, 64]),
    part("DIP2", "dip-switch", { positions: 4, s2: true }, undefined, [25, 58]),
    part("U7", "chip", { model: "74HC393" }, undefined, [52, 58]),
    part("XU2", "ic-socket", { pins: 14 }, undefined, [84, 58]),
    part("PS1", "bench-supply", { position: 0.75 }, undefined, [150, 85]),
  ];
  return b;
}
