/**
 * The block view's model, without a DOM: where blocks sit in a program's block tree, what the palette offers, and
 * the edits the drawer makes (place, move, remove, change a number or a word). Blocks are one view of the program's
 * syntax tree (@ohmland/code: toBlocks and fromBlocks); every edit here returns a new block tree, which the drawer
 * turns back into text with `textOf`, so the text view redraws from the same tree.
 */
import { analyze, BUILTIN_BY_NAME, CONSTANTS, findNode, format, fromBlocks, nodeAt, parse, toBlocks, type BlockNode, type BlockProgram, type Diagnostic, type Program } from "@ohmland/code";

/** A place in a block tree: keys and indexes from the program down, such as ["items", 1, "body", 0]. */
export type Path = readonly (string | number)[];

/** Where a statement can go: a list of statements (its path) and an index in it. */
export type Slot = { list: Path; index: number };

/** What the program reads as now: its tree and blocks (null while the text cannot be read), and its first mistake. */
export type Reading = { ast: Program | null; blocks: BlockProgram | null; error: Diagnostic | null };

// ---- Reading and writing --------------------------------------------------------------------------------------

/** The blocks of a program's text (null when it cannot be read), and its first mistake (what Upload refuses). */
export function readProgram(source: string): Reading {
  const a = analyze(source);
  return { ast: a.ast, blocks: a.ast ? toBlocks(a.ast) : null, error: a.errors[0] ?? null };
}

/** A block tree as text: the tree it shows, printed. Null when a block cannot be read (a slot left empty). */
export function textOf(prog: BlockProgram): string | null {
  try {
    return format(fromBlocks(prog));
  } catch {
    return null;
  }
}

/** The line a block's statement starts on, in the text it was read from. */
export function lineOf(ast: Program | null, id: number | undefined): number | null {
  if (!ast || id === undefined) return null;
  const n = findNode(ast, id) as { span?: { line: number } } | null;
  return n?.span?.line ?? null;
}

/** The id of the statement at a line and column of the text (the block to light), or null. */
export function blockAt(ast: Program | null, line: number, col: number): number | null {
  if (!ast) return null;
  return nodeAt(ast, line, col)?.id ?? null;
}

// ---- Paths ------------------------------------------------------------------------------------------------------

/** The value at a path. */
export function at(root: unknown, path: Path): unknown {
  let cur = root as Record<string | number, unknown> | undefined;
  for (const k of path) cur = cur?.[k] as Record<string | number, unknown> | undefined;
  return cur;
}

/** A copy of `root` with the value at `path` replaced (only the nodes along the path are copied). */
export function setAt<T>(root: T, path: Path, value: unknown): T {
  if (!path.length) return value as T;
  const [k, ...rest] = path;
  const node = root as unknown as Record<string | number, unknown> | unknown[];
  const child = setAt((node as Record<string | number, unknown>)[k!], rest, value);
  if (Array.isArray(node)) {
    const copy = [...node];
    copy[k as number] = child;
    return copy as T;
  }
  return { ...(node as object), [k!]: child } as T;
}

const listAt = (prog: BlockProgram, list: Path): BlockNode[] => (at(prog, list) as BlockNode[] | undefined) ?? [];

/** Inserts statements into a list (a missing list, an empty body, is made). */
export function insertAt(prog: BlockProgram, slot: Slot, blocks: readonly BlockNode[]): BlockProgram {
  const list = [...listAt(prog, slot.list)];
  list.splice(Math.max(0, Math.min(slot.index, list.length)), 0, ...blocks);
  return setAt(prog, slot.list, list);
}

/** Removes the statement at a slot. */
export function removeAt(prog: BlockProgram, slot: Slot): BlockProgram {
  const list = [...listAt(prog, slot.list)];
  list.splice(slot.index, 1);
  return setAt(prog, slot.list, list);
}

/** Whether `inner` is `outer` or lies inside it. */
const within = (inner: Path, outer: Path) => outer.length <= inner.length && outer.every((k, i) => inner[i] === k);

/**
 * Moves a statement to another slot (`to` counts positions as they are before the move). A block cannot go inside
 * itself; that move returns the program unchanged.
 */
export function moveBlock(prog: BlockProgram, from: Slot, to: Slot): BlockProgram {
  const block = listAt(prog, from.list)[from.index];
  if (!block) return prog;
  if (within(to.list, [...from.list, from.index])) return prog;
  const same = to.list.length === from.list.length && within(to.list, from.list);
  const removed = removeAt(prog, from);
  // A slot further down the same list moves up by one once the block is out; so does a slot inside a later sibling.
  let target: Slot = to;
  if (same && to.index > from.index) target = { list: to.list, index: to.index - 1 };
  else if (to.list.length > from.list.length && within(to.list, from.list) && (to.list[from.list.length] as number) > from.index) {
    const list = [...to.list];
    list[from.list.length] = (list[from.list.length] as number) - 1;
    target = { list, index: to.index };
  }
  if (same && (target.index === from.index)) return prog;
  return insertAt(removed, target, [block]);
}


/** Whether a block may go into a list: the program's top level takes declarations and functions, bodies take steps. */
export function fits(block: BlockNode, list: Path): boolean {
  const top = list.length === 1 && list[0] === "items";
  if (top) return block.type === "declare" || block.type === "comment";
  return !["setup", "loop", "function", "prototype"].includes(block.type);
}

/** Every statement list of a program, in reading order, with the blocks in it (for gaps and keyboard moves). */
export function statementLists(prog: BlockProgram): Path[] {
  const out: Path[] = [["items"]];
  const visit = (list: BlockNode[], path: Path) => {
    list.forEach((b, i) => {
      const here = [...path, i];
      if (b.body !== undefined || ["setup", "loop", "function", "if", "every", "while", "do", "for", "group"].includes(b.type)) {
        out.push([...here, "body"]);
        visit(b.body ?? [], [...here, "body"]);
      }
      if (b.else) {
        out.push([...here, "else"]);
        visit(b.else, [...here, "else"]);
      }
    });
  };
  visit(prog.items, ["items"]);
  return out;
}

// ---- The palette ------------------------------------------------------------------------------------------------

/**
 * What a palette name puts in: one step, or a few, written in bench C. Leading declarations are the globals the step
 * needs (the clock check's `last`): they go at the top of the program unless the name is already declared there.
 */
export const SNIPPETS: Record<string, string> = {
  pinMode: "pinMode(13, OUTPUT);",
  digitalWrite: "digitalWrite(13, HIGH);",
  analogWrite: "analogWrite(9, 128);",
  delay: "delay(1000);",
  delayMicroseconds: "delayMicroseconds(100);",
  every: "unsigned long last = 0;\nif (millis() - last >= 1000) {\n  last = millis();\n}",
  if: "if (digitalRead(2) == LOW) {\n}",
  "if-else": "if (digitalRead(2) == LOW) {\n} else {\n}",
  while: "while (digitalRead(2) == HIGH) {\n}",
  for: "for (int i = 0; i < 3; i++) {\n}",
  "Serial.begin": "Serial.begin(9600);",
  "Serial.print": 'Serial.print("hello");',
  "Serial.println": 'Serial.println("hello");',
  randomSeed: "randomSeed(analogRead(A0));",
  count: "int count = 0;\ncount++;",
  comment: "// a note",
};

/** One thing the palette offers: the steps it puts in, the globals they need, and the entry it came from. */
export type PaletteItem = { entry: string; steps: BlockNode[]; globals: BlockNode[] };

/** A palette entry as blocks: a name from SNIPPETS, or steps written in bench C. Null when it cannot be read. */
export function paletteItem(entry: string): PaletteItem | null {
  const code = SNIPPETS[entry.trim()] ?? entry;
  const p = parse(`void __palette() {\n${code}\n}\n`);
  const body = p.ast ? toBlocks(p.ast).items[0]?.body : undefined;
  if (!body?.length) return null;
  const blocks = body.map(fresh);
  let k = 0;
  while (k < blocks.length - 1 && blocks[k]!.type === "declare") k++;
  return { entry, globals: blocks.slice(0, k), steps: blocks.slice(k) };
}

/** A copy of a block without ids or layout, as a block made in the editor (fromBlocks mints fresh ids). */
export function fresh(b: BlockNode): BlockNode {
  const out: BlockNode = { type: b.type };
  if (b.fields) out.fields = { ...b.fields };
  if (b.inputs) out.inputs = Object.fromEntries(Object.entries(b.inputs).map(([k, v]) => [k, fresh(v)]));
  if (b.args) out.args = b.args.map(fresh);
  if (b.body) out.body = b.body.map(fresh);
  if (b.else) out.else = b.else.map(fresh);
  if (b.params) out.params = b.params.map(({ name, type }) => ({ name, type }));
  if (b.more) out.more = b.more.map((m) => ({ name: m.name, ...(m.value ? { value: fresh(m.value) } : {}) }));
  return out;
}

/** Names declared at the top of the program. */
function globalNames(prog: BlockProgram): Set<string> {
  const out = new Set<string>();
  for (const b of prog.items) {
    if (b.type !== "declare") continue;
    out.add(String(b.fields?.name ?? ""));
    for (const m of b.more ?? []) out.add(m.name);
  }
  return out;
}

/** Clock variables of the program's "every" blocks. */
function everyVars(prog: BlockProgram): Set<string> {
  const out = new Set<string>();
  const visit = (b: BlockNode) => {
    if (b.type === "every" && typeof b.fields?.var === "string") out.add(b.fields.var);
    for (const x of [...(b.body ?? []), ...(b.else ?? [])]) visit(x);
  };
  prog.items.forEach(visit);
  return out;
}

/** A block with one variable renamed everywhere inside it. */
function rename(b: BlockNode, from: string, to: string): BlockNode {
  const out: BlockNode = { ...b };
  if (b.fields) {
    out.fields = { ...b.fields };
    for (const k of ["name", "var"]) if (out.fields[k] === from && (k === "var" || b.type === "get" || b.type === "set" || b.type === "change" || b.type === "declare")) out.fields[k] = to;
  }
  if (b.inputs) out.inputs = Object.fromEntries(Object.entries(b.inputs).map(([k, v]) => [k, rename(v, from, to)]));
  if (b.args) out.args = b.args.map((x) => rename(x, from, to));
  if (b.body) out.body = b.body.map((x) => rename(x, from, to));
  if (b.else) out.else = b.else.map((x) => rename(x, from, to));
  return out;
}

/**
 * Puts a palette item into the program at a slot. Its globals go to the top (after the program's own declarations)
 * unless already declared; an "every" block gets a clock variable of its own (`last`, then `last2` ...), since two
 * clock checks sharing one would disturb each other.
 */
export function placeItem(prog: BlockProgram, slot: Slot, item: PaletteItem): BlockProgram {
  let steps = item.steps.map(fresh);
  let globals = item.globals.map(fresh);
  const declared = globalNames(prog);
  const clocks = everyVars(prog);
  for (const s of steps) {
    const v = s.type === "every" ? s.fields?.var : undefined;
    if (typeof v !== "string" || !clocks.has(v)) continue;
    let n = 2;
    while (declared.has(`${v}${n}`) || clocks.has(`${v}${n}`)) n++;
    const name = `${v}${n}`;
    steps = steps.map((x) => rename(x, v, name));
    globals = globals.map((g) => rename(g, v, name));
  }
  globals = globals.filter((g) => !declared.has(String(g.fields?.name ?? "")));
  let next = insertAt(prog, slot, steps);
  if (globals.length) {
    let top = 0;
    while (top < next.items.length && (next.items[top]!.type === "declare" || next.items[top]!.type === "comment")) top++;
    // The slot was counted before the globals went in: a top-level slot after them moves down.
    next = insertAt(next, { list: ["items"], index: top }, globals);
  }
  return next;
}

// ---- Changing a value -------------------------------------------------------------------------------------------

/** Words that can stand in for each other, offered as a choice where one of them is written. */
export const CONSTANT_GROUPS: readonly (readonly string[])[] = [
  ["HIGH", "LOW"],
  ["INPUT", "OUTPUT", "INPUT_PULLUP"],
  ["DEC", "HEX", "OCT", "BIN"],
  ["A0", "A1", "A2", "A3", "A4", "A5"],
];

/** The words a constant can be changed to (just itself when it belongs to no group). */
export function choicesFor(name: string): readonly string[] {
  return CONSTANT_GROUPS.find((g) => g.includes(name)) ?? [name];
}

/** Operators a block's operator can be changed to, by block type. */
export const OPERATORS: Record<string, readonly string[]> = {
  compare: ["==", "!=", "<", ">", "<=", ">="],
  math: ["+", "-", "*", "/", "%"],
  logic: ["&&", "||"],
  set: ["=", "+=", "-="],
  change: ["++", "--"],
};

/**
 * A number typed into a block: a whole number (a minus sign makes it negative), or null when it is not one. Spellings
 * such as 0x1F are kept.
 */
export function numberBlock(text: string): BlockNode | null {
  const t = text.trim();
  const m = /^(-)?\s*(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+)([uU]?[lL]?|[lL][uU]?)$/.exec(t);
  if (!m) return null;
  const raw = m[2]! + m[3]!;
  const body = m[2]!;
  const value = /^0[xX]/.test(body) ? parseInt(body.slice(2), 16) : /^0[bB]/.test(body) ? parseInt(body.slice(2), 2) : Number(body);
  if (!Number.isSafeInteger(value)) return null;
  const num: BlockNode = { type: "number", fields: { value, raw } };
  return m[1] ? { type: "negate", inputs: { value: num } } : num;
}

/** A name typed into a block: letters, digits and _ (not starting with a digit), or null. */
export function nameOk(text: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(text.trim());
}

/** Whether a block type is a built-in call ("digitalWrite", "Serial.println"), as opposed to a statement or a value. */
export const isBuiltin = (type: string): boolean => BUILTIN_BY_NAME.has(type);

/** Whether a name is one of the board's constants (HIGH, OUTPUT, A0 ...). */
export const isConstant = (name: string): boolean => CONSTANTS[name] !== undefined;
