// The typed syntax tree of bench C. It is the single source of truth: text and blocks are two views of it.
//
// Every node has an `id` (unique within one tree, so a block can be matched with its line) and, when it came from
// text, a `span` (1-based line and column, end column exclusive). Comments and blank lines are part of the tree, so
// text -> tree -> text and blocks -> tree -> blocks both round-trip.

export type Span = { line: number; col: number; endLine: number; endCol: number };

/** Value types. int and uint are 16 bits, long and ulong 32 bits, byte 8 bits unsigned, as on an Uno-style board. */
export type Ty = "int" | "uint" | "long" | "ulong" | "byte" | "bool" | "void" | "text";

/** A type as written: the resolved type plus the spelling the learner used ("unsigned long", "boolean", "uint8_t"). */
export type TypeRef = { ty: Ty; spelling: string; const?: boolean; static?: boolean };

type Base = { id: number; span?: Span };

// ---------------------------------------------------------------------------------------------------------------
// Expressions

export type NumLit = Base & { kind: "num"; value: number; raw: string };
export type BoolLit = Base & { kind: "bool"; value: boolean };
export type StrLit = Base & { kind: "str"; value: string; raw: string };
/** A variable or a named constant (HIGH, LOW, OUTPUT, LED_BUILTIN, A0...). */
export type NameRef = Base & { kind: "name"; name: string };
/** A call: a built-in ("digitalWrite", "Serial.println") or one of the program's own functions. */
export type Call = Base & { kind: "call"; callee: string; args: Expr[]; calleeSpan?: Span };
export type UnaryOp = "-" | "+" | "!" | "~";
export type Unary = Base & { kind: "unary"; op: UnaryOp; arg: Expr };
export type Update = Base & { kind: "update"; op: "++" | "--"; prefix: boolean; target: NameRef };
export type BinaryOp = "*" | "/" | "%" | "+" | "-" | "<<" | ">>" | "<" | ">" | "<=" | ">=" | "==" | "!=" | "&" | "^" | "|" | "&&" | "||";
export type Binary = Base & { kind: "binary"; op: BinaryOp; left: Expr; right: Expr; opSpan?: Span };
export type AssignOp = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "|=" | "^=" | "<<=" | ">>=";
export type Assign = Base & { kind: "assign"; op: AssignOp; target: NameRef; value: Expr; opSpan?: Span };
export type Cond = Base & { kind: "cond"; test: Expr; then: Expr; else: Expr };
/** Brackets the learner wrote (kept so the text comes back as typed). */
export type Paren = Base & { kind: "paren"; expr: Expr };
/** `(unsigned long)x`: converts a value to a type. */
export type Cast = Base & { kind: "cast"; type: TypeRef; expr: Expr };

export type Expr = NumLit | BoolLit | StrLit | NameRef | Call | Unary | Update | Binary | Assign | Cond | Paren | Cast;

// ---------------------------------------------------------------------------------------------------------------
// Statements

/** Layout kept for the text view: a blank line before the item, and a comment after it on the same line. */
type Layout = { blankBefore?: boolean; trailing?: string };

export type Declarator = { id: number; name: string; init?: Expr; span?: Span; nameSpan?: Span };
/** `int a = 1, b;` (globals and locals). */
export type VarDecl = Base & Layout & { kind: "var"; type: TypeRef; vars: Declarator[] };
export type Block = Base &
  Layout & {
    kind: "block";
    body: Stmt[];
    /** Comment after the opening brace, on its line. */
    openTrailing?: string;
    /** Comment after the closing brace, on its line. */
    closeTrailing?: string;
  };
export type ExprStmt = Base & Layout & { kind: "expr"; expr: Expr };
export type If = Base & Layout & { kind: "if"; test: Expr; then: Stmt; else?: Stmt };
export type While = Base & Layout & { kind: "while"; test: Expr; body: Stmt };
export type DoWhile = Base & Layout & { kind: "do"; body: Stmt; test: Expr };
export type For = Base & Layout & { kind: "for"; init?: VarDecl | Expr; test?: Expr; update?: Expr; body: Stmt };
export type Return = Base & Layout & { kind: "return"; value?: Expr };
export type Break = Base & Layout & { kind: "break" };
export type Continue = Base & Layout & { kind: "continue" };
/** A lone `;`. */
export type Empty = Base & Layout & { kind: "empty" };
/** A note for people: `// ...` on its own line, or `/* ... *\/`. Ignored when running. */
export type Comment = Base & Layout & { kind: "comment"; text: string; style: "line" | "block" };

export type Stmt = VarDecl | Block | ExprStmt | If | While | DoWhile | For | Return | Break | Continue | Empty | Comment;

// ---------------------------------------------------------------------------------------------------------------
// Top level

export type Param = { id: number; name: string; type: TypeRef; span?: Span };
/** A function. Without a body it is a prototype (`void showFace();`), which changes nothing. */
export type Func = Base & Layout & { kind: "func"; ret: TypeRef; name: string; params: Param[]; body: Block | null; nameSpan?: Span };

export type TopItem = VarDecl | Func | Comment;

export type Program = Base & { kind: "program"; items: TopItem[] };

export type Node = Program | TopItem | Stmt | Expr;

// ---------------------------------------------------------------------------------------------------------------
// Helpers

/** Calls `fn` for every node of the tree, parents before children. */
export function walk(node: Node, fn: (n: Node, parent: Node | null) => void, parent: Node | null = null): void {
  fn(node, parent);
  const kids = children(node);
  for (const k of kids) walk(k, fn, node);
}

/** The direct child nodes (declarator initialisers count as children of their declaration). */
export function children(n: Node): Node[] {
  switch (n.kind) {
    case "program":
      return n.items;
    case "func":
      return n.body ? [n.body] : [];
    case "var":
      return n.vars.flatMap((v) => (v.init ? [v.init] : []));
    case "block":
      return n.body;
    case "expr":
      return [n.expr];
    case "if":
      return n.else ? [n.test, n.then, n.else] : [n.test, n.then];
    case "while":
      return [n.test, n.body];
    case "do":
      return [n.body, n.test];
    case "for":
      return [...(n.init ? [n.init] : []), ...(n.test ? [n.test] : []), ...(n.update ? [n.update] : []), n.body];
    case "return":
      return n.value ? [n.value] : [];
    case "call":
      return n.args;
    case "unary":
      return [n.arg];
    case "update":
      return [n.target];
    case "binary":
      return [n.left, n.right];
    case "assign":
      return [n.target, n.value];
    case "cond":
      return [n.test, n.then, n.else];
    case "paren":
    case "cast":
      return [n.expr];
    default:
      return [];
  }
}

/** Finds a node by id. */
export function findNode(root: Node, id: number): Node | null {
  let hit: Node | null = null;
  walk(root, (n) => {
    if (!hit && n.id === id) hit = n;
  });
  return hit;
}

const STATEMENT_KINDS = new Set(["func", "var", "block", "expr", "if", "while", "do", "for", "return", "break", "continue", "empty", "comment"]);

/**
 * The innermost statement (or function) whose span contains a 1-based line and column: what a block view lights
 * when the cursor sits there. With `expressions`, the innermost node of any kind.
 */
export function nodeAt(root: Program, line: number, col: number, opts: { expressions?: boolean } = {}): Node | null {
  let best: Node | null = null;
  const inside = (s: Span) => (line > s.line || (line === s.line && col >= s.col)) && (line < s.endLine || (line === s.endLine && col < s.endCol));
  walk(root, (n) => {
    if (n.kind === "program" || !n.span || !inside(n.span)) return;
    if (!opts.expressions && !STATEMENT_KINDS.has(n.kind)) return;
    if (n.kind === "block") return; // a block's line belongs to its statement
    best = n;
  });
  return best;
}

/** Copies a tree without spans (what a tree built from blocks looks like). Ids are kept. */
export function stripSpans<T extends Node>(n: T): T {
  return JSON.parse(JSON.stringify(n, (k, v) => (k === "span" || k === "nameSpan" || k === "calleeSpan" || k === "opSpan" ? undefined : v))) as T;
}

/** Hands out ids for new nodes. */
export class Ids {
  private next: number;
  constructor(start = 1) {
    this.next = start;
  }
  take(): number {
    return this.next++;
  }
  /** Makes sure future ids are above every id in the tree. */
  above(root: Node): void {
    walk(root, (n) => {
      if (n.id >= this.next) this.next = n.id + 1;
      if (n.kind === "var") for (const d of n.vars) if (d.id >= this.next) this.next = d.id + 1;
      if (n.kind === "func") for (const p of n.params) if (p.id >= this.next) this.next = p.id + 1;
    });
  }
}
