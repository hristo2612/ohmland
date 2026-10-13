import { describe, expect, it } from "vitest";
import { PIECES } from "../../../../packages/isle/src/catalog";
import { ISLE_PIECES } from "./isle-pieces";

describe("island pieces", () => {
  it("matches the island catalog", () => {
    expect([...ISLE_PIECES].sort()).toEqual([...PIECES].sort());
  });
});
