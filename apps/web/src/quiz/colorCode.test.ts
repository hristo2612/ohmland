import { describe, expect, it } from "vitest";
import { bandsForOhms, canWriteWithBands, ohmsForBands, type BandColor } from "./colorCode";

describe("bandsForOhms", () => {
  it.each([
    [4700, ["yellow", "violet", "red", "gold"]],
    [470, ["yellow", "violet", "brown", "gold"]],
    [220, ["red", "red", "brown", "gold"]],
    [10_000, ["brown", "black", "orange", "gold"]],
    [1_000_000, ["brown", "black", "green", "gold"]],
    [10, ["brown", "black", "black", "gold"]],
    [4.7, ["yellow", "violet", "gold", "gold"]],
    [1, ["brown", "black", "gold", "gold"]],
    [0.47, ["yellow", "violet", "silver", "gold"]],
  ] as [number, BandColor[]][])("%d Ω (4 bands)", (ohms, bands) => {
    expect(bandsForOhms(ohms, 4)).toEqual(bands);
  });

  it("writes five-band values with three digits", () => {
    expect(bandsForOhms(4750, 5, "brown")).toEqual(["yellow", "violet", "green", "brown", "brown"]);
    expect(bandsForOhms(100, 5, "brown")).toEqual(["brown", "black", "black", "black", "brown"]);
  });

  it("refuses values that need more digits than the bands hold", () => {
    expect(bandsForOhms(4750, 4)).toBeNull();
    expect(canWriteWithBands(4750, 4)).toBe(false);
    expect(canWriteWithBands(4750, 5)).toBe(true);
    expect(bandsForOhms(0, 4)).toBeNull();
    expect(bandsForOhms(0.001, 4)).toBeNull();
  });
});

describe("ohmsForBands", () => {
  it("reads digits and the multiplier, with or without a tolerance band", () => {
    expect(ohmsForBands(["yellow", "violet", "red", "gold"])).toBe(4700);
    expect(ohmsForBands(["yellow", "violet", "red"])).toBe(4700);
    expect(ohmsForBands(["yellow", "violet", "gold", "gold"])).toBe(4.7);
    expect(ohmsForBands(["yellow", "violet", "silver"])).toBe(0.47);
    expect(ohmsForBands(["brown", "black", "black", "red", "brown"], 5)).toBe(10_000);
  });

  it("rejects gold or silver as a digit, and wrong band counts", () => {
    expect(ohmsForBands(["gold", "violet", "red", "gold"])).toBeNull();
    expect(ohmsForBands(["yellow", "violet"])).toBeNull();
  });

  it("round-trips every E12 value from 1 Ω to 8.2 MΩ", () => {
    const e12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
    for (let exp = -1; exp <= 5; exp++)
      for (const base of e12) {
        const ohms = Number((base * 10 ** exp).toPrecision(6));
        const bands = bandsForOhms(ohms, 4);
        expect(bands, `${ohms}`).not.toBeNull();
        expect(ohmsForBands(bands as BandColor[])).toBe(ohms);
      }
  });
});
