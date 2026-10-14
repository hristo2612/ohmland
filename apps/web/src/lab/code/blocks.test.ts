/**
 * The block view's edits, round tripped through text: blocks and text are two views of one tree, so every edit made
 * on the blocks must come back as the program a learner would have typed, and text typed by hand must read as blocks.
 */
import { describe, expect, it } from "vitest";
import { analyze, type BlockNode, type BlockProgram } from "@ohmland/code";
import { BLINK, HELLO, START } from "../../../../../content/labs/mcu-demo";
import { at, choicesFor, fits, moveBlock, numberBlock, paletteItem, placeItem, readProgram, removeAt, setAt, SNIPPETS, statementLists, textOf, type Path } from "./blocks";

const blocksOf = (text: string): BlockProgram => {
  const r = readProgram(text);
  expect(r.blocks, text).not.toBeNull();
  return r.blocks!;
};
const LOOP: Path = ["items", 1, "body"];
const loopLines = (text: string) => text.split("\n").filter((l) => l.startsWith("  "));

describe("blocks and text", () => {
  it("turns text into blocks and back exactly", () => {
    const odd = "// my heartbeat\nint count = 0; // presses\n\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  if (count > 3) digitalWrite(13, HIGH);\n  else {\n    count += 0x1F;\n  }\n  delay(1000UL); /* a wait */\n}\n";
    for (const text of [START, BLINK, HELLO, odd]) expect(textOf(blocksOf(text))).toBe(text);
  });

  it("puts a palette block where it is dropped", () => {
    const item = paletteItem("digitalWrite(7, LOW);")!;
    const text = textOf(placeItem(blocksOf(START), { list: LOOP, index: 1 }, item))!;
    expect(loopLines(text).slice(-2)).toEqual(["  digitalWrite(13, HIGH);", "  digitalWrite(7, LOW);"]);
    expect(analyze(text).errors).toEqual([]);
  });

  it("gives each clock check its own variable, declared at the top", () => {
    const every = paletteItem("every")!;
    expect(every.globals.map((g) => g.fields?.name)).toEqual(["last"]);
    let b = placeItem(blocksOf(START), { list: LOOP, index: 1 }, every);
    // The global went in above setup: the loop is one further down now.
    expect(at(b, ["items", 2, "type"])).toBe("loop");
    b = placeItem(b, { list: ["items", 2, "body"], index: 2 }, every);
    const text = textOf(b)!;
    expect(text.startsWith("unsigned long last = 0;\nunsigned long last2 = 0;\n")).toBe(true);
    expect(text).toContain("  if (millis() - last >= 1000) {\n    last = millis();\n  }\n  if (millis() - last2 >= 1000) {\n    last2 = millis();\n  }\n}");
    expect(analyze(text).errors).toEqual([]);
    // Read back from the text, each is one "every" block again.
    const back = blocksOf(text);
    expect([at(back, ["items", 3, "body", 1, "type"]), at(back, ["items", 3, "body", 2, "fields", "var"])]).toEqual(["every", "last2"]);
  });

  it("moves, reorders and takes out blocks", () => {
    const b = blocksOf(BLINK);
    // The first wait to the end of the loop.
    const moved = textOf(moveBlock(b, { list: LOOP, index: 1 }, { list: LOOP, index: 4 }))!;
    expect(loopLines(moved)).toEqual(["  pinMode(13, OUTPUT);", "  pinMode(7, OUTPUT);", "  digitalWrite(7, HIGH);", "  digitalWrite(7, LOW);", "  delay(1000);", "  delay(1000);"]);
    // Up into setup.
    const up = textOf(moveBlock(b, { list: LOOP, index: 0 }, { list: ["items", 0, "body"], index: 0 }))!;
    expect(up.split("\n")[1]).toBe("  digitalWrite(7, HIGH);");
    // Nowhere: onto itself.
    expect(moveBlock(b, { list: LOOP, index: 2 }, { list: LOOP, index: 2 })).toBe(b);
    expect(loopLines(textOf(removeAt(b, { list: LOOP, index: 3 }))!)).toHaveLength(5);
  });

  it("never puts a block inside itself", () => {
    const b = blocksOf("void setup() {\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n    delay(5);\n  }\n}\n");
    expect(moveBlock(b, { list: LOOP, index: 0 }, { list: [...LOOP, 0, "body"], index: 1 })).toBe(b);
  });

  it("changes numbers, words and operators in place", () => {
    let b = blocksOf(START);
    const pin: Path = [...LOOP, 0, "inputs", "pin"];
    b = setAt(b, pin, numberBlock("7"));
    const value: Path = [...LOOP, 0, "inputs", "value"];
    expect(choicesFor(String((at(b, value) as BlockNode).fields?.name))).toEqual(["HIGH", "LOW"]);
    b = setAt(b, value, { type: "constant", fields: { name: "LOW" } });
    expect(textOf(b)).toContain("  digitalWrite(7, LOW);\n");
    const test = blocksOf("void setup() {\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n  }\n}\n");
    const op: Path = [...LOOP, 0, "inputs", "test"];
    const cmp = at(test, op) as BlockNode;
    expect(textOf(setAt(test, op, { ...cmp, fields: { op: "!=" } }))).toContain("if (digitalRead(2) != LOW)");
  });

  it("reads typed numbers as the board would", () => {
    expect(numberBlock("250")?.fields).toEqual({ value: 250, raw: "250" });
    expect(numberBlock("0x1F")?.fields).toEqual({ value: 31, raw: "0x1F" });
    expect(numberBlock("5000UL")?.fields).toEqual({ value: 5000, raw: "5000UL" });
    expect(numberBlock("-3")).toEqual({ type: "negate", inputs: { value: { type: "number", fields: { value: 3, raw: "3" } } } });
    for (const bad of ["", "1.5", "ten", "1e3", "--2"]) expect(numberBlock(bad)).toBeNull();
  });

  it("redraws the blocks from typed text, and freezes them on text that does not read", () => {
    const typed = BLINK.replace("delay(1000);\n  digitalWrite(7, LOW);", "delay(250);\n  digitalWrite(7, LOW);");
    expect(at(blocksOf(typed), [...LOOP, 1, "inputs", "ms", "fields", "value"])).toBe(250);
    const broken = readProgram(BLINK.replace("delay(1000);", "delay(1000)"));
    expect(broken.blocks).toBeNull();
    expect(broken.error).toMatchObject({ line: 8, col: 14, kind: "semicolon" });
    const caps = readProgram(BLINK.replace("digitalWrite(7, HIGH)", "digitalwrite(7, HIGH)"));
    expect(caps.blocks).not.toBeNull();
    expect(caps.error).toMatchObject({ line: 7, col: 3, kind: "case" });
  });

  it("offers every palette name as blocks that fit a loop", () => {
    for (const name of Object.keys(SNIPPETS)) {
      const item = paletteItem(name);
      expect(item, name).not.toBeNull();
      for (const s of item!.steps) expect(fits(s, LOOP), name).toBe(true);
      const text = textOf(placeItem(blocksOf(START), { list: LOOP, index: 0 }, item!))!;
      expect(analyze(text).ast, name).not.toBeNull();
    }
    expect(paletteItem("digitalWrite(13, LOW")).toBeNull();
    expect(fits({ type: "delay" }, ["items"])).toBe(false);
    expect(fits({ type: "declare", fields: { type: "int", name: "x" } }, ["items"])).toBe(true);
  });

  it("lists every statement list in reading order", () => {
    const b = blocksOf("void setup() {\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n  } else {\n  }\n}\n");
    expect(statementLists(b)).toEqual([["items"], ["items", 0, "body"], ["items", 1, "body"], ["items", 1, "body", 0, "body"], ["items", 1, "body", 0, "else"]]);
  });
});
