// The iron and the joint-quality model against the calibration targets of docs/curriculum/unit-3.md (3.4, 3.5, 7.8).

import { describe, expect, it } from "vitest";
import { ALLOYS, FEED_RATE, type Alloy } from "../src/solder/alloys";
import { IRON, feedTip, freshIron, stepIron, takeBead, tinFactor, wipeTip, type IronState, type Tinning } from "../src/solder/iron";
import { contactOhms, judge, jointElectric, jointLook, newJoint, stepJoint, tugResult, verdictOf, type Joint, type Verdict, type WorkKind } from "../src/solder/joint";
import { madeJoint } from "../src/solder/station";

const DT = 0.02;

/** A small bench: an iron at its working heat and one joint. Scripted: rest the iron, feed, lift, tug. */
class Rig {
  iron: IronState;
  joint: Joint;
  t = 0;
  on = true;
  resting = false;
  feeding = false;
  braid = false;
  constructor(
    kind: WorkKind,
    public setC = 330,
    public alloy: Alloy = "leaded",
    tinning: Tinning = "tinned",
    public neighbours: string[] = [],
  ) {
    this.iron = freshIron(tinning, setC);
    this.joint = newJoint(kind);
  }
  step(seconds: number, opts: { moved?: boolean; bead?: boolean } = {}) {
    const end = this.t + seconds;
    let bead = opts.bead ?? false;
    while (this.t < end - 1e-9) {
      let landing = null;
      if (bead && this.resting) {
        const taken = takeBead(this.iron);
        this.iron = taken.iron;
        landing = { mm3: taken.mm3, flux: taken.flux, alloy: taken.alloy };
        bead = false;
      }
      const r = stepJoint(this.joint, DT, {
        tipC: this.resting ? this.iron.tipC : null,
        tin: tinFactor(this.iron.tinning),
        feed: this.feeding ? FEED_RATE * DT : 0,
        alloy: this.alloy,
        bead: landing,
        braid: this.braid,
        neighbours: this.neighbours,
        moved: opts.moved ?? false,
      });
      this.joint = r.joint;
      this.iron = stepIron(this.iron, DT, this.on, this.setC, this.resting ? [{ g: r.contact, tempC: this.joint.tempC }] : []);
      this.t += DT;
    }
    return this;
  }
  /** Seconds until a condition holds (or Infinity within `max`). */
  until(cond: (r: Rig) => boolean, max = 30): number {
    const t0 = this.t;
    while (!cond(this) && this.t - t0 < max) this.step(DT);
    return cond(this) ? this.t - t0 : Infinity;
  }
}

const melt = (a: Alloy) => ALLOYS[a].liquidus;

describe("the iron", () => {
  it("warms to 330 °C in about 20 s and holds it", () => {
    let s = freshIron("tinned", 25);
    let t = 0;
    while (s.tipC < 320 && t < 60) {
      s = stepIron(s, DT, true, 330);
      t += DT;
    }
    expect(t).toBeGreaterThan(15);
    expect(t).toBeLessThan(25);
    for (let k = 0; k < 2000; k++) s = stepIron(s, DT, true, 330);
    expect(Math.abs(s.tipC - 330)).toBeLessThan(3);
  });

  it("switched off, it is still above 200 °C after a minute and below 50 °C after about 8 minutes", () => {
    let s = freshIron("tinned", 330);
    for (let k = 0; k < 60 / DT; k++) s = stepIron(s, DT, false, 330);
    expect(s.tipC).toBeGreaterThan(200);
    for (let k = 0; k < (8 * 60 - 60) / DT; k++) s = stepIron(s, DT, false, 330);
    expect(s.tipC).toBeLessThan(50);
    expect(s.tipC).toBeGreaterThan(25);
  });

  it("dips 60 to 100 °C on a big copper bar and recovers within 5 s of lifting", () => {
    let s = freshIron("tinned", 330);
    let bar = 25;
    let low = 330;
    for (let k = 0; k < 10 / DT; k++) {
      const g = 0.3;
      const q = g * (s.tipC - bar);
      s = stepIron(s, DT, true, 330, [{ g, tempC: bar }]);
      bar += (q / 34.5) * DT;
      low = Math.min(low, s.tipC);
    }
    expect(330 - low).toBeGreaterThan(60);
    expect(330 - low).toBeLessThan(100);
    let t = 0;
    while (s.tipC < 320 && t < 10) {
      s = stepIron(s, DT, true, 330);
      t += DT;
    }
    expect(t).toBeLessThan(5);
  });

  it("a bead on the tip loses its flux in about 2 s; a hot dry tip oxidises; the brass wool cleans it", () => {
    let s = feedTip(freshIron("tinned", 330), 3, "leaded");
    expect(s.beadFlux).toBeCloseTo(1);
    for (let k = 0; k < 2 / DT; k++) s = stepIron(s, DT, true, 330);
    expect(s.beadFlux).toBeLessThan(0.1);
    let dry = wipeTip(s);
    for (let k = 0; k < (IRON.oxidiseAfter + 5) / DT; k++) dry = stepIron(dry, DT, true, 330);
    expect(dry.tinning).toBe("oxidised");
    // An oxidised tip will not take solder until it is wiped.
    expect(feedTip(dry, 1, "leaded").bead).toBe(0);
    expect(feedTip(wipeTip(dry), 1, "leaded").tinning).toBe("tinned");
  });
});

describe("the joint: heat the work, and the work melts the solder", () => {
  it("a crossed pair under a tinned tip at 330 °C reaches 183 °C in 2 to 3 s", () => {
    const r = new Rig("crossed");
    r.resting = true;
    const t = r.until((x) => x.joint.tempC >= 183);
    expect(t).toBeGreaterThan(2);
    expect(t).toBeLessThan(3);
  });

  it("solder fed at the hot work wets it fully 1 to 2 s later; a good joint in 3 to 5 s in all", () => {
    const r = new Rig("crossed");
    r.resting = true;
    const tMelt = r.until((x) => x.joint.tempC >= melt("leaded"));
    r.feeding = true;
    const tWet = r.until((x) => x.joint.wetted >= 0.8, 5);
    expect(tWet).toBeGreaterThan(1);
    expect(tWet).toBeLessThan(2);
    r.feeding = false;
    r.step(0.4);
    r.resting = false;
    expect(tMelt + tWet + 0.4).toBeGreaterThan(3);
    expect(tMelt + tWet + 0.4).toBeLessThan(5);
    r.until((x) => x.joint.phase === "set", 10);
    expect(r.joint.verdict).toBe("good");
    expect(r.joint.fedAt).toBe("work");
    expect(tugResult(r.joint)).toBe("held");
    expect(contactOhms(jointElectric(r.joint), true)).toBeLessThan(0.01);
    expect(jointLook(r.joint)).toMatchObject({ shape: "volcano", finish: "bright" });
  });

  it("a leg through a pad melts in 1 to 2 s and makes a good joint in 2 to 4 s", () => {
    const r = new Rig("pad");
    r.resting = true;
    const tMelt = r.until((x) => x.joint.tempC >= melt("leaded"));
    expect(tMelt).toBeGreaterThan(1);
    expect(tMelt).toBeLessThan(2);
    r.feeding = true;
    r.step(1);
    r.feeding = false;
    r.step(0.3);
    r.resting = false;
    r.until((x) => x.joint.phase === "set", 10);
    expect(r.joint.verdict).toBe("good");
  });

  it("lead-free at 370 °C is about 20% slower to melt than leaded at 330 °C, and sets satin", () => {
    const lead = new Rig("crossed", 330, "leaded");
    lead.resting = true;
    const tl = lead.until((x) => x.joint.tempC >= melt("leaded"));
    const free = new Rig("crossed", 370, "lead-free");
    free.resting = true;
    const tf = free.until((x) => x.joint.tempC >= melt("lead-free"));
    expect(tf / tl).toBeGreaterThan(1.1);
    expect(tf / tl).toBeLessThan(1.3);
    free.feeding = true;
    free.step(1.6);
    free.feeding = false;
    free.step(0.4);
    free.resting = false;
    free.until((x) => x.joint.phase === "set", 10);
    expect(free.joint.verdict).toBe("good");
    expect(jointLook(free.joint).finish).toBe("satin");
  });

  it("an oxidised tip never melts solder on the crossed pair within 15 s", () => {
    const r = new Rig("crossed", 330, "leaded", "oxidised");
    r.resting = true;
    r.step(15);
    expect(r.joint.tempC).toBeLessThan(melt("leaded"));
  });

  it("two 14 AWG wires take 8 to 12 s to reach the melt", () => {
    const r = new Rig("heavy");
    r.resting = true;
    const t = r.until((x) => x.joint.tempC >= melt("leaded"), 20);
    expect(t).toBeGreaterThan(8);
    expect(t).toBeLessThan(12);
  });

  it("solder held to cold work does nothing", () => {
    const r = new Rig("crossed");
    r.feeding = true;
    r.step(1);
    expect(r.joint.volume).toBe(0);
    expect(r.joint.coldTouch).toBe(true);
  });
});

describe("the joint: what goes wrong", () => {
  it("a bead carried on the tip for 3 s and dabbed on cold wires balls up: cold, and it pops off", () => {
    const r = new Rig("crossed");
    r.iron = feedTip(r.iron, 3, "leaded");
    r.step(3);
    expect(r.iron.beadFlux).toBeLessThan(0.1);
    r.resting = true;
    r.step(0.3, { bead: true });
    r.resting = false;
    r.until((x) => x.joint.phase === "set", 10);
    expect(r.joint.fedAt).toBe("tip");
    expect(r.joint.verdict).toBe("cold");
    expect(r.joint.wetted).toBeLessThan(0.4);
    expect(tugResult(r.joint)).toBe("pulled");
    expect(jointLook(r.joint)).toMatchObject({ shape: "lump", gap: true });
  });

  it("lifting the iron the moment the solder touches leaves a cold joint that comes and goes", () => {
    const r = new Rig("pad");
    r.resting = true;
    r.until((x) => x.joint.tempC >= melt("leaded"));
    r.feeding = true;
    r.step(0.2);
    r.feeding = false;
    r.resting = false;
    r.until((x) => x.joint.phase === "set", 10);
    expect(r.joint.verdict).toBe("cold");
    const e = jointElectric(r.joint);
    expect(e.intermittent).toBe(true);
    expect(contactOhms(e, false)).toBeLessThan(30);
    expect(contactOhms(e, true)).toBe(Infinity);
    expect(tugResult(r.joint)).toBe("loose");
  });

  it("a tug while it sets gives a disturbed joint; reheating heals it", () => {
    const r = new Rig("crossed");
    r.resting = true;
    r.until((x) => x.joint.tempC >= melt("leaded"));
    r.feeding = true;
    r.step(1.5);
    r.feeding = false;
    r.step(0.4);
    r.resting = false;
    r.until((x) => x.joint.setting > 0, 10);
    r.step(DT, { moved: true });
    r.until((x) => x.joint.phase === "set", 10);
    expect(r.joint.verdict).toBe("disturbed");
    expect(jointLook(r.joint).shape).toBe("frosty");
    // Reheat with a touch of fresh solder, hold still.
    r.resting = true;
    r.until((x) => x.joint.phase === "molten");
    r.feeding = true;
    r.step(0.3);
    r.feeding = false;
    r.step(0.8);
    r.resting = false;
    r.until((x) => x.joint.phase === "set", 10);
    expect(r.joint.verdict).toBe("good");
  });

  it("too little and too much, and 4 s of extra feed on a pad bridges to its neighbour", () => {
    const thin = new Rig("pad");
    thin.resting = true;
    thin.until((x) => x.joint.tempC >= 230);
    thin.feeding = true;
    thin.step(0.35);
    thin.feeding = false;
    thin.step(1);
    thin.resting = false;
    thin.until((x) => x.joint.phase === "set", 10);
    expect(thin.joint.verdict).toBe("too-little");
    expect(jointLook(thin.joint).shape).toBe("ring");

    const ball = new Rig("pad", 330, "leaded", "tinned", []);
    ball.resting = true;
    ball.until((x) => x.joint.tempC >= 230);
    ball.feeding = true;
    ball.step(2.4);
    ball.feeding = false;
    ball.step(0.4);
    ball.resting = false;
    ball.until((x) => x.joint.phase === "set", 10);
    expect(ball.joint.verdict).toBe("too-much");
    expect(jointLook(ball.joint).shape).toBe("ball");

    const bridged = new Rig("pad", 330, "leaded", "tinned", ["B5"]);
    bridged.resting = true;
    bridged.until((x) => x.joint.tempC >= 230);
    bridged.feeding = true;
    bridged.step(1 + 4);
    bridged.feeding = false;
    bridged.resting = false;
    bridged.until((x) => x.joint.phase === "set", 10);
    expect(bridged.joint.verdict).toBe("bridge");
    expect(bridged.joint.bridgeTo).toBe("B5");
  });

  it("braid with the iron on it for 3 s turns a ball into a good joint and breaks a bridge", () => {
    const r = new Rig("pad", 330, "leaded", "tinned", ["B5"]);
    r.resting = true;
    r.until((x) => x.joint.tempC >= 230);
    r.feeding = true;
    r.step(5);
    r.feeding = false;
    r.resting = false;
    r.until((x) => x.joint.phase === "set", 10);
    expect(r.joint.verdict).toBe("bridge");
    r.braid = true;
    r.resting = true;
    r.step(3);
    r.braid = false;
    r.resting = false;
    r.until((x) => x.joint.phase === "set", 10);
    expect(r.joint.bridgeTo).toBeNull();
    expect(["good", "too-little"]).toContain(r.joint.verdict);
  });

  it("held on far too long the joint burns and the pad lifts", () => {
    const r = new Rig("pad");
    r.resting = true;
    r.until((x) => x.joint.tempC >= melt("leaded"));
    r.feeding = true;
    r.step(1);
    r.feeding = false;
    r.step(18);
    r.resting = false;
    r.until((x) => x.joint.phase === "set", 10);
    expect(r.joint.verdict).toBe("burnt");
    expect(r.joint.lifted).toBe(true);
    expect(jointElectric(r.joint).open).toBe(true);
    expect(jointLook(r.joint).finish).toBe("dark");
  });

  it("molten joints read live, and a bare one is none of these", () => {
    const r = new Rig("pad");
    expect(verdictOf(r.joint)).toBeNull();
    expect(tugResult(r.joint)).toBe("pulled");
    r.resting = true;
    r.until((x) => x.joint.tempC >= 230);
    r.feeding = true;
    r.step(0.5);
    expect(r.joint.phase).toBe("molten");
    expect(jointLook(r.joint).molten).toBe(true);
  });
});

describe("madeJoint (lab setups)", () => {
  it("makes a record the model judges the way it says, for every verdict", () => {
    const all: Verdict[] = ["good", "cold", "disturbed", "too-much", "too-little", "bridge", "burnt"];
    for (const alloy of ["leaded", "lead-free"] as Alloy[]) {
      for (const v of all) {
        const rec = madeJoint(v, { alloy, bridgeTo: "C8" });
        expect(judge({ ...newJoint("pad"), ...rec, phase: "set" }), `${alloy} ${v}`).toBe(v);
      }
    }
  });
});
