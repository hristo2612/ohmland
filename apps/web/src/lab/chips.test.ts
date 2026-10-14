/** Chips on the bench: pins by number and name, how a chip sits on the board, logic levels, the 555 map's blocks. */
import { describe, expect, it } from "vitest";
import { emptyBench, holeWorld, type BenchState, type PlacedPart } from "@ohmland/bench/core";
import { blocks555, chipInfo, chipPinRef, chipSeat, gatesOf, latchNamed, levelOf, mapComplete, pinCode, pinNumber } from "./chips";
import { applyStep } from "./steps";

/** A chip as the bench will place it: a model and its legs in holes (leg names "1" to "8", or datasheet names). */
const chip = (id: string, model: string, holes: Record<string, string>): PlacedPart => ({ id, kind: "chip", params: { model }, pos: [0, 0], rot: 0, holes }) as unknown as PlacedPart;

/** Holes for a DIP-n with pin 1 at row e, column c, notch left (pins 1 to n/2 along e, the rest back along f). */
function across(c: number, n = 8): Record<string, string> {
  const out: Record<string, string> = {};
  for (let k = 1; k <= n / 2; k++) out[String(k)] = `e${c + k - 1}`;
  for (let k = n / 2 + 1; k <= n; k++) out[String(k)] = `f${c + n - k}`;
  return out;
}

const benchWith = (...parts: PlacedPart[]): BenchState => ({ ...emptyBench({ kind: "bb400" }), parts });

describe("pins by number and name", () => {
  const t555 = chipInfo("555")!;
  const and = chipInfo("74HC08")!;
  it("reads a 555's pins by number, simulator name or the lessons' words", () => {
    expect([pinNumber(t555, 6), pinNumber(t555, "6"), pinNumber(t555, "thresh"), pinNumber(t555, "threshold")]).toEqual([6, 6, 6, 6]);
    expect([pinNumber(t555, "trigger"), pinNumber(t555, "plus"), pinNumber(t555, "minus"), pinNumber(t555, "drain")]).toEqual([2, 8, 1, 7]);
    expect(pinNumber(t555, 9)).toBeNull();
    expect(pinNumber(t555, "volume")).toBeNull();
  });

  it("reads logic pins by datasheet name, either way round, and the supply by word", () => {
    expect([pinNumber(and, "1A"), pinNumber(and, "a1"), pinNumber(and, "1Y"), pinNumber(and, "4B")]).toEqual([1, 1, 3, 13]);
    expect([pinNumber(and, "plus"), pinNumber(and, "gnd")]).toEqual([14, 7]);
    const counter = chipInfo("4026B")!;
    expect([pinNumber(counter, "CO"), pinNumber(counter, "inh"), pinNumber(counter, "plus")]).toEqual([5, 2, 16]);
    expect(pinNumber(chipInfo("74HC393")!, "1QA")).toBe(3);
    // The 02 has its outputs first: 1Y is pin 1.
    expect(pinNumber(chipInfo("74HC02")!, "1Y")).toBe(1);
    expect([pinCode(and, 1), pinCode(and, 3), pinCode(and, 14)]).toEqual(["1A", "1Y", "VCC"]);
  });

  it("knows the models by their usual names, and nothing else", () => {
    expect(chipInfo("NE555")?.model).toBe("555");
    expect(chipInfo("555-cmos")?.model).toBe("555-cmos");
    expect(chipInfo("74hc32")?.model).toBe("74HC32");
    expect(chipInfo("resistor")).toBeNull();
  });

  it("turns 'U1.trig' and 'DM1.CO' into chip pins, from the bench or the netlist, and leaves other attach points alone", () => {
    const bench = benchWith(chip("U1", "555", across(12)));
    expect(chipPinRef("U1.trig", bench, null)).toMatchObject({ id: "U1", n: 2 });
    expect(chipPinRef("pin:U1.8", bench, null)).toMatchObject({ id: "U1", n: 8 });
    const net = { parts: [{ id: "DM1", kind: "logic", model: "4026B", pins: {} }] } as never;
    expect(chipPinRef("DM1.CO", emptyBench(null), net)).toMatchObject({ id: "DM1", n: 5 });
    expect(chipPinRef("R1.a", bench, null)).toBeNull();
    expect(chipPinRef("U1.nothing", bench, null)).toBeNull();
  });
});

describe("chipSeat", () => {
  it("a chip across the channel, notch left: straddles, pin 1 left, not turned, its columns", () => {
    const s = chipSeat(benchWith(chip("U1", "555", across(12))), "U1")!;
    expect(s).toMatchObject({ seated: true, straddles: true, pin1: "left", turned: false, columns: [12, 15], oneSide: false, shorted: [] });
    expect(s.holes[1]).toBe("e12");
    expect(s.holes[8]).toBe("f12");
  });

  it("turned round: pin 1 on the far side at the right end", () => {
    const holes: Record<string, string> = {};
    for (let k = 1; k <= 4; k++) holes[String(k)] = `f${16 - k}`;
    for (let k = 5; k <= 8; k++) holes[String(k)] = `e${k + 7}`;
    expect(chipSeat(benchWith(chip("U1", "555", holes)), "U1")).toMatchObject({ straddles: true, pin1: "right", turned: true });
  });

  it("all on one side of the channel: pins facing each other share strips", () => {
    const holes: Record<string, string> = {};
    for (let k = 1; k <= 4; k++) holes[String(k)] = `e${11 + k}`;
    for (let k = 5; k <= 8; k++) holes[String(k)] = `b${20 - k}`;
    const s = chipSeat(benchWith(chip("U2", "555", holes)), "U2")!;
    expect(s).toMatchObject({ seated: true, straddles: false, oneSide: true });
    expect(s.shorted).toContainEqual([1, 8]);
    expect(s.shorted).toHaveLength(4);
  });

  it("works with legs named by the datasheet, a DIP-14, and says null off the board or for other parts", () => {
    const names = ["gnd", "trig", "out", "reset", "ctrl", "thresh", "dis", "vcc"];
    const byName = Object.fromEntries(Object.entries(across(5)).map(([n, h]) => [names[Number(n) - 1]!, h]));
    expect(chipSeat(benchWith(chip("U1", "555", byName)), "U1")).toMatchObject({ straddles: true, pin1: "left", columns: [5, 8] });
    expect(chipSeat(benchWith(chip("U3", "74HC08", across(3, 14))), "U3")).toMatchObject({ straddles: true, columns: [3, 9] });
    const half = Object.fromEntries(Object.entries(across(12)).slice(0, 3));
    expect(chipSeat(benchWith(chip("U1", "555", half)), "U1")).toMatchObject({ seated: false, straddles: false });
    expect(chipSeat(benchWith(chip("U1", "555", {})), "U1")).toBeNull();
    expect(chipSeat({ ...benchWith(chip("U1", "555", across(12))), board: null }, "U1")).toBeNull();
  });
});

describe("logic levels and the 555 map", () => {
  it("levels by 30% and 70% of the supply; Z without power", () => {
    expect([levelOf(0.2, 5), levelOf(4.9, 5), levelOf(2.5, 5), levelOf(1, 0), levelOf(undefined, 5)]).toEqual(["L", "H", "X", "Z", "Z"]);
  });

  it("each lesson's pins bring in their blocks; the latch is named with pin 4; all eight complete the map", () => {
    expect([...blocks555([1, 8])]).toEqual(["rails"]);
    expect(blocks555([1, 8, 2, 3])).toEqual(new Set(["rails", "low", "latch", "output"]));
    expect(blocks555([6, 7])).toEqual(new Set(["high", "latch", "drain"]));
    expect(blocks555([5]).has("ladder")).toBe(true);
    expect(latchNamed([1, 2, 3])).toBe(false);
    expect(latchNamed([4])).toBe(true);
    expect(mapComplete([1, 2, 3, 4, 6, 7, 8])).toBe(false);
    expect(mapComplete([8, 7, 6, 5, 4, 3, 2, 1])).toBe(true);
  });

  it("finds which gate is which on gate chips (and none on counters)", () => {
    expect(gatesOf(chipInfo("74HC08")!)).toEqual([
      { kind: "and", inputs: [1, 2], output: 3, n: 1 },
      { kind: "and", inputs: [4, 5], output: 6, n: 2 },
      { kind: "and", inputs: [9, 10], output: 8, n: 3 },
      { kind: "and", inputs: [12, 13], output: 11, n: 4 },
    ]);
    expect(gatesOf(chipInfo("74HC02")!)[0]).toMatchObject({ kind: "nor", inputs: [2, 3], output: 1 });
    expect(gatesOf(chipInfo("74HC27")!)[0]).toMatchObject({ kind: "nor", inputs: [1, 2, 13], output: 12 });
    expect(gatesOf(chipInfo("74HC04")!)).toHaveLength(6);
    expect(gatesOf(chipInfo("74HC393")!)).toEqual([]);
  });
});

describe("the logic probe in solution steps", () => {
  const board = { kind: "bb830" } as const;
  const probe = { id: "LP1", kind: "logic-probe", params: {}, pos: [96, 10], rot: 0, holes: { vcc: "bp57", gnd: "bn58" } } as unknown as PlacedPart;
  const lp = (b: BenchState) => b.parts.find((p) => p.id === "LP1")!;
  const at = (hole: string) => [...holeWorld(board, hole)!];

  it("stands the pen at its tip's hole, as a drag does, never off beside the board", () => {
    const b = applyStep({ ...emptyBench(board), parts: [probe] }, { do: "move", part: "LP1", at: "a22-bp57-bn58" }).bench;
    expect(lp(b).holes).toEqual({ tip: "a22", vcc: "bp57", gnd: "bn58" });
    expect(lp(b).pos).toEqual(at("a22"));
    // A single hole is the tip alone: the supply leads come out (a fix-it's unplugged probe).
    expect(lp(applyStep(b, { do: "move", part: "LP1", at: "a30" }).bench).holes).toEqual({ tip: "a30" });
  });

  it("moves only the named leads with `holes`, and lays a pulled pen in front of the board", () => {
    const b = applyStep({ ...emptyBench(board), parts: [probe] }, { do: "move", part: "LP1", at: "a22-bp57-bn58" }).bench;
    const moved = applyStep(b, { do: "move", part: "LP1", holes: { tip: "a30" } }).bench;
    expect(lp(moved).holes).toEqual({ tip: "a30", vcc: "bp57", gnd: "bn58" });
    expect(lp(moved).pos).toEqual(at("a30"));
    const out = applyStep(moved, { do: "move", part: "LP1", holes: { tip: null } }).bench;
    expect(lp(out).holes).toEqual({ vcc: "bp57", gnd: "bn58" });
    expect(lp(out).pos[0]).toBeCloseTo(at("a30")[0]!);
    expect(lp(out).pos[1]).toBeGreaterThan(27.3);
    expect(applyStep(b, { do: "move", part: "LP1", holes: { nose: "a30" } }).problem).toMatch(/no lead/);
  });
});
