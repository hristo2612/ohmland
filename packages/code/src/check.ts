// The checker: resolves every name, works out every value's type, and finds the mistakes a compiler would find,
// in plain words. It also gives the warnings a careful compiler gives (`if (x = 6)`, numbers too big for their type).

import { walk, type Block, type Call, type Expr, type Func, type NameRef, type Program, type Span, type Stmt, type Ty, type VarDecl } from "./ast";
import { BUILTIN_BY_NAME, CONSTANTS, KNOWN_WORDS, type Builtin } from "./builtins";
import { byPosition, distance, err, warn, type Diagnostic, type ErrorKind } from "./errors";
import { RANGE, common, literalType, promote, typeName } from "./types";

export type VarSym = {
  kind: "var";
  name: string;
  ty: Ty;
  /** Global slot (globals and statics) or frame slot (parameters and locals). */
  global: boolean;
  slot: number;
  isConst: boolean;
  declId: number;
};
export type ConstSym = { kind: "const"; name: string; value: number };
export type CallTarget = { kind: "builtin"; b: Builtin } | { kind: "func"; index: number };

export type FuncInfo = {
  name: string;
  ret: Ty;
  params: VarSym[];
  /** Frame slots needed (parameters and every local). */
  frameSize: number;
  node: Func;
};

export type Checked = {
  ast: Program;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  /** Type of every expression, by node id. */
  types: Map<number, Ty>;
  /** What every name reference means, by node id. */
  names: Map<number, VarSym | ConstSym>;
  /** Slot of every declared variable, by declarator id. */
  decls: Map<number, VarSym>;
  /** What every call calls, by node id. */
  calls: Map<number, CallTarget>;
  funcs: FuncInfo[];
  /** Global variables in declaration order (statics included), with their initialisers. */
  globals: { sym: VarSym; init?: Expr }[];
  /** Static locals: initialised once, before setup. */
};

type Scope = Map<string, VarSym>;

const FIXED_SIGNATURE = new Set(["setup", "loop"]);

export function check(ast: Program): Checked {
  return new Checker(ast).run();
}

class Checker {
  private readonly errors: Diagnostic[] = [];
  private readonly warnings: Diagnostic[] = [];
  private readonly types = new Map<number, Ty>();
  private readonly names = new Map<number, VarSym | ConstSym>();
  private readonly decls = new Map<number, VarSym>();
  private readonly calls = new Map<number, CallTarget>();
  private readonly funcs: FuncInfo[] = [];
  private readonly funcIndex = new Map<string, number>();
  private readonly globals: { sym: VarSym; init?: Expr }[] = [];
  private readonly globalScope: Scope = new Map();
  private scopes: Scope[] = [];
  private frame = 0;
  private frameMax = 0;
  private loopDepth = 0;
  private current: FuncInfo | null = null;
  private serialBegun = false;
  private printWarned = false;

  constructor(private readonly ast: Program) {}

  run(): Checked {
    const items = this.ast.items;
    // Functions first (the board's tools let a program call a function written further down).
    for (const it of items) {
      if (it.kind !== "func") continue;
      const prevIdx = this.funcIndex.get(it.name);
      const at = it.nameSpan ?? it.span;
      if (BUILTIN_BY_NAME.has(it.name)) this.error(at, "duplicate", `${it.name} is already one of the board's functions. Pick another name.`);
      else if (CONSTANTS[it.name] !== undefined) this.error(at, "duplicate", `${it.name} is a fixed value of the board. Pick another name.`);
      if (prevIdx !== undefined) {
        const prev = this.funcs[prevIdx]!;
        if (prev.node.body && it.body) this.error(at, "duplicate", `There is already a function called ${it.name}.`);
        if (it.body) {
          prev.node = it;
          prev.ret = it.ret.ty;
        }
        continue;
      }
      this.funcIndex.set(it.name, this.funcs.length);
      this.funcs.push({ name: it.name, ret: it.ret.ty, params: [], frameSize: 0, node: it });
    }
    for (const name of ["setup", "loop"] as const) {
      const f = this.funcs.find((x) => x.name === name && x.node.body);
      if (f) continue;
      // "void Setup()": the function is there, with the wrong capitals.
      const near = this.funcs.find((x) => x.name !== name && x.name.toLowerCase() === name && x.node.body);
      if (near) this.error(near.node.nameSpan ?? near.node.span, "case", `Did you mean ${name}? Capitals matter.`);
      else this.diag("error", { line: 1, col: 1, endLine: 1, endCol: 1 }, name, `Every program needs void ${name}() { }.`);
    }
    // Serial.begin anywhere counts (a careful reader would accept it in a helper too).
    walk(this.ast, (n) => {
      if (n.kind === "call" && n.callee === "Serial.begin") this.serialBegun = true;
    });
    for (const it of items) {
      if (it.kind === "var") this.varDecl(it, true);
      else if (it.kind === "func") this.func(it);
    }
    this.errors.sort(byPosition);
    this.warnings.sort(byPosition);
    return {
      ast: this.ast,
      errors: this.errors,
      warnings: this.warnings,
      types: this.types,
      names: this.names,
      decls: this.decls,
      calls: this.calls,
      funcs: this.funcs,
      globals: this.globals,
    };
  }

  // -- diagnostics -------------------------------------------------------------------------------------------------

  private diag(sev: "error" | "warning", span: Span | undefined, kind: ErrorKind, message: string): void {
    const s = span ?? { line: 1, col: 1, endLine: 1, endCol: 1 };
    const d = (sev === "error" ? err : warn)(s.line, s.col, kind, message, { line: s.endLine, col: s.endCol });
    (sev === "error" ? this.errors : this.warnings).push(d);
  }
  private error(span: Span | undefined, kind: ErrorKind, message: string): void {
    this.diag("error", span, kind, message);
  }
  private warning(span: Span | undefined, kind: ErrorKind, message: string): void {
    this.diag("warning", span, kind, message);
  }

  // -- declarations ------------------------------------------------------------------------------------------------

  private lookup(name: string): VarSym | undefined {
    for (let k = this.scopes.length - 1; k >= 0; k--) {
      const s = this.scopes[k]!.get(name);
      if (s) return s;
    }
    return this.globalScope.get(name);
  }

  private declare(name: string, ty: Ty, opts: { global: boolean; isConst: boolean; declId: number; span?: Span }): VarSym {
    const scope = opts.global ? this.globalScope : this.scopes[this.scopes.length - 1]!;
    if (scope.has(name)) this.error(opts.span, "duplicate", `There is already a variable called ${name} here.`);
    else if (CONSTANTS[name] !== undefined) this.error(opts.span, "duplicate", `${name} is a fixed value of the board. Pick another name.`);
    else if (BUILTIN_BY_NAME.has(name)) this.error(opts.span, "duplicate", `${name} is one of the board's functions. Pick another name.`);
    else if (opts.global && this.funcIndex.has(name)) this.error(opts.span, "duplicate", `There is already a function called ${name}.`);
    const slot = opts.global ? this.globals.length : this.frame++;
    if (!opts.global) this.frameMax = Math.max(this.frameMax, this.frame);
    const sym: VarSym = { kind: "var", name, ty, global: opts.global, slot, isConst: opts.isConst, declId: opts.declId };
    scope.set(name, sym);
    return sym;
  }

  private varDecl(d: VarDecl, global: boolean): void {
    const ty = d.type.ty;
    const isStatic = !global && !!d.type.static;
    for (const v of d.vars) {
      if (v.init) {
        // A static local's initialiser runs once, before setup, so it may only use what exists then.
        if (isStatic && literalValue(v.init) === null && v.init.kind !== "bool") {
          this.error(v.init.span, "type", `A static variable starts from a fixed value, like static ${d.type.spelling} ${v.name} = 0;`);
        }
        this.expr(v.init);
        this.needValue(v.init);
        this.checkFits(v.init, ty, v.name);
      } else if (d.type.const) this.error(v.nameSpan ?? v.span, "const", `${v.name} is const, so it needs a value here: const ${d.type.spelling} ${v.name} = 0;`);
      let sym: VarSym;
      if (isStatic) {
        // Lives with the globals but is only visible in its block.
        const scope = this.scopes[this.scopes.length - 1]!;
        if (scope.has(v.name)) this.error(v.nameSpan ?? v.span, "duplicate", `There is already a variable called ${v.name} here.`);
        sym = { kind: "var", name: v.name, ty, global: true, slot: this.globals.length, isConst: !!d.type.const, declId: v.id };
        scope.set(v.name, sym);
      } else sym = this.declare(v.name, ty, { global, isConst: !!d.type.const, declId: v.id, span: v.nameSpan ?? v.span });
      this.decls.set(v.id, sym);
      if (sym.global) this.globals.push(v.init ? { sym, init: v.init } : { sym });
    }
  }

  private func(f: Func): void {
    const info = this.funcs[this.funcIndex.get(f.name)!]!;
    if (FIXED_SIGNATURE.has(f.name) && (f.ret.ty !== "void" || f.params.length > 0)) {
      this.error(f.nameSpan ?? f.span, "type", `${f.name} must be written void ${f.name}() with nothing in the brackets.`);
    }
    if (!f.body) return;
    if (info.node !== f) return; // a second body was already reported
    this.current = info;
    this.frame = 0;
    this.frameMax = 0;
    this.scopes = [new Map()];
    info.params = f.params.map((p) => {
      const s = this.declare(p.name, p.type.ty, { global: false, isConst: !!p.type.const, declId: p.id, span: p.span });
      this.decls.set(p.id, s);
      return s;
    });
    this.blockBody(f.body, false);
    info.frameSize = this.frameMax;
    if (f.ret.ty !== "void" && !returns(f.body)) {
      this.warning(f.nameSpan ?? f.span, "return", `${f.name} can reach its end without return, and then it gives back a meaningless value.`);
    }
    this.scopes = [];
    this.current = null;
  }

  // -- statements --------------------------------------------------------------------------------------------------

  private blockBody(b: Block, newScope = true): void {
    const saved = this.frame;
    if (newScope) this.scopes.push(new Map());
    for (const s of b.body) this.stmt(s);
    if (newScope) {
      this.scopes.pop();
      this.frame = saved;
    }
  }

  private stmt(s: Stmt): void {
    switch (s.kind) {
      case "block":
        this.blockBody(s);
        return;
      case "var":
        this.varDecl(s, false);
        return;
      case "expr":
        this.expr(s.expr);
        this.noEffect(s.expr);
        return;
      case "if":
        this.test(s.test, "if");
        this.scoped(s.then);
        if (s.else) this.scoped(s.else);
        return;
      case "while":
        this.test(s.test, "while");
        this.loopDepth++;
        this.scoped(s.body);
        this.loopDepth--;
        return;
      case "do":
        this.loopDepth++;
        this.scoped(s.body);
        this.loopDepth--;
        this.test(s.test, "while");
        return;
      case "for": {
        const saved = this.frame;
        this.scopes.push(new Map());
        if (s.init) {
          if (s.init.kind === "var") this.varDecl(s.init, false);
          else this.expr(s.init);
        }
        if (s.test) this.test(s.test, "for");
        if (s.update) this.expr(s.update);
        this.loopDepth++;
        this.scoped(s.body);
        this.loopDepth--;
        this.scopes.pop();
        this.frame = saved;
        return;
      }
      case "return": {
        const f = this.current!;
        if (s.value) {
          this.expr(s.value);
          if (f.ret === "void") this.error(s.span, "type", `${f.name} is a void function, so return cannot give a value back.`);
          else {
            this.needValue(s.value);
            this.checkFits(s.value, f.ret, `${f.name}'s answer`);
          }
        } else if (f.ret !== "void") this.error(s.span, "type", `${f.name} gives back a ${typeName(f.ret)}, so return needs a value.`);
        return;
      }
      case "break":
      case "continue":
        if (this.loopDepth === 0) this.error(s.span, "syntax", `${s.kind} only works inside a loop (while or for).`);
        return;
      case "empty":
      case "comment":
        return;
    }
  }

  /** A statement that is not a block still gets its own scope (a declaration there is a syntax error anyway). */
  private scoped(s: Stmt): void {
    if (s.kind === "block") {
      this.blockBody(s);
      return;
    }
    const saved = this.frame;
    this.scopes.push(new Map());
    this.stmt(s);
    this.scopes.pop();
    this.frame = saved;
  }

  private test(e: Expr, word: string): void {
    this.expr(e);
    this.needValue(e);
    if (e.kind === "assign" && e.op === "=") this.warning(e.opSpan ?? e.span, "assign-in-if", `= sets a value, so this ${word} is about the new value. To compare, use ==.`);
  }

  private noEffect(e: Expr): void {
    let x = e;
    while (x.kind === "paren") x = x.expr;
    if (x.kind === "call" || x.kind === "assign" || x.kind === "update") return;
    if (x.kind === "binary" && (x.op === "==" || x.op === "!=")) {
      this.warning(x.opSpan ?? x.span, "no-effect", `This compares but does nothing with the answer. To set a value, use ${x.op === "==" ? "=" : "a single ="}.`);
      return;
    }
    if (x.kind === "cond" || x.kind === "binary") return; // a && f() and the like may call something
    this.warning(e.span, "no-effect", "This step works out a value and does nothing with it.");
  }

  // -- expressions -------------------------------------------------------------------------------------------------

  private needValue(e: Expr): void {
    const ty = this.types.get(e.id);
    if (ty === "void") {
      const name = e.kind === "call" ? e.callee : "This";
      this.error(e.span, "type", `${name} gives no value back, so it cannot be used here.`);
    } else if (ty === "text") this.error(e.span, "type", "Text in quotes can only be printed, with Serial.print or Serial.println.");
  }

  /** Warns when a fixed number does not fit the type it is stored in. */
  private checkFits(e: Expr, ty: Ty, what: string): void {
    const v = literalValue(e);
    if (v === null || ty === "void" || ty === "text" || ty === "bool") return;
    const [lo, hi] = RANGE[ty];
    if (v > hi) this.warning(e.span, "overflow", `${v} is too big for ${what} (a ${typeName(ty)} holds up to ${hi}).${ty === "int" ? " Use long." : ty === "uint" ? " Use unsigned long." : ""}`);
    else if (v < lo) this.warning(e.span, "overflow", lo === 0 ? `${what} is ${typeName(ty)}, so ${v} becomes a large positive number.` : `${v} is too small for ${what} (a ${typeName(ty)} goes down to ${lo}).`);
  }

  private set(e: Expr, ty: Ty): Ty {
    this.types.set(e.id, ty);
    return ty;
  }

  private expr(e: Expr): Ty {
    switch (e.kind) {
      case "num":
        return this.set(e, literalType(e.value, e.raw));
      case "bool":
        return this.set(e, "bool");
      case "str":
        return this.set(e, "text");
      case "name":
        return this.set(e, this.name(e));
      case "paren":
        return this.set(e, this.expr(e.expr));
      case "cast": {
        this.expr(e.expr);
        this.needValue(e.expr);
        return this.set(e, e.type.ty);
      }
      case "unary": {
        const t = this.expr(e.arg);
        this.needValue(e.arg);
        return this.set(e, e.op === "!" ? "bool" : promote(t));
      }
      case "update": {
        const t = this.expr(e.target);
        this.assignable(e.target, e.op);
        return this.set(e, t);
      }
      case "binary": {
        const a = this.expr(e.left);
        const b = this.expr(e.right);
        this.needValue(e.left);
        this.needValue(e.right);
        switch (e.op) {
          case "&&":
          case "||":
          case "<":
          case ">":
          case "<=":
          case ">=":
          case "==":
          case "!=":
            return this.set(e, "bool");
          case "<<":
          case ">>":
            return this.set(e, promote(a));
          default:
            return this.set(e, common(a, b));
        }
      }
      case "assign": {
        const t = this.expr(e.target);
        this.expr(e.value);
        this.needValue(e.value);
        this.assignable(e.target, e.op);
        if (e.op === "=") this.checkFits(e.value, t, e.target.name);
        return this.set(e, t);
      }
      case "cond": {
        this.expr(e.test);
        this.needValue(e.test);
        const a = this.expr(e.then);
        const b = this.expr(e.else);
        this.needValue(e.then);
        this.needValue(e.else);
        return this.set(e, a === "bool" && b === "bool" ? "bool" : common(a, b));
      }
      case "call":
        return this.set(e, this.call(e));
    }
  }

  private assignable(target: NameRef, op: string): void {
    const sym = this.names.get(target.id);
    if (!sym) return;
    if (sym.kind === "const") this.error(target.span, "const", `${target.name} is a fixed value of the board. You can't change it with ${op}.`);
    else if (sym.isConst) this.error(target.span, "const", `${target.name} is const, so it can't change.`);
  }

  private name(e: NameRef): Ty {
    const sym = this.lookup(e.name);
    if (sym) {
      this.names.set(e.id, sym);
      return sym.ty;
    }
    const c = CONSTANTS[e.name];
    if (c !== undefined) {
      this.names.set(e.id, { kind: "const", name: e.name, value: c });
      return "int";
    }
    if (this.funcIndex.has(e.name) || BUILTIN_BY_NAME.has(e.name)) {
      this.error(e.span, "syntax", `${e.name} is a function. Call it with brackets: ${e.name}().`);
      return "int";
    }
    this.unknown(e.name, e.span, false);
    return "int";
  }

  /** Reports a name the board does not know, with a "did you mean" when one is close. */
  private unknown(name: string, span: Span | undefined, isCall: boolean): void {
    const words = new Set<string>([...KNOWN_WORDS, ...this.funcs.map((f) => f.name), ...this.visibleNames()]);
    const lower = name.toLowerCase();
    const sameButCase = [...words].find((w) => w.toLowerCase() === lower);
    if (sameButCase) {
      this.error(span, "case", `Did you mean ${sameButCase}? Capitals matter.`);
      return;
    }
    if (name.startsWith("Serial.")) {
      // A slip of the keys (Serial.printn) gets a "did you mean"; anything else is simply not here yet.
      const serial = ["Serial.begin", "Serial.print", "Serial.println"].find((w) => distance(lower, w.toLowerCase()) <= 2);
      if (serial) this.error(span, "name", `I don't know ${name}. Did you mean ${serial}?`);
      else this.error(span, "unsupported", `${name} is not on this bench yet. Serial can begin, print and println.`);
      return;
    }
    let best = "";
    let bestD = 99;
    for (const w of words) {
      const d = distance(lower, w.toLowerCase());
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    if (bestD <= Math.min(2, Math.floor(name.length / 3) + 1)) {
      this.error(span, "name", `I don't know ${name}. Did you mean ${best}?`);
      return;
    }
    if (isCall) this.error(span, "name", `I don't know a function called ${name}.`);
    else this.error(span, "name", `I don't know ${name}. Make it first, for example: int ${name} = 0;`);
  }

  private visibleNames(): string[] {
    const out = [...this.globalScope.keys()];
    for (const s of this.scopes) out.push(...s.keys());
    return out;
  }

  private call(e: Call): Ty {
    for (const a of e.args) this.expr(a);
    const b = BUILTIN_BY_NAME.get(e.callee);
    if (b) {
      this.calls.set(e.id, { kind: "builtin", b });
      const min = b.minArgs ?? b.params.length;
      const max = b.params.length;
      if (e.args.length < min || e.args.length > max) {
        const count = min === max ? `${min} value${min === 1 ? "" : "s"}` : `${min} to ${max} values`;
        this.error(e.calleeSpan ?? e.span, "args", min === 0 && max === 0 ? `${b.name} takes no values: ${b.name}().` : `${b.name} needs ${count}: ${b.hint}.`);
        return b.ret === "same" ? "int" : b.ret;
      }
      e.args.forEach((a, k) => {
        if (paramFor(b, e.args.length, k).ty === "printable" && this.types.get(a.id) === "text") return;
        this.needValue(a);
      });
      this.builtinWarnings(e, b);
      if (b.ret !== "same") return b.ret;
      let t: Ty = this.types.get(e.args[0]!.id) ?? "int";
      for (const a of e.args.slice(1)) t = common(t, this.types.get(a.id) ?? "int");
      return promote(t);
    }
    const idx = this.funcIndex.get(e.callee);
    if (idx === undefined) {
      if (this.lookup(e.callee)) this.error(e.calleeSpan ?? e.span, "type", `${e.callee} is a variable, not a function, so it can't be called.`);
      else this.unknown(e.callee, e.calleeSpan ?? e.span, true);
      return "int";
    }
    const f = this.funcs[idx]!;
    this.calls.set(e.id, { kind: "func", index: idx });
    const want = f.node.params.length;
    if (e.args.length !== want) {
      this.error(e.calleeSpan ?? e.span, "args", want === 0 ? `${f.name} takes no values: ${f.name}().` : `${f.name} needs ${want} value${want === 1 ? "" : "s"}: ${f.node.params.map((p) => p.name).join(", ")}.`);
    } else e.args.forEach((a) => this.needValue(a));
    return f.ret;
  }

  private builtinWarnings(e: Call, b: Builtin): void {
    const pinArg = ["pinMode", "digitalWrite", "digitalRead", "analogWrite", "analogRead"].includes(b.name) ? e.args[0] : undefined;
    const pin = pinArg ? literalValue(pinArg) : null;
    if (pinArg && pin !== null) {
      if (b.name === "analogRead") {
        if (!((pin >= 0 && pin <= 5) || (pin >= 14 && pin <= 19))) this.warning(pinArg.span, "pin", "analogRead works on A0 to A5.");
      } else if (pin < 0 || pin > 19) this.warning(pinArg.span, "pin", "The board has pins 0 to 13 and A0 to A5.");
    }
    if (b.name === "analogWrite" && e.args[1]) {
      const v = literalValue(e.args[1]);
      if (v !== null && (v < 0 || v > 255)) this.warning(e.args[1].span, "overflow", "analogWrite takes a level from 0 to 255.");
    }
    if (b.name === "pinMode" && e.args[1]) {
      const v = literalValue(e.args[1]);
      if (v !== null && v > 2) this.warning(e.args[1].span, "syntax", "A pin's mode is INPUT, OUTPUT or INPUT_PULLUP.");
    }
    if ((b.name === "Serial.print" || b.name === "Serial.println") && !this.serialBegun && !this.printWarned) {
      this.printWarned = true;
      this.warning(e.calleeSpan ?? e.span, "serial", "Nothing will show: call Serial.begin(9600); in setup() first.");
    }
    if (b.name !== "Serial.print" && b.name !== "Serial.println") return;
    if (e.args[1]) {
      const base = literalValue(e.args[1]);
      if (base !== null && ![2, 8, 10, 16].includes(base)) this.warning(e.args[1].span, "syntax", "The second value of print is a base: DEC, HEX, OCT or BIN.");
      if (this.types.get(e.args[0]!.id) === "text") this.error(e.args[1].span, "args", "Text in quotes is printed as it is, without a base.");
    }
  }
}

/** The parameter a value stands for: random(max) with one value is the top number, not the bottom. */
export function paramFor(b: Builtin, argc: number, k: number): Builtin["params"][number] {
  if (b.name === "random" && argc === 1) return b.params[1]!;
  return b.params[k] ?? b.params[b.params.length - 1]!;
}

/** The value of a fixed number (with an optional minus sign or brackets), or null. */
export function literalValue(e: Expr): number | null {
  if (e.kind === "num") return e.value;
  if (e.kind === "paren") return literalValue(e.expr);
  if (e.kind === "unary" && e.op === "-") {
    const v = literalValue(e.arg);
    return v === null ? null : -v;
  }
  if (e.kind === "name" && CONSTANTS[e.name] !== undefined) return CONSTANTS[e.name]!;
  return null;
}

/** True when every path through a block ends in a return. */
function returns(s: Stmt): boolean {
  switch (s.kind) {
    case "return":
      return true;
    case "block":
      return s.body.some((x) => returns(x));
    case "if":
      return !!s.else && returns(s.then) && returns(s.else);
    case "while":
      return isTrue(s.test);
    case "for":
      return !s.test || isTrue(s.test);
    default:
      return false;
  }
}

function isTrue(e: Expr): boolean {
  return (e.kind === "bool" && e.value) || (e.kind === "num" && e.value !== 0);
}

export type { Call };
