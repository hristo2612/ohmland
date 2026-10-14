/**
 * The code drawer's blocks: our own ink blocks, one per statement or value of the program's tree. Statements stack in
 * their lists (setup, loop, the body of an if or a clock check); values sit in them as blanks filled in blue ink (a
 * number, HIGH or LOW, a name, an operator) that the learner changes in place.
 *
 * Three ways to move a block, all the same edit: drag it by its grip (or from the palette) and drop it where the
 * insertion line shows; tap it, then tap one of the slots that open ("Put it here"); or with the keyboard, Enter on a
 * grip or a palette block to pick it up, Up and Down (or Tab) to a slot, Enter to put it down (Escape lets go). On a
 * grip, Alt+Up and Alt+Down move the block one place, Delete takes it out, Up and Down walk from block to block. A
 * block carried back to the palette ("Take it out") leaves the program.
 */
import { Fragment, useEffect, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BUILTIN_BY_NAME, type BlockNode, type BlockProgram } from "@ohmland/code";
import { m } from "../../i18n";
import { at, choicesFor, fits, moveBlock, nameOk, numberBlock, OPERATORS, placeItem, removeAt, setAt, type PaletteItem, type Path, type Slot } from "./blocks";

/** What is being carried: a new block from the palette, or a block already in the program. */
export type Carry = { kind: "new"; item: PaletteItem } | { kind: "move"; from: Slot; block: BlockNode };

export type BlocksViewProps = {
  blocks: BlockProgram;
  /** The program's text does not read right: show the last good blocks, greyed, untouchable. */
  frozen: boolean;
  palette: PaletteItem[];
  /** The block holding the mistake Upload refused. */
  errorId: number | null;
  /** The block to light (the text cursor is in it). */
  litId: number | null;
  /** The text of each line (for screen readers: a block is read as its line). */
  lineText(id: number | undefined): string;
  onChange(next: BlockProgram): void;
  /** A block got focus or was tapped: light its line in the text. */
  onLight(id: number | null): void;
  announce(text: string): void;
};

const CONTAINERS = new Set(["setup", "loop", "function", "if", "every", "while", "do", "for", "group"]);
const TYPES = ["int", "long", "unsigned long", "bool", "byte", "unsigned int"];
const gapKey = (s: Slot) => `${s.list.join(".")}#${s.index}`;
const ghostAt = (x: number, y: number) => `translate(${x + 12}px, ${y - 18}px)`;
const sameList = (a: Path, b: Path) => a.length === b.length && a.every((k, i) => b[i] === k);

/** A block as one short line of words, for labels and the drag ghost ("digitalWrite 13 LOW"). */
export function blockWords(b: BlockNode): string {
  const v = (x: BlockNode | undefined): string => (x ? blockWords(x) : "");
  const f = b.fields ?? {};
  switch (b.type) {
    case "number":
      return String(f.raw ?? f.value ?? "");
    case "bool":
      return String(!!f.value);
    case "text":
      return `"${String(f.value ?? "")}"`;
    case "constant":
    case "get":
      return String(f.name ?? "");
    case "negate":
      return `-${v(b.inputs?.value)}`;
    case "not":
      return `!${v(b.inputs?.value)}`;
    case "math":
    case "compare":
    case "logic":
      return `${v(b.inputs?.a)} ${String(f.op)} ${v(b.inputs?.b)}`;
    case "set":
      return `${String(f.name)} ${String(f.op)} ${v(b.inputs?.value)}`;
    case "change":
      return `${String(f.name)}${String(f.op)}`;
    case "declare":
      return `${String(f.type)} ${String(f.name)}${b.inputs?.value ? ` = ${v(b.inputs.value)}` : ""}`;
    case "every":
      return `every ${v(b.inputs?.ms)} ms`;
    case "if":
    case "while":
      return `${b.type} ${v(b.inputs?.test)}`;
    case "comment":
      return `// ${String(f.text ?? "")}`;
    case "call":
      return `${String(f.name)}()`;
    case "expr":
      return v(b.inputs?.value);
    default: {
      const bi = BUILTIN_BY_NAME.get(b.type);
      if (bi) return [b.type, ...bi.params.filter((p) => b.inputs?.[p.name]).map((p) => v(b.inputs![p.name]))].join(" ") + (b.type === "delay" ? " ms" : "");
      return b.type;
    }
  }
}

export function BlocksView(props: BlocksViewProps) {
  const { blocks, frozen } = props;
  const root = useRef<HTMLDivElement>(null);
  const [carry, setCarry] = useState<Carry | null>(null);
  const [drag, setDrag] = useState<{ carry: Carry; over: string | null; trash: boolean } | null>(null);
  const pending = useRef<{ carry: Carry; x: number; y: number; id: number; el: HTMLElement; active: boolean } | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  /** Where the pointer is while dragging (the ghost follows it without a render per move). */
  const pointer = useRef({ x: 0, y: 0 });
  const swallowClick = useRef(false);
  const origin = useRef<HTMLElement | null>(null);

  // The program changed under a carried block (an edit in the text): let go of it.
  useEffect(() => setCarry(null), [blocks]);

  const commit = (next: BlockProgram) => {
    if (next !== blocks) props.onChange(next);
  };

  const put = (c: Carry, slot: Slot) => {
    if (c.kind === "new") commit(placeItem(blocks, slot, c.item));
    else commit(moveBlock(blocks, c.from, slot));
    props.announce(m.lab.code.placed);
  };
  const takeOut = (from: Slot) => {
    commit(removeAt(blocks, from));
    props.announce(m.lab.code.removed);
  };

  const carried = (c: Carry): BlockNode[] => (c.kind === "new" ? c.item.steps : [c.block]);
  /** Whether a carried block can go to this slot (and would move: not right where it is). */
  const accepts = (c: Carry, slot: Slot) => {
    if (!carried(c).every((b) => fits(b, slot.list))) return false;
    if (c.kind === "move") {
      const inside = slot.list.length > c.from.list.length && sameList(slot.list.slice(0, c.from.list.length + 1), [...c.from.list, c.from.index]);
      if (inside) return false;
      if (sameList(slot.list, c.from.list) && (slot.index === c.from.index || slot.index === c.from.index + 1)) return false;
    }
    return true;
  };

  const startCarry = (c: Carry, el: HTMLElement) => {
    origin.current = el;
    setCarry(c);
    props.announce(m.lab.code.carrying(c.kind === "new" ? c.item.steps.map(blockWords).join(", ") : blockWords(c.block)));
  };
  const endCarry = (refocus: boolean) => {
    setCarry(null);
    if (refocus) origin.current?.focus();
  };

  // A mistake Upload found: its block comes into view.
  useEffect(() => {
    if (props.errorId === null) return;
    root.current?.querySelector(`[data-block-id="${props.errorId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [props.errorId]);

  // Picking something up moves focus to the first slot it fits.
  useEffect(() => {
    if (!carry) return;
    const first = root.current?.querySelector<HTMLButtonElement>(".cb-gap__put");
    first?.focus({ preventScroll: false });
  }, [carry]);

  // ---- Dragging ----------------------------------------------------------------------------------------------

  const nearest = (x: number, y: number, c: Carry): { over: string | null; trash: boolean } => {
    const el = root.current;
    if (!el) return { over: null, trash: false };
    const pal = el.querySelector(".cb-palette")?.getBoundingClientRect();
    if (c.kind === "move" && pal && x >= pal.left && x <= pal.right && y >= pal.top && y <= pal.bottom) return { over: null, trash: true };
    const area = el.querySelector(".cb-scroll")?.getBoundingClientRect();
    if (!area || x < area.left - 24 || x > area.right + 24 || y < area.top - 24 || y > area.bottom + 24) return { over: null, trash: false };
    let best: string | null = null;
    let bestD = 64;
    el.querySelectorAll<HTMLElement>(".cb-gap[data-accepts]").forEach((g) => {
      const r = g.getBoundingClientRect();
      const d = Math.abs(y - (r.top + r.height / 2)) + (x < r.left ? (r.left - x) * 0.6 : 0);
      if (d < bestD) {
        bestD = d;
        best = g.dataset.gap ?? null;
      }
    });
    return { over: best, trash: false };
  };

  const slotOf = (key: string): Slot => {
    const [list, index] = key.split("#") as [string, string];
    return { list: list.split(".").map((k) => (/^\d+$/.test(k) ? Number(k) : k)), index: Number(index) };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, c: Carry) => {
    if (frozen || e.button !== 0) return;
    pending.current = { carry: c, x: e.clientX, y: e.clientY, id: e.pointerId, el: e.currentTarget, active: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone.
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const p = pending.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.active) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
      p.active = true;
      setCarry(null);
      setDrag({ carry: p.carry, over: null, trash: false });
    }
    pointer.current = { x: e.clientX, y: e.clientY };
    const g = ghost.current;
    if (g) g.style.transform = ghostAt(e.clientX, e.clientY);
    // Near the top or bottom edge of the blocks, they scroll.
    const sc = root.current?.querySelector<HTMLElement>(".cb-scroll");
    if (sc) {
      const r = sc.getBoundingClientRect();
      if (e.clientY < r.top + 28) sc.scrollTop -= 8;
      else if (e.clientY > r.bottom - 28) sc.scrollTop += 8;
    }
    const n = nearest(e.clientX, e.clientY, p.carry);
    setDrag((d) => (d && (d.over !== n.over || d.trash !== n.trash) ? { ...d, ...n } : d));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const p = pending.current;
    pending.current = null;
    if (!p?.active || p.id !== e.pointerId) return;
    swallowClick.current = true;
    window.setTimeout(() => (swallowClick.current = false), 0);
    const n = nearest(e.clientX, e.clientY, p.carry);
    setDrag(null);
    if (n.trash && p.carry.kind === "move") takeOut(p.carry.from);
    else if (n.over) put(p.carry, slotOf(n.over));
  };
  const onPointerCancel = () => {
    pending.current = null;
    setDrag(null);
  };
  const dragHandlers = (c: Carry) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => onPointerDown(e, c),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  });

  // ---- Keyboard on a grip --------------------------------------------------------------------------------------

  const grips = () => [...(root.current?.querySelectorAll<HTMLButtonElement>(".cb-grip") ?? [])];
  const onGripKey = (e: ReactKeyboardEvent<HTMLButtonElement>, slot: Slot) => {
    if (frozen) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const list = grips();
      const i = list.indexOf(e.currentTarget);
      takeOut(slot);
      window.requestAnimationFrame(() => grips()[Math.max(0, Math.min(i, grips().length - 1))]?.focus());
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const len = (at(blocks, slot.list) as BlockNode[]).length;
      const to = e.key === "ArrowUp" ? slot.index - 1 : slot.index + 2;
      if (to < 0 || to > len) return;
      commit(moveBlock(blocks, slot, { list: slot.list, index: to }));
      const target = { list: slot.list, index: e.key === "ArrowUp" ? slot.index - 1 : slot.index + 1 };
      window.requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`.cb-grip[data-slot="${gapKey(target)}"]`)?.focus());
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const list = grips();
      const i = list.indexOf(e.currentTarget);
      list[i + (e.key === "ArrowUp" ? -1 : 1)]?.focus();
    }
  };

  // ---- Rendering -------------------------------------------------------------------------------------------------

  const ctx: Ctx = {
    blocks,
    frozen,
    carry,
    drag,
    errorId: props.errorId,
    litId: props.litId,
    lineText: props.lineText,
    accepts,
    edit: (path, b) => commit(setAt(blocks, path, b)),
    light: props.onLight,
    gripProps: (block, slot) => ({
      ...dragHandlers({ kind: "move", from: slot, block }),
      onClick: (e: ReactMouseEvent<HTMLButtonElement>) => {
        if (swallowClick.current || frozen) return;
        if (carry?.kind === "move" && gapKey(carry.from) === gapKey(slot)) endCarry(false);
        else startCarry({ kind: "move", from: slot, block }, e.currentTarget);
      },
      onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => onGripKey(e, slot),
    }),
    putHere: (slot) => {
      if (!carry) return;
      const c = carry;
      setCarry(null);
      put(c, slot);
    },
  };

  const activeCarry = carry ?? drag?.carry ?? null;
  return (
    <div
      ref={root}
      className="cb"
      data-frozen={frozen || undefined}
      data-carrying={carry ? true : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && carry) {
          e.stopPropagation();
          endCarry(true);
          props.announce(m.lab.code.letGo);
        }
      }}
    >
      {props.palette.length > 0 && (
        <div className="cb-palette" role="group" aria-label={m.lab.code.palette} data-trash={drag?.trash || undefined}>
          {activeCarry?.kind === "move" ? (
            <button type="button" className="cb-trash" disabled={!carry} onClick={() => carry?.kind === "move" && (setCarry(null), takeOut(carry.from))}>
              {m.lab.code.takeOut}
            </button>
          ) : (
            props.palette.map((item, i) => {
              const c: Carry = { kind: "new", item };
              const words = item.steps.map(blockWords).join(", ");
              return (
                <button
                  key={`${i}:${item.entry}`}
                  type="button"
                  className="cb-pal"
                  disabled={frozen}
                  aria-label={m.lab.code.add(words)}
                  aria-pressed={carry?.kind === "new" && carry.item === item}
                  data-palette={item.entry}
                  {...dragHandlers(c)}
                  onClick={(e) => {
                    if (swallowClick.current) return;
                    if (carry?.kind === "new" && carry.item === item) endCarry(false);
                    else startCarry(c, e.currentTarget);
                  }}
                >
                  {item.steps.map((s, k) => (
                    <span key={k} className="cb-pal__block">
                      <Head block={s} path={[]} ctx={ctx} still />
                    </span>
                  ))}
                </button>
              );
            })
          )}
          {!activeCarry && props.palette.length > 0 && <span className="cb-palette__hint" aria-hidden="true">{m.lab.code.dragHint}</span>}
        </div>
      )}
      {carry && (
        <p className="cb-carrying" role="status">
          <span>{m.lab.code.where}</span>
          <button type="button" className="cb-link" onClick={() => endCarry(true)}>
            {m.lab.code.cancel}
          </button>
        </p>
      )}
      <div className="cb-scroll">
        <List list={blocks.items} path={["items"]} ctx={ctx} />
      </div>
      {drag &&
        typeof document !== "undefined" &&
        createPortal(
          <div ref={ghost} className="cb-ghost" aria-hidden="true" style={{ transform: ghostAt(pointer.current.x, pointer.current.y) }}>
            {carried(drag.carry).map(blockWords).join(" · ")}
          </div>,
          document.body,
        )}
    </div>
  );
}

type Ctx = {
  blocks: BlockProgram;
  frozen: boolean;
  carry: Carry | null;
  drag: { carry: Carry; over: string | null; trash: boolean } | null;
  errorId: number | null;
  litId: number | null;
  lineText(id: number | undefined): string;
  accepts(c: Carry, slot: Slot): boolean;
  edit(path: Path, b: BlockNode): void;
  light(id: number | null): void;
  gripProps(block: BlockNode, slot: Slot): ButtonHTMLAttributes<HTMLButtonElement>;
  putHere(slot: Slot): void;
};

function List({ list, path, ctx }: { list: BlockNode[]; path: Path; ctx: Ctx }) {
  return (
    <ol className="cb-list">
      {list.map((b, i) => (
        <Fragment key={i}>
          <Gap slot={{ list: path, index: i }} ctx={ctx} />
          <Stmt block={b} path={[...path, i]} slot={{ list: path, index: i }} ctx={ctx} />
        </Fragment>
      ))}
      <Gap slot={{ list: path, index: list.length }} ctx={ctx} empty={!list.length} />
    </ol>
  );
}

function Gap({ slot, ctx, empty }: { slot: Slot; ctx: Ctx; empty?: boolean }) {
  const c = ctx.carry ?? ctx.drag?.carry ?? null;
  const ok = !!c && ctx.accepts(c, slot);
  const key = gapKey(slot);
  const over = ctx.drag?.over === key;
  return (
    <li className="cb-gap" data-gap={key} data-accepts={ok || undefined} data-over={over || undefined} data-empty={empty || undefined}>
      {ctx.carry && ok ? (
        <button
          type="button"
          className="cb-gap__put"
          onClick={() => ctx.putHere(slot)}
          onKeyDown={(e) => {
            // Up and Down walk from slot to slot (Tab also stops at the blanks in between).
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const all = [...(e.currentTarget.closest(".cb")?.querySelectorAll<HTMLButtonElement>(".cb-gap__put") ?? [])];
            all[all.indexOf(e.currentTarget) + (e.key === "ArrowUp" ? -1 : 1)]?.focus();
          }}
        >
          {m.lab.code.putHere}
        </button>
      ) : empty && slot.list.length > 1 ? (
        <span className="cb-gap__empty" aria-hidden="true">
          {m.lab.code.empty}
        </span>
      ) : null}
    </li>
  );
}

function Stmt({ block, path, slot, ctx }: { block: BlockNode; path: Path; slot: Slot; ctx: Ctx }) {
  const fixed = block.type === "setup" || block.type === "loop" || block.type === "function" || block.type === "prototype";
  const container = CONTAINERS.has(block.type);
  const carried = ctx.carry?.kind === "move" && gapKey(ctx.carry.from) === gapKey(slot);
  return (
    <li
      className={`cb-stmt${container ? " cb-stmt--box" : ""}`}
      data-type={block.type}
      data-block-id={block.id}
      data-error={(block.id !== undefined && block.id === ctx.errorId) || undefined}
      data-lit={(block.id !== undefined && block.id === ctx.litId) || undefined}
      data-carried={carried || undefined}
      onFocus={(e) => {
        e.stopPropagation();
        ctx.light(block.id ?? null);
      }}
    >
      <div
        className="cb-head"
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("cb-word")) ctx.light(block.id ?? null);
        }}
      >
        {!fixed && (
          <button type="button" className="cb-grip" data-slot={gapKey(slot)} aria-label={m.lab.code.grip(ctx.lineText(block.id) || blockWords(block))} aria-pressed={carried} disabled={ctx.frozen} {...ctx.gripProps(block, slot)}>
            <svg viewBox="0 0 8 14" aria-hidden="true">
              <circle cx="2" cy="2" r="1.2" />
              <circle cx="6" cy="2" r="1.2" />
              <circle cx="2" cy="7" r="1.2" />
              <circle cx="6" cy="7" r="1.2" />
              <circle cx="2" cy="12" r="1.2" />
              <circle cx="6" cy="12" r="1.2" />
            </svg>
          </button>
        )}
        <Head block={block} path={path} ctx={ctx} />
      </div>
      {container && block.type !== "do" && (
        <div className="cb-body">
          <List list={block.body ?? []} path={[...path, "body"]} ctx={ctx} />
        </div>
      )}
      {block.type === "do" && (
        <>
          <div className="cb-body">
            <List list={block.body ?? []} path={[...path, "body"]} ctx={ctx} />
          </div>
          <div className="cb-head cb-head--tail">
            <Word kw>while</Word>
            <Value block={block.inputs!.test!} path={[...path, "inputs", "test"]} ctx={ctx} />
          </div>
        </>
      )}
      {block.else && (
        <>
          <div className="cb-head cb-head--tail">
            <Word kw>else</Word>
          </div>
          <div className="cb-body">
            <List list={block.else} path={[...path, "else"]} ctx={ctx} />
          </div>
        </>
      )}
    </li>
  );
}

function Word({ children, kw, small }: { children: ReactNode; kw?: boolean; small?: boolean }) {
  return <span className={`cb-word${kw ? " cb-word--kw" : ""}${small ? " cb-word--small" : ""}`}>{children}</span>;
}

/** A statement's own line: its words and the values in it. `still` draws it without fields (the palette, the ghost). */
function Head({ block, path, ctx, still: quiet }: { block: BlockNode; path: Path; ctx: Ctx; still?: boolean }) {
  // Blocks shown while the text does not read right are a picture of the last good program: nothing to change.
  const still = quiet || ctx.frozen;
  const f = block.fields ?? {};
  const input = (name: string) => {
    const b = block.inputs?.[name];
    return b ? <Value block={b} path={[...path, "inputs", name]} ctx={ctx} still={still} /> : null;
  };
  switch (block.type) {
    case "setup":
      return (
        <>
          <Word kw>setup</Word>
          <Word small>{m.lab.code.once}</Word>
        </>
      );
    case "loop":
      return (
        <>
          <Word kw>loop</Word>
          <svg className="cb-again" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M12.5 5.5A5 5 0 1 0 13 9" />
            <path d="M13.5 2.5v3.5H10" />
          </svg>
          <Word small>{m.lab.code.repeats}</Word>
        </>
      );
    case "function":
    case "prototype":
      return (
        <>
          <Word kw>{String(f.returns ?? "void")}</Word>
          <Word>{`${String(f.name ?? "")}(${(block.params ?? []).map((p) => `${p.type} ${p.name}`).join(", ")})`}</Word>
        </>
      );
    case "declare":
      return (
        <>
          <TypeField value={String(f.type ?? "int")} path={path} block={block} ctx={ctx} still={still} />
          <NameField value={String(f.name ?? "")} path={path} block={block} field="name" ctx={ctx} still={still} />
          {block.inputs?.value && <Word>=</Word>}
          {input("value")}
          {(block.more ?? []).map((x, i) => (
            <Word key={i}>{`, ${x.name}${x.value ? ` = ${blockWords(x.value)}` : ""}`}</Word>
          ))}
        </>
      );
    case "set":
      return (
        <>
          <NameField value={String(f.name ?? "")} path={path} block={block} field="name" ctx={ctx} still={still} />
          <OpField block={block} path={path} ctx={ctx} still={still} />
          {input("value")}
        </>
      );
    case "change":
      return (
        <>
          <NameField value={String(f.name ?? "")} path={path} block={block} field="name" ctx={ctx} still={still} />
          <OpField block={block} path={path} ctx={ctx} still={still} />
        </>
      );
    case "every":
      return (
        <>
          <Word kw>every</Word>
          {input("ms")}
          <Word>ms</Word>
        </>
      );
    case "if":
    case "while":
      return (
        <>
          <Word kw>{block.type}</Word>
          {input("test")}
        </>
      );
    case "do":
      return <Word kw>do</Word>;
    case "for":
      return (
        <>
          <Word kw>for</Word>
          {input("init")}
          <Word>;</Word>
          {input("test")}
          <Word>;</Word>
          {input("update")}
        </>
      );
    case "return":
      return (
        <>
          <Word kw>return</Word>
          {input("value")}
        </>
      );
    case "break":
    case "continue":
      return <Word kw>{block.type}</Word>;
    case "empty":
      return <Word small>;</Word>;
    case "group":
      return <Word small>{"{ }"}</Word>;
    case "comment":
      return (
        <>
          <Word small>//</Word>
          <TextField value={String(f.text ?? "")} onCommit={(t) => ctx.edit(path, { ...block, fields: { ...f, text: t } })} still={still} label={m.lab.code.note} wide />
        </>
      );
    case "expr":
      return input("value");
    case "call":
      return (
        <>
          <Word>{String(f.name ?? "")}</Word>
          {(block.args ?? []).map((a, i) => (
            <Value key={i} block={a} path={[...path, "args", i]} ctx={ctx} still={still} />
          ))}
        </>
      );
    default: {
      const bi = BUILTIN_BY_NAME.get(block.type);
      if (!bi) return <Word>{blockWords(block)}</Word>;
      return (
        <>
          <Word kw>{block.type}</Word>
          {bi.params.map((p) => (block.inputs?.[p.name] ? <Fragment key={p.name}>{input(p.name)}</Fragment> : null))}
          {block.type === "delay" && <Word>ms</Word>}
        </>
      );
    }
  }
}

/** A value inside a block: a blank in blue ink to change in place, or a small expression of them. */
function Value({ block, path, ctx, still: quiet }: { block: BlockNode; path: Path; ctx: Ctx; still?: boolean }) {
  const still = quiet || ctx.frozen;
  const f = block.fields ?? {};
  const sub = (name: string) => {
    const b = block.inputs?.[name];
    return b ? <Value block={b} path={[...path, "inputs", name]} ctx={ctx} still={still} /> : null;
  };
  switch (block.type) {
    case "number":
      return <NumberField block={block} path={path} ctx={ctx} still={still} />;
    case "negate":
      if (block.inputs?.value?.type === "number") return <NumberField block={block} path={path} ctx={ctx} still={still} />;
      return (
        <span className="cb-val">
          <Word>-</Word>
          {sub("value")}
        </span>
      );
    case "bool":
      return <Choice value={String(!!f.value)} options={["true", "false"]} onPick={(v) => ctx.edit(path, { ...block, fields: { value: v === "true" } })} still={still} label={m.lab.code.value} />;
    case "text":
      return <TextField value={String(f.value ?? "")} quoted onCommit={(t) => ctx.edit(path, { ...block, fields: { value: t } })} still={still} label={m.lab.code.value} />;
    case "constant": {
      const name = String(f.name ?? "");
      return <Choice value={name} options={choicesFor(name)} onPick={(v) => ctx.edit(path, { ...block, fields: { name: v } })} still={still} label={m.lab.code.value} />;
    }
    case "get":
      return <NameField value={String(f.name ?? "")} path={path} block={block} field="name" ctx={ctx} still={still} />;
    case "math":
    case "compare":
    case "logic":
      return (
        <span className="cb-val">
          {sub("a")}
          <OpField block={block} path={path} ctx={ctx} still={still} />
          {sub("b")}
        </span>
      );
    case "not":
      return (
        <span className="cb-val">
          <Word>!</Word>
          {sub("value")}
        </span>
      );
    case "unary":
      return (
        <span className="cb-val">
          <Word>{String(f.op)}</Word>
          {sub("value")}
        </span>
      );
    case "brackets":
      return (
        <span className="cb-val">
          <Word>(</Word>
          {sub("value")}
          <Word>)</Word>
        </span>
      );
    case "cast":
      return (
        <span className="cb-val">
          <Word>{`(${String(f.type)})`}</Word>
          {sub("value")}
        </span>
      );
    case "choose":
      return (
        <span className="cb-val">
          {sub("test")}
          <Word>?</Word>
          {sub("then")}
          <Word>:</Word>
          {sub("else")}
        </span>
      );
    case "set":
    case "change":
    case "declare":
      return (
        <span className="cb-val">
          <Head block={block} path={path} ctx={ctx} still={still} />
        </span>
      );
    default:
      return (
        <span className="cb-val">
          <Head block={block} path={path} ctx={ctx} still={still} />
        </span>
      );
  }
}

// ---- Fields: the blanks ---------------------------------------------------------------------------------------------

function Blank({ text, still }: { text: string; still?: boolean }) {
  return <span className={`cb-blank${still ? " cb-blank--still" : ""}`}>{text}</span>;
}

/** A typed blank: kept locally while typed, written into the program on Enter or when focus leaves. */
function Typed({ value, check, onCommit, still, label, kind, wide }: { value: string; check(t: string): boolean; onCommit(t: string): void; still?: boolean; label: string; kind: "number" | "name" | "text"; wide?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (still) return <Blank text={value} still />;
  const shown = draft ?? value;
  const done = () => {
    if (draft !== null && draft !== value && check(draft)) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      className={`cb-blank cb-blank--${kind}`}
      value={shown}
      size={Math.max(wide ? 8 : 1, shown.length)}
      aria-label={label}
      aria-invalid={draft !== null && !check(draft) ? true : undefined}
      inputMode={kind === "number" ? "numeric" : "text"}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          done();
        } else if (e.key === "Escape" && draft !== null) {
          e.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
}

function NumberField({ block, path, ctx, still }: { block: BlockNode; path: Path; ctx: Ctx; still?: boolean }) {
  const inner = block.type === "negate" ? block.inputs!.value! : block;
  const raw = String(inner.fields?.raw ?? inner.fields?.value ?? 0);
  const text = block.type === "negate" ? `-${raw}` : raw;
  return (
    <Typed
      value={text}
      kind="number"
      still={still}
      label={m.lab.code.number}
      check={(t) => numberBlock(t) !== null}
      onCommit={(t) => {
        const b = numberBlock(t);
        if (b) ctx.edit(path, b);
      }}
    />
  );
}

function NameField({ value, path, block, field, ctx, still }: { value: string; path: Path; block: BlockNode; field: string; ctx: Ctx; still?: boolean }) {
  return <Typed value={value} kind="name" still={still} label={m.lab.code.name} check={nameOk} onCommit={(t) => ctx.edit(path, { ...block, fields: { ...block.fields, [field]: t.trim() } })} />;
}

function TextField({ value, onCommit, still, label, quoted, wide }: { value: string; onCommit(t: string): void; still?: boolean; label: string; quoted?: boolean; wide?: boolean }) {
  const body = <Typed value={value} kind="text" still={still} label={label} check={(t) => !/["\n\\]/.test(t)} onCommit={onCommit} wide={wide} />;
  if (!quoted) return body;
  return (
    <span className="cb-quoted">
      <Word>“</Word>
      {body}
      <Word>”</Word>
    </span>
  );
}

function Choice({ value, options, onPick, still, label }: { value: string; options: readonly string[]; onPick(v: string): void; still?: boolean; label: string }) {
  if (still || options.length < 2) return <Blank text={value} still={still} />;
  const list = options.includes(value) ? options : [value, ...options];
  return (
    <span className="cb-choice">
      <select className="cb-blank cb-blank--choice" value={value} aria-label={label} onChange={(e) => onPick(e.target.value)}>
        {list.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </span>
  );
}

function OpField({ block, path, ctx, still }: { block: BlockNode; path: Path; ctx: Ctx; still?: boolean }) {
  const op = String(block.fields?.op ?? "");
  const options = OPERATORS[block.type] ?? [op];
  return <Choice value={op} options={options} still={still} label={m.lab.code.operator} onPick={(v) => ctx.edit(path, { ...block, fields: { ...block.fields, op: v } })} />;
}

function TypeField({ value, path, block, ctx, still }: { value: string; path: Path; block: BlockNode; ctx: Ctx; still?: boolean }) {
  // A const or static declaration keeps its word in front of the type it changes.
  const prefix = /^((?:static |const )*)/.exec(value)?.[1] ?? "";
  const bare = value.slice(prefix.length);
  return <Choice value={bare} options={TYPES} still={still} label={m.lab.code.type} onPick={(v) => ctx.edit(path, { ...block, fields: { ...block.fields, type: prefix + v } })} />;
}
