import { describe, expect, it } from "vitest";
import { edgeHit, placeNotes, type Rect } from "./noteLayout";

const view = { w: 800, h: 600 };
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe("note layout", () => {
  it("writes a note off the breadboard when the part it is about sits on it", () => {
    const board: Rect = { x0: 200, y0: 200, x1: 600, y1: 400 };
    const [n] = placeNotes([{ id: "n", p: { x: 400, y: 300 }, target: null, w: 180, h: 24 }], [board], view);
    expect(overlaps(n!.box, board)).toBe(false);
  });

  it("keeps two notes about the same spot apart", () => {
    const p = { x: 400, y: 300 };
    const [a, b] = placeNotes(
      [
        { id: "a", p, target: null, w: 200, h: 24 },
        { id: "b", p, target: null, w: 160, h: 24 },
      ],
      [],
      view,
    );
    expect(overlaps(a!.box, b!.box)).toBe(false);
  });

  it("points at a big part's outline, not the empty middle", () => {
    const card: Rect = { x0: 100, y0: 100, x1: 500, y1: 400 };
    expect(edgeHit(card, { x: 300, y: 20 }, { x: 300, y: 250 })).toEqual({ x: 300, y: 100 });
    const [n] = placeNotes([{ id: "n", p: { x: 300, y: 250 }, target: card, w: 200, h: 24 }], [card], view);
    // The arrow's last point is on the card's edge.
    const end = /([\d.]+),([\d.]+)$/.exec(n!.path)!;
    const [x, y] = [Number(end[1]), Number(end[2])];
    const onEdge = Math.min(Math.abs(x - card.x0), Math.abs(x - card.x1), Math.abs(y - card.y0), Math.abs(y - card.y1));
    expect(onEdge).toBeLessThan(4);
  });
});
