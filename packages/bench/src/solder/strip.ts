// The wire stripper (station engine SE5): a notch closed on a wire either cuts the jacket cleanly, nicks the copper
// (too small) or just stretches the jacket (too big). Stranded wire has its own scale. Pure.

export const NOTCHES = [30, 28, 26, 24, 22, 20, 18, 16] as const;
export type Notch = (typeof NOTCHES)[number];
export type StripScale = "solid" | "stranded";

/** Copper diameter of a solid wire of this gauge (mm): bigger numbers are thinner. */
export function awgMm(awg: number): number {
  return 0.127 * Math.pow(92, (36 - awg) / 39);
}

/** Overall copper diameter: a stranded 22 AWG wire is 7 strands of 30 AWG, a little fatter than solid. */
export function copperMm(awg: number, stranded: boolean): number {
  return stranded ? awgMm(awg) * 1.18 : awgMm(awg);
}

/** Jacket outside diameter (mm) of ordinary PVC hookup wire. */
export function jacketMm(awg: number): number {
  return awgMm(awg) + 0.95;
}

/** The hole the blades leave when a notch closes (mm). The stranded scale's notches are cut a little larger. */
export function notchMm(notch: number, scale: StripScale): number {
  return awgMm(notch) * (scale === "stranded" ? 1.2 : 1.04);
}

export type StripEnd = {
  /** Bare copper now showing (mm). */
  mm: number;
  notch: number;
  scale: StripScale;
  clean: boolean;
  nicked: boolean;
  slipped: boolean;
  /** Strands cut off a stranded wire (of 7). */
  cutStrands: number;
  twisted: boolean;
};

export type StripTry = { notch: number; scale: StripScale; clean: boolean; nicked: boolean; slipped: boolean; cutStrands: number };

/** What closing `notch` on a wire and pulling does. `stopMm` is the jaw stop: how much jacket comes off. */
export function stripWire(wire: { awg: number; stranded: boolean }, notch: number, scale: StripScale, stopMm = 10): StripEnd {
  const copper = copperMm(wire.awg, wire.stranded);
  const gap = notchMm(notch, scale);
  const r = gap / copper;
  const tooSmall = r < 0.93;
  // Blades that stop well short of the copper cannot cut through the jacket: it stretches and slides.
  const tooBig = r > 1.4;
  const nicked = tooSmall && !wire.stranded;
  const cutStrands = tooSmall && wire.stranded ? Math.min(7, Math.max(1, Math.round((0.93 - r) * 18))) : 0;
  return {
    mm: tooBig ? 0 : Math.max(2, Math.min(20, stopMm)),
    notch,
    scale,
    clean: !tooSmall && !tooBig,
    nicked,
    slipped: tooBig,
    cutStrands,
    twisted: false,
  };
}

/** A nick snaps after a few bends; cut strands leave a thinner, weaker end. */
export function endIsSound(e: StripEnd | undefined): boolean {
  return !!e && e.mm > 0 && e.clean && !e.nicked && e.cutStrands === 0;
}
