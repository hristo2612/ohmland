import { describe, expect, test } from "vitest";
import { analyze, compile, describe as say, format, formatWithMap, fromBlocks, nodeAt, parse, stripSpans, toBlocks, type BlockNode, type BlockProgram, type Program } from "../src";
import * as P from "./programs";

const GOLDEN = { BLINK: P.BLINK, HEARTBEAT: P.HEARTBEAT, BUTTON: P.BUTTON, COUNT_PRESSES: P.COUNT_PRESSES, DEBOUNCED: P.DEBOUNCED, NON_BLOCKING: P.NON_BLOCKING, LIGHTHOUSE_UNSAFE: P.LIGHTHOUSE_UNSAFE, DICE: P.DICE, FADE: P.FADE };

/** The first mistake, as the editor shows it. */
function first(src: string): string {
  const a = analyze(src);
  return a.errors[0] ? say(a.errors[0]) : "";
}
function firstKind(src: string): string | undefined {
  return analyze(src).errors[0]?.kind;
}

describe("friendly errors: line:column and a plain sentence", () => {
  test("wrong capitals: 5:3 Did you mean digitalWrite?", () => {
    const src = P.HEARTBEAT.replace("  digitalWrite(13, HIGH);\n  delay(100);", "  digitalwrite(13, HIGH);\n  delay(100);");
    expect(first(src)).toBe("5:3 Did you mean digitalWrite? Capitals matter.");
    expect(firstKind(src)).toBe("case");
    expect(first(P.HEARTBEAT.replace("delay(700)", "Delay(700)"))).toBe("12:3 Did you mean delay? Capitals matter.");
  });

  test("a missing semicolon points just after the step: 6:13", () => {
    const src = P.HEARTBEAT.replace("  delay(100);", "  delay(100)");
    expect(first(src)).toBe("6:13 Each step ends with a semicolon.");
    expect(firstKind(src)).toBe("semicolon");
  });

  test("brackets and braces", () => {
    expect(firstKind("void setup() {\n  pinMode(13, OUTPUT;\n}\nvoid loop() {\n}\n")).toBe("paren");
    expect(first("void setup() {\n  pinMode(13, OUTPUT);\n\nvoid loop() {\n}\n")).toMatch(/^4:/);
    expect(first("void setup() {\n}\nvoid loop() {\n  if (1) {\n    delay(1);\n}\n")).toBe("3:13 This { is never closed. Add a } to end it.");
    expect(first("void setup() {\n}\n}\nvoid loop() {\n}\n")).toBe("3:1 This } has no matching {.");
  });

  test("names the board does not know", () => {
    expect(first("void setup() {\n  dela(10);\n}\nvoid loop() {\n}\n")).toBe("2:3 I don't know dela. Did you mean delay?");
    expect(first("void setup() {\n  x = 5;\n}\nvoid loop() {\n}\n")).toBe("2:3 I don't know x. Make it first, for example: int x = 0;");
    expect(firstKind("void setup() {\n  Serial.available();\n}\nvoid loop() {\n}\n")).toBe("unsupported");
  });

  test("setup and loop are required", () => {
    expect(first("void setup() {\n}\n")).toBe("1:1 Every program needs void loop() { }.");
    expect(firstKind("void loop() {\n}\n")).toBe("setup");
  });

  test("features that are not on this bench say so", () => {
    expect(first("int pins[3];\nvoid setup() {\n}\nvoid loop() {\n}\n")).toBe("1:9 Arrays are not on this bench yet.");
    expect(firstKind("float v = 1.5;\nvoid setup() {\n}\nvoid loop() {\n}\n")).toBe("unsupported");
    expect(firstKind("#include <Servo.h>\nvoid setup() {\n}\nvoid loop() {\n}\n")).toBe("unsupported");
    expect(firstKind("void setup() {\n  switch (1) {\n  }\n}\nvoid loop() {\n}\n")).toBe("unsupported");
    expect(firstKind("void setup() {\n  int x = 1.5;\n}\nvoid loop() {\n}\n")).toBe("unsupported");
  });

  test("values, types and counts", () => {
    expect(first("void setup() {\n  digitalWrite(13);\n}\nvoid loop() {\n}\n")).toBe("2:3 digitalWrite needs 2 values: a pin and HIGH or LOW.");
    expect(firstKind("void setup() {\n  int x = delay(5);\n}\nvoid loop() {\n}\n")).toBe("type");
    expect(firstKind("void setup() {\n  HIGH = 3;\n}\nvoid loop() {\n}\n")).toBe("const");
    expect(firstKind("const int led = 13;\nvoid setup() {\n  led = 12;\n}\nvoid loop() {\n}\n")).toBe("const");
    expect(firstKind("int a = 1;\nint a = 2;\nvoid setup() {\n}\nvoid loop() {\n}\n")).toBe("duplicate");
    expect(firstKind("void setup() {\n  break;\n}\nvoid loop() {\n}\n")).toBe("syntax");
    expect(firstKind("void setup() {\n  int x = \"hi\";\n}\nvoid loop() {\n}\n")).toBe("type");
    expect(firstKind("int roll() {\n  return;\n}\nvoid setup() {\n}\nvoid loop() {\n}\n")).toBe("type");
  });

  test("warnings a careful compiler gives", () => {
    const kinds = (src: string) => analyze(src).warnings.map((w) => w.kind);
    expect(kinds(P.DICE.replace("face == 6", "face = 6"))).toContain("assign-in-if");
    const w = analyze(P.DICE.replace("face == 6", "face = 6")).warnings.find((x) => x.kind === "assign-in-if")!;
    expect(w.message).toBe("= sets a value, so this if is about the new value. To compare, use ==.");
    expect(kinds("int x = 40000;\nvoid setup() {\n}\nvoid loop() {\n}\n")).toContain("overflow");
    expect(kinds("void setup() {\n  pinMode(22, OUTPUT);\n}\nvoid loop() {\n}\n")).toContain("pin");
    expect(kinds("int x = 0;\nvoid setup() {\n  x == 5;\n}\nvoid loop() {\n}\n")).toContain("no-effect");
    expect(kinds("int f() {\n  if (1) return 2;\n}\nvoid setup() {\n}\nvoid loop() {\n}\n")).toContain("return");
    // Warnings do not stop a program from running.
    expect(compile(P.DICE.replace("face == 6", "face = 6")).ok).toBe(true);
  });

  test("functions may be called before they are written; variables must come first", () => {
    expect(analyze(P.DICE.replace("void showFace() {", "void later() {\n}\nvoid showFace() {")).errors).toEqual([]);
    expect(firstKind("void setup() {\n  x = 1;\n}\nint x = 0;\nvoid loop() {\n}\n")).toBe("name");
  });
});

describe("text and blocks are two views of one tree", () => {
  test.each(Object.entries(GOLDEN))("%s: text -> tree -> text is unchanged", (_name, src) => {
    const p = parse(src);
    expect(p.errors).toEqual([]);
    expect(format(p.ast!)).toBe(src);
  });

  test.each(Object.entries(GOLDEN))("%s: tree -> blocks -> tree is the same tree", (_name, src) => {
    const ast = parse(src).ast!;
    const blocks = toBlocks(ast);
    // Blocks are plain JSON.
    const back = fromBlocks(JSON.parse(JSON.stringify(blocks)));
    expect(format(back)).toBe(src);
    if (!src.includes("millis() -")) expect(stripSpans(back)).toEqual(stripSpans(ast));
  });

  test("comments, blank lines and the learner's brackets survive both trips", () => {
    const src = `// my heartbeat
int beats = 0; // counted

void setup() { // once
  pinMode(13, OUTPUT);
}

void loop() {
  /* on */
  digitalWrite(13, HIGH);
  delay((100));

  beats += 1;
  if (beats > 3) beats = 0;
  else if (beats == 2) {
    delay(5);
  } else {
    delay(6);
  }
  for (int i = 0; i < 3; i++) delay(1);
  while (false);
  int x = -(-5) + ~beats - !beats;
  x = x > 0 ? x : -x;
  long y = (long)x * 1000L + 0x10 + 0b11 + 017;
}
`;
    const ast = parse(src).ast!;
    expect(format(ast)).toBe(src);
    expect(format(fromBlocks(toBlocks(ast)))).toBe(src);
    expect(compile(src).ok).toBe(true);
  });

  test("the clock check shows as one 'every' block and comes back as the same text", () => {
    const ast = parse(P.NON_BLOCKING).ast!;
    const loop = toBlocks(ast).items.find((b) => b.type === "loop")!;
    const every = loop.body![0]!;
    expect(every.type).toBe("every");
    expect(every.fields).toEqual({ var: "last" });
    expect(every.inputs!.ms).toMatchObject({ type: "number", fields: { value: 1000 } });
    expect(every.body!.map((b) => b.type)).toEqual(["set", "digitalWrite"]);
    // Edited out of shape (brackets around the subtraction), it is a plain if again.
    const plain = toBlocks(parse(P.NON_BLOCKING.replace("millis() - last >= 1000", "(millis() - last) >= 1000")).ast!);
    expect(plain.items.find((b) => b.type === "loop")!.body![0]!.type).toBe("if");
  });

  test("blocks made in the editor (no ids) become a program that runs", () => {
    const n = (value: number): BlockNode => ({ type: "number", fields: { value } });
    const c = (name: string): BlockNode => ({ type: "constant", fields: { name } });
    const blocks: BlockProgram = {
      type: "program",
      items: [
        { type: "setup", body: [{ type: "pinMode", inputs: { pin: n(13), mode: c("OUTPUT") } }] },
        {
          type: "loop",
          body: [
            { type: "digitalWrite", inputs: { pin: n(13), value: c("HIGH") } },
            { type: "delay", inputs: { ms: n(250) } },
            { type: "digitalWrite", inputs: { pin: n(13), value: c("LOW") } },
            { type: "delay", inputs: { ms: n(250) } },
          ],
        },
      ],
    };
    const ast = fromBlocks(blocks);
    expect(format(ast)).toBe("void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(250);\n  digitalWrite(13, LOW);\n  delay(250);\n}\n");
    expect(compile(ast).ok).toBe(true);
    const ids = new Set<number>();
    JSON.stringify(ast, (k, v) => {
      if (k === "id") {
        expect(ids.has(v)).toBe(false);
        ids.add(v);
      }
      return v;
    });
  });

  test("a block lights its line: spans from the parser and from the formatter agree", () => {
    const ast = parse(P.HEARTBEAT).ast!;
    const loop = toBlocks(ast).items[1]!;
    const firstDelay = loop.body![1]!;
    const { spans } = formatWithMap(ast);
    expect(spans.get(firstDelay.id!)).toMatchObject({ line: 6, col: 3 });
    expect(nodeAt(ast as Program, 6, 5)?.id).toBe(firstDelay.id);
    // A tree from blocks has no spans of its own; the formatter supplies them.
    const fromB = fromBlocks(toBlocks(ast));
    expect(formatWithMap(fromB).spans.get(firstDelay.id!)).toMatchObject({ line: 6, col: 3, endCol: 14 });
  });
});
