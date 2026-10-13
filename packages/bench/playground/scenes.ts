// Ready-made benches for the playground and the screenshot script.

import { defaultMeter, emptyBench, type BenchState, type TrayItem } from "../src";

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
