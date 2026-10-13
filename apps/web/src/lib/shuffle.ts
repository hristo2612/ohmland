/** Deterministic shuffles: the same item id always gives the same order, so a resumed lesson looks the same. */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Indices 0..n-1 in a seeded random order. With `notIdentity`, never returns them in their original order. */
export function shuffledIndices(n: number, seed: string, notIdentity = false): number[] {
  const rand = mulberry32(hash(seed));
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as number, out[i] as number];
  }
  if (notIdentity && n > 1 && out.every((v, i) => v === i)) out.push(out.shift() as number);
  return out;
}
