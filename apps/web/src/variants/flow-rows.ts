/**
 * The four benches of the flow try-out (/variants/flow): the-flow's lit loop with its two gates, welcome-to-the-bench's
 * loop with the gap for the tracer, a loop on the breadboard through four jumpers, and two branches whose currents
 * differ. Each is a lab bench config, built the way a lab builds it.
 */
import { buildBench, type BuiltBench } from "../lab/build";
import type { BenchConfig, LabDefinition } from "../lab/define";
import { loadLab } from "../lab/labs";

export type RowId = "flow" | "gap" | "board" | "branches";

export type FlowRow = {
  id: RowId;
  built: BuiltBench;
  /** Where the loop tracer starts, for the row that shows it. */
  trace?: string;
  /** What a close-up frames. */
  close: string[];
};

/** A lab's bench with its switch thrown on (and any extra parts), so the loop is lit from the start. */
function switchedOn(lab: LabDefinition, extra: BenchConfig["parts"] = []): BenchConfig {
  const { overlays: _overlays, ...bench } = lab.bench;
  const parts = bench.parts.map((p) => (p.id === "S1" && "params" in p ? ({ ...p, params: { ...p.params, to: "b" } } as typeof p) : p));
  return { ...bench, parts: [...parts, ...extra], tray: [] };
}

const BOARD: BenchConfig = {
  board: "half",
  frame: ["desk:-70,-60", "desk:70,40"],
  parts: [
    { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "9 V battery" },
    { id: "R1", kind: "resistor", holes: { a: "c6", b: "c10" }, params: { ohms: 1000, watts: 0.25 }, label: "1 kΩ resistor" },
    { id: "D1", kind: "led", holes: { anode: "d14", cathode: "d15" }, params: { color: "red", maxmA: 50 }, label: "Red LED" },
  ],
  wires: [
    { id: "W1", from: "rail+:5", to: "a6", color: "red" },
    { id: "W2", from: "a10", to: "a14", color: "yellow" },
    { id: "W3", from: "a15", to: "a19", color: "green" },
    { id: "W4", from: "b19", to: "b23", color: "blue" },
    { id: "W5", from: "a23", to: "rail-:24", color: "black" },
  ],
  tray: [],
  instruments: [],
};

const BRANCHES: BenchConfig = {
  board: "none",
  frame: ["desk:-110,-66", "desk:96,62"],
  parts: [
    { id: "B1", kind: "battery", at: "desk:-74,0", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "9 V battery" },
    { id: "R1", kind: "resistor", at: "desk:4,-36", params: { ohms: 1000, watts: 0.25 }, label: "1 kΩ resistor" },
    { id: "D1", kind: "led", at: "desk:62,-36", rot: 180, params: { color: "red", maxmA: 50 }, label: "Red LED" },
    { id: "R2", kind: "resistor", at: "desk:4,34", params: { ohms: 330, watts: 0.25 }, label: "330 Ω resistor" },
    { id: "D2", kind: "led", at: "desk:62,34", rot: 180, params: { color: "green", maxmA: 50 }, label: "Green LED" },
  ],
  leads: [
    // Red and black carry both branches; the rest carry one each.
    { id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
    { id: "TL2", from: "R1.a", to: "R2.a", color: "blue" },
    { id: "TL3", from: "R1.b", to: "D1.anode", color: "green" },
    { id: "TL4", from: "R2.b", to: "D2.anode", color: "yellow" },
    { id: "TL5", from: "D1.cathode", to: "B1.neg", color: "black" },
    { id: "TL6", from: "D2.cathode", to: "D1.cathode", color: "white" },
  ],
  tray: [],
  instruments: [],
};

export async function loadRows(): Promise<FlowRow[]> {
  const [flow, welcome] = await Promise.all([loadLab("the-flow"), loadLab("welcome-to-the-bench")]);
  return [
    {
      id: "flow",
      built: buildBench(
        switchedOn(flow, [
          { id: "G1", kind: "gate", at: "lead:TL3" },
          { id: "G2", kind: "gate", at: "lead:TL4" },
        ]),
      ),
      close: ["part:G1", "part:G2", "part:D1"],
    },
    { id: "gap", built: buildBench(switchedOn(welcome)), trace: "pin:B1.neg", close: ["part:B1"] },
    { id: "board", built: buildBench(BOARD), close: ["wire:W2", "wire:W3", "wire:W4", "part:D1"] },
    { id: "branches", built: buildBench(BRANCHES), close: ["part:R1", "part:R2"] },
  ];
}
