import { describe, expect, it } from "vitest";
import { simulateFor, type PartSpec } from "@ohmland/sim";
import { benchToNetlist } from "../src/netlist";
import { partPose } from "../src/layout";
import { MCU_LEGS, MCU_PIN_XZ, MCU_PIN_Y } from "../src/mcuBoard";
import type { BenchState } from "../src/types";

const BLINK7 = "void setup() {\n  pinMode(7, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(7, HIGH);\n  delay(500);\n  digitalWrite(7, LOW);\n  delay(500);\n}\n";

/** Lesson 12's bench: the board on the desk, pin 7 clipped to a 470 Ω resistor and a red LED on the breadboard. */
function lampOnPin7(program = BLINK7): BenchState {
  return {
    v: 1,
    board: { kind: "bb400", pos: [0, 80] },
    parts: [
      { id: "U1", kind: "mcu-board", params: { program, upload: 1 }, pos: [-20, -40], rot: 0 },
      { id: "R1", kind: "resistor", params: { ohms: 470, tolerance: 0 }, pos: [0, 0], rot: 0, holes: { a: "e10", b: "e14" } },
      { id: "D1", kind: "led", params: { color: "red" }, pos: [0, 0], rot: 0, holes: { anode: "d14", cathode: "d15" } },
    ],
    wires: [],
    leads: [
      { id: "TL1", color: "yellow", a: { to: "pin:U1.d7", pos: [0, 0] }, b: { to: "hole:a10", pos: [0, 0] } },
      { id: "TL2", color: "black", a: { to: "hole:a15", pos: [0, 0] }, b: { to: "pin:U1.gnd2", pos: [0, 0] } },
    ],
    meter: null,
  };
}

describe("microcontroller board on the bench", () => {
  it("maps its header sockets to the simulator's pins, with both GND sockets on ground", () => {
    const { netlist, nodeOf, warnings } = benchToNetlist(lampOnPin7());
    const u1 = netlist.parts.find((p) => p.id === "U1") as Extract<PartSpec, { kind: "mcuboard" }>;
    expect(u1.kind).toBe("mcuboard");
    expect(u1.program).toBe(BLINK7);
    expect(u1.upload).toBe(1);
    expect(u1.power).toBe("usb");
    // With no battery on the bench, the board's GND is the reference node.
    expect(u1.pins.gnd).toBe("gnd");
    expect(nodeOf("pin:U1.gnd2")).toBe("gnd");
    expect(warnings.filter((w) => w.startsWith("no-ground"))).toEqual([]);
    expect(Object.keys(u1.pins).sort()).toEqual(MCU_LEGS.filter((l) => l !== "gnd2").sort());
    expect(u1.pins.d7).not.toBe(u1.pins.d6);
    // The clip lead joins pin 7 to the resistor's strip (merged when leads are ideal).
    const ideal = benchToNetlist(lampOnPin7(), { leadOhms: 0 });
    expect(ideal.nodeOf("pin:U1.d7")).toBe(ideal.nodeOf("pin:R1.a"));
  });

  it("puts every clip point on top of its socket, turning with the board", () => {
    const bench = lampOnPin7();
    const pose = partPose(bench, bench.parts[0]!);
    expect(pose.mount).toBe("desk");
    const [x, z] = MCU_PIN_XZ.d7;
    expect(pose.legs.d7).toEqual([-20 + x, MCU_PIN_Y, -40 + z]);
    const turned = { ...bench.parts[0]!, rot: 90 };
    const p2 = partPose({ ...bench, parts: [turned] }, turned);
    // A quarter turn: local x runs toward -z on the desk.
    expect(p2.legs.d7![0]).toBeCloseTo(-20 + z, 6);
    expect(p2.legs.d7![2]).toBeCloseTo(-40 - x, 6);
  });

  it("runs the uploaded program: pin 7 blinks the LED through the clip lead and the board", () => {
    const { netlist } = benchToNetlist(lampOnPin7());
    const s = simulateFor(netlist, 1.2, { sampleEvery: 0.05 });
    const at = (t: number) => s.find((x) => x.t >= t - 1e-9)!;
    expect(at(0.25).parts.D1!.glow).toBeGreaterThan(0.5);
    expect(at(0.75).parts.D1!.glow).toBeLessThan(0.05);
    expect(at(0.25).parts.D1!.i).toBeGreaterThan(0.0055);
    expect(at(0.25).parts["U1:ON"]!.glow).toBeGreaterThan(0.3);
  });
});
