// Params of the Unit 3 part kinds (merged into PartParamsMap). Plain JSON, like every BenchState param.

import type { Vec2, WireColor } from "../types";
import type { Alloy } from "./alloys";
import type { Tinning } from "./iron";
import type { HeatMetal } from "./leadheat";
import type { JointRecord, PerfLink, PlanGhost } from "./perfboard";
import type { TubeSize } from "./shrink";
import type { StripEnd, StripScale, StripTry } from "./strip";

export type SolderParamsMap = {
  /**
   * A temperature-controlled solder station: base with a dial and a display, the iron on its cord, and a stand with
   * a damp sponge and a brass-wool cup. The iron's tip temperature lives in the station engine; where the iron is
   * lives here.
   */
  "solder-station": {
    on: boolean;
    /** Dial setting, 150 to 450 °C. */
    setC: number;
    /** Where the iron is: "stand" (default), a spot ("PB1.B4" a pad, "D1.anode" a lead, "HW1.b" a splice) or "desk". */
    iron?: string;
    /** Where the tip lies when the iron is on the desk (mm). */
    ironAt?: Vec2;
    /** The tip's coat at the start (default tinned). */
    tinning?: Tinning;
    /** The spool in use (a part id), else the first spool on the bench. */
    spool?: string;
  };
  /** A spool of solder wire with its label. */
  "solder-spool": { alloy: Alloy };
  /** Desoldering braid on a little spool; `used` is how much of its end has silvered (0 to 1). */
  "solder-braid": { used?: number };
  /** Pad-per-hole perfboard. See src/solder/perfboard.ts. */
  perfboard: {
    cols: number;
    rows: number;
    /** Copper side up: left becomes right. */
    flipped?: boolean;
    /** Legs that meet conduct without solder (the robot solders them later). */
    tack?: boolean;
    /** The board is being pressed: intermittent joints open. */
    flexed?: boolean;
    /** Joints by pad, as they last set. */
    joints?: Partial<Record<string, JointRecord>>;
    /** Legs bent along the underside: "R1.a" -> the pad its end lies on. */
    bends?: Partial<Record<string, string>>;
    /** Wire links pad to pad underneath. */
    links?: PerfLink[];
    /** A plan card whose ghosts are drawn over the board. */
    plan?: string;
    /** Parts whose legs have been snipped short underneath. */
    snipped?: string[];
  };
  /** A plan for a perfboard: ghost outlines of the parts by pad, and the connections drawn as numbered lines. */
  "plan-card": {
    title?: string;
    cols: number;
    rows: number;
    ghosts?: PlanGhost[];
    /** Pad pairs joined on the finished board (numbered from 1 in this order). */
    lines?: [string, string][];
  };
  /** A heat-sink clip, loose on the desk or gripping a lead `mm` from the part's body. */
  "heat-sink-clip": { metal: HeatMetal; on?: string | null; mm?: number };
  /** A length of hookup wire with two ends that can be stripped, put in holes and spliced. */
  "hookup-wire": {
    color: WireColor;
    awg: number;
    stranded?: boolean;
    /** Length (mm). */
    len: number;
    /** Stripped ends. */
    ends?: Partial<Record<"a" | "b", StripEnd>>;
    /** Every strip tried, oldest first. */
    tries?: StripTry[];
    /** Splice joints at its ends, with the end of the other wire they join ("HW2.a"). */
    joints?: Partial<Record<"a" | "b", JointRecord & { with: string }>>;
  };
  /** A wire stripper: notches on a solid and a stranded scale, and a jaw stop that sets how much comes off. */
  "wire-stripper": { notch: number; scale: StripScale; stopMm: number };
  /** A 2:1 heat-shrink tube, loose or slid onto a wire `at` mm from its end a. */
  "heat-shrink": { size: TubeSize; on?: string | null; at?: number; shrink?: number; split?: boolean };
  /** A heat gun; on, its hot air shrinks tubes in front of its nozzle. */
  "heat-gun": { on: boolean };
  /** A small board with a barrel socket and two pins (tip: the centre contact, sleeve) for the breadboard. */
  "barrel-jack": { label?: string };
  /** A wall adapter in the power strip (mains never modelled); its barrel plug goes into a jack. */
  "wall-adapter": {
    volts: number;
    amps: number;
    type: "regulated" | "unregulated" | "ac";
    centre: "plus" | "minus";
    /** The barrel jack its plug is in. */
    into?: string | null;
    /** Overrides for the simulator: open-circuit volts, output resistance, filter capacitor. */
    emf?: number;
    ohms?: number;
    filterFarads?: number;
  };
};
