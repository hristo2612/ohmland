import { describe, expect, test } from "vitest";
import { Drive, VirtualBoard, Vm, compile, runProgram, type DriveMode } from "../src";
import * as P from "./programs";

const US = 1e6;

/**
 * A pushbutton from pin 2 to ground: each press closes at `at` (s) and opens `hold` seconds later. With `chatter`,
 * the contacts touch and spring back a few times over about 1.6 ms on every make and break.
 */
function button(presses: { at: number; hold: number }[], chatter = false) {
  const bounce = chatter ? [0, 0.3e-3, 0.5e-3, 1.2e-3, 1.6e-3] : [0];
  return (pin: number, tUs: number, mode: DriveMode): number | undefined => {
    if (pin !== 2) return undefined;
    const t = tUs / US;
    for (const p of presses) {
      // Count the contact changes since the press (or the release) began.
      const flips = (t0: number) => bounce.filter((d) => t >= t0 + d).length;
      if (t >= p.at && t < p.at + p.hold) return flips(p.at) % 2 === 1 ? 0 : 1;
      if (t >= p.at + p.hold && t < p.at + p.hold + 2e-3) return flips(p.at + p.hold) % 2 === 1 ? 1 : 0;
    }
    return mode === Drive.PULLUP ? 1 : 0;
  };
}

describe("golden programs on a virtual board", () => {
  test("blink: one second on, one off, a 2.000 s period", () => {
    const r = runProgram(P.BLINK, { seconds: 10 });
    expect(r.ok).toBe(true);
    const e = r.board.edges(13);
    expect(e[0]).toEqual({ t: 4, level: 0 }); // pinMode(13, OUTPUT): output, LOW
    const rises = e.filter((x) => x.level === 1).map((x) => x.t);
    expect(rises.length).toBe(5);
    for (let k = 1; k < rises.length; k++) expect(Math.abs((rises[k]! - rises[k - 1]!) / US - 2)).toBeLessThan(0.01);
    // Each step costs board time: the period is 2 s plus a few microseconds.
    expect(rises[1]! - rises[0]!).toBe(2_000_011);
  });

  test("HIGH then LOW with no wait toggles far too fast to see (about 100 kHz)", () => {
    const r = runProgram(`void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  digitalWrite(13, LOW);\n}\n`, { seconds: 0.01 });
    const rises = r.board.edges(13).filter((x) => x.level === 1);
    const period = (rises[rises.length - 1]!.t - rises[0]!.t) / (rises.length - 1);
    expect(period).toBe(9); // two 4 µs pin calls and the loop
  });

  test("button with the pull-up: pressed reads LOW and lights pin 13 at once", () => {
    const r = runProgram(P.BUTTON, { seconds: 2, input: button([{ at: 0.5, hold: 0.5 }]) });
    const b = r.board;
    expect(b.levelAt(13, 0.4 * US)).toBe(0);
    expect(b.levelAt(13, 0.5 * US + 20)).toBe(1);
    expect(b.levelAt(13, 0.99 * US)).toBe(1);
    expect(b.levelAt(13, 1.0 * US + 20)).toBe(0);
    expect(b.modes[2]).toBe(Drive.PULLUP);
  });

  test("without a debounce, five bouncing presses count far more than five", () => {
    const presses = [1, 2, 3, 4, 5].map((k) => ({ at: k * 0.4, hold: 0.15 }));
    const r = runProgram(P.COUNT_PRESSES, { seconds: 2.5, input: button(presses, true) });
    const counts = r.board.lines.map((l) => Number(l.text));
    expect(counts.length).toBeGreaterThan(5);
    expect(counts).toEqual(counts.map((_, k) => k + 1));
  });

  test("with a 50 ms wait after each change, five presses count five", () => {
    const presses = [1, 2, 3, 4, 5].map((k) => ({ at: k * 0.4, hold: 0.15 }));
    const r = runProgram(P.DEBOUNCED, { seconds: 2.5, input: button(presses, true) });
    expect(r.board.lines.map((l) => l.text)).toEqual(["1", "2", "3", "4", "5"]);
  });

  test("serial lines take time to send: 10 bits a character at 9600 baud", () => {
    const r = runProgram(`void setup() {\n  Serial.begin(9600);\n  Serial.println("hello");\n}\nvoid loop() {\n}\n`, { seconds: 0.1 });
    expect(r.board.lines).toHaveLength(1);
    expect(r.board.lines[0]!.text).toBe("hello");
    // "hello\\r\\n" is 7 characters: about 7.3 ms on the line.
    expect(r.board.lines[0]!.t / 1000).toBeCloseTo(7.3, 0);
    expect(r.board.serial).toBe("hello\r\n");
  });

  test("blocking blink misses a quick tap; the millis version catches it at once", () => {
    const tap = button([{ at: 0.3, hold: 0.2 }]);
    const blocking = runProgram(P.BLOCKING_BLINK_AND_LISTEN, { seconds: 3, input: tap });
    expect(blocking.board.edges(7).some((e) => e.level === 1)).toBe(false);
    const free = runProgram(P.NON_BLOCKING, { seconds: 5, input: tap });
    const lit = free.board.edges(7).find((e) => e.level === 1)!;
    expect(lit.t / US - 0.3).toBeLessThan(0.001);
    const rises = free.board.edges(13).filter((e) => e.level === 1).map((e) => e.t / US);
    expect(Math.abs(rises[1]! - rises[0]! - 2)).toBeLessThan(0.002);
  });

  test("millis can jump to day 49; the subtraction keeps time across the wrap", () => {
    const wrapIn9s = 4294967296 - 9000;
    const safe = runProgram(P.LIGHTHOUSE_SAFE, { seconds: 22, clockStart: wrapIn9s });
    const t = safe.board.edges(13).map((e) => e.t / US);
    const gaps = t.slice(2).map((x, k) => x - t[k + 1]!);
    expect(gaps.length).toBeGreaterThan(3);
    for (const g of gaps) expect(Math.abs(g - 5)).toBeLessThan(0.01);
  });

  test("adding to millis overflows 4 s before the wrap: the lamp flickers until millis wraps too", () => {
    const wrapIn9s = 4294967296 - 9000;
    const r = runProgram(P.LIGHTHOUSE_UNSAFE, { seconds: 12, clockStart: wrapIn9s });
    const t = r.board.edges(13).map((e) => e.t / US);
    const flicker = t.filter((x) => x > 5.01 && x < 9);
    expect(flicker.length).toBeGreaterThan(1000);
    expect(t.filter((x) => x > 9.01 && x < 10).length).toBe(0);
    // A jump of a running clock does the same.
    const j = runProgram(P.LIGHTHOUSE_UNSAFE, { seconds: 12, clockJumps: [{ at: 0.5, millis: wrapIn9s }] });
    expect(j.board.edges(13).filter((e) => e.t / US > 5.6 && e.t / US < 9.4).length).toBeGreaterThan(1000);
  });

  test("random is the board's own generator: same numbers as avr-libc from seed 1", () => {
    const src = `void setup() {\n  Serial.begin(115200);\n  Serial.println(random(2147483647));\n  Serial.println(random(2147483647));\n  Serial.println(random(2147483647));\n  randomSeed(42);\n  Serial.println(random(1, 7));\n}\nvoid loop() {\n}\n`;
    const r = runProgram(src, { seconds: 0.1 });
    expect(r.board.lines.map((l) => l.text)).toEqual(["16807", "282475249", "1622650073", String(1 + ((42 * 16807) % 2147483647) % 6)]);
  });

  test("random(1, 7) gives only 1 to 6, each about a sixth of 10,000 rolls", () => {
    const counters = [1, 2, 3, 4, 5, 6].map((f) => `long c${f} = 0;`).join("\n");
    const src = `${counters}
long bad = 0;

void setup() {
  Serial.begin(115200);
  for (long i = 0; i < 10000; i++) {
    int face = random(1, 7);
    if (face == 1) c1++;
    else if (face == 2) c2++;
    else if (face == 3) c3++;
    else if (face == 4) c4++;
    else if (face == 5) c5++;
    else if (face == 6) c6++;
    else bad++;
  }
  Serial.println(c1);
  Serial.println(c2);
  Serial.println(c3);
  Serial.println(c4);
  Serial.println(c5);
  Serial.println(c6);
  Serial.println(bad);
}
void loop() {
}
`;
    const r = runProgram(src, { seconds: 1 });
    const n = r.board.lines.map((l) => Number(l.text));
    expect(n[6]).toBe(0);
    for (const c of n.slice(0, 6)) expect(Math.abs(c / 10000 - 1 / 6)).toBeLessThan(0.03 / 6 + 0.005);
  });

  test("dice: the pips always show the number printed, and a press stops the roll", () => {
    const r = runProgram(P.DICE, { seconds: 3, input: button([{ at: 1.0, hold: 0.2 }], true) });
    const lines = r.board.lines;
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines.slice(0, -1)) {
      const at = l.t + 2000; // the pips change a moment after the print starts; by the time it is sent they are set
      const face = Number(l.text);
      expect(face >= 1 && face <= 6).toBe(true);
      expect([4, 5, 6, 7].map((p) => r.board.levelAt(p, at))).toEqual(P.PIPS[face]);
    }
    // Stopped: nothing printed after the press settles.
    expect(lines.filter((l) => l.t / US > 1.1).length).toBe(0);
  });

  test("analogWrite on a PWM pin: 490 Hz at a quarter duty", () => {
    const r = runProgram(P.FADE, { seconds: 0.01 });
    const pwm = r.board.events.filter((e) => e.pin === 9 && e.mode === Drive.PWM);
    expect(pwm).toHaveLength(1);
    expect(pwm[0]!.duty).toBeCloseTo(64 / 255, 5);
    expect(pwm[0]!.hz).toBeCloseTo(490.196, 2);
  });

  test("reset runs setup again from a fresh clock", () => {
    const r = runProgram(P.BLINK, { seconds: 4, resets: [1.5] });
    const rises = r.board.edges(13).filter((e) => e.level === 1).map((e) => e.t / US);
    expect(rises[0]).toBeCloseTo(0, 3);
    expect(rises[1]).toBeCloseTo(1.5, 3);
    expect(rises[2]).toBeCloseTo(3.5, 3);
  });
});

describe("step and trace", () => {
  test("step runs one statement at a time; trace keeps the last few with their board times", () => {
    const c = compile(P.BLINK);
    if (!c.ok) throw new Error("does not compile");
    const vm = new Vm(c.program, { trace: 8 });
    const board = new VirtualBoard();
    const lines: (number | undefined)[] = [];
    for (let k = 0; k < 8; k++) {
      expect(vm.step(board)).toBe("step");
      lines.push(c.program.stmts[vm.stmt]?.span?.line);
    }
    // setup's pinMode, then each pass: the call to loop() (no line of its own), then lines 6 to 9.
    expect(lines).toEqual([2, undefined, 6, 7, 8, 9, undefined, 6]);
    // The second pass's digitalWrite has run: 1 µs for the step, 3 for the pin call.
    expect(vm.t).toBe(2_000_020);
    const tr = vm.traced();
    expect(tr).toHaveLength(8);
    expect(tr[0]!.t).toBe(0);
    expect(tr[tr.length - 1]!.t).toBe(2_000_016);
  });
});

describe("whole numbers wrap as on the board", () => {
  const out = (body: string, globals = "") =>
    runProgram(`${globals}\nvoid setup() {\n  Serial.begin(115200);\n${body}\n}\nvoid loop() {\n}\n`, { seconds: 0.2 }).board.lines.map((l) => l.text);

  test("int is 16 bits", () => {
    expect(out("  int x = 32767;\n  x++;\n  Serial.println(x);")).toEqual(["-32768"]);
    // The classic: two ints multiply as int, even into a long.
    expect(out("  int a = 300;\n  int b = 300;\n  long c = a * b;\n  Serial.println(c);\n  long d = (long)a * b;\n  Serial.println(d);")).toEqual(["24464", "90000"]);
    expect(out("  unsigned int u = 0;\n  u--;\n  Serial.println(u);")).toEqual(["65535"]);
    expect(out("  byte b = 250;\n  b += 10;\n  Serial.println(b);")).toEqual(["4"]);
  });

  test("unsigned long wraps at 2^32 and the subtraction survives it", () => {
    expect(out("  unsigned long a = 4294967295UL;\n  a = a + 2;\n  Serial.println(a);\n  unsigned long last = 4294967000UL;\n  unsigned long now = 704;\n  Serial.println(now - last);")).toEqual(["1", "1000"]);
    expect(out("  long big = 2147483647;\n  big++;\n  Serial.println(big);")).toEqual(["-2147483648"]);
  });

  test("division truncates toward zero; dividing by zero gives the board's strange answer", () => {
    expect(out("  Serial.println(-7 / 2);\n  Serial.println(-7 % 2);\n  int z = 0;\n  Serial.println(5 / z);\n  Serial.println(5 % z);")).toEqual(["-3", "-1", "-1", "5"]);
  });

  test("printing in other bases, bools as numbers, comparisons mixing signed and unsigned", () => {
    expect(out("  Serial.println(255, HEX);\n  Serial.println(-1, HEX);\n  Serial.println(5, BIN);\n  bool t = true;\n  Serial.println(t);")).toEqual(["FF", "FFFFFFFF", "101", "1"]);
    // -1 compared with an unsigned long becomes 4294967295.
    expect(out("  unsigned long u = 5;\n  if (-1 > u) Serial.println(\"yes\");\n  else Serial.println(\"no\");")).toEqual(["yes"]);
  });

  test("functions with values, static locals, while, for, do, break, continue, ?:", () => {
    const g = `int square(int n) {\n  return n * n;\n}\nint counter() {\n  static int calls = 0;\n  calls++;\n  return calls;\n}`;
    const body = [
      "  Serial.println(square(12));",
      "  counter();",
      "  Serial.println(counter());",
      "  int s = 0;",
      "  for (int i = 0; i < 10; i++) {",
      "    if (i == 3) continue;",
      "    if (i == 6) break;",
      "    s += i;",
      "  }",
      "  Serial.println(s);",
      "  int k = 0;",
      "  do {",
      "    k++;",
      "  } while (k < 4);",
      "  while (k > 0) k -= 3;",
      "  Serial.println(k);",
      "  Serial.println(k < 0 ? 7 : 8);",
      "  Serial.println(map(512, 0, 1023, 0, 255));",
      "  Serial.println(constrain(300, 0, 255));",
    ].join("\n");
    expect(out(body, g)).toEqual(["144", "2", "12", "-2", "7", "127", "255"]);
  });

  test("printing before Serial.begin sends nothing and says why", () => {
    const r = runProgram(`void setup() {\n  Serial.println(1);\n}\nvoid loop() {\n}\n`, { seconds: 0.1 });
    expect(r.board.serial).toBe("");
    expect(r.notes[0]?.kind).toBe("serial");
    expect(r.warnings.some((w) => w.kind === "serial")).toBe(true);
  });
});
