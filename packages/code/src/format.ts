// Tree -> text, in one canonical layout: two-space indents, braces on the same line, one step per line. Comments,
// blank lines, the brackets the learner wrote and the spelling of numbers and types come back as they were, so
// text -> tree -> text is stable, and a tree built from blocks prints as tidy code.

import type { Block, Expr, Func, Program, Span, Stmt, TopItem, TypeRef, VarDecl } from "./ast";
import { quote } from "./parser";

export type FormatOptions = { indent?: string };

/** Prints a tree as bench C text. */
export function format(ast: Program, opts: FormatOptions = {}): string {
  return formatWithMap(ast, opts).text;
}

/** Prints a tree and says where each node landed (by node id), so a block can light up its line. */
export function formatWithMap(ast: Program, opts: FormatOptions = {}): { text: string; spans: Map<number, Span> } {
  const w = new Writer(opts.indent ?? "  ");
  w.program(ast);
  return { text: w.text(), spans: w.spans };
}

/** Prints one expression (for block labels and error messages). */
export function formatExpr(e: Expr): string {
  const w = new Writer("  ");
  w.expr(e, 0);
  return w.text().trimEnd();
}

const PREC: Record<string, number> = {
  "||": 3,
  "&&": 4,
  "|": 5,
  "^": 6,
  "&": 7,
  "==": 8,
  "!=": 8,
  "<": 9,
  ">": 9,
  "<=": 9,
  ">=": 9,
  "<<": 10,
  ">>": 10,
  "+": 11,
  "-": 11,
  "*": 12,
  "/": 12,
  "%": 12,
};

function prec(e: Expr): number {
  switch (e.kind) {
    case "assign":
      return 1;
    case "cond":
      return 2;
    case "binary":
      return PREC[e.op]!;
    case "unary":
    case "cast":
      return 13;
    case "update":
      return e.prefix ? 13 : 14;
    default:
      return 15;
  }
}

export function typeText(t: TypeRef): string {
  return `${t.static ? "static " : ""}${t.const ? "const " : ""}${t.spelling}`;
}

class Writer {
  private out: string[] = [];
  private line = 1;
  private col = 1;
  private depth = 0;
  readonly spans = new Map<number, Span>();

  constructor(private readonly unit: string) {}

  text(): string {
    return this.out.join("");
  }

  private put(s: string): void {
    this.out.push(s);
    const nl = s.lastIndexOf("\n");
    if (nl < 0) this.col += s.length;
    else {
      this.line += s.split("\n").length - 1;
      this.col = s.length - nl;
    }
  }
  private newline(): void {
    this.put("\n");
  }
  private pad(): void {
    this.put(this.unit.repeat(this.depth));
  }
  private start(): { line: number; col: number } {
    return { line: this.line, col: this.col };
  }
  private end(id: number, s: { line: number; col: number }): void {
    this.spans.set(id, { line: s.line, col: s.col, endLine: this.line, endCol: this.col });
  }
  private trailing(t: string | undefined): void {
    if (t === undefined) return;
    this.put(t.startsWith("/*") ? ` ${t}` : ` //${t}`);
  }

  program(p: Program): void {
    p.items.forEach((it, k) => {
      if (k > 0 && it.blankBefore) this.newline();
      this.top(it);
    });
  }

  private top(it: TopItem): void {
    if (it.kind === "func") this.func(it);
    else this.stmt(it);
  }

  private func(f: Func): void {
    this.pad();
    const s = this.start();
    this.put(`${typeText(f.ret)} ${f.name}(${f.params.map((p) => `${typeText(p.type)} ${p.name}`).join(", ")})`);
    if (!f.body) {
      this.put(";");
      this.end(f.id, s);
      this.trailing(f.trailing);
      this.newline();
      return;
    }
    this.put(" ");
    this.block(f.body);
    this.end(f.id, s);
    this.newline();
  }

  /** `{ ... }` starting at the current position; leaves the cursor after `}` (and its comment). */
  private block(b: Block): void {
    const s = this.start();
    this.put("{");
    this.trailing(b.openTrailing);
    this.newline();
    this.depth++;
    b.body.forEach((x, k) => {
      if (k > 0 && x.blankBefore) this.newline();
      this.stmt(x);
    });
    this.depth--;
    this.pad();
    this.put("}");
    this.end(b.id, s);
    this.trailing(b.closeTrailing);
  }

  /** A full line (or lines) for a statement, ending with a newline. */
  stmt(x: Stmt | VarDecl): void {
    this.pad();
    this.inline(x);
    this.newline();
  }

  /** A statement starting at the cursor, without the final newline. */
  private inline(x: Stmt): void {
    const s = this.start();
    switch (x.kind) {
      case "var":
        this.varDecl(x);
        this.put(";");
        this.end(x.id, s);
        this.trailing(x.trailing);
        return;
      case "expr":
        this.expr(x.expr, 0);
        this.put(";");
        this.end(x.id, s);
        this.trailing(x.trailing);
        return;
      case "block":
        this.block(x);
        return;
      case "if": {
        this.put("if (");
        this.expr(x.test, 0);
        this.put(")");
        this.body(x.then, !!x.else);
        if (x.else) {
          if (x.then.kind === "block" && x.then.closeTrailing === undefined) this.put(" ");
          else {
            this.newline();
            this.pad();
          }
          this.put("else");
          if (x.else.kind === "if") {
            this.put(" ");
            this.inline(x.else);
          } else this.body(x.else, false);
        }
        this.end(x.id, s);
        return;
      }
      case "while":
        this.put("while (");
        this.expr(x.test, 0);
        this.put(")");
        this.body(x.body, false);
        this.end(x.id, s);
        return;
      case "do":
        this.put("do");
        this.body(x.body, true);
        if (x.body.kind === "block") this.put(" ");
        else {
          this.newline();
          this.pad();
        }
        this.put("while (");
        this.expr(x.test, 0);
        this.put(");");
        this.end(x.id, s);
        this.trailing(x.trailing);
        return;
      case "for":
        this.put("for (");
        if (x.init) {
          if (x.init.kind === "var") this.varDecl(x.init);
          else this.expr(x.init, 0);
        }
        this.put(";");
        if (x.test) {
          this.put(" ");
          this.expr(x.test, 0);
        }
        this.put(";");
        if (x.update) {
          this.put(" ");
          this.expr(x.update, 0);
        }
        this.put(")");
        this.body(x.body, false);
        this.end(x.id, s);
        return;
      case "return":
        this.put("return");
        if (x.value) {
          this.put(" ");
          this.expr(x.value, 0);
        }
        this.put(";");
        this.end(x.id, s);
        this.trailing(x.trailing);
        return;
      case "break":
      case "continue":
        this.put(`${x.kind};`);
        this.end(x.id, s);
        this.trailing(x.trailing);
        return;
      case "empty":
        this.put(";");
        this.end(x.id, s);
        this.trailing(x.trailing);
        return;
      case "comment":
        this.put(x.style === "line" ? `//${x.text}` : `/*${x.text}*/`);
        this.end(x.id, s);
        return;
    }
  }

  /** The body of if, while, for or do: a block on the same line, or one step on the same line. */
  private body(b: Stmt, more: boolean): void {
    if (b.kind === "block") {
      this.put(" ");
      this.block(b);
      return;
    }
    if (b.kind === "empty") {
      this.put(";");
      this.spans.set(b.id, { line: this.line, col: this.col - 1, endLine: this.line, endCol: this.col });
      this.trailing(b.trailing);
      return;
    }
    void more;
    this.put(" ");
    this.inline(b);
  }

  private varDecl(d: VarDecl): void {
    this.put(`${typeText(d.type)} `);
    d.vars.forEach((v, k) => {
      if (k > 0) this.put(", ");
      const s = this.start();
      this.put(v.name);
      if (v.init) {
        this.put(" = ");
        this.expr(v.init, 1);
      }
      this.end(v.id, s);
    });
  }

  expr(e: Expr, minPrec: number): void {
    const s = this.start();
    const p = prec(e);
    const wrapIt = p < minPrec;
    if (wrapIt) this.put("(");
    switch (e.kind) {
      case "num":
        this.put(e.raw);
        break;
      case "bool":
        this.put(e.value ? "true" : "false");
        break;
      case "str":
        this.put(e.raw ?? quote(e.value));
        break;
      case "name":
        this.put(e.name);
        break;
      case "paren":
        this.put("(");
        this.expr(e.expr, 0);
        this.put(")");
        break;
      case "cast":
        this.put(`(${typeText(e.type)})`);
        this.expr(e.expr, 13);
        break;
      case "call":
        this.put(`${e.callee}(`);
        e.args.forEach((a, k) => {
          if (k > 0) this.put(", ");
          this.expr(a, 1);
        });
        this.put(")");
        break;
      case "unary": {
        this.put(e.op);
        const a = e.arg;
        const clash = (a.kind === "unary" && (a.op === e.op || (e.op === "-" && a.op === "-"))) || (a.kind === "update" && a.prefix && a.op[0] === e.op) || (a.kind === "num" && false);
        if (clash) {
          this.put("(");
          this.expr(a, 0);
          this.put(")");
        } else this.expr(a, 13);
        break;
      }
      case "update":
        if (e.prefix) this.put(e.op);
        this.expr(e.target, 15);
        if (!e.prefix) this.put(e.op);
        break;
      case "binary":
        this.expr(e.left, p);
        this.put(` ${e.op} `);
        this.expr(e.right, p + 1);
        break;
      case "assign":
        this.expr(e.target, 15);
        this.put(` ${e.op} `);
        this.expr(e.value, 1);
        break;
      case "cond":
        this.expr(e.test, 3);
        this.put(" ? ");
        this.expr(e.then, 1);
        this.put(" : ");
        this.expr(e.else, 2);
        break;
    }
    if (wrapIt) this.put(")");
    this.end(e.id, s);
  }
}
