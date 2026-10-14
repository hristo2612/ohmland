// Tree -> bytecode for the interpreter. A small stack machine: every operation works on whole numbers kept inside
// their type's range by explicit WRAP steps, so int wraps at 16 bits and long at 32, as on the real board.
// Each statement starts with a STMT step that costs 1 µs of board time: that is how the program keeps time.

import type { Expr, Program, Span, Stmt, Ty } from "./ast";
import { B, type Builtin } from "./builtins";
import { check, paramFor, type Checked, type VarSym } from "./check";
import type { Diagnostic } from "./errors";
import { parse } from "./parser";
import { RANGE, common, isUnsigned, is32, promote, wrapCode } from "./types";

/** Opcodes. Operand counts are in OPERANDS. */
export const Op = {
  HALT: 0,
  CONST: 1,
  LOADG: 2,
  STOREG: 3,
  LOADL: 4,
  STOREL: 5,
  POP: 6,
  DUP: 7,
  ADD: 8,
  SUB: 9,
  MUL: 10,
  MUL32: 11,
  DIV: 12,
  MOD: 13,
  NEG: 14,
  AND: 15,
  OR: 16,
  XOR: 17,
  BNOT: 18,
  SHL: 19,
  SHR: 20,
  LT: 21,
  LE: 22,
  GT: 23,
  GE: 24,
  EQ: 25,
  NE: 26,
  NOT: 27,
  WRAP: 28,
  JMP: 29,
  JZ: 30,
  JNZ: 31,
  CALL: 32,
  RET: 33,
  BUILTIN: 34,
  STMT: 35,
  PRINTSTR: 36,
} as const;

export const OPERANDS: readonly number[] = [0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 3, 1, 2];

/** How Serial.print shows a value: as a signed or an unsigned number (bool and byte print as numbers). */
export const PRINT_SIGNED = 0;
export const PRINT_UNSIGNED = 1;
/** Width of the printed value, for HEX and BIN of negative numbers (the board prints them as 32-bit unsigned). */

export type CompiledFunc = { name: string; entry: number; frameSize: number; params: number; ret: Ty };

export type Compiled = {
  code: Float64Array;
  /** STMT operands index this: the statement's node id and where it is in the text (when known). */
  stmts: { id: number; span?: Span }[];
  strings: string[];
  funcs: CompiledFunc[];
  globals: number;
  /** Start of the boot code: global initialisers, setup(), then loop() forever. */
  entry: number;
  /** Diagnostics from the checker (warnings only, when compiling succeeded). */
  warnings: Diagnostic[];
};

export type CompileResult =
  | { ok: true; program: Compiled; ast: Program; errors: []; warnings: Diagnostic[] }
  | { ok: false; program: null; ast: Program | null; errors: Diagnostic[]; warnings: Diagnostic[] };

/** Parses, checks and compiles. On mistakes `errors` lists them by position (show the first). */
export function compile(source: string | Program): CompileResult {
  let ast: Program;
  if (typeof source === "string") {
    const p = parse(source);
    if (!p.ast) return { ok: false, program: null, ast: null, errors: p.errors, warnings: [] };
    ast = p.ast;
  } else ast = source;
  const c = check(ast);
  if (c.errors.length) return { ok: false, program: null, ast, errors: c.errors, warnings: c.warnings };
  return { ok: true, program: new Emitter(c).run(), ast, errors: [], warnings: c.warnings };
}

class Emitter {
  private code: number[] = [];
  private stmts: { id: number; span?: Span }[] = [];
  private strings: string[] = [];
  private funcs: CompiledFunc[] = [];
  /** Jump fix-ups for function calls before their entry is known. */
  private loops: { breaks: number[]; conts: number[] }[] = [];
  /** Return type of the function being emitted. */
  private ret: Ty = "void";

  constructor(private readonly c: Checked) {}

  run(): Compiled {
    const c = this.c;
    this.funcs = c.funcs.map((f) => ({ name: f.name, entry: -1, frameSize: f.frameSize, params: f.params.length, ret: f.ret }));
    // Boot: globals, setup, loop forever.
    const entry = this.code.length;
    for (const g of c.globals) {
      if (!g.init) continue;
      this.expr(g.init, g.sym.ty);
      this.store(g.sym);
      this.emit(Op.POP);
    }
    const setup = c.funcs.findIndex((f) => f.name === "setup");
    const loop = c.funcs.findIndex((f) => f.name === "loop");
    this.emit(Op.CALL, setup);
    this.emit(Op.POP);
    const top = this.code.length;
    this.emit(Op.STMT, this.stmtIndex(-1));
    this.emit(Op.CALL, loop);
    this.emit(Op.POP);
    this.emit(Op.JMP, top);
    this.emit(Op.HALT);
    c.funcs.forEach((f, k) => {
      this.funcs[k]!.entry = this.code.length;
      this.ret = f.ret;
      if (f.node.body) this.stmt(f.node.body);
      this.emit(Op.CONST, 0);
      this.emit(Op.RET);
    });
    return { code: Float64Array.from(this.code), stmts: this.stmts, strings: this.strings, funcs: this.funcs, globals: c.globals.length, entry, warnings: c.warnings };
  }

  private emit(op: number, ...args: number[]): number {
    const at = this.code.length;
    this.code.push(op, ...args);
    return at;
  }
  private here(): number {
    return this.code.length;
  }
  /** Patches the jump target of the instruction at `at`. */
  private patch(at: number, target: number): void {
    this.code[at + 1] = target;
  }
  private stmtIndex(id: number, span?: Span): number {
    this.stmts.push(span ? { id, span } : { id });
    return this.stmts.length - 1;
  }
  private mark(s: { id: number; span?: Span }): void {
    this.emit(Op.STMT, this.stmtIndex(s.id, s.span));
  }

  private load(sym: VarSym): void {
    this.emit(sym.global ? Op.LOADG : Op.LOADL, sym.slot);
  }
  private store(sym: VarSym): void {
    this.emit(sym.global ? Op.STOREG : Op.STOREL, sym.slot);
  }

  /** Converts the value on top of the stack from one type to another (all integer conversions wrap). */
  private convert(from: Ty, to: Ty): void {
    if (from === to || to === "void" || to === "text" || from === "void" || from === "text") return;
    if (to === "bool") {
      if (from !== "bool") this.emit(Op.WRAP, wrapCode("bool"));
      return;
    }
    const [flo, fhi] = from === "bool" ? [0, 1] : RANGE[from];
    const [tlo, thi] = RANGE[to];
    if (flo >= tlo && fhi <= thi) return;
    this.emit(Op.WRAP, wrapCode(to));
  }

  private ty(e: Expr): Ty {
    return this.c.types.get(e.id) ?? "int";
  }

  // -- statements --------------------------------------------------------------------------------------------------

  private stmt(s: Stmt): void {
    switch (s.kind) {
      case "block":
        for (const x of s.body) this.stmt(x);
        return;
      case "var":
        for (const d of s.vars) {
          const sym = this.c.decls.get(d.id)!;
          if (sym.global) continue; // statics are set up with the globals
          if (d.init) {
            this.mark(d.span ? { id: s.id, span: d.span } : s);
            this.expr(d.init, sym.ty);
          } else this.emit(Op.CONST, 0);
          this.store(sym);
          this.emit(Op.POP);
        }
        return;
      case "expr":
        this.mark(s);
        this.expr(s.expr, null);
        this.emit(Op.POP);
        return;
      case "if": {
        this.mark(s);
        this.expr(s.test, "bool");
        const jz = this.emit(Op.JZ, 0);
        this.stmt(s.then);
        if (s.else) {
          const jmp = this.emit(Op.JMP, 0);
          this.patch(jz, this.here());
          this.stmt(s.else);
          this.patch(jmp, this.here());
        } else this.patch(jz, this.here());
        return;
      }
      case "while": {
        const top = this.here();
        this.mark(s);
        this.expr(s.test, "bool");
        const jz = this.emit(Op.JZ, 0);
        this.loops.push({ breaks: [], conts: [] });
        this.stmt(s.body);
        this.emit(Op.JMP, top);
        const l = this.loops.pop()!;
        this.patch(jz, this.here());
        for (const b of l.breaks) this.patch(b, this.here());
        for (const k of l.conts) this.patch(k, top);
        return;
      }
      case "do": {
        const top = this.here();
        this.loops.push({ breaks: [], conts: [] });
        this.stmt(s.body);
        const l = this.loops.pop()!;
        const cont = this.here();
        this.mark(s);
        this.expr(s.test, "bool");
        this.emit(Op.JNZ, top);
        for (const b of l.breaks) this.patch(b, this.here());
        for (const k of l.conts) this.patch(k, cont);
        return;
      }
      case "for": {
        if (s.init) {
          if (s.init.kind === "var") this.stmt(s.init);
          else {
            this.mark(s);
            this.expr(s.init, null);
            this.emit(Op.POP);
          }
        }
        const top = this.here();
        this.mark(s);
        let jz = -1;
        if (s.test) {
          this.expr(s.test, "bool");
          jz = this.emit(Op.JZ, 0);
        }
        this.loops.push({ breaks: [], conts: [] });
        this.stmt(s.body);
        const l = this.loops.pop()!;
        const cont = this.here();
        if (s.update) {
          this.expr(s.update, null);
          this.emit(Op.POP);
        }
        this.emit(Op.JMP, top);
        if (jz >= 0) this.patch(jz, this.here());
        for (const b of l.breaks) this.patch(b, this.here());
        for (const k of l.conts) this.patch(k, cont);
        return;
      }
      case "return":
        this.mark(s);
        if (s.value) this.expr(s.value, this.ret);
        else this.emit(Op.CONST, 0);
        this.emit(Op.RET);
        return;
      case "break":
        this.loops[this.loops.length - 1]!.breaks.push(this.emit(Op.JMP, 0));
        return;
      case "continue":
        this.loops[this.loops.length - 1]!.conts.push(this.emit(Op.JMP, 0));
        return;
      case "empty":
      case "comment":
        return;
    }
  }

  // -- expressions -------------------------------------------------------------------------------------------------

  /** Leaves the value of `e` on the stack, converted to `want` (null: its own type). */
  private expr(e: Expr, want: Ty | null): void {
    const own = this.ty(e);
    this.value(e);
    if (want) this.convert(own, want);
  }

  private value(e: Expr): void {
    switch (e.kind) {
      case "num":
        this.emit(Op.CONST, e.value);
        return;
      case "bool":
        this.emit(Op.CONST, e.value ? 1 : 0);
        return;
      case "str":
        this.emit(Op.CONST, 0);
        return;
      case "name": {
        const sym = this.c.names.get(e.id);
        if (!sym) this.emit(Op.CONST, 0);
        else if (sym.kind === "const") this.emit(Op.CONST, sym.value);
        else this.load(sym);
        return;
      }
      case "paren":
        this.value(e.expr);
        return;
      case "cast":
        this.expr(e.expr, e.type.ty);
        return;
      case "unary": {
        const t = promote(this.ty(e.arg));
        if (e.op === "!") {
          this.expr(e.arg, null);
          this.emit(Op.NOT);
          return;
        }
        this.expr(e.arg, t);
        if (e.op === "-") {
          this.emit(Op.NEG);
          this.emit(Op.WRAP, wrapCode(t));
        } else if (e.op === "~") {
          this.emit(Op.BNOT);
          this.emit(Op.WRAP, wrapCode(t));
        }
        return;
      }
      case "update": {
        const sym = this.c.names.get(e.target.id);
        if (!sym || sym.kind !== "var") {
          this.emit(Op.CONST, 0);
          return;
        }
        this.load(sym);
        if (!e.prefix) this.emit(Op.DUP);
        this.emit(Op.CONST, 1);
        this.emit(e.op === "++" ? Op.ADD : Op.SUB);
        this.emit(Op.WRAP, wrapCode(sym.ty));
        this.store(sym);
        if (!e.prefix) this.emit(Op.POP);
        return;
      }
      case "binary":
        this.binary(e.op, e.left, e.right);
        return;
      case "assign": {
        const sym = this.c.names.get(e.target.id);
        if (!sym || sym.kind !== "var") {
          this.expr(e.value, null);
          return;
        }
        if (e.op === "=") {
          this.expr(e.value, sym.ty);
        } else {
          const op = e.op.slice(0, -1) as "+" | "-" | "*" | "/" | "%" | "&" | "|" | "^" | "<<" | ">>";
          const vt = this.ty(e.value);
          const t = op === "<<" || op === ">>" ? promote(sym.ty) : common(sym.ty, vt);
          this.load(sym);
          this.convert(sym.ty, t);
          this.expr(e.value, op === "<<" || op === ">>" ? "int" : t);
          this.arith(op, t);
          this.convert(t, sym.ty);
        }
        this.store(sym);
        return;
      }
      case "cond": {
        const t = this.ty(e);
        this.expr(e.test, "bool");
        const jz = this.emit(Op.JZ, 0);
        this.expr(e.then, t);
        const jmp = this.emit(Op.JMP, 0);
        this.patch(jz, this.here());
        this.expr(e.else, t);
        this.patch(jmp, this.here());
        return;
      }
      case "call":
        this.call(e);
        return;
    }
  }

  private binary(op: string, left: Expr, right: Expr): void {
    const a = this.ty(left);
    const b = this.ty(right);
    if (op === "&&" || op === "||") {
      this.expr(left, null);
      const j1 = this.emit(op === "&&" ? Op.JZ : Op.JNZ, 0);
      this.expr(right, null);
      const j2 = this.emit(op === "&&" ? Op.JZ : Op.JNZ, 0);
      this.emit(Op.CONST, op === "&&" ? 1 : 0);
      const jend = this.emit(Op.JMP, 0);
      this.patch(j1, this.here());
      this.patch(j2, this.here());
      this.emit(Op.CONST, op === "&&" ? 0 : 1);
      this.patch(jend, this.here());
      return;
    }
    if (op === "<<" || op === ">>") {
      const t = promote(a);
      this.expr(left, t);
      this.expr(right, "int");
      this.arith(op, t);
      return;
    }
    const t = common(a, b);
    this.expr(left, t);
    this.expr(right, t);
    switch (op) {
      case "<":
        this.emit(Op.LT);
        return;
      case "<=":
        this.emit(Op.LE);
        return;
      case ">":
        this.emit(Op.GT);
        return;
      case ">=":
        this.emit(Op.GE);
        return;
      case "==":
        this.emit(Op.EQ);
        return;
      case "!=":
        this.emit(Op.NE);
        return;
    }
    this.arith(op, t);
  }

  /** Arithmetic on two values of type t already on the stack; leaves a value of type t. */
  private arith(op: string, t: Ty): void {
    const w = wrapCode(t);
    switch (op) {
      case "+":
        this.emit(Op.ADD);
        break;
      case "-":
        this.emit(Op.SUB);
        break;
      case "*":
        this.emit(is32(t) ? Op.MUL32 : Op.MUL);
        break;
      case "/":
        this.emit(Op.DIV, isUnsigned(t) ? 0 : 1);
        break;
      case "%":
        this.emit(Op.MOD, isUnsigned(t) ? 0 : 1);
        break;
      case "&":
        this.emit(Op.AND);
        break;
      case "|":
        this.emit(Op.OR);
        break;
      case "^":
        this.emit(Op.XOR);
        break;
      case "<<":
        this.emit(Op.SHL);
        break;
      case ">>":
        this.emit(Op.SHR, isUnsigned(t) ? 1 : 0);
        break;
    }
    this.emit(Op.WRAP, w);
  }

  private call(e: Expr & { kind: "call" }): void {
    const target = this.c.calls.get(e.id);
    if (!target) {
      this.emit(Op.CONST, 0);
      return;
    }
    if (target.kind === "func") {
      const f = this.c.funcs[target.index]!;
      e.args.forEach((a, k) => this.expr(a, f.params[k]?.ty ?? null));
      this.emit(Op.CALL, target.index);
      return;
    }
    this.builtin(target.b, e);
  }

  private builtin(b: Builtin, e: Expr & { kind: "call" }): void {
    const argc = e.args.length;
    if (b.code === B.serialPrint || b.code === B.serialPrintln) {
      const nl = b.code === B.serialPrintln ? 1 : 0;
      const first = e.args[0];
      if (first && first.kind === "str") {
        this.strings.push(first.value);
        this.emit(Op.PRINTSTR, this.strings.length - 1, nl);
        return;
      }
      if (first) {
        const t = this.ty(first);
        // print(int) and print(long) show signed numbers; unsigned types, bool and byte print as positive numbers.
        const signed = t === "int" || t === "long" ? PRINT_SIGNED : PRINT_UNSIGNED;
        this.expr(first, null);
        if (e.args[1]) this.expr(e.args[1], "int");
        else this.emit(Op.CONST, 10);
        this.emit(Op.BUILTIN, b.code, 2, signed + (is32(t) ? 2 : 0));
        return;
      }
      this.emit(Op.BUILTIN, b.code, 0, 0);
      return;
    }
    if (b.ret === "same") {
      const t = this.ty(e);
      for (const a of e.args) this.expr(a, t);
      this.emit(Op.BUILTIN, b.code, argc, isUnsigned(t) ? 0 : 1);
      this.emit(Op.WRAP, wrapCode(t));
      return;
    }
    e.args.forEach((a, k) => {
      const p = paramFor(b, argc, k);
      this.expr(a, p.ty === "any" || p.ty === "printable" ? null : p.ty);
    });
    this.emit(Op.BUILTIN, b.code, argc, 0);
  }
}
