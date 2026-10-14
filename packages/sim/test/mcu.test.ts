import { describe, expect, test } from "vitest";
import { createSimulation, mcuPin, simulateFor, type Netlist, type PartSpec, type Snapshot } from "../src";
import { allEvents, last, led, resistor } from "./circuits";

const BLINK7 = `void setup() {
  pinMode(7, OUTPUT);
}
void loop() {
  digitalWrite(7, HIGH);
  delay(1000);
  digitalWrite(7, LOW);
  delay(1000);
}
`;

const BUTTON = `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}
void loop() {
  if (digitalRead(2) == LOW) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
}
`;

const COUNT = (wait: boolean) => `int count = 0;
int last = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
}
void loop() {
  int now = digitalRead(2);
  if (now != last) {
    if (now == LOW) {
      count++;
      Serial.println(count);
    }
    last = now;${wait ? "\n    delay(50);" : ""}
  }
}
`;

type Board = Extract<PartSpec, { kind: "mcuboard" }>;

function board(program: string, pins: Board["pins"] = {}, more: Partial<Board> = {}): Board {
  return { id: "U1", kind: "mcuboard", program, pins: { gnd: "gnd", ...pins }, ...more };
}

/** A lamp (red LED and a resistor to ground) on a node. */
function lamp(node: string, id = "D1", ohms = 470): PartSpec[] {
  return ohms > 0 ? [resistor(`R${id}`, node, `${id}a`, ohms), led(id, `${id}a`, "gnd")] : [led(id, node, "gnd")];
}

const glowAt = (s: Snapshot[], id: string, t: number) => s.find((x) => x.t >= t - 1e-9)!.parts[id]!.glow ?? 0;

describe("microcontroller board", () => {
  test("blink drives an LED through 470 Ω at about 6 mA, one second on, one off", () => {
    const net: Netlist = { parts: [board(BLINK7, { d7: "p7" }), ...lamp("p7")] };
    const s = simulateFor(net, 4.5, { sampleEvery: 0.05 });
    const on = s.find((x) => x.t >= 0.5)!;
    const i = on.parts.D1!.i;
    expect(i).toBeGreaterThan(0.0055);
    expect(i).toBeLessThan(0.007);
    expect(on.parts.D1!.glow).toBeGreaterThan(0.5);
    expect(glowAt(s, "D1", 1.5)).toBeLessThan(0.05);
    expect(glowAt(s, "D1", 2.5)).toBeGreaterThan(0.5);
    // The pin reads as an output, HIGH, at about 4.85 V (25 Ω inside).
    const p = mcuPin(on.parts.U1, 7)!;
    expect(p.mode).toBe("OUTPUT");
    expect(p.level).toBe("HIGH");
    expect(p.volts).toBeGreaterThan(4.75);
    expect(p.mA).toBeCloseTo(i * 1000, 1);
    // The board's own lamps: ON lit, L dark (pin 13 is not used).
    expect(on.parts["U1:ON"]!.glow).toBeGreaterThan(0.3);
    expect(on.parts["U1:L"]!.glow).toBe(0);
    expect(on.parts.U1!.extra!.program).toBe("running");
  });

  test("the blink period is 2.000 s on the simulator clock", () => {
    const net: Netlist = { parts: [board(BLINK7, { d7: "p7" }), ...lamp("p7")] };
    const s = simulateFor(net, 6.2, { sampleEvery: 0.001 });
    const rises: number[] = [];
    for (let k = 1; k < s.length; k++) if (s[k]!.parts.D1!.i > 0.003 && s[k - 1]!.parts.D1!.i < 0.003) rises.push(s[k]!.t);
    expect(rises.length).toBe(3);
    expect(Math.abs(rises[1]! - rises[0]! - 2)).toBeLessThan(0.002);
    expect(Math.abs(rises[2]! - rises[1]! - 2)).toBeLessThan(0.002);
  });

  test("L follows pin 13 without loading it", () => {
    const prog = BLINK7.replaceAll("7", "13");
    const s = simulateFor({ parts: [board(prog)] }, 1.5, { sampleEvery: 0.05 });
    expect(glowAt(s, "U1:L", 0.5)).toBeGreaterThan(0.4);
    expect(glowAt(s, "U1:L", 1.4)).toBeLessThan(0.05);
    expect(mcuPin(s.find((x) => x.t >= 0.5)!.parts.U1, 13)!.mA).toBeCloseTo(0, 3);
  });

  test("a button reads with the pull-up: pressed is LOW and lights L at once", () => {
    const net: Netlist = { parts: [board(BUTTON, { d2: "p2" }), { id: "S1", kind: "pushbutton", pins: { a: "p2", b: "gnd" } }] };
    const s = simulateFor(net, 1.5, {
      sampleEvery: 0.01,
      actions: [
        { t: 0.5, id: "S1", key: "pressed", value: true },
        { t: 1.0, id: "S1", key: "pressed", value: false },
      ],
    });
    const free = s.find((x) => x.t >= 0.4)!;
    const held = s.find((x) => x.t >= 0.51)!;
    expect(mcuPin(free.parts.U1, 2)).toMatchObject({ mode: "INPUT_PULLUP", level: "HIGH" });
    expect(mcuPin(held.parts.U1, 2)).toMatchObject({ level: "LOW" });
    // 5 V across the 35 kΩ pull-up: about 0.14 mA flows into the button.
    expect(mcuPin(held.parts.U1, 2)!.mA).toBeCloseTo(0.143, 2);
    expect(mcuPin(held.parts.U1, 13)!.level).toBe("HIGH");
    expect(glowAt(s, "U1:L", 0.6)).toBeGreaterThan(0.4);
    expect(glowAt(s, "U1:L", 1.2)).toBeLessThan(0.05);
  });

  test("without the pull-up a free input floats: a hand near the board makes it flicker", () => {
    const prog = BUTTON.replace("INPUT_PULLUP", "INPUT");
    const sim = createSimulation();
    sim.load({ parts: [board(prog, { d2: "p2" }), { id: "S1", kind: "pushbutton", pins: { a: "p2", b: "gnd" } }] });
    sim.setInput("U1", "proximity", 1);
    let changes = 0;
    let prev: string | null = null;
    for (let k = 0; k < 100; k++) {
      const lv = mcuPin(sim.step(0.0047).parts.U1, 13)!.level;
      if (prev && lv !== prev) changes++;
      prev = lv;
    }
    expect(changes).toBeGreaterThan(3);
  });

  test("PWM brightness: analogWrite 64 is dimmer than 255 and brighter than 0", () => {
    const glow = (v: number) => {
      const prog = `void setup() {\n  pinMode(9, OUTPUT);\n  analogWrite(9, ${v});\n}\nvoid loop() {\n}\n`;
      const s = simulateFor({ parts: [board(prog, { d9: "p9" }), ...lamp("p9")] }, 0.3, { sampleEvery: 0.05 });
      return last(s).parts.D1!.glow ?? 0;
    };
    const g0 = glow(0);
    const g64 = glow(64);
    const g255 = glow(255);
    expect(g0).toBe(0);
    // A quarter of 6.3 mA, as the eye averages it.
    expect(g64).toBeGreaterThan(0.35);
    expect(g64).toBeLessThan(0.52);
    expect(g255).toBeGreaterThan(0.65);
  });

  test("HIGH then LOW with no wait: the lamp looks steady and a little dimmer, and it stays cheap", () => {
    const prog = `void setup() {\n  pinMode(7, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(7, HIGH);\n  digitalWrite(7, LOW);\n}\n`;
    const t0 = performance.now();
    const s = simulateFor({ parts: [board(prog, { d7: "p7" }), ...lamp("p7")] }, 1, { sampleEvery: 0.02 });
    const wall = performance.now() - t0;
    const g = s.filter((x) => x.t > 0.2).map((x) => x.parts.D1!.glow ?? 0);
    const mean = g.reduce((a, b) => a + b, 0) / g.length;
    expect(mean).toBeGreaterThan(0.3);
    expect(mean).toBeLessThan(0.85);
    expect(Math.max(...g) - Math.min(...g)).toBeLessThan(0.1);
    expect(wall).toBeLessThan(3000);
  });

  test("bouncing button: the serial monitor counts too many, the 50 ms wait counts right", () => {
    const presses = [0.3, 0.8, 1.3, 1.8, 2.3].flatMap((t) => [
      { t, id: "S1", key: "pressed" as const, value: true },
      { t: t + 0.2, id: "S1", key: "pressed" as const, value: false },
    ]);
    const count = (wait: boolean) => {
      const net: Netlist = { seed: "lesson-16", parts: [board(COUNT(wait), { d2: "p2" }), { id: "S1", kind: "pushbutton", pins: { a: "p2", b: "gnd" }, bounce: 5 }] };
      const s = simulateFor(net, 2.8, { sampleEvery: 0.05, actions: presses });
      const lines = allEvents(s)
        .filter((e) => e.type === "serial")
        .flatMap((e) => String(e.data!.text).split("\n"));
      return { lines, tail: String(last(s).parts.U1!.extra!.serial) };
    };
    const raw = count(false);
    expect(raw.lines.length).toBeGreaterThan(5);
    expect(raw.lines).toEqual(raw.lines.map((_, k) => String(k + 1)));
    const fixed = count(true);
    expect(fixed.lines).toEqual(["1", "2", "3", "4", "5"]);
    expect(fixed.tail.endsWith("4\r\n5\r\n")).toBe(true);
  });

  test("an upload restarts the program; a rebuild with the same program keeps it running", () => {
    const sim = createSimulation();
    const net = (upload: number, extra: PartSpec[] = []): Netlist => ({ parts: [board(BLINK7, { d7: "p7" }, { upload }), ...lamp("p7"), ...extra] });
    sim.load(net(1));
    sim.step(1.5);
    const before = Number(sim.snapshot().parts.U1!.extra!.millis);
    expect(before).toBeGreaterThan(1400);
    // Adding a part elsewhere: the program carries on.
    sim.load(net(1, [resistor("R9", "x", "y", 100)]));
    sim.step(0.1);
    expect(Number(sim.snapshot().parts.U1!.extra!.millis)).toBeGreaterThan(before + 90);
    // Upload again: back to the top of setup().
    sim.load(net(2));
    sim.step(0.1);
    expect(Number(sim.snapshot().parts.U1!.extra!.millis)).toBeLessThan(110);
    expect(sim.snapshot().parts.D1!.glow).toBeGreaterThan(0.5); // HIGH again at once
    // The reset button does the same.
    sim.step(1.2);
    sim.setInput("U1", "reset", true);
    sim.step(0.05);
    expect(Number(sim.snapshot().parts.U1!.extra!.millis)).toBeLessThan(60);
  });

  test("millis can jump to day 49 and wraps to 0", () => {
    const sim = createSimulation();
    sim.load({ parts: [board(BLINK7, { d7: "p7" })] });
    sim.step(0.2);
    sim.setInput("U1", "millis", 4294967296 - 3000);
    sim.step(1);
    expect(Number(sim.snapshot().parts.U1!.extra!.millis)).toBe(4294967296 - 2000);
    sim.step(2.5);
    const m = Number(sim.snapshot().parts.U1!.extra!.millis);
    expect(m).toBeGreaterThanOrEqual(499);
    expect(m).toBeLessThan(502);
  });

  test("power: off stops everything, the jack restarts the program from the regulator", () => {
    const sim = createSimulation();
    sim.load({ parts: [board(BLINK7, { d7: "p7", vin: "vin", "5v": "v5" }), ...lamp("p7")] });
    sim.step(0.5);
    expect(sim.snapshot().parts.D1!.glow).toBeGreaterThan(0.5);
    sim.setInput("U1", "power", "off");
    sim.step(0.2);
    let s = sim.snapshot();
    expect(s.parts.D1!.glow).toBeLessThan(0.05);
    expect(s.parts["U1:ON"]!.glow).toBeLessThan(0.05);
    expect(s.parts.U1!.extra!.powered).toBe(false);
    sim.setInput("U1", "power", "jack");
    sim.step(0.3);
    s = sim.snapshot();
    expect(s.parts.U1!.extra!.powered).toBe(true);
    expect(s.parts.D1!.glow).toBeGreaterThan(0.5);
    expect(s.nodes.v5).toBeGreaterThan(4.9);
    expect(s.nodes.v5).toBeLessThan(5.05);
    // VIN: the 9 V battery less the protection diode and its own resistance.
    expect(s.nodes.vin).toBeGreaterThan(7.8);
    expect(s.nodes.vin).toBeLessThan(8.6);
    expect(Number(s.parts.U1!.extra!.millis)).toBeLessThan(310);
  });

  test("an LED with no resistor: the pin warns, then burns out", () => {
    const s = simulateFor({ parts: [board(BLINK7.replace("delay(1000);\n  digitalWrite(7, LOW);", "delay(5000);\n  digitalWrite(7, LOW);"), { d7: "p7" }), ...lamp("p7", "D1", 0)] }, 3, { sampleEvery: 0.05 });
    const ev = allEvents(s).filter((e) => e.partId === "U1");
    expect(ev.find((e) => e.type === "warning" && e.data?.cause === "overload")?.data?.pin).toBe("7");
    const died = ev.find((e) => e.type === "died");
    expect(died?.data).toMatchObject({ pin: "7", cause: "overcurrent" });
    expect(died!.message).toMatch(/^Pin 7 of the board burned out/);
    expect(String(last(s).parts.U1!.extra!.deadPins)).toBe("7");
    expect(last(s).parts.U1!.health).toBe("hot");
  });

  test("9 V on the 5V pin kills the chip", () => {
    const s = simulateFor({ parts: [board(BLINK7, { "5v": "vcc" }), { id: "B1", kind: "battery", pins: { pos: "vcc", neg: "gnd" }, emf: 9, internalOhms: 1.7 }] }, 2, { sampleEvery: 0.1 });
    const died = allEvents(s).find((e) => e.partId === "U1" && e.type === "died");
    expect(died?.data?.cause).toBe("overvoltage");
    expect(last(s).parts.U1!.health).toBe("dead");
  });

  test("analogRead samples the node voltage: a divider at half the supply reads about 512", () => {
    const prog = `void setup() {\n  Serial.begin(115200);\n}\nvoid loop() {\n  Serial.println(analogRead(A0));\n  delay(100);\n}\n`;
    const net: Netlist = { parts: [board(prog, { a0: "mid", "5v": "v5" }), resistor("RA", "v5", "mid", 10_000), resistor("RB", "mid", "gnd", 10_000)] };
    const s = simulateFor(net, 0.5, { sampleEvery: 0.1 });
    const values = allEvents(s)
      .filter((e) => e.type === "serial")
      .flatMap((e) => String(e.data!.text).split("\n"))
      .map(Number);
    expect(values.length).toBeGreaterThan(3);
    for (const v of values) expect(Math.abs(v - 512)).toBeLessThanOrEqual(2);
  });

  test("pins 0 and 1 belong to the USB serial line: wiring a button to pin 0 warns", () => {
    const prog = `void setup() {\n  pinMode(0, INPUT_PULLUP);\n}\nvoid loop() {\n}\n`;
    const s = simulateFor({ parts: [board(prog, { d0: "p0" }), { id: "S1", kind: "pushbutton", pins: { a: "p0", b: "gnd" }, pressed: true }] }, 0.3, { sampleEvery: 0.1 });
    expect(allEvents(s).find((e) => e.type === "warning" && e.data?.cause === "serial-pins")).toBeTruthy();
  });

  test("a program that does not compile leaves the board idle and says why", () => {
    const s = last(simulateFor({ parts: [board("void setup() {\n  digitalwrite(13, HIGH);\n}\nvoid loop() {\n}\n")] }, 0.2, { sampleEvery: 0.1 }));
    expect(s.parts.U1!.extra!.program).toBe("error");
    expect(s.parts.U1!.extra!.error).toBe("2:3 Did you mean digitalWrite? Capitals matter.");
    expect(mcuPin(s.parts.U1, 13)!.mode).toBe("INPUT");
  });
});
