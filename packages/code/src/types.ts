// Integer types as on an Uno-style board (avr-gcc): int is 16 bits, long 32 bits. Values are JS numbers kept inside
// the range of their type; `wrap` brings any whole number back into it, as the board's registers do.

import type { Ty } from "./ast";

/** Wrap codes used by the interpreter. */
export const W = { int: 0, uint: 1, long: 2, ulong: 3, bool: 4, byte: 5 } as const;
export type WrapCode = (typeof W)[keyof typeof W];

export function wrapCode(ty: Ty): WrapCode {
  switch (ty) {
    case "uint":
      return W.uint;
    case "long":
      return W.long;
    case "ulong":
      return W.ulong;
    case "bool":
      return W.bool;
    case "byte":
      return W.byte;
    default:
      return W.int;
  }
}

export function wrap(v: number, code: WrapCode): number {
  switch (code) {
    case W.int:
      return (v << 16) >> 16;
    case W.uint:
      return v & 0xffff;
    case W.long:
      return v | 0;
    case W.ulong:
      return v >>> 0;
    case W.bool:
      return v !== 0 ? 1 : 0;
    case W.byte:
      return v & 0xff;
  }
  return v;
}

/** Wraps a value to a type by name. Whole numbers only (JS bit operations take the low 32 bits). */
export function wrapTo(v: number, ty: Ty): number {
  // Doubles beyond 2^53 cannot happen: operands are at most 32 bits and products use Math.imul.
  return wrap(Math.trunc(v) % 4294967296, wrapCode(ty));
}

/** Integer promotion: bool and byte become int. */
export function promote(ty: Ty): Ty {
  return ty === "bool" || ty === "byte" ? "int" : ty;
}

/** The usual arithmetic conversions with a 16-bit int and a 32-bit long. */
export function common(a: Ty, b: Ty): Ty {
  const x = promote(a);
  const y = promote(b);
  if (x === "ulong" || y === "ulong") return "ulong";
  if (x === "long" || y === "long") return "long";
  if (x === "uint" || y === "uint") return "uint";
  return "int";
}

export const RANGE: Record<Exclude<Ty, "void" | "text">, [number, number]> = {
  int: [-32768, 32767],
  uint: [0, 65535],
  long: [-2147483648, 2147483647],
  ulong: [0, 4294967295],
  byte: [0, 255],
  bool: [0, 1],
};

export function is32(ty: Ty): boolean {
  return ty === "long" || ty === "ulong";
}

export function isUnsigned(ty: Ty): boolean {
  return ty === "uint" || ty === "ulong" || ty === "byte" || ty === "bool";
}

/** The type C gives an integer literal (int, then long, then unsigned long; hex may also be unsigned). */
export function literalType(value: number, raw: string): Ty {
  const suffix = (/[uUlL]+$/.exec(raw)?.[0] ?? "").toLowerCase();
  const u = suffix.includes("u");
  const l = suffix.includes("l");
  const hexLike = /^0[xXbB0-7]/.test(raw) && raw.length > 1;
  if (u && l) return "ulong";
  if (u) return value <= 0xffff ? "uint" : "ulong";
  if (l) return value <= 0x7fffffff ? "long" : "ulong";
  if (value <= 0x7fff) return "int";
  if (hexLike && value <= 0xffff) return "uint";
  if (value <= 0x7fffffff) return "long";
  return "ulong";
}

export function typeName(ty: Ty): string {
  switch (ty) {
    case "uint":
      return "unsigned int";
    case "ulong":
      return "unsigned long";
    default:
      return ty;
  }
}
