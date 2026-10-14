import { describe, expect, it } from "vitest";
import { createControllerHub, type BenchController } from "../src/view/controller";
import { meterSpot, parseTarget, targetPoint } from "../src/view/targets";
import { focalTargets, frameWithParts, needsReading } from "../src/view/framing";
import { addLead, addPart, clipLead, defaultMeter, emptyBench } from "../src/ops";
import { anchorPosition } from "../src/layout";

function fakeController(log: string[]): BenchController & { fire(): void } {
  const subs = new Set<() => void>();
  return {
    project: (a) => ({ x: a.length, y: 0, visible: true }),
    onViewChange: (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    focus: (t, o) => log.push(`focus ${t.join(",")} ${o?.instant ? "instant" : "smooth"}`),
    spotlight: (t) => log.push(`spot ${t ? t.join(",") : "none"}`),
    fire: () => subs.forEach((cb) => cb()),
  };
}

describe("controller hub", () => {
  it("forwards to the attached view and keeps one subscription across views", () => {
    const hub = createControllerHub();
    let changes = 0;
    hub.onViewChange(() => changes++);
    expect(hub.project("part:R1")).toBeNull();
    const log: string[] = [];
    const a = fakeController(log);
    hub.attach(a);
    expect(changes).toBe(1);
    expect(hub.project("part:R1")).toEqual({ x: 7, y: 0, visible: true });
    a.fire();
    expect(changes).toBe(2);
    const b = fakeController(log);
    hub.attach(b);
    expect(changes).toBe(3);
    a.fire(); // the old view no longer reaches the hub's listeners
    expect(changes).toBe(3);
    b.fire();
    expect(changes).toBe(4);
    expect(hub.inner()).toBe(b);
  });

  it("applies the last spotlight and focus to a view that attaches later", () => {
    const hub = createControllerHub();
    hub.spotlight(["part:D1"]);
    hub.focus(["part:D1", "part:R1"], { padding: 40 });
    const log: string[] = [];
    hub.attach(fakeController(log));
    expect(log).toEqual(["spot part:D1", "focus part:D1,part:R1 instant"]);
    hub.spotlight(null);
    const log2: string[] = [];
    hub.attach(fakeController(log2));
    expect(log2).toEqual(["focus part:D1,part:R1 instant"]);
  });
});

describe("targets", () => {
  it("parses parts, meter spots, whole leads and wires, and plain anchors", () => {
    expect(parseTarget("part:D1")).toEqual({ type: "part", id: "D1", sub: null });
    expect(parseTarget("part:M1/display")).toEqual({ type: "part", id: "M1", sub: "display" });
    expect(parseTarget("lead:TL1")).toEqual({ type: "lead", id: "TL1" });
    expect(parseTarget("wire:W2")).toEqual({ type: "wire", id: "W2" });
    expect(parseTarget("lead:TL1.a")).toEqual({ type: "anchor", anchor: "lead:TL1.a" });
    expect(parseTarget("pin:R1.a")).toEqual({ type: "anchor", anchor: "pin:R1.a" });
    expect(parseTarget("hole:e12")).toEqual({ type: "anchor", anchor: "hole:e12" });
    expect(parseTarget("part:")).toBeNull();
    expect(parseTarget("nonsense")).toBeNull();
  });

  it("places targets without a renderer", () => {
    let b = emptyBench({ kind: "bb830" });
    [b] = addPart(b, "resistor", { ohms: 470 }, { pos: [0, 0], holes: { a: "e10", b: "e14" } }, "R1");
    b = { ...b, meter: defaultMeter([150, 0], 0) };
    let lead: string;
    [b, lead] = addLead(b, "red", [0, 60], "TL1");
    b = clipLead(b, lead, "a", "pin:R1.a");
    b = clipLead(b, lead, "b", "probe:red");
    const pin = anchorPosition(b, "pin:R1.a")!;
    expect(targetPoint(b, "pin:R1.a")).toEqual(pin);
    const r = targetPoint(b, "part:R1")!;
    expect(r[0]).toBeGreaterThan(pin[0]);
    expect(r[1]).toBeGreaterThan(pin[1]);
    // The display is on the far half of the meter, the sockets on the near half.
    const display = meterSpot(b, "display")!;
    const com = meterSpot(b, "com")!;
    expect(display[2]).toBeLessThan(0);
    expect(com[2]).toBeGreaterThan(0);
    expect(targetPoint(b, "part:M1/display")).toEqual(display);
    expect(meterSpot(b, "nowhere")).toBeNull();
    expect(targetPoint(b, "lead:TL1")).not.toBeNull();
    expect(targetPoint(b, "part:X9")).toBeNull();
  });
});

describe("home framing", () => {
  it("takes in a part that pokes out of the lab's frame, not one left mostly outside it", () => {
    const frame: [number, number, number, number] = [-90, -60, 90, 60];
    // A battery drawn a little past the left edge comes in whole; a far meter that only touches the corner does not.
    expect(frameWithParts(frame, [[-110, -20, -50, 30]])).toEqual([-110, -60, 90, 60]);
    expect(frameWithParts(frame, [[80, 40, 260, 200]])).toEqual(frame);
    // Nothing outside the frame changes it.
    expect(frameWithParts(frame, [[200, 0, 260, 40]])).toEqual(frame);
  });
});

describe("reading-scale framing", () => {
  it("comes close only when every target has leads or clip points, and centres on the anchors among them", () => {
    let b = emptyBench({ kind: "bb830" });
    [b] = addPart(b, "resistor", { ohms: 470 }, { pos: [0, 0], holes: { a: "e10", b: "e14" } }, "R1");
    [b] = addPart(b, "chart", {}, { pos: [0, -80] }, "CH1");
    expect(needsReading(b, ["part:R1", "hole:a3", "lead:TL1"])).toBe(true);
    // A chart among the targets is meant to be seen whole.
    expect(needsReading(b, ["part:R1", "part:CH1"])).toBe(false);
    expect(needsReading(b, [])).toBe(false);
    expect(focalTargets(["part:R1", "pin:R1.a", "hole:e3"])).toEqual(["pin:R1.a", "hole:e3"]);
    // A whole lead or wire is aimed at by its first end.
    expect(focalTargets(["lead:TL4", "part:R1"])).toEqual(["lead:TL4.a"]);
    expect(focalTargets(["part:R1", "part:CH1"])).toEqual(["part:R1"]);
  });
});
