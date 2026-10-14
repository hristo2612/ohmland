// Text -> tree. A recursive descent reader that stops at the first thing it cannot follow and says why, in one
// plain sentence at a line and column. Comments and blank lines are kept in the tree.

import type {
  AssignOp,
  BinaryOp,
  Block,
  Comment,
  Declarator,
  Expr,
  Func,
  NameRef,
  Param,
  Program,
  Span,
  Stmt,
  TopItem,
  TypeRef,
  VarDecl,
} from "./ast";
import { TYPE_NAMES } from "./builtins";
import { CodeError, err, type Diagnostic, type ErrorKind } from "./errors";
import { lex, type RawComment, type Token } from "./lexer";

export type ParseResult = { ast: Program | null; errors: Diagnostic[] };

/** Reads bench C source. On a mistake `ast` is null and `errors` holds the first one. */
export function parse(src: string, opts: { firstId?: number } = {}): ParseResult {
  try {
    const { tokens, comments } = lex(src);
    const p = new Parser(tokens, comments, opts.firstId ?? 1);
    return { ast: p.program(), errors: [] };
  } catch (e) {
    if (e instanceof CodeError) return { ast: null, errors: [e.diag] };
    throw e;
  }
}

const UNSUPPORTED_TYPES: Record<string, string> = {
  float: "Decimal numbers (float) are not on this bench yet. Use int or long.",
  double: "Decimal numbers (double) are not on this bench yet. Use int or long.",
  char: "Single letters (char) are not on this bench yet.",
  String: "Text variables (String) are not on this bench yet. Print text in quotes instead.",
  struct: "struct is not on this bench yet.",
  class: "class is not on this bench yet.",
  enum: "enum is not on this bench yet. Use const int values.",
  union: "union is not on this bench yet.",
  typedef: "typedef is not on this bench yet.",
  template: "template is not on this bench yet.",
  signed: "Write int or long instead of signed.",
  size_t: "size_t is not on this bench yet. Use int or long.",
  auto: "auto is not on this bench yet. Name the type: int, long, bool.",
  volatile: "volatile is not on this bench yet.",
};
const UNSUPPORTED_STATEMENTS: Record<string, string> = {
  switch: "switch is not on this bench yet. Use if and else.",
  case: "case is not on this bench yet. Use if and else.",
  goto: "goto is not on this bench yet.",
  sizeof: "sizeof is not on this bench yet.",
  new: "new is not on this bench yet.",
  delete: "delete is not on this bench yet.",
};

const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="]);
const BINARY_PREC: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "|": 3,
  "^": 4,
  "&": 5,
  "==": 6,
  "!=": 6,
  "<": 7,
  ">": 7,
  "<=": 7,
  ">=": 7,
  "<<": 8,
  ">>": 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10,
};

class Parser {
  private i = 0;
  private ci = 0;
  private nextId: number;

  constructor(
    private readonly toks: Token[],
    private readonly comments: RawComment[],
    firstId: number,
  ) {
    this.nextId = firstId;
  }

  // -- token helpers ---------------------------------------------------------------------------------------------

  private get t(): Token {
    return this.toks[this.i]!;
  }
  private peek(k = 1): Token {
    return this.toks[Math.min(this.i + k, this.toks.length - 1)]!;
  }
  private get prev(): Token {
    return this.toks[Math.max(0, this.i - 1)]!;
  }
  private id(): number {
    return this.nextId++;
  }
  private is(v: string): boolean {
    return (this.t.k === "op" || this.t.k === "id") && this.t.v === v;
  }
  private take(v: string): boolean {
    if (this.is(v)) {
      this.i++;
      return true;
    }
    return false;
  }
  private fail(tok: Token, kind: ErrorKind, message: string): never {
    throw new CodeError(err(tok.line, tok.col, kind, message, { line: tok.endLine, col: tok.endCol }));
  }
  /** An error placed right after the previous token (where something is missing). */
  private failAfterPrev(kind: ErrorKind, message: string): never {
    const p = this.prev;
    throw new CodeError(err(p.endLine, p.endCol, kind, message));
  }
  private span(from: Token, to: Token = this.prev): Span {
    return { line: from.line, col: from.col, endLine: to.endLine, endCol: to.endCol };
  }
  private semicolon(): void {
    if (this.take(";")) return;
    this.failAfterPrev("semicolon", "Each step ends with a semicolon.");
  }
  private close(v: ")" | "]"): void {
    if (this.take(v)) return;
    if (this.t.k === "eof" || this.t.line > this.prev.endLine || this.is(";") || this.is("{")) this.failAfterPrev("paren", `Close the bracket with ${v} here.`);
    this.fail(this.t, "paren", `I expected ${v} or a comma here.`);
  }
  private ident(what: string): Token {
    const t = this.t;
    if (t.k !== "id") this.fail(t, "syntax", `A name for the ${what} goes here.`);
    this.i++;
    return t;
  }

  // -- comments --------------------------------------------------------------------------------------------------

  /** Comments on their own lines before the current token, as comment statements. */
  private leadingComments(): Comment[] {
    const out: Comment[] = [];
    while (this.ci < this.comments.length && this.comments[this.ci]!.pos < this.t.pos) {
      const c = this.comments[this.ci++]!;
      out.push({
        kind: "comment",
        id: this.id(),
        text: c.text,
        style: c.style,
        span: { line: c.line, col: c.col, endLine: c.endLine, endCol: c.endCol },
        ...(c.blank ? { blankBefore: true } : {}),
      });
    }
    return out;
  }
  /** A comment that starts on the line where the previous token ended (it trails that step). */
  private trailingComment(): string | undefined {
    const c = this.comments[this.ci];
    if (c && c.trailing && c.line === this.prev.endLine && c.pos < this.t.pos) {
      this.ci++;
      return c.style === "line" ? c.text : `/*${c.text}*/`;
    }
    return undefined;
  }

  // -- program ---------------------------------------------------------------------------------------------------

  program(): Program {
    const start = this.t;
    const items: TopItem[] = [];
    for (;;) {
      items.push(...this.leadingComments());
      if (this.t.k === "eof") break;
      const first = this.t;
      const item = this.topItem();
      if (first.blank && items.length > 0) item.blankBefore = true;
      items.push(item);
    }
    return { kind: "program", id: this.id(), items, span: { line: start.line, col: start.col, endLine: this.t.line, endCol: this.t.col } };
  }

  private topItem(): VarDecl | Func {
    const t = this.t;
    if (this.is("#")) {
      const name = this.peek().k === "id" ? `#${this.peek().v}` : "#";
      if (name === "#define") this.fail(t, "unsupported", "#define is not on this bench yet. Use const int instead.");
      this.fail(t, "unsupported", `Lines starting with ${name} are not on this bench yet.`);
    }
    if (this.is("}")) this.fail(t, "brace", "This } has no matching {.");
    if (this.is("{")) this.fail(t, "syntax", "A block in { } needs to belong to a function, such as void loop().");
    const type = this.typeRef(true);
    if (!type) {
      if (t.k === "id" && (this.peek().v === "(" || this.peek().v === "=" || this.peek().v === ".")) {
        this.fail(t, "syntax", "Steps go inside a function, such as setup() or loop().");
      }
      if (t.k === "id" && UNSUPPORTED_STATEMENTS[t.v]) this.fail(t, "unsupported", UNSUPPORTED_STATEMENTS[t.v]!);
      if (t.k === "id" && /^(if|while|for|do|return|break|continue|else)$/.test(t.v)) this.fail(t, "syntax", "Steps go inside a function, such as setup() or loop().");
      this.fail(t, "syntax", "A program is made of variables and functions, such as void setup() { }.");
    }
    const nameTok = this.ident(type.ty === "void" ? "function" : "variable or function");
    if (this.is("(")) return this.func(t, type, nameTok);
    if (type.ty === "void") this.fail(nameTok, "type", "void is only for functions. A variable needs a type such as int.");
    return this.varDeclRest(t, type, nameTok);
  }

  /** Reads a type (with const, static, unsigned, long...). Returns null when the current token does not start one. */
  private typeRef(top: boolean): TypeRef | null {
    const start = this.i;
    let isConst = false;
    let isStatic = false;
    for (;;) {
      if (this.t.k === "id" && this.t.v === "const") {
        isConst = true;
        this.i++;
      } else if (this.t.k === "id" && this.t.v === "static") {
        isStatic = true;
        this.i++;
      } else break;
    }
    const t = this.t;
    if (t.k !== "id") {
      if (isConst || isStatic) this.fail(t, "syntax", "A type such as int goes here.");
      return null;
    }
    if (UNSUPPORTED_TYPES[t.v]) this.fail(t, "unsupported", UNSUPPORTED_TYPES[t.v]!);
    let words: string[] = [];
    if (t.v === "unsigned") {
      words.push("unsigned");
      this.i++;
      if (this.t.k === "id" && (this.t.v === "int" || this.t.v === "long")) {
        words.push(this.t.v);
        this.i++;
        if (words[1] === "long" && this.t.k === "id" && this.t.v === "int") {
          words.push("int");
          this.i++;
        }
      }
      if (this.t.k === "id" && (this.t.v === "char" || this.t.v === "short")) {
        if (this.t.v === "char") this.fail(this.t, "unsupported", "Use byte for a number from 0 to 255.");
        words = ["unsigned", "int"];
        this.i++;
      }
    } else if (t.v === "long") {
      words.push("long");
      this.i++;
      if (this.t.k === "id" && this.t.v === "long") this.fail(this.t, "unsupported", "long long is not on this bench yet. Use long or unsigned long.");
      if (this.t.k === "id" && this.t.v === "int") {
        words.push("int");
        this.i++;
      }
    } else if (t.v === "short") {
      this.i++;
      if (this.t.k === "id" && this.t.v === "int") this.i++;
      words = ["int"];
    } else if (TYPE_NAMES[t.v]) {
      words.push(t.v);
      this.i++;
    } else {
      this.i = start;
      if (isConst || isStatic) this.fail(t, "syntax", "A type such as int goes here.");
      return null;
    }
    const spelling = words.join(" ");
    const ty = TYPE_NAMES[spelling] ?? "int";
    void top;
    const ref: TypeRef = { ty, spelling };
    if (isConst) ref.const = true;
    if (isStatic) ref.static = true;
    return ref;
  }

  private func(start: Token, ret: TypeRef, nameTok: Token): Func {
    this.take("(");
    const params: Param[] = [];
    if (!this.is(")")) {
      if (this.is("void") && this.peek().v === ")") this.i++;
      else {
        for (;;) {
          const pt = this.t;
          const type = this.typeRef(false);
          if (!type) this.fail(pt, "syntax", "Each value a function takes needs a type, such as int count.");
          if (type.ty === "void") this.fail(pt, "type", "A value cannot be void.");
          const pn = this.ident("value");
          if (this.is("[")) this.fail(this.t, "unsupported", "Arrays are not on this bench yet.");
          if (this.is("=")) this.fail(this.t, "unsupported", "Default values are not on this bench yet.");
          params.push({ id: this.id(), name: pn.v, type, span: this.span(pt) });
          if (!this.take(",")) break;
        }
      }
    }
    this.close(")");
    const f: Func = { kind: "func", id: this.id(), ret, name: nameTok.v, params, body: null, nameSpan: this.span(nameTok, nameTok) };
    if (this.take(";")) {
      f.span = this.span(start);
      const tr = this.trailingComment();
      if (tr !== undefined) f.trailing = tr;
      return f;
    }
    if (!this.is("{")) {
      if (this.t.line > this.prev.endLine || this.t.k === "eof") this.failAfterPrev("brace", "A function's steps go between { and }.");
      this.fail(this.t, "brace", "A function's steps go between { and }.");
    }
    f.body = this.block();
    f.span = this.span(start);
    return f;
  }

  private varDeclRest(start: Token, type: TypeRef, firstName: Token): VarDecl {
    const vars: Declarator[] = [];
    let nameTok = firstName;
    for (;;) {
      if (this.is("[")) this.fail(this.t, "unsupported", "Arrays are not on this bench yet.");
      if (this.is("(")) this.fail(this.t, "syntax", "A variable is set with =, like int count = 0;");
      const d: Declarator = { id: this.id(), name: nameTok.v, nameSpan: this.span(nameTok, nameTok) };
      if (this.take("=")) d.init = this.assignment();
      d.span = this.span(nameTok);
      vars.push(d);
      if (!this.take(",")) break;
      nameTok = this.ident("variable");
    }
    if (!this.is(";") && this.t.k === "id" && this.t.line === this.prev.endLine && !d0(this.prev)) {
      this.fail(this.t, "syntax", "Put a comma between two names, or end the step with a semicolon.");
    }
    this.semicolon();
    const decl: VarDecl = { kind: "var", id: this.id(), type, vars, span: this.span(start) };
    const tr = this.trailingComment();
    if (tr !== undefined) decl.trailing = tr;
    return decl;
  }

  // -- statements ------------------------------------------------------------------------------------------------

  private block(): Block {
    const open = this.t;
    this.take("{");
    const blk: Block = { kind: "block", id: this.id(), body: [] };
    const ot = this.trailingComment();
    if (ot !== undefined) blk.openTrailing = ot;
    for (;;) {
      const lead = this.leadingComments();
      blk.body.push(...lead);
      if (this.is("}")) break;
      if (this.t.k === "eof") this.fail(open, "brace", "This { is never closed. Add a } to end it.");
      const first = this.t;
      const s = this.statement();
      if (first.blank && blk.body.length > 0 && lead.length === 0) s.blankBefore = true;
      blk.body.push(s);
    }
    this.take("}");
    blk.span = this.span(open);
    const ct = this.trailingComment();
    if (ct !== undefined) blk.closeTrailing = ct;
    return blk;
  }

  private statement(): Stmt {
    const t = this.t;
    if (t.k === "op") {
      if (t.v === "{") return this.block();
      if (t.v === ";") {
        this.i++;
        const s: Stmt = { kind: "empty", id: this.id(), span: this.span(t) };
        this.attachTrailing(s);
        return s;
      }
      if (t.v === "#") this.fail(t, "unsupported", "Lines starting with # go at the very top, and they are not on this bench yet.");
      if (t.v === ")" || t.v === "]") this.fail(t, "paren", `This ${t.v} has no matching opening bracket.`);
    }
    if (t.k === "id") {
      switch (t.v) {
        case "if":
          return this.ifStmt();
        case "while":
          return this.whileStmt();
        case "do":
          return this.doStmt();
        case "for":
          return this.forStmt();
        case "return": {
          this.i++;
          const s: Stmt = { kind: "return", id: this.id() };
          if (!this.is(";")) s.value = this.expression();
          this.semicolon();
          s.span = this.span(t);
          this.attachTrailing(s);
          return s;
        }
        case "break":
        case "continue": {
          this.i++;
          this.semicolon();
          const s: Stmt = { kind: t.v, id: this.id(), span: this.span(t) };
          this.attachTrailing(s);
          return s;
        }
        case "else":
          this.fail(t, "syntax", "This else has no if before it.");
      }
      if (UNSUPPORTED_STATEMENTS[t.v]) this.fail(t, "unsupported", UNSUPPORTED_STATEMENTS[t.v]!);
      const type = this.typeRef(false);
      if (type) {
        if (type.ty === "void") this.fail(t, "type", "void is only for functions. A variable needs a type such as int.");
        const nameTok = this.ident("variable");
        if (this.is("(") && this.peek().v !== ")") this.fail(nameTok, "syntax", "Functions are made outside other functions, next to setup() and loop().");
        return this.varDeclRest(t, type, nameTok);
      }
    }
    const expr = this.expression();
    // Two names in a row on one line ("delay 100"): a missing bracket is likelier than a missing semicolon.
    if (!this.is(";") && this.t.line === this.prev.endLine && this.t.k !== "eof" && !this.is("}")) {
      if (expr.kind === "name" && (this.t.k === "num" || this.t.k === "id")) this.fail(this.t, "paren", `Values for ${expr.name} go in brackets, like ${expr.name}(${this.t.v}).`);
      if (this.t.k === "id" || this.t.k === "num") this.fail(this.t, "semicolon", "Each step ends with a semicolon. Put one before this.");
      if (this.is("=")) this.fail(this.t, "syntax", "Only a variable can go on the left of =.");
      if (this.is(")")) this.fail(this.t, "paren", "This ) has no matching (.");
    }
    this.semicolon();
    const s: Stmt = { kind: "expr", id: this.id(), expr, span: this.span(t) };
    this.attachTrailing(s);
    return s;
  }

  private attachTrailing(s: Stmt): void {
    const tr = this.trailingComment();
    if (tr !== undefined) s.trailing = tr;
  }

  private testInParens(word: string): Expr {
    if (!this.take("(")) this.fail(this.t, "paren", `After ${word} comes a test in brackets, like ${word} (x > 3).`);
    if (this.is(")")) this.fail(this.t, "syntax", `The test inside ${word} ( ) is missing.`);
    const e = this.expression();
    this.close(")");
    return e;
  }

  private body(word: string): Stmt {
    if (this.is(";") && this.t.line === this.prev.endLine) {
      // `if (x);` is legal C but almost always a slip.
      const t = this.t;
      this.i++;
      return { kind: "empty", id: this.id(), span: this.span(t) };
    }
    if (this.t.k === "eof" || this.is("}")) this.fail(this.t, "syntax", `${word} needs a step or a block { } after its test.`);
    if (this.t.k === "id" && /^(int|long|bool|byte|unsigned|const|static)$/.test(this.t.v)) {
      this.fail(this.t, "syntax", `A new variable inside ${word} needs braces: ${word} (...) { int x = 0; }`);
    }
    return this.statement();
  }

  private ifStmt(): Stmt {
    const t = this.t;
    this.i++;
    const test = this.testInParens("if");
    const then = this.body("if");
    const s: Stmt = { kind: "if", id: this.id(), test, then };
    // A trailing comment after `}` of the then-block was taken by the block.
    const lead = this.peekLeadingBeforeElse();
    if (this.is("else") && lead) {
      this.i++;
      s.else = this.is("if") ? this.ifStmt() : this.body("else");
    }
    s.span = this.span(t);
    if (!s.else && then.kind !== "block") {
      // The trailing comment went to the then-statement already.
    }
    return s;
  }

  /** Comments between `}` and `else` would be lost; only allow else when none sit there. */
  private peekLeadingBeforeElse(): boolean {
    if (!this.is("else")) return false;
    const c = this.comments[this.ci];
    if (c && c.pos < this.t.pos) this.fail(this.t, "syntax", "Move this note: it cannot sit between } and else.");
    return true;
  }

  private whileStmt(): Stmt {
    const t = this.t;
    this.i++;
    const test = this.testInParens("while");
    const body = this.body("while");
    return { kind: "while", id: this.id(), test, body, span: this.span(t) };
  }

  private doStmt(): Stmt {
    const t = this.t;
    this.i++;
    const body = this.statement();
    if (!this.take("while")) this.fail(this.t, "syntax", "do { } ends with while (test);");
    const test = this.testInParens("while");
    this.semicolon();
    const s: Stmt = { kind: "do", id: this.id(), body, test, span: this.span(t) };
    this.attachTrailing(s);
    return s;
  }

  private forStmt(): Stmt {
    const t = this.t;
    this.i++;
    if (!this.take("(")) this.fail(this.t, "paren", "After for come three parts in brackets, like for (int i = 0; i < 5; i++).");
    const s: Stmt & { kind: "for" } = { kind: "for", id: this.id(), body: null as unknown as Stmt };
    if (!this.is(";")) {
      const it = this.t;
      const type = this.typeRef(false);
      if (type) {
        const nameTok = this.ident("variable");
        const vars: Declarator[] = [];
        let nt = nameTok;
        for (;;) {
          const d: Declarator = { id: this.id(), name: nt.v, nameSpan: this.span(nt, nt) };
          if (this.take("=")) d.init = this.assignment();
          d.span = this.span(nt);
          vars.push(d);
          if (!this.take(",")) break;
          nt = this.ident("variable");
        }
        s.init = { kind: "var", id: this.id(), type, vars, span: this.span(it) };
      } else s.init = this.expression();
    }
    if (!this.take(";")) this.failAfterPrev("semicolon", "The three parts of for ( ) are split by semicolons.");
    if (!this.is(";")) s.test = this.expression();
    if (!this.take(";")) this.failAfterPrev("semicolon", "The three parts of for ( ) are split by semicolons.");
    if (!this.is(")")) s.update = this.expression();
    this.close(")");
    s.body = this.body("for");
    s.span = this.span(t);
    return s;
  }

  // -- expressions -----------------------------------------------------------------------------------------------

  private expression(): Expr {
    const e = this.assignment();
    if (this.is(",")) this.fail(this.t, "unsupported", "Commas between steps are not on this bench yet. Use a semicolon and a new step.");
    return e;
  }

  private assignment(): Expr {
    const start = this.t;
    const left = this.conditional();
    if (this.t.k === "op" && ASSIGN_OPS.has(this.t.v)) {
      const opTok = this.t;
      if (left.kind !== "name") this.fail(opTok, "syntax", `Only a variable can go on the left of ${opTok.v}.`);
      this.i++;
      const value = this.assignment();
      return { kind: "assign", id: this.id(), op: opTok.v as AssignOp, target: left, value, span: this.span(start), opSpan: this.span(opTok, opTok) };
    }
    return left;
  }

  private conditional(): Expr {
    const start = this.t;
    const test = this.binary(1);
    if (!this.take("?")) return test;
    const then = this.assignment();
    if (!this.take(":")) this.fail(this.t, "syntax", "A ? needs a : with the other choice.");
    const els = this.conditional();
    return { kind: "cond", id: this.id(), test, then, else: els, span: this.span(start) };
  }

  private binary(minPrec: number): Expr {
    const start = this.t;
    let left = this.unary();
    for (;;) {
      const t = this.t;
      const prec = t.k === "op" ? BINARY_PREC[t.v] : undefined;
      if (prec === undefined || prec < minPrec) return left;
      this.i++;
      if (this.t.k === "eof" || this.is(";") || this.is(")")) this.fail(this.t, "syntax", `A value is missing after ${t.v}.`);
      const right = this.binary(prec + 1);
      left = { kind: "binary", id: this.id(), op: t.v as BinaryOp, left, right, span: this.span(start), opSpan: this.span(t, t) };
    }
  }

  private unary(): Expr {
    const t = this.t;
    if (t.k === "op") {
      if (t.v === "-" || t.v === "+" || t.v === "!" || t.v === "~") {
        this.i++;
        const arg = this.unary();
        return { kind: "unary", id: this.id(), op: t.v, arg, span: this.span(t) };
      }
      if (t.v === "++" || t.v === "--") {
        this.i++;
        const target = this.unary();
        if (target.kind !== "name") this.fail(t, "syntax", `${t.v} works on a variable.`);
        return { kind: "update", id: this.id(), op: t.v, prefix: true, target, span: this.span(t) };
      }
      if (t.v === "&" || t.v === "*") this.fail(t, "unsupported", "Pointers are not on this bench yet.");
      if (t.v === "(" && this.isCast()) {
        this.i++;
        const type = this.typeRef(false)!;
        if (type.ty === "void") this.fail(t, "type", "A value cannot be turned into void.");
        this.close(")");
        const expr = this.unary();
        return { kind: "cast", id: this.id(), type, expr, span: this.span(t) };
      }
    }
    return this.postfix();
  }

  private isCast(): boolean {
    const n = this.peek();
    if (n.k !== "id") return false;
    if (UNSUPPORTED_TYPES[n.v]) this.fail(n, "unsupported", UNSUPPORTED_TYPES[n.v]!);
    return n.v === "const" || n.v === "unsigned" || n.v === "short" || !!TYPE_NAMES[n.v];
  }

  private postfix(): Expr {
    const start = this.t;
    let e = this.primary();
    for (;;) {
      if (this.is("++") || this.is("--")) {
        const op = this.t.v as "++" | "--";
        if (e.kind !== "name") this.fail(this.t, "syntax", `${op} works on a variable.`);
        this.i++;
        e = { kind: "update", id: this.id(), op, prefix: false, target: e, span: this.span(start) };
        continue;
      }
      if (this.is("[")) this.fail(this.t, "unsupported", "Arrays are not on this bench yet.");
      if (this.is("(") && e.kind !== "name") this.fail(this.t, "syntax", "Only a function's name can go before ( ).");
      return e;
    }
  }

  private primary(): Expr {
    const t = this.t;
    if (t.k === "num") {
      this.i++;
      return this.number(t);
    }
    if (t.k === "str") {
      this.i++;
      return { kind: "str", id: this.id(), value: unescape(t.v.slice(1, -1)), raw: t.v, span: this.span(t) };
    }
    if (t.k === "id") {
      if (t.v === "true" || t.v === "false") {
        this.i++;
        return { kind: "bool", id: this.id(), value: t.v === "true", span: this.span(t) };
      }
      if (UNSUPPORTED_STATEMENTS[t.v]) this.fail(t, "unsupported", UNSUPPORTED_STATEMENTS[t.v]!);
      if (UNSUPPORTED_TYPES[t.v]) this.fail(t, "unsupported", UNSUPPORTED_TYPES[t.v]!);
      if (TYPE_NAMES[t.v] || t.v === "const" || t.v === "unsigned") this.fail(t, "syntax", "A new variable is made at the start of a step, like int x = 0;");
      if (/^(if|else|while|for|do|return|break|continue)$/.test(t.v)) this.fail(t, "syntax", `${t.v} starts a step of its own, so it cannot go here.`);
      this.i++;
      let name = t.v;
      let nameEnd = t;
      if (this.is(".")) {
        this.i++;
        const m = this.t;
        if (m.k !== "id") this.fail(m, "syntax", `A name goes after ${name}.`);
        this.i++;
        name = `${name}.${m.v}`;
        nameEnd = m;
      } else if (this.is("::") || this.is("->")) this.fail(this.t, "unsupported", `${this.t.v} is not on this bench yet.`);
      if (this.is("(")) return this.call(t, name, nameEnd);
      const ref: NameRef = { kind: "name", id: this.id(), name, span: this.span(t, nameEnd) };
      return ref;
    }
    if (t.k === "op" && t.v === "(") {
      this.i++;
      if (this.is(")")) this.fail(this.t, "syntax", "A value goes inside these brackets.");
      const expr = this.expression();
      this.close(")");
      return { kind: "paren", id: this.id(), expr, span: this.span(t) };
    }
    if (t.k === "eof") this.failAfterPrev(this.prev.v === "{" || this.unclosed() ? "brace" : "syntax", this.unclosed() ? "A } is missing at the end." : "The program ends too soon.");
    if (t.k === "op" && (t.v === ";" || t.v === ")" || t.v === "," || t.v === "}")) this.fail(t, "syntax", "A value is missing here.");
    if (t.k === "op" && t.v === "{") this.fail(t, "syntax", "A value goes here, not a {.");
    this.fail(t, "syntax", `I can't read ${t.v} here.`);
  }

  private unclosed(): boolean {
    let depth = 0;
    for (let k = 0; k < this.i; k++) {
      const tk = this.toks[k]!;
      if (tk.k === "op" && tk.v === "{") depth++;
      if (tk.k === "op" && tk.v === "}") depth--;
    }
    return depth > 0;
  }

  private call(start: Token, callee: string, nameEnd: Token): Expr {
    const calleeSpan = this.span(start, nameEnd);
    this.take("(");
    const args: Expr[] = [];
    if (!this.is(")")) {
      for (;;) {
        if (this.is(",")) this.fail(this.t, "syntax", "A value is missing before this comma.");
        args.push(this.assignment());
        if (this.take(",")) {
          if (this.is(")")) this.fail(this.t, "syntax", "A value is missing after the last comma.");
          continue;
        }
        if (this.is(")")) break;
        if (this.t.k === "eof" || this.is(";") || this.is("{") || this.t.line > this.prev.endLine) this.failAfterPrev("paren", "Close the bracket with ) here.");
        if (this.t.k === "num" || this.t.k === "id" || this.t.k === "str") this.fail(this.t, "syntax", "Put a comma between the values.");
        this.fail(this.t, "paren", "I expected ) or a comma here.");
      }
    }
    this.take(")");
    return { kind: "call", id: this.id(), callee, args, span: this.span(start), calleeSpan };
  }

  private number(t: Token): Expr {
    const raw = t.v;
    if (/[.]/.test(raw) || (/[eE]/.test(raw) && !/^0[xX]/.test(raw))) this.fail(t, "unsupported", "Decimal numbers are not on this bench yet. Use whole numbers.");
    const m = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|[0-9]+)([uUlL]*)$/.exec(raw);
    if (!m) this.fail(t, "number", `I can't read the number ${raw}.`);
    const body = m[1]!;
    const suffix = m[2]!.toLowerCase();
    if (suffix && !/^(u|l|ul|lu)$/.test(suffix)) {
      if (suffix === "ll" || suffix === "ull" || suffix === "llu") this.fail(t, "unsupported", "long long numbers are not on this bench yet.");
      this.fail(t, "number", `I can't read the end of the number ${raw}.`);
    }
    let value: number;
    if (/^0[xX]/.test(body)) value = parseInt(body.slice(2), 16);
    else if (/^0[bB]/.test(body)) value = parseInt(body.slice(2), 2);
    else if (body.length > 1 && body[0] === "0") {
      if (/[89]/.test(body)) this.fail(t, "number", "A number that starts with 0 is read in base 8 by the board, where 8 and 9 do not exist. Remove the leading 0.");
      value = parseInt(body, 8);
    } else value = parseInt(body, 10);
    if (!(value <= 4294967295)) this.fail(t, "number", `${raw} is too big for the board. The largest number is 4294967295.`);
    return { kind: "num", id: this.id(), value, raw, span: this.span(t) };
  }
}

function d0(t: Token): boolean {
  return t.k === "op" && (t.v === "," || t.v === "=");
}

function unescape(s: string): string {
  return s.replace(/\\(.)/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c === "0" ? "\0" : c));
}

/** The source spelling of a text value (the inverse of the parser's unescape). */
export function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\r/g, "\\r").replace(/\0/g, "\\0")}"`;
}
