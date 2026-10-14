// Solder alloys on the bench's spools. Facts from datasheets (docs/curriculum/unit-3.md, MP2).

export type Alloy = "leaded" | "lead-free" | "acid";

export type AlloySpec = {
  /** Fully solid below this (°C). */
  solidus: number;
  /** Fully molten above this (°C): the melting point the lessons quote. */
  liquidus: number;
  /** The usual tip setting for this solder (°C). */
  workC: number;
  /** The finish of a good joint once set. */
  finish: "bright" | "satin";
  /** How long a joint takes to set as it cools through its pasty range (s): lead-free sets a moment longer. */
  setSeconds: number;
  /** Flux that keeps eating copper after the joint is made (acid core: never for electronics). */
  corrosive?: boolean;
  /** Printed on the spool's label. */
  label: string;
};

export const ALLOYS: Record<Alloy, AlloySpec> = {
  // Tin-lead 63/37 is eutectic: it melts and sets at one temperature.
  leaded: { solidus: 183, liquidus: 183, workC: 330, finish: "bright", setSeconds: 0.8, label: "Sn63 Pb37, rosin core, 0.8 mm" },
  // SAC305 melts over 217 to 220 °C.
  "lead-free": { solidus: 217, liquidus: 220, workC: 370, finish: "satin", setSeconds: 1.6, label: "Sn96.5 Ag3.0 Cu0.5, lead-free, rosin core, 0.8 mm" },
  // Plumbing solder: tin-lead with an acid flux.
  acid: { solidus: 183, liquidus: 190, workC: 330, finish: "bright", setSeconds: 1, corrosive: true, label: "acid core, for sheet metal and plumbing" },
};

/** Solder wire diameter (mm) and how fast a held spool end feeds (mm of wire per second). */
export const WIRE_MM = 0.8;
export const FEED_MM_S = 3;
/** Volume of solder fed per second (mm³/s): 3 mm of 0.8 mm wire. */
export const FEED_RATE = Math.PI * (WIRE_MM / 2) ** 2 * FEED_MM_S;

export function alloyOf(kind: string | undefined): AlloySpec {
  return ALLOYS[(kind as Alloy) in ALLOYS ? (kind as Alloy) : "lead-free"];
}
