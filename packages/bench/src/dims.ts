// Physical dimensions shared by the part models, the layout (clip points) and snapping. Millimetres.
// Values follow common datasheet sizes for each package; models are simplified but keep these proportions.

import { PITCH } from "./board";

export const BOARD_TOP = 8.5;

export const LEAD_R = 0.3; // 0.6 mm tinned lead

export const RESISTOR = { len: 6.3, dia: 2.45, lift: 0.9, deskLead: 16 };
export const DIODE = { len: 5.2, dia: 2.7, lift: 0.8, deskLead: 16, leadR: 0.4 };

export const LED = {
  5: { dome: 5.0, rim: 5.8, rimH: 1.0, height: 8.6, flat: 0.5, standoff: 3.2, deskLeadA: 20, deskLeadK: 18 },
  3: { dome: 3.0, rim: 3.8, rimH: 0.9, height: 5.3, flat: 0.4, standoff: 3.0, deskLeadA: 18, deskLeadK: 16 },
} as const;

export const NPN = { dia: 4.9, height: 4.9, flatDepth: 1.55, standoff: 3.4, deskLead: 13 };

export const CERAMIC = { dia: 5.2, thick: 2.6, standoff: 3.0, deskLead: 12 };

export const PUSHBUTTON = { body: 6.0, bodyH: 3.4, capDia: 3.5, capH: 1.6, travel: 0.35 };

export const SLIDE = { len: 8.6, wid: 3.8, h: 3.8, knobW: 1.5, knobL: 1.6, knobH: 3.4, throw: 1.6 };

export const TOGGLE = { len: 12.8, wid: 7.0, h: 8.6, bushingDia: 6.0, bushingH: 6.0, lever: 10.0 };

export const TRIMMER = { size: 6.6, h: 4.6, rotorDia: 4.6 };

export const RELAY = { len: 20.4, wid: 10.0, h: 11.4 };

export const FUSE = { len: 14.5, dia: 4.5, capLen: 4.2, clipPitch: 7 };

export const BATTERY = { len: 48.5, wid: 26.5, thick: 17.5, termSpacing: 12.7 };

export const SPEAKER = { depth: 14 };

export const CUP = { dia: 58, height: 66, water: 46 };

export const LEMON = { dia: 60, height: 29, stripW: 8, stripUp: 17 };

/** Electrolytic can size and lead spacing (in board pitches) by value, after common radial series. */
export function electrolyticSize(farads: number, volts = 16): { d: number; h: number; pitch: 1 | 2; lead: number } {
  const uf = farads * 1e6 * Math.max(1, volts / 16);
  if (uf <= 22) return { d: 5, h: 11, pitch: 1, lead: 2.0 };
  if (uf <= 47) return { d: 5, h: 11, pitch: 1, lead: 2.0 };
  if (uf <= 100) return { d: 6.3, h: 11, pitch: 1, lead: 2.5 };
  if (uf <= 220) return { d: 8, h: 11.5, pitch: 2, lead: 3.5 };
  if (uf <= 470) return { d: 10, h: 12.5, pitch: 2, lead: 5.0 };
  if (uf <= 1000) return { d: 10, h: 16, pitch: 2, lead: 5.0 };
  return { d: 13, h: 21, pitch: 2, lead: 5.0 };
}

/** Lead clip point height above the board surface for parts seated in the board. */
export const BOARD_CLIP_LIFT = 1.3;

export { PITCH };
