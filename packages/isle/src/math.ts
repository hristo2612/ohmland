/**
 * The planner's trigonometry, bit-identical on every CPU and engine.
 *
 * ECMA-262 lets Math.sin, Math.cos, Math.atan2 and Math.hypot be approximated by the implementation, and engines
 * differ: V8 on arm64 and on x86_64 can disagree in the last bit, and Safari uses the system libm. One bit is enough to
 * move a trace or a piece by a cell, so the same progress would build a different island on a phone and on a laptop.
 *
 * These are fdlibm's sin, cos and atan2 (following V8's port in ieee754.cc) and V8's two-argument hypot, written in
 * plain double arithmetic, which the language fixes bit for bit. Math.sqrt, Math.abs and Math.trunc are exact.
 *
 * The sin, cos, atan2, argument reduction and kernel routines below are derived from fdlibm, which carries this notice:
 *
 * ====================================================
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 */

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const HI = LITTLE ? 1 : 0;
const LO = LITTLE ? 0 : 1;
/** The high 32 bits of a double, signed (fdlibm's GET_HIGH_WORD). */
const high = (x: number): number => ((f64[0] = x), u32[HI]! | 0);
const low = (x: number): number => ((f64[0] = x), u32[LO]!);
const fromHigh = (h: number): number => ((u32[HI] = h), (u32[LO] = 0), f64[0]!);

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

/** sin on [-pi/4, pi/4]; y is the tail of x and iy says whether there is one (fdlibm's __kernel_sin). */
function kernelSin(x: number, y: number, iy: 0 | 1): number {
  if ((high(x) & 0x7fffffff) < 0x3e400000) return x;
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return iy === 0 ? x + v * (S1 + z * r) : x - (z * (0.5 * y - v * r) - y - v * S1);
}

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

/** cos on [-pi/4, pi/4] for the argument x + y (fdlibm's __kernel_cos). */
function kernelCos(x: number, y: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix < 0x3e400000) return 1;
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y));
  const qx = ix > 0x3fe90000 ? 0.28125 : fromHigh(ix - 0x00200000);
  return 1 - qx - (0.5 * z - qx - (z * r - x * y));
}

const NPIO2_HW = [
  0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c, 0x4025fdbb, 0x402921fb, 0x402c463a, 0x402f6a7a,
  0x4031475c, 0x4032d97c, 0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb, 0x403ab41b, 0x403c463a, 0x403dd85a, 0x403f6a7a,
  0x40407e4c, 0x4041475c, 0x4042106c, 0x4042d97c, 0x4043a28c, 0x40446b9c, 0x404534ac, 0x4045fdbb, 0x4046c6cb, 0x40478fdb,
  0x404858eb, 0x404921fb,
];
const INVPIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;
const PIO2_2 = 6.0771005063039659766e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.0222662487111664558e-21;
const PIO2_3T = 8.47842766036889956997e-32;
/** The double nearest 2 pi. Huge angles are first reduced modulo it, which the % operator does exactly. */
const TWO_PI = 2 * Math.PI;
const tail = [0, 0];

/** x = n * pi/2 + tail[0] + tail[1] with |tail| <= pi/4, for 3pi/4 <= |x| <= 2^19 * pi/2 (fdlibm's __ieee754_rem_pio2). */
function remPio2(x: number, hx: number, ix: number): number {
  if (ix < 0x4002d97c) {
    const sign = hx > 0 ? 1 : -1;
    let z = x - sign * PIO2_1;
    if (ix !== 0x3ff921fb) {
      tail[0] = z - sign * PIO2_1T;
      tail[1] = z - tail[0] - sign * PIO2_1T;
    } else {
      z -= sign * PIO2_2;
      tail[0] = z - sign * PIO2_2T;
      tail[1] = z - tail[0] - sign * PIO2_2T;
    }
    return sign;
  }
  const t = Math.abs(x);
  const n = Math.trunc(t * INVPIO2 + 0.5);
  let r = t - n * PIO2_1;
  let w = n * PIO2_1T;
  let y0 = r - w;
  if (!(n < 32 && ix !== NPIO2_HW[n - 1])) {
    const j = ix >> 20;
    if (j - ((high(y0) >> 20) & 0x7ff) > 16) {
      let u = r;
      w = n * PIO2_2;
      r = u - w;
      w = n * PIO2_2T - (u - r - w);
      y0 = r - w;
      if (j - ((high(y0) >> 20) & 0x7ff) > 49) {
        u = r;
        w = n * PIO2_3;
        r = u - w;
        w = n * PIO2_3T - (u - r - w);
        y0 = r - w;
      }
    }
  }
  const y1 = r - y0 - w;
  if (hx < 0) {
    tail[0] = -y0;
    tail[1] = -y1;
    return -n;
  }
  tail[0] = y0;
  tail[1] = y1;
  return n;
}

export function sin(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelSin(x, 0, 0);
  if (ix >= 0x7ff00000) return NaN;
  if (ix > 0x413921fb) return sin(x % TWO_PI);
  switch (remPio2(x, hx, ix) & 3) {
    case 0:
      return kernelSin(tail[0]!, tail[1]!, 1);
    case 1:
      return kernelCos(tail[0]!, tail[1]!);
    case 2:
      return -kernelSin(tail[0]!, tail[1]!, 1);
    default:
      return -kernelCos(tail[0]!, tail[1]!);
  }
}

export function cos(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelCos(x, 0);
  if (ix >= 0x7ff00000) return NaN;
  if (ix > 0x413921fb) return cos(x % TWO_PI);
  switch (remPio2(x, hx, ix) & 3) {
    case 0:
      return kernelCos(tail[0]!, tail[1]!);
    case 1:
      return -kernelSin(tail[0]!, tail[1]!, 1);
    case 2:
      return -kernelCos(tail[0]!, tail[1]!);
    default:
      return kernelSin(tail[0]!, tail[1]!, 1);
  }
}

const ATANHI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.570796326794896558];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.1111110405462355788e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.6531572744216915527e-2, 1.62858201153657823623e-2,
];

/** fdlibm's atan. */
function atan(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    if (x !== x) return x + x;
    return hx > 0 ? ATANHI[3]! + ATANLO[3]! : -ATANHI[3]! - ATANLO[3]!;
  }
  if (ix < 0x3fdc0000) {
    if (ix < 0x3e400000) return x;
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2 * x - 1) / (2 + x);
      } else {
        id = 1;
        x = (x - 1) / (x + 1);
      }
    } else if (ix < 0x40038000) {
      id = 2;
      x = (x - 1.5) / (1 + 1.5 * x);
    } else {
      id = 3;
      x = -1 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT[0]! + w * (AT[2]! + w * (AT[4]! + w * (AT[6]! + w * (AT[8]! + w * AT[10]!)))));
  const s2 = w * (AT[1]! + w * (AT[3]! + w * (AT[5]! + w * (AT[7]! + w * AT[9]!))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATANHI[id]! - (x * (s1 + s2) - ATANLO[id]! - x);
  return hx < 0 ? -r : r;
}

const PI_O_4 = 7.85398163397448279e-1;
const PI_O_2 = 1.570796326794896558;
const PI = 3.141592653589793116;
const PI_LO = 1.2246467991473531772e-16;

/** fdlibm's atan2. */
export function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return x + y;
  const hx = high(x);
  const lx = low(x);
  const hy = high(y);
  const ly = low(y);
  const ix = hx & 0x7fffffff;
  const iy = hy & 0x7fffffff;
  if (hx === 0x3ff00000 && lx === 0) return atan(y);
  let m = ((hy >>> 31) & 1) | ((hx >>> 30) & 2);
  if ((iy | ly) === 0) return m < 2 ? y : m === 2 ? PI : -PI;
  if ((ix | lx) === 0) return hy < 0 ? -PI_O_2 : PI_O_2;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) return [PI_O_4, -PI_O_4, 3 * PI_O_4, -3 * PI_O_4][m]!;
    return [0, -0, PI, -PI][m]!;
  }
  if (iy === 0x7ff00000) return hy < 0 ? -PI_O_2 : PI_O_2;
  const k = (iy - ix) >> 20;
  let z: number;
  if (k > 60) {
    z = PI_O_2 + 0.5 * PI_LO;
    m &= 1;
  } else if (hx < 0 && k < -60) z = 0;
  else z = atan(Math.abs(y / x));
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

/** V8's Math.hypot for two numbers: both scaled by the larger, squared, summed, then the square root. */
export function hypot(a: number, b: number): number {
  const x = Math.abs(a);
  const y = Math.abs(b);
  if (x === Infinity || y === Infinity) return Infinity;
  if (x !== x || y !== y) return NaN;
  const max = x > y ? x : y;
  if (max === 0) return 0;
  const p = x / max;
  const q = y / max;
  return Math.sqrt(p * p + q * q) * max;
}

/** mulberry32: a small seeded generator, the same sequence everywhere (integer arithmetic only). */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit FNV-1a over a string's UTF-16 code units. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A stable 0..1 hash of two integers (for render-side noise that must also match on every device). */
export function hash2(x: number, z: number, salt = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
