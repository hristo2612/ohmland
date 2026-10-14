import { describe, expect, it } from "vitest";
import { PIECES, THEMES, themeOf } from "../../../../packages/isle/src/catalog";
import { ISLE_PIECES } from "./isle-pieces";
import { loadCourse } from "./load";

describe("island pieces", () => {
  it("matches the island catalog", () => {
    expect([...ISLE_PIECES].sort()).toEqual([...PIECES].sort());
  });

  it("draws each unit's island in the theme the unit names, when the island has that theme", () => {
    const drawn = new Set<string>(THEMES);
    const units = loadCourse().units.filter((u) => drawn.has(u.isle.theme));
    expect(units.map((u) => u.id)).toContain("start-here");
    for (const u of units) expect(themeOf(u.id), u.id).toBe(u.isle.theme);
  });
});
