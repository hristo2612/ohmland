// Deterministic per-part randomness: the same part id always gets the same spread.

export function hashString(s: string): number {
  // FNV-1a, 32 bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Returns a function giving uniform numbers in [0, 1), seeded by the string. */
export function seededRandom(seed: string): () => number {
  let a = hashString(seed) || 1;
  return () => {
    // mulberry32
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value in [-1, 1) that depends only on the id and a salt. */
export function spread(id: string, salt: string): number {
  return seededRandom(`${salt}:${id}`)() * 2 - 1;
}
