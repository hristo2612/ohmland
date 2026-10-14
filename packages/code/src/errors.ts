// Friendly diagnostics: a place (line:column, both counted from 1) and one plain sentence.

/**
 * What kind of mistake it is, so a lesson can tell them apart (`lab.code(board).errorsSeen`):
 * - semicolon: a step does not end with `;`
 * - case: a name with the wrong capitals ("digitalwrite")
 * - name: a name the board does not know (a typo, or a variable used before it is declared)
 * - brace, paren: a `{` or `(` without its partner, or one too many
 * - syntax: anything else the reader cannot follow
 * - args: a call with the wrong number of values
 * - type: a value used where it cannot go (a void call in a sum, text outside Serial.print)
 * - const: changing a fixed value
 * - duplicate: a second variable or function with the same name in one place
 * - setup, loop: the program has no `void setup()` or no `void loop()`
 * - unsupported: a C feature that is not on this bench yet (arrays, float, String, switch, #include...)
 * - char, string, comment, number: a bad character, unclosed text, unclosed note, a number the board cannot hold
 * Warnings (the program still runs):
 * - assign-in-if: `if (x = 6)` sets x instead of comparing it
 * - no-effect: a step that computes something and throws it away (`x == 5;`)
 * - overflow: a number too big for its type (`int x = 40000;`)
 * - pin: a pin number the board does not have
 * - return: a function that should give a value back can reach its end without one
 * - serial: printing before Serial.begin
 */
export type ErrorKind =
  | "semicolon"
  | "case"
  | "name"
  | "brace"
  | "paren"
  | "syntax"
  | "args"
  | "type"
  | "const"
  | "duplicate"
  | "setup"
  | "loop"
  | "unsupported"
  | "char"
  | "string"
  | "comment"
  | "number"
  | "assign-in-if"
  | "no-effect"
  | "overflow"
  | "pin"
  | "return"
  | "serial";

export type Diagnostic = {
  line: number;
  col: number;
  endLine?: number;
  endCol?: number;
  kind: ErrorKind;
  /** One plain sentence, without the position. */
  message: string;
  severity: "error" | "warning";
};

/** "4:18 Each step ends with a semicolon." */
export function describe(d: Diagnostic): string {
  return `${d.line}:${d.col} ${d.message}`;
}

/** Thrown by the parser at the first error it cannot read past. */
export class CodeError extends Error {
  constructor(public readonly diag: Diagnostic) {
    super(describe(diag));
  }
}

export function err(line: number, col: number, kind: ErrorKind, message: string, end?: { line: number; col: number }): Diagnostic {
  const d: Diagnostic = { line, col, kind, message, severity: "error" };
  if (end) {
    d.endLine = end.line;
    d.endCol = end.col;
  }
  return d;
}

export function warn(line: number, col: number, kind: ErrorKind, message: string, end?: { line: number; col: number }): Diagnostic {
  return { ...err(line, col, kind, message, end), severity: "warning" };
}

/** Orders diagnostics by position (the editor shows one error at a time: the first). */
export function byPosition(a: Diagnostic, b: Diagnostic): number {
  return a.line - b.line || a.col - b.col;
}

/** Edit distance, for "did you mean" (small strings only). */
export function distance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[n]!;
}
