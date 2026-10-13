import { describe, expect, it } from "vitest";
import { bandsToOhms, ceramicCode, formatOhms, isPreferredValue, resistorBands } from "../src/colorCode";

describe("resistor colour code", () => {
  it.each([
    [15, ["brown", "green", "black", "gold"]],
    [150, ["brown", "green", "brown", "gold"]],
    [470, ["yellow", "violet", "brown", "gold"]],
    [1000, ["brown", "black", "red", "gold"]],
    [2200, ["red", "red", "red", "gold"]],
    [4700, ["yellow", "violet", "red", "gold"]],
    [33000, ["orange", "orange", "orange", "gold"]],
    [470000, ["yellow", "violet", "yellow", "gold"]],
    [4.7, ["yellow", "violet", "gold", "gold"]],
    [1_000_000, ["brown", "black", "green", "gold"]],
  ])("%s ohms in four bands", (ohms, bands) => {
    expect(resistorBands(ohms)).toEqual(bands);
    expect(bandsToOhms(resistorBands(ohms))).toBe(ohms);
  });

  it("uses three digits and a brown 1% band for five bands", () => {
    expect(resistorBands(4700, 5)).toEqual(["yellow", "violet", "black", "brown", "brown"]);
    expect(resistorBands(1500, 5)).toEqual(["brown", "green", "black", "brown", "brown"]);
    expect(bandsToOhms(resistorBands(10, 5))).toBe(10);
  });

  it("knows the E12 and E24 series", () => {
    expect(isPreferredValue(4700)).toBe(true);
    expect(isPreferredValue(5100)).toBe(false);
    expect(isPreferredValue(5100, 24)).toBe(true);
  });

  it("formats values and ceramic codes", () => {
    expect(formatOhms(470)).toBe("470 Ω");
    expect(formatOhms(4700)).toBe("4.7 kΩ");
    expect(formatOhms(2_200_000)).toBe("2.2 MΩ");
    expect(ceramicCode(100e-9)).toBe("104");
    expect(ceramicCode(10e-9)).toBe("103");
    expect(ceramicCode(47e-9)).toBe("473");
    expect(ceramicCode(22e-12)).toBe("22");
  });
});
