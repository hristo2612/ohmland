/**
 * Bench C for CodeMirror 6: a small stream tokenizer (comments, text in quotes, numbers, keywords, types, the board's
 * built-ins and constants), indentation by braces, and an ink highlight style. Part of the text view's lazy chunk.
 */
import { HighlightStyle, StreamLanguage, type StreamParser } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { BUILTINS, CONSTANTS, TYPE_NAMES } from "@ohmland/code";

const KEYWORDS = new Set(["if", "else", "while", "for", "do", "return", "break", "continue", "const", "static", "unsigned", "true", "false", "void"]);
const TYPES = new Set([...Object.keys(TYPE_NAMES).flatMap((k) => k.split(" ")), "short"]);
const BUILTIN_NAMES = new Set([...BUILTINS.map((b) => b.name.split(".")[0]!), "setup", "loop"]);

type State = { comment: boolean; depth: number };

const parser: StreamParser<State> = {
  name: "benchc",
  startState: () => ({ comment: false, depth: 0 }),
  copyState: (s) => ({ ...s }),
  token(stream, state) {
    if (state.comment) {
      if (stream.skipTo("*/")) {
        stream.match("*/");
        state.comment = false;
      } else stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      state.comment = true;
      return "comment";
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+)[uUlL]*/)) return "number";
    const word = stream.match(/^[A-Za-z_]\w*/) as RegExpMatchArray | null;
    if (word) {
      const w = word[0];
      if (KEYWORDS.has(w)) return w === "true" || w === "false" ? "bool" : "keyword";
      if (TYPES.has(w)) return "typeName";
      if (CONSTANTS[w] !== undefined) return "atom";
      if (BUILTIN_NAMES.has(w)) return "builtin";
      return "variableName";
    }
    const ch = stream.next();
    if (ch === "{") state.depth++;
    else if (ch === "}") state.depth = Math.max(0, state.depth - 1);
    if (ch === "{" || ch === "}" || ch === "(" || ch === ")") return "bracket";
    if (ch === ";" || ch === ",") return "punctuation";
    return "operator";
  },
  indent(state, textAfter, cx) {
    const close = /^\s*}/.test(textAfter) ? 1 : 0;
    return Math.max(0, state.depth - close) * cx.unit;
  },
  languageData: { commentTokens: { line: "//", block: { open: "/*", close: "*/" } }, indentOnInput: /^\s*}$/ },
};

export const benchC = StreamLanguage.define(parser);

/** Graphite for the language, blue ink for the values the learner writes, faint pencil for notes. */
export const benchHighlight = HighlightStyle.define([
  { tag: t.comment, class: "cm-bc-comment" },
  { tag: [t.keyword, t.typeName], class: "cm-bc-keyword" },
  { tag: t.standard(t.variableName), class: "cm-bc-builtin" },
  { tag: [t.number, t.string, t.bool, t.atom], class: "cm-bc-value" },
  { tag: t.variableName, class: "cm-bc-name" },
]);
