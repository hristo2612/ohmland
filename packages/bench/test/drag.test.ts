import { describe, expect, it } from "vitest";
import { boardOrigin } from "../src/board";
import { mergeLabels } from "../src/labels";
import * as ops from "../src/ops";
import { DRAG, dragMarks, edgeVelocity, landed, partMisfit } from "../src/view/drag";

describe("drag and drop", () => {
  it("pans toward an edge only inside its band, faster nearer, and never at an edge the tray covers", () => {
    expect(edgeVelocity(500, 300, 1000, 600)).toEqual([0, 0]);
    const [near] = edgeVelocity(1000 - 4, 300, 1000, 600);
    const [far] = edgeVelocity(1000 - DRAG.edge + 4, 300, 1000, 600);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(edgeVelocity(10, 590, 1000, 600)[0]).toBeLessThan(0);
    expect(edgeVelocity(10, 590, 1000, 600)[1]).toBeGreaterThan(0);
    expect(edgeVelocity(10, 590, 1000, 600, { left: 186, bottom: 94 })).toEqual([0, 0]);
  });

  it("marks the holes a part would take, names them, and crosses a spot on the board where it fits nowhere", () => {
    const labels = mergeLabels();
    const project = (a: string) => ({ x: a.length, y: 0 });
    const [b0, id] = ops.addPart(ops.emptyBench(), "resistor", { ohms: 470 }, { pos: [0, 0] });
    const [ox, oz] = boardOrigin(b0.board!);
    const inHoles = ops.movePart(b0, id, [ox, oz + 4], { seat: false });
    const m = dragMarks(inHoles, { kind: "part", id }, { snap: null, hot: { x: 0, y: 0 }, invalid: partMisfit(inHoles, id, [ox, oz + 4]), project, labels });
    expect(m.ghosts).toHaveLength(2);
    expect(m.cross).toBeNull();
    expect(m.name?.text).toMatch(/^[a-j]\d+ to [a-j]\d+$/);
    expect(landed(inHoles, { kind: "part", id }, null)).toBe(true);

    // Over the board but in no holes (none free there): lying on top of the board would not take.
    const lying = { ...b0, parts: b0.parts.map((p) => (p.id === id ? { ...p, pos: [ox, oz] as [number, number], holes: undefined } : p)) };
    expect(partMisfit(lying, id, [ox, oz])).toBe(true);
    expect(partMisfit(lying, id, [ox, oz + 200])).toBe(false);
  });
});
