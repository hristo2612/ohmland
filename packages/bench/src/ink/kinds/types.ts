// The ink registry's contract: what the ink view needs to know to draw and handle one part kind.
//
// Adding a kind: write a `Draw` (top down, in the part's frame, millimetres, x right and z down the page) and a
// `box` (its outline in the same frame), then list it in kinds/index.ts. Leads must end exactly on the clip points
// the shared layout gives (`PartInk.legs`); `localLegs(pi)` hands them over in the part's frame.

import type { ReactNode } from "react";
import type { PartState } from "@ohmland/sim";
import type { BenchPartKind, PlacedPartOf } from "../../types";
import type { Box } from "../frame";
import type { PartInk } from "../model";

export type Mount = "board" | "desk";

export type ShapeCtx = {
  mount: Mount;
  /** Lead spacing in pitches, for stretchable parts on the board. */
  span?: number;
  /** Sitting in a holder's seat (a resistor holder, a battery tester's bay, a lemon slot, the reject bin). */
  held: boolean;
  /** Laid on its back in its seat (a 9 V battery in a sealed box). */
  lie?: boolean;
};

export type Actuator = { type: "press" | "flip" | "rotor"; x: number; z: number; r: number };

export type DrawProps<K extends BenchPartKind = BenchPartKind> = {
  pi: PartInk & { part: PlacedPartOf<K> };
  /** The part's simulator state (null before the first snapshot). */
  st: PartState | null;
  /** A pushbutton held down right now. */
  pressed: boolean;
  /** Simulated minutes since the start (for the desk clock). */
  minutes: number;
};

export type InkKind<K extends BenchPartKind = BenchPartKind> = {
  /** Outline in the part's frame: hit testing, selection marks, framing. */
  box: (part: PlacedPartOf<K>, c: ShapeCtx) => Box;
  /** A press, flip or turn handle in the part's frame. */
  actuator?: (part: PlacedPartOf<K>, c: ShapeCtx) => Actuator | null;
  Draw: (p: DrawProps<K>) => ReactNode;
  /** Draw order: 0 for desk furniture and holders (under loose parts), 1 (default) for parts. */
  layer?: number;
  /** Shows simulated time (re-renders once a simulated minute). */
  clock?: boolean;
};

export type InkRegistry = { [K in BenchPartKind]?: InkKind<K> };
