/** Answer panels: the pin map must reject wrong maps (the replays only prove right ones pass), and the hole hunt's net. */
import { describe, expect, it } from "vitest";
import { emptyBench, type PlacedPart } from "@ohmland/bench/core";
import type { PanelConfig } from "./define";
import { emptyPanel, holeNet, pinMapRight, submitPanel } from "./panels";

const dpdt = (mystery?: string): PlacedPart => ({ id: "SW", kind: "dpdt-switch", params: { to: "a", ...(mystery ? { mystery } : {}) }, pos: [0, 0], rot: 0 });

const map: Extract<PanelConfig, { kind: "pin-map" }> = {
  kind: "pin-map",
  id: "legs",
  part: "SW",
  roles: [
    { id: "pole-a", label: "Pole A", legs: ["com1"] },
    { id: "throw-a", label: "Throw of A", legs: ["a1", "b1"] },
    { id: "pole-b", label: "Pole B", legs: ["com2"] },
    { id: "throw-b", label: "Throw of B", legs: ["a2", "b2"] },
  ],
  swap: [
    ["pole-a", "throw-a"],
    ["pole-b", "throw-b"],
  ],
};

describe("pin map", () => {
  // Terminals a1 com1 b1 a2 com2 b2 are wired inside as a2, com1, b2, a1, com2, b1.
  const part = dpdt("315042");
  const right = { a1: "throw-b", com1: "pole-a", b1: "throw-b", a2: "throw-a", com2: "pole-b", b2: "throw-a" };

  it("accepts the right map, and the same map with the two poles' names swapped", () => {
    expect(pinMapRight(map, part, right)).toBe(true);
    const swapped = Object.fromEntries(Object.entries(right).map(([k, v]) => [k, v.endsWith("-a") ? v.replace("-a", "-b") : v.replace("-b", "-a")]));
    expect(pinMapRight(map, part, swapped)).toBe(true);
  });

  it("rejects a throw given to the wrong pole, a missing leg, and a pole mixed up with a throw", () => {
    expect(pinMapRight(map, part, { ...right, b1: "throw-a" })).toBe(false);
    const { a1: _a1, ...missing } = right;
    expect(pinMapRight(map, part, missing)).toBe(false);
    expect(pinMapRight(map, part, { ...right, a1: "pole-b", com2: "throw-b" })).toBe(false);
  });

  it("counts wrong submissions", () => {
    const bench = { ...emptyBench(null), parts: [part] };
    let state = submitPanel(map, emptyPanel(), { ...right, b1: "throw-a" }, bench);
    state = submitPanel(map, state, right, bench);
    expect(state).toMatchObject({ submissions: 2, wrong: 1, correct: true });
  });
});

describe("hole hunt", () => {
  it("is the five holes of the strip, which stops at the channel", () => {
    expect(holeNet(emptyBench(), "a12").sort()).toEqual(["a12", "b12", "c12", "d12", "e12"]);
    expect(holeNet(emptyBench(), "f12")).not.toContain("e12");
  });
});
