// Bench C tokens. Comments are kept (with where they sit) so the tree can carry them.

import { CodeError, err } from "./errors";

export type TokKind = "id" | "num" | "str" | "op" | "eof";

export type Token = {
  k: TokKind;
  v: string;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
  /** A blank line separates this token from the previous token or comment. */
  blank: boolean;
  /** Index into the source (start). */
  pos: number;
};

export type RawComment = {
  text: string;
  style: "line" | "block";
  line: number;
  col: number;
  endLine: number;
  endCol: number;
  blank: boolean;
  /** Code comes before it on its first line (it trails a step). */
  trailing: boolean;
  pos: number;
};

const OPS = [
  "<<=",
  ">>=",
  "...",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<",
  ">>",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
  "->",
  "::",
];
const SINGLE = "+-*/%<>=!~&|^?:;,(){}[].#";

export function lex(src: string): { tokens: Token[]; comments: RawComment[] } {
  const tokens: Token[] = [];
  const comments: RawComment[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  /** Line where the last token or comment ended, and the last token's line (for trailing comments). */
  let lastEnd = 0;
  let lastTokLine = 0;
  const n = src.length;

  const advance = (k: number) => {
    for (let j = 0; j < k; j++) {
      if (src[i] === "\n") {
        line++;
        col = 1;
      } else col++;
      i++;
    }
  };

  while (i < n) {
    const c = src[i]!;
    if (c === "\n" || c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v") {
      advance(1);
      continue;
    }
    const startLine = line;
    const startCol = col;
    const startPos = i;
    const blank = lastEnd > 0 && startLine - lastEnd >= 2;
    // Comments
    if (c === "/" && src[i + 1] === "/") {
      let j = i + 2;
      while (j < n && src[j] !== "\n") j++;
      const text = src.slice(i + 2, j).replace(/\r$/, "");
      advance(j - i);
      comments.push({ text, style: "line", line: startLine, col: startCol, endLine: line, endCol: col, blank, trailing: lastTokLine === startLine, pos: startPos });
      lastEnd = line;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const close = src.indexOf("*/", i + 2);
      if (close < 0) throw new CodeError(err(startLine, startCol, "comment", "This note starts with /* but never ends with */."));
      const text = src.slice(i + 2, close);
      advance(close + 2 - i);
      comments.push({ text, style: "block", line: startLine, col: startCol, endLine: line, endCol: col, blank, trailing: lastTokLine === startLine, pos: startPos });
      lastEnd = line;
      continue;
    }
    const push = (k: TokKind, v: string, len: number) => {
      advance(len);
      tokens.push({ k, v, line: startLine, col: startCol, endLine: line, endCol: col, blank, pos: startPos });
      lastEnd = line;
      lastTokLine = line;
    };
    // Identifiers and keywords
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j]!)) j++;
      push("id", src.slice(i, j), j - i);
      continue;
    }
    // Numbers
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      if (c === "0" && /[xXbB]/.test(src[i + 1] ?? "")) {
        j = i + 2;
        while (j < n && /[0-9A-Za-z_]/.test(src[j]!)) j++;
      } else {
        while (j < n && /[0-9A-Za-z_.]/.test(src[j]!)) {
          // An exponent sign belongs to the number (1e-3), so it reaches the "decimal numbers" message.
          if (/[eE]/.test(src[j]!) && /[+-]/.test(src[j + 1] ?? "") && !/[xX]/.test(src.slice(i, j))) j++;
          j++;
        }
      }
      push("num", src.slice(i, j), j - i);
      continue;
    }
    // Text
    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"' && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      if (j >= n || src[j] !== '"') throw new CodeError(err(startLine, startCol, "string", 'Close the text with a second quote mark ".'));
      push("str", src.slice(i, j + 1), j + 1 - i);
      continue;
    }
    if (c === "'") {
      throw new CodeError(err(startLine, startCol, "unsupported", 'Single letters in \' \' are not on this bench yet. Put text in double quotes: "A".'));
    }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    const op = OPS.find((o) => o === three || o === two);
    if (op) {
      push("op", op, op.length);
      continue;
    }
    if (SINGLE.includes(c)) {
      push("op", c, 1);
      continue;
    }
    throw new CodeError(err(startLine, startCol, "char", `I don't understand the character ${JSON.stringify(c)}.`));
  }
  tokens.push({ k: "eof", v: "", line, col, endLine: line, endCol: col, blank: false, pos: n });
  return { tokens, comments };
}
