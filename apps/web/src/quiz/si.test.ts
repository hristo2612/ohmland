import { describe, expect, it } from "vitest";
import { formatSI, gradeNumeric, isParseError, parseQuantity, type ParsedQuantity } from "./si";

const ok = (s: string): ParsedQuantity => {
  const p = parseQuantity(s);
  if (isParseError(p)) throw new Error(`"${s}" failed: ${p.error}`);
  return p;
};

describe("parseQuantity", () => {
  it.each([
    ["470", 470],
    ["0.047", 0.047],
    [".5", 0.5],
    ["4.7k", 4700],
    ["4k7", 4700],
    ["4K7", 4700],
    ["2M2", 2_200_000],
    ["4R7", 4.7],
    ["1n5", 1.5e-9],
    ["47m", 0.047],
    ["4.7 kΩ", 4700],
    ["4.7kohm", 4700],
    ["4.7 kohms", 4700],
    ["1 Mohm", 1e6],
    ["1meg", 1e6],
    ["10 µF", 1e-5],
    ["10uF", 1e-5],
    ["10 μF", 1e-5],
    ["20 mA", 0.02],
    ["20ma", 0.02],
    ["0,5 V", 0.5],
    ["4,700", 4700],
    ["1e3", 1000],
    ["-0.42 V", -0.42],
    ["9 volts", 9],
    ["470 Ω", 470],
  ])("%s -> %d", (input, value) => {
    expect(ok(input).value).toBeCloseTo(value, 15);
  });

  it("keeps track of what the learner typed", () => {
    expect(ok("470")).toMatchObject({ prefix: null, base: null });
    expect(ok("4.7k")).toMatchObject({ prefix: "k", base: null, number: 4.7 });
    expect(ok("20 mA")).toMatchObject({ prefix: "m", base: "A", number: 20 });
    expect(ok("9 V")).toMatchObject({ prefix: null, base: "V" });
    expect(ok("4R7")).toMatchObject({ prefix: null, base: "Ω" });
  });

  it("tells milli from mega", () => {
    expect(ok("1m").value).toBe(0.001);
    expect(ok("1M").value).toBe(1e6);
  });

  it("rejects junk with a reason", () => {
    expect(parseQuantity("")).toEqual({ error: "empty" });
    expect(parseQuantity("abc")).toEqual({ error: "format" });
    expect(parseQuantity("12 bananas")).toEqual({ error: "unit" });
    expect(parseQuantity("4R7 V")).toEqual({ error: "unit" });
  });
});

describe("formatSI", () => {
  it.each([
    [0.0149, "A", "14.9 mA"],
    [4700, "Ω", "4.7 kΩ"],
    [470, "Ω", "470 Ω"],
    [2_200_000, "Ω", "2.2 MΩ"],
    [1e-5, "F", "10 µF"],
    [9, "V", "9 V"],
    [0, "V", "0 V"],
  ] as const)("%d %s -> %s", (value, base, text) => {
    expect(formatSI(value, base)).toBe(text.replace(" ", "\u00a0"));
  });
});

describe("gradeNumeric", () => {
  const ma = { answer: 15, unit: "mA", tolerance: 3 };

  it("accepts the answer in the box's unit, with or without units", () => {
    for (const s of ["15", "15 mA", "15mA", "0.015 A", "15m", "14.9", "15.3"]) expect(gradeNumeric(s, ma).status).toBe("correct");
  });

  it("applies the tolerance", () => {
    expect(gradeNumeric("15.4", ma).status).toBe("correct"); // 2.7% off
    expect(gradeNumeric("15.6", ma)).toMatchObject({ status: "wrong", direction: "high" }); // 4% off
    expect(gradeNumeric("14", ma)).toMatchObject({ status: "wrong", direction: "low" });
    expect(gradeNumeric("4.75k", { answer: 4.7, unit: "kΩ", tolerance: 2 }).status).toBe("correct");
    expect(gradeNumeric("4.9k", { answer: 4.7, unit: "kΩ", tolerance: 2 }).status).toBe("wrong");
  });

  it("spots a prefix slip: 0.015 in a mA box", () => {
    const g = gradeNumeric("0.015", ma);
    expect(g).toMatchObject({ status: "prefix", digits: "0.015", typedUnit: "mA", rightUnit: "A", inBoxUnit: "15\u00a0mA", explicit: false });
  });

  it("spots a prefix slip in ohms: 4.7 in an ohm box", () => {
    expect(gradeNumeric("4.7", { answer: 4700, unit: "Ω", tolerance: 1 })).toMatchObject({ status: "prefix", rightUnit: "kΩ", inBoxUnit: "4700\u00a0Ω" });
  });

  it("spots an explicit wrong prefix: 15 A for 15 mA", () => {
    expect(gradeNumeric("15 A", ma)).toMatchObject({ status: "prefix", explicit: true, typedUnit: "A", rightUnit: "mA" });
  });

  it("flags a different quantity and a decimal slip", () => {
    expect(gradeNumeric("15 V", ma)).toEqual({ status: "wrong-unit", got: "V", want: "A" });
    expect(gradeNumeric("1.5", ma)).toMatchObject({ status: "wrong", factor10: true });
  });

  it("reports unparseable input", () => {
    expect(gradeNumeric("", ma)).toEqual({ status: "invalid", reason: "empty" });
    expect(gradeNumeric("fifteen", ma)).toEqual({ status: "invalid", reason: "format" });
  });
});
