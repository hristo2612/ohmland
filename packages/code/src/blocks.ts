// Tree <-> blocks. Blocks are a second view of the same tree: one block per statement or value, named after what it
// does ("digitalWrite", "if", "compare"), with editable fields (a number, a name, HIGH or LOW), value inputs and
// statement lists. toBlocks then fromBlocks gives back the same tree (ids, comments and layout included), and a
// block made in the editor (no id yet) gets a fresh id. One pattern is shown as a single block: the clock check
// `if (millis() - last >= N) { last = millis(); ... }` is an "every" block.

import { Ids, walk, type Block as BlockStmt, type Declarator, type Expr, type Func, type Program, type Stmt, type TopItem, type TypeRef, type VarDecl } from "./ast";
import { BUILTIN_BY_NAME, CONSTANTS, TYPE_NAMES } from "./builtins";
import { paramFor } from "./check";
import { quote } from "./parser";

/** Layout the text view needs to come back exactly as typed. A block editor can ignore it. */
export type BlockLayout = {
  blankBefore?: boolean;
  trailing?: string;
  openTrailing?: string;
  closeTrailing?: string;
  /** if, while or for written without braces around a single step. */
  compact?: boolean;
  /** else if, written without braces round the inner if. */
  elseIf?: boolean;
  elseCompact?: boolean;
  /** Comments after the else block's braces. */
  elseOpenTrailing?: string;
  elseCloseTrailing?: string;
};

export type BlockNode = {
  /** What the block is: a statement ("if", "digitalWrite", "set"...) or a value ("number", "compare", "millis"...). */
  type: string;
  /** The tree node it shows (missing on a block just made in the editor). */
  id?: number;
  /** Values typed into the block itself: numbers, names, operators. */
  fields?: Record<string, string | number | boolean>;
  /** Value slots, by name (a built-in's parameter names: pin, value, ms...). */
  inputs?: Record<string, BlockNode>;
  /** Values of a call to the program's own function, in order. */
  args?: BlockNode[];
  /** Statement lists. */
  body?: BlockNode[];
  else?: BlockNode[];
  /** A function's parameters. */
  params?: { name: string; type: string; id?: number }[];
  /** More names in one declaration (`int a = 1, b;`). */
  more?: { name: string; id?: number; value?: BlockNode }[];
  /** Ids of tree nodes inside the block that have no block of their own (a declared name, a call in a step). */
  refs?: { var?: number; expr?: number; target?: number; body?: number; elseBody?: number };
  layout?: BlockLayout;
};

export type BlockProgram = { type: "program"; id?: number; items: BlockNode[] };

/** Block types for built-in calls are the built-in's name; these are the others. */
export const BLOCK_TYPES = [
  "setup",
  "loop",
  "function",
  "prototype",
  "declare",
  "set",
  "change",
  "call",
  "expr",
  "if",
  "every",
  "while",
  "do",
  "for",
  "return",
  "break",
  "continue",
  "empty",
  "comment",
  "group",
  "number",
  "bool",
  "text",
  "constant",
  "get",
  "math",
  "compare",
  "logic",
  "not",
  "negate",
  "unary",
  "choose",
  "brackets",
  "cast",
] as const;

// -------------------------------------------------------------------------------------------------------------------
// Tree -> blocks

export function toBlocks(ast: Program): BlockProgram {
  return { type: "program", id: ast.id, items: ast.items.map(topToBlock) };
}

function layoutOf(n: { blankBefore?: boolean; trailing?: string }, extra: BlockLayout = {}): BlockLayout | undefined {
  const l: BlockLayout = { ...extra };
  if (n.blankBefore) l.blankBefore = true;
  if (n.trailing !== undefined) l.trailing = n.trailing;
  return Object.keys(l).length ? l : undefined;
}

function withLayout(b: BlockNode, l: BlockLayout | undefined): BlockNode {
  if (l) b.layout = l;
  return b;
}

function blockLayout(b: BlockStmt): BlockLayout {
  const l: BlockLayout = {};
  if (b.openTrailing !== undefined) l.openTrailing = b.openTrailing;
  if (b.closeTrailing !== undefined) l.closeTrailing = b.closeTrailing;
  return l;
}

function topToBlock(it: TopItem): BlockNode {
  if (it.kind === "func") return funcToBlock(it);
  return stmtToBlock(it);
}

function funcToBlock(f: Func): BlockNode {
  const special = (f.name === "setup" || f.name === "loop") && f.ret.ty === "void" && f.params.length === 0 && f.body;
  const b: BlockNode = { type: special ? f.name : f.body ? "function" : "prototype", id: f.id };
  if (!special) {
    b.fields = { name: f.name, returns: typeSpelling(f.ret) };
    b.params = f.params.map((p) => ({ name: p.name, type: typeSpelling(p.type), id: p.id }));
  }
  if (f.body) b.body = f.body.body.map(stmtToBlock);
  if (f.body) b.refs = { body: f.body.id };
  return withLayout(b, layoutOf(f, f.body ? blockLayout(f.body) : {}));
}

function typeSpelling(t: TypeRef): string {
  return `${t.static ? "static " : ""}${t.const ? "const " : ""}${t.spelling}`;
}

function declToBlock(d: VarDecl): BlockNode {
  const first = d.vars[0]!;
  const b: BlockNode = { type: "declare", id: d.id, fields: { type: typeSpelling(d.type), name: first.name }, refs: { var: first.id } };
  if (first.init) b.inputs = { value: exprToBlock(first.init) };
  if (d.vars.length > 1) b.more = d.vars.slice(1).map((v) => (v.init ? { name: v.name, id: v.id, value: exprToBlock(v.init) } : { name: v.name, id: v.id }));
  return withLayout(b, layoutOf(d));
}

function bodyOf(s: Stmt): { list: BlockNode[]; compact: boolean; extra: BlockLayout; id?: number } {
  if (s.kind === "block") return { list: s.body.map(stmtToBlock), compact: false, extra: blockLayout(s), id: s.id };
  return { list: [stmtToBlock(s)], compact: true, extra: {} };
}

function refsOf(body: number | undefined): BlockNode["refs"] {
  return body === undefined ? undefined : { body };
}

/** Matches `if (millis() - V >= N) { V = millis(); ... }` (no else). */
function everyPattern(s: Stmt): { v: string; ms: Expr; rest: Stmt[]; blk: BlockStmt } | null {
  if (s.kind !== "if" || s.else || s.then.kind !== "block") return null;
  const t = s.test;
  if (t.kind !== "binary" || t.op !== ">=" || t.left.kind !== "binary" || t.left.op !== "-") return null;
  const m = t.left.left;
  const v = t.left.right;
  if (m.kind !== "call" || m.callee !== "millis" || m.args.length || v.kind !== "name") return null;
  const first = s.then.body[0];
  if (!first || first.kind !== "expr" || first.trailing !== undefined) return null;
  const a = first.expr;
  if (a.kind !== "assign" || a.op !== "=" || a.target.name !== v.name || a.value.kind !== "call" || a.value.callee !== "millis" || a.value.args.length) return null;
  return { v: v.name, ms: t.right, rest: s.then.body.slice(1), blk: s.then };
}

function stmtToBlock(s: Stmt): BlockNode {
  switch (s.kind) {
    case "var":
      return declToBlock(s);
    case "expr": {
      const e = s.expr;
      let b: BlockNode;
      if (e.kind === "call") b = callToBlock(e);
      else if (e.kind === "assign" || e.kind === "update") b = exprToBlock(e);
      else b = { type: "expr", inputs: { value: exprToBlock(e) } };
      // The statement keeps its own id; the expression's id rides along.
      b.refs = { ...(b.refs ?? {}), expr: e.id };
      b.id = s.id;
      return withLayout(b, layoutOf(s));
    }
    case "block":
      return withLayout({ type: "group", id: s.id, body: s.body.map(stmtToBlock) }, layoutOf(s, blockLayout(s)));
    case "if": {
      const ev = everyPattern(s);
      if (ev) {
        const b: BlockNode = { type: "every", id: s.id, fields: { var: ev.v }, inputs: { ms: exprToBlock(ev.ms) }, body: ev.rest.map(stmtToBlock), refs: { body: ev.blk.id } };
        return withLayout(b, layoutOf(s, blockLayout(ev.blk)));
      }
      const then = bodyOf(s.then);
      const b: BlockNode = { type: "if", id: s.id, inputs: { test: exprToBlock(s.test) }, body: then.list, refs: refsOf(then.id) };
      const l: BlockLayout = { ...then.extra };
      if (then.compact) l.compact = true;
      if (s.else) {
        if (s.else.kind === "if") {
          b.else = [stmtToBlock(s.else)];
          l.elseIf = true;
        } else {
          const el = bodyOf(s.else);
          b.else = el.list;
          if (el.id !== undefined) b.refs = { ...b.refs, elseBody: el.id };
          if (el.compact) l.elseCompact = true;
          if (el.extra.openTrailing !== undefined) l.elseOpenTrailing = el.extra.openTrailing;
          if (el.extra.closeTrailing !== undefined) l.elseCloseTrailing = el.extra.closeTrailing;
        }
      }
      return withLayout(b, layoutOf(s, l));
    }
    case "while": {
      const body = bodyOf(s.body);
      return withLayout({ type: "while", id: s.id, inputs: { test: exprToBlock(s.test) }, body: body.list, refs: refsOf(body.id) }, layoutOf(s, { ...body.extra, ...(body.compact ? { compact: true } : {}) }));
    }
    case "do": {
      const body = bodyOf(s.body);
      return withLayout({ type: "do", id: s.id, inputs: { test: exprToBlock(s.test) }, body: body.list, refs: refsOf(body.id) }, layoutOf(s, { ...body.extra, ...(body.compact ? { compact: true } : {}) }));
    }
    case "for": {
      const body = bodyOf(s.body);
      const inputs: Record<string, BlockNode> = {};
      if (s.init) inputs.init = s.init.kind === "var" ? declToBlock(s.init) : exprToBlock(s.init);
      if (s.test) inputs.test = exprToBlock(s.test);
      if (s.update) inputs.update = exprToBlock(s.update);
      return withLayout({ type: "for", id: s.id, inputs, body: body.list, refs: refsOf(body.id) }, layoutOf(s, { ...body.extra, ...(body.compact ? { compact: true } : {}) }));
    }
    case "return":
      return withLayout({ type: "return", id: s.id, ...(s.value ? { inputs: { value: exprToBlock(s.value) } } : {}) }, layoutOf(s));
    case "break":
    case "continue":
    case "empty":
      return withLayout({ type: s.kind, id: s.id }, layoutOf(s));
    case "comment":
      return withLayout({ type: "comment", id: s.id, fields: { text: s.text, style: s.style } }, layoutOf(s));
  }
}

function callToBlock(e: Expr & { kind: "call" }): BlockNode {
  const b = BUILTIN_BY_NAME.get(e.callee);
  if (!b) return { type: "call", id: e.id, fields: { name: e.callee }, args: e.args.map(exprToBlock) };
  const inputs: Record<string, BlockNode> = {};
  e.args.forEach((a, k) => {
    inputs[paramFor(b, e.args.length, k).name] = exprToBlock(a);
  });
  const out: BlockNode = { type: b.name, id: e.id };
  if (e.args.length) out.inputs = inputs;
  return out;
}

function exprToBlock(e: Expr): BlockNode {
  switch (e.kind) {
    case "num":
      return { type: "number", id: e.id, fields: { value: e.value, raw: e.raw } };
    case "bool":
      return { type: "bool", id: e.id, fields: { value: e.value } };
    case "str":
      return { type: "text", id: e.id, fields: { value: e.value } };
    case "name":
      return CONSTANTS[e.name] !== undefined ? { type: "constant", id: e.id, fields: { name: e.name } } : { type: "get", id: e.id, fields: { name: e.name } };
    case "paren":
      return { type: "brackets", id: e.id, inputs: { value: exprToBlock(e.expr) } };
    case "cast":
      return { type: "cast", id: e.id, fields: { type: typeSpelling(e.type) }, inputs: { value: exprToBlock(e.expr) } };
    case "call":
      return callToBlock(e);
    case "unary":
      if (e.op === "!") return { type: "not", id: e.id, inputs: { value: exprToBlock(e.arg) } };
      if (e.op === "-") return { type: "negate", id: e.id, inputs: { value: exprToBlock(e.arg) } };
      return { type: "unary", id: e.id, fields: { op: e.op }, inputs: { value: exprToBlock(e.arg) } };
    case "update":
      return { type: "change", id: e.id, fields: { name: e.target.name, op: e.op, prefix: e.prefix }, refs: { target: e.target.id } };
    case "assign":
      return { type: "set", id: e.id, fields: { name: e.target.name, op: e.op }, refs: { target: e.target.id }, inputs: { value: exprToBlock(e.value) } };
    case "cond":
      return { type: "choose", id: e.id, inputs: { test: exprToBlock(e.test), then: exprToBlock(e.then), else: exprToBlock(e.else) } };
    case "binary": {
      const type = e.op === "&&" || e.op === "||" ? "logic" : ["<", ">", "<=", ">=", "==", "!="].includes(e.op) ? "compare" : "math";
      return { type, id: e.id, fields: { op: e.op }, inputs: { a: exprToBlock(e.left), b: exprToBlock(e.right) } };
    }
  }
}

// -------------------------------------------------------------------------------------------------------------------
// Blocks -> tree

export class BlockError extends Error {}

/**
 * Builds the tree from blocks. Blocks keep their ids; new blocks (no id, or an id already used) get fresh ones.
 * Throws BlockError for a block it cannot read (an unknown type, a missing input).
 */
export function fromBlocks(bp: BlockProgram): Program {
  const used = new Set<number>();
  let maxId = 0;
  const scan = (b: BlockNode | undefined) => {
    if (!b) return;
    if (typeof b.id === "number") maxId = Math.max(maxId, b.id);
    for (const k of ["var", "expr", "target", "body", "elseBody"]) {
      const v = (b.refs as Record<string, number | undefined> | undefined)?.[k];
      if (typeof v === "number") maxId = Math.max(maxId, v);
    }
    for (const p of b.params ?? []) if (typeof p.id === "number") maxId = Math.max(maxId, p.id);
    for (const m of b.more ?? []) {
      if (typeof m.id === "number") maxId = Math.max(maxId, m.id);
      scan(m.value);
    }
    Object.values(b.inputs ?? {}).forEach(scan);
    (b.args ?? []).forEach(scan);
    (b.body ?? []).forEach(scan);
    (b.else ?? []).forEach(scan);
  };
  bp.items.forEach(scan);
  if (typeof bp.id === "number") maxId = Math.max(maxId, bp.id);
  const ids = new Ids(maxId + 1);
  const idOf = (want: unknown): number => {
    if (typeof want === "number" && !used.has(want)) {
      used.add(want);
      return want;
    }
    const n = ids.take();
    used.add(n);
    return n;
  };
  const b2t = new Builder(idOf);
  const items = bp.items.map((b) => b2t.top(b));
  const prog: Program = { kind: "program", id: idOf(bp.id), items };
  // Ids are unique; make sure nothing collides with ones minted later by an editor.
  walk(prog, () => {});
  return prog;
}

class Builder {
  constructor(private readonly idOf: (want: unknown) => number) {}

  private fail(b: BlockNode, what: string): never {
    throw new BlockError(`${b.type}: ${what}`);
  }
  private input(b: BlockNode, name: string): Expr {
    const v = b.inputs?.[name];
    if (!v) this.fail(b, `the ${name} slot is empty`);
    return this.expr(v);
  }
  private layout<T extends Stmt | Func>(b: BlockNode, n: T): T {
    if (b.layout?.blankBefore) n.blankBefore = true;
    if (b.layout?.trailing !== undefined) n.trailing = b.layout.trailing;
    return n;
  }
  private typeRef(spelling: string): TypeRef {
    const words = spelling.trim().split(/\s+/);
    let isStatic = false;
    let isConst = false;
    while (words[0] === "static" || words[0] === "const") {
      if (words.shift() === "static") isStatic = true;
      else isConst = true;
    }
    const sp = words.join(" ");
    const ty = TYPE_NAMES[sp] ?? (sp === "short" ? "int" : "int");
    const t: TypeRef = { ty, spelling: sp };
    if (isConst) t.const = true;
    if (isStatic) t.static = true;
    return t;
  }
  private block(list: BlockNode[] | undefined, l?: BlockLayout, wantId?: number): BlockStmt {
    const blk: BlockStmt = { kind: "block", id: this.idOf(wantId), body: (list ?? []).map((x) => this.stmt(x)) };
    if (l?.openTrailing !== undefined) blk.openTrailing = l.openTrailing;
    if (l?.closeTrailing !== undefined) blk.closeTrailing = l.closeTrailing;
    return blk;
  }
  /** A body: one step without braces when it was written so (and still is one plain step), else a block. */
  private body(list: BlockNode[] | undefined, l: BlockLayout | undefined, wantId?: number): Stmt {
    const one = list?.length === 1 ? list[0]! : null;
    if (l?.compact && one && one.type !== "declare" && one.type !== "comment") return this.stmt(one);
    return this.block(list, l, wantId);
  }

  top(b: BlockNode): TopItem {
    if (b.type === "setup" || b.type === "loop" || b.type === "function" || b.type === "prototype") {
      const name = b.type === "setup" || b.type === "loop" ? b.type : String(b.fields?.name ?? "");
      if (!name) this.fail(b, "a function needs a name");
      const f: Func = {
        kind: "func",
        id: this.idOf(b.id),
        ret: this.typeRef(String(b.fields?.returns ?? "void")),
        name,
        params: (b.params ?? []).map((p) => ({ id: this.idOf(p.id), name: p.name, type: this.typeRef(p.type) })),
        body: b.type === "prototype" ? null : this.block(b.body, b.layout, b.refs?.body),
      };
      return this.layout(b, f);
    }
    const s = this.stmt(b);
    if (s.kind !== "var" && s.kind !== "comment") this.fail(b, "steps go inside a function, such as setup or loop");
    return s;
  }

  private decl(b: BlockNode): VarDecl {
    const type = this.typeRef(String(b.fields?.type ?? "int"));
    const name = String(b.fields?.name ?? "");
    if (!name) this.fail(b, "a variable needs a name");
    const first: Declarator = { id: this.idOf(b.refs?.var), name };
    if (b.inputs?.value) first.init = this.expr(b.inputs.value);
    const vars = [first];
    for (const m of b.more ?? []) {
      const d: Declarator = { id: this.idOf(m.id), name: m.name };
      if (m.value) d.init = this.expr(m.value);
      vars.push(d);
    }
    return this.layout(b, { kind: "var", id: this.idOf(b.id), type, vars });
  }

  stmt(b: BlockNode): Stmt {
    switch (b.type) {
      case "declare":
        return this.decl(b);
      case "set":
      case "change":
      case "call":
      case "expr": {
        const e = b.type === "expr" ? this.input(b, "value") : this.expr({ ...b, id: b.refs?.expr });
        return this.layout(b, { kind: "expr", id: this.idOf(b.id), expr: e });
      }
      case "group":
        return this.layout(b, this.block(b.body, b.layout, b.id));
      case "if": {
        const s: Stmt = { kind: "if", id: this.idOf(b.id), test: this.input(b, "test"), then: this.body(b.body, b.layout, b.refs?.body) };
        if (b.else) {
          const l = b.layout;
          if (l?.elseIf && b.else.length === 1 && b.else[0]!.type === "if") s.else = this.stmt(b.else[0]!);
          else s.else = this.body(b.else, l ? { compact: l.elseCompact, openTrailing: l.elseOpenTrailing, closeTrailing: l.elseCloseTrailing } : undefined, b.refs?.elseBody);
        }
        return this.layout(b, s);
      }
      case "every": {
        const v = String(b.fields?.var ?? "");
        if (!v) this.fail(b, "every needs a variable for the last time");
        const millis = (): Expr => ({ kind: "call", id: this.idOf(undefined), callee: "millis", args: [] });
        const name = (): Expr & { kind: "name" } => ({ kind: "name", id: this.idOf(undefined), name: v });
        const test: Expr = {
          kind: "binary",
          id: this.idOf(undefined),
          op: ">=",
          left: { kind: "binary", id: this.idOf(undefined), op: "-", left: millis(), right: name() },
          right: this.input(b, "ms"),
        };
        const reset: Stmt = { kind: "expr", id: this.idOf(undefined), expr: { kind: "assign", id: this.idOf(undefined), op: "=", target: name(), value: millis() } };
        const blk = this.block(b.body, b.layout, b.refs?.body);
        blk.body.unshift(reset);
        return this.layout(b, { kind: "if", id: this.idOf(b.id), test, then: blk });
      }
      case "while":
        return this.layout(b, { kind: "while", id: this.idOf(b.id), test: this.input(b, "test"), body: this.body(b.body, b.layout, b.refs?.body) });
      case "do":
        return this.layout(b, { kind: "do", id: this.idOf(b.id), body: this.body(b.body, b.layout, b.refs?.body), test: this.input(b, "test") });
      case "for": {
        const s: Stmt & { kind: "for" } = { kind: "for", id: this.idOf(b.id), body: this.body(b.body, b.layout, b.refs?.body) };
        const init = b.inputs?.init;
        if (init) s.init = init.type === "declare" ? this.decl(init) : this.expr(init);
        if (b.inputs?.test) s.test = this.expr(b.inputs.test);
        if (b.inputs?.update) s.update = this.expr(b.inputs.update);
        return this.layout(b, s);
      }
      case "return": {
        const s: Stmt = { kind: "return", id: this.idOf(b.id) };
        if (b.inputs?.value) s.value = this.expr(b.inputs.value);
        return this.layout(b, s);
      }
      case "break":
      case "continue":
      case "empty":
        return this.layout(b, { kind: b.type, id: this.idOf(b.id) });
      case "comment": {
        const style = b.fields?.style === "block" ? "block" : "line";
        return this.layout(b, { kind: "comment", id: this.idOf(b.id), text: String(b.fields?.text ?? ""), style });
      }
      default:
        if (BUILTIN_BY_NAME.has(b.type)) {
          return this.layout(b, { kind: "expr", id: this.idOf(b.id), expr: this.expr({ ...b, id: b.refs?.expr }) });
        }
        this.fail(b, "not a step");
    }
  }

  expr(b: BlockNode): Expr {
    switch (b.type) {
      case "number": {
        const value = Number(b.fields?.value ?? 0);
        const raw = typeof b.fields?.raw === "string" && Number(rawValue(b.fields.raw)) === value ? b.fields.raw : String(value);
        return { kind: "num", id: this.idOf(b.id), value, raw };
      }
      case "bool":
        return { kind: "bool", id: this.idOf(b.id), value: !!b.fields?.value };
      case "text": {
        const value = String(b.fields?.value ?? "");
        return { kind: "str", id: this.idOf(b.id), value, raw: quote(value) };
      }
      case "constant":
      case "get":
        return { kind: "name", id: this.idOf(b.id), name: String(b.fields?.name ?? "") };
      case "brackets":
        return { kind: "paren", id: this.idOf(b.id), expr: this.input(b, "value") };
      case "cast":
        return { kind: "cast", id: this.idOf(b.id), type: this.typeRef(String(b.fields?.type ?? "long")), expr: this.input(b, "value") };
      case "not":
        return { kind: "unary", id: this.idOf(b.id), op: "!", arg: this.input(b, "value") };
      case "negate":
        return { kind: "unary", id: this.idOf(b.id), op: "-", arg: this.input(b, "value") };
      case "unary": {
        const op = String(b.fields?.op ?? "-");
        return { kind: "unary", id: this.idOf(b.id), op: op === "~" || op === "+" || op === "!" ? op : "-", arg: this.input(b, "value") };
      }
      case "change": {
        const op = b.fields?.op === "--" ? "--" : "++";
        return { kind: "update", id: this.idOf(b.id), op, prefix: !!b.fields?.prefix, target: { kind: "name", id: this.idOf(b.refs?.target), name: String(b.fields?.name ?? "") } };
      }
      case "set": {
        const op = String(b.fields?.op ?? "=") as Expr & { kind: "assign" } extends { op: infer O } ? O : never;
        return {
          kind: "assign",
          id: this.idOf(b.id),
          op,
          target: { kind: "name", id: this.idOf(b.refs?.target), name: String(b.fields?.name ?? "") },
          value: this.input(b, "value"),
        };
      }
      case "choose":
        return { kind: "cond", id: this.idOf(b.id), test: this.input(b, "test"), then: this.input(b, "then"), else: this.input(b, "else") };
      case "math":
      case "compare":
      case "logic": {
        const op = String(b.fields?.op ?? "+") as Expr & { kind: "binary" } extends { op: infer O } ? O : never;
        return { kind: "binary", id: this.idOf(b.id), op, left: this.input(b, "a"), right: this.input(b, "b") };
      }
      case "call":
        return { kind: "call", id: this.idOf(b.id), callee: String(b.fields?.name ?? ""), args: (b.args ?? []).map((a) => this.expr(a)) };
      case "expr":
        return this.input(b, "value");
      default: {
        const bi = BUILTIN_BY_NAME.get(b.type);
        if (!bi) this.fail(b, "unknown block");
        const given = bi.params.filter((p) => b.inputs?.[p.name]);
        // random with only a top number keeps one value.
        const args = given.map((p) => this.expr(b.inputs![p.name]!));
        return { kind: "call", id: this.idOf(b.id), callee: bi.name, args };
      }
    }
  }
}

function rawValue(raw: string): number {
  const body = raw.replace(/[uUlL]+$/, "");
  if (/^0[xX]/.test(body)) return parseInt(body.slice(2), 16);
  if (/^0[bB]/.test(body)) return parseInt(body.slice(2), 2);
  if (body.length > 1 && body.startsWith("0")) return parseInt(body, 8);
  return parseInt(body, 10);
}

export type { Stmt };
