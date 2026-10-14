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
// Unit 3: making it permanent.

const GOOD = { kind: "pad", alloy: "lead-free", volume: 1.6, wetted: 0.95, peakC: 270, moved: false, fedAt: "work", bridgeTo: null, lifted: false, coldTouch: false, flux: 0.3, verdict: "good" } as const;

/**
 * The solder station beside a perfboard lamp (MP10, MP11): the board copper side up with its legs bent along the
 * plan's lines and a few joints already made (`?scene=solder`; `&top=1` shows the top with the plan's ghosts,
 * `&joints=all` a finished board, `&joints=none` a bare one).
 */
export function solderBench(opts: { top?: boolean; joints?: "some" | "all" | "none"; lead?: "leaded" | "lead-free" } = {}): BenchState {
  const b = emptyBench(null);
  const joints: Record<string, unknown> =
    opts.joints === "none"
      ? {}
      : opts.joints === "all"
        ? { A1: GOOD, A3: GOOD, C7: GOOD, F8: GOOD }
        : {
            A1: GOOD,
            A3: { ...GOOD, volume: 3.1, verdict: "too-much" },
            F8: { ...GOOD, volume: 0.5, verdict: "too-little" },
            D3: { ...GOOD, wetted: 0.3, peakC: 190, verdict: "cold" },
            D5: { ...GOOD, moved: true, verdict: "disturbed" },
            E3: { ...GOOD, volume: 4.2, bridgeTo: "E4", verdict: "bridge" },
          };
  b.parts = [
    { id: "ST1", kind: "solder-station", params: { on: true, setC: opts.lead === "leaded" ? 330 : 370, iron: "stand", spool: "SD1" }, pos: [-175, -25], rot: 0 },
    { id: "SD1", kind: "solder-spool", params: { alloy: opts.lead ?? "lead-free" }, pos: [-185, 62], rot: 0 },
    { id: "SD2", kind: "solder-spool", params: { alloy: opts.lead === "leaded" ? "lead-free" : "leaded" }, pos: [-128, 70], rot: 0 },
    { id: "BR1", kind: "solder-braid", params: {}, pos: [-80, 78], rot: 0 },
    {
      id: "PB1",
      kind: "perfboard",
      params: { cols: 10, rows: 6, flipped: !opts.top, plan: "PC1", joints, bends: opts.top ? {} : { "R1.b": "C7", "D1.cathode": "F8" }, links: opts.top ? [] : [{ id: "L1", a: "A1", b: "A3" }] },
      pos: [-20, -10],
      rot: 0,
    },
    { id: "BS1", kind: "battery", params: { snap: true, emf: 9.4, internalOhms: 1.7 }, pos: [-40, 70], rot: 0, holes: { pos: "PB1:A1", neg: "PB1:F8" } },
    { id: "R1", kind: "resistor", params: { ohms: 1000 }, pos: [0, 0], rot: 0, holes: { a: "PB1:A3", b: "PB1:A7" } },
    { id: "D1", kind: "led", params: { color: "red", size: 3 }, pos: [0, 0], rot: 0, holes: { anode: "PB1:C7", cathode: "PB1:C8" } },
    {
      id: "PC1",
      kind: "plan-card",
      params: {
        title: "Lamp",
        cols: 10,
        rows: 6,
        ghosts: [
          { id: "R1", kind: "resistor", legs: { a: "A3", b: "A7" } },
          { id: "D1", kind: "led", legs: { anode: "C7", cathode: "C8" } },
          { id: "BS1", kind: "battery", legs: { pos: "A1", neg: "F8" } },
        ],
        lines: [
          ["A1", "A3"],
          ["A7", "C7"],
          ["C8", "F8"],
        ],
      },
      pos: [82, 28],
      rot: 0,
    },
  ] as BenchState["parts"];
  return b;
}

/** Heat running up a lead into an LED (MP5): a 3 mm LED on the desk, a copper clip on its leg, the iron at the mark. */
export function heatsinkBench(clip = true): BenchState {
  const b = emptyBench(null);
  b.parts = [
    { id: "ST1", kind: "solder-station", params: { on: true, setC: 330, iron: "D1.anode" }, pos: [-150, -30], rot: 0 },
    { id: "B1", kind: "battery", params: { emf: 9.4, internalOhms: 1.7 }, pos: [-60, 60], rot: 0 },
    { id: "R1", kind: "resistor", params: { ohms: 470 }, pos: [0, 70], rot: 0 },
    { id: "D1", kind: "led", params: { color: "red", size: 3 }, pos: [10, 10], rot: 0 },
    ...(clip ? [{ id: "HS1", kind: "heat-sink-clip", params: { metal: "copper", on: "D1.anode", mm: 6 }, pos: [0, 0], rot: 0 }] : []),
    { id: "HS2", kind: "heat-sink-clip", params: { metal: "steel" }, pos: [80, 50], rot: 0 },
  ] as BenchState["parts"];
  b.leads = [
    { id: "TL1", color: "red", a: { to: "pin:B1.pos", pos: [0, 0] }, b: { to: "pin:R1.a", pos: [0, 0] } },
    { id: "TL2", color: "yellow", a: { to: "pin:R1.b", pos: [0, 0] }, b: { to: "pin:D1.anode", pos: [0, 0] } },
    { id: "TL3", color: "black", a: { to: "pin:D1.cathode", pos: [0, 0] }, b: { to: "pin:B1.neg", pos: [0, 0] } },
  ];
  return b;
}

/** Wire and power from the wall (MP6 to MP8): hookup wire, the stripper, heat-shrink, a heat gun, a jack and adapters. */
export function wiresBench(): BenchState {
  const b = emptyBench({ kind: "bb400", pos: [60, 40] });
  const clean = { mm: 10, notch: 22, scale: "solid", clean: true, nicked: false, slipped: false, cutStrands: 0, twisted: false };
  b.parts = [
    { id: "HW1", kind: "hookup-wire", params: { color: "red", awg: 22, len: 90, ends: { b: clean } }, pos: [-130, -80], rot: 0, ends: { a: [-185, -85], b: [-104, -80] } },
    { id: "HW2", kind: "hookup-wire", params: { color: "red", awg: 22, len: 90, ends: { a: clean } }, pos: [-60, -80], rot: 0, ends: { a: [-101, -79], b: [-20, -85] } },
    { id: "HW3", kind: "hookup-wire", params: { color: "black", awg: 22, len: 80, ends: { a: { ...clean, notch: 26, clean: false, nicked: true } } }, pos: [-140, -40], rot: 0, ends: { a: [-180, -40], b: [-100, -38] } },
    { id: "WS1", kind: "wire-stripper", params: { notch: 22, scale: "solid", stopMm: 10 }, pos: [-150, 20], rot: 0 },
    { id: "T1", kind: "heat-shrink", params: { size: 3.2, on: "HW1", at: 30, shrink: 0 }, pos: [-150, -82], rot: 0 },
    { id: "T2", kind: "heat-shrink", params: { size: 3.2, shrink: 1 }, pos: [-60, -45], rot: 0 },
    { id: "T3", kind: "heat-shrink", params: { size: 6.4, shrink: 0 }, pos: [-60, -30], rot: 0 },
    { id: "HG1", kind: "heat-gun", params: { on: true }, pos: [-140, 95], rot: 0 },
    { id: "J1", kind: "barrel-jack", params: {}, pos: [0, 0], rot: 0, holes: { tip: "bp4", sleeve: "bn4" } },
    { id: "AD1", kind: "wall-adapter", params: { volts: 9, amps: 1, type: "regulated", centre: "plus", into: "J1" }, pos: [10, 160], rot: 0 },
    { id: "AD2", kind: "wall-adapter", params: { volts: 9, amps: 0.5, type: "regulated", centre: "minus", into: null }, pos: [110, 160], rot: 0, ends: { plug: [150, 125] } },
    { id: "R1", kind: "resistor", params: { ohms: 1000 }, pos: [0, 0], rot: 0, holes: { a: "bp10", b: "c10" } },
    { id: "D1", kind: "led", params: { color: "red" }, pos: [0, 0], rot: 0, holes: { anode: "d10", cathode: "d11" } },
  ] as BenchState["parts"];
  b.wires = [{ id: "W1", a: "a11", b: "bn11", color: "black" }];
  return b;
}

export const SOLDER_TRAY: TrayItem[] = [
  { kind: "resistor", params: { ohms: 1000 } },
  { kind: "led", params: { color: "red", size: 3 } },
  { kind: "npn" },
  { kind: "electrolytic-cap", params: { farads: 10e-6 } },
  { kind: "heat-sink-clip", params: { metal: "copper" } },
  { kind: "hookup-wire", params: { color: "black", awg: 22, len: 80 } },
  { kind: "heat-shrink", params: { size: 3.2 } },
];
