/**
 * The code drawer's text view: CodeMirror 6 with bench C (./lang.ts). A lazy chunk, loaded only when the learner
 * opens the text, never with a lesson's first screen. The drawer owns the program; this view shows it, reports each
 * edit, marks the mistake Upload refused (line:column) and lights the line of the block in focus.
 */
import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Annotation, EditorState, StateEffect, StateField, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, drawSelection, keymap, lineNumbers, type DecorationSet } from "@codemirror/view";
import type { Diagnostic } from "@ohmland/code";
import { m } from "../../i18n";
import { benchC, benchHighlight } from "./lang";

export type TextViewProps = {
  source: string;
  onChange(source: string): void;
  /** The mistake to mark, or null. */
  error: Diagnostic | null;
  /** A line to light (the block in focus), or null. */
  lit: number | null;
  /** The cursor moved: the drawer lights the block there. */
  onCursor?(line: number, col: number): void;
  readOnly?: boolean;
};

/** Marks a change the drawer made (the blocks redrew the text), so it is not reported back as an edit. */
const fromDrawer = Annotation.define<boolean>();
const setError = StateEffect.define<Diagnostic | null>();
const setLit = StateEffect.define<number | null>();

/** Where an error sits when it points past the end of its line (a missing semicolon): a small red caret. */
class Caret extends WidgetType {
  override toDOM() {
    const s = document.createElement("span");
    s.className = "cm-bc-caret";
    s.setAttribute("aria-hidden", "true");
    return s;
  }
  override eq() {
    return true;
  }
}

function errorMarks(state: EditorState, d: Diagnostic | null): DecorationSet {
  if (!d || d.line < 1 || d.line > state.doc.lines) return Decoration.none;
  const line = state.doc.line(d.line);
  const from = Math.min(line.to, line.from + Math.max(0, d.col - 1));
  const marks: Range<Decoration>[] = [Decoration.line({ class: "cm-bc-errline" }).range(line.from)];
  let to = d.endLine === d.line && d.endCol ? line.from + d.endCol - 1 : from;
  if (to <= from) {
    // No end given: the word (or the character) at the column.
    const rest = line.text.slice(from - line.from);
    const word = /^\w+/.exec(rest)?.[0].length ?? (rest.length ? 1 : 0);
    to = from + word;
  }
  if (to > from) marks.push(Decoration.mark({ class: "cm-bc-error" }).range(from, Math.min(to, line.to)));
  else marks.push(Decoration.widget({ widget: new Caret(), side: 1 }).range(from));
  return Decoration.set(marks, true);
}

const errorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setError)) return errorMarks(tr.state, e.value);
    return tr.docChanged ? v.map(tr.changes) : v;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const litField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(v, tr) {
    for (const e of tr.effects) {
      if (!e.is(setLit)) continue;
      const n = e.value;
      if (n === null || n < 1 || n > tr.state.doc.lines) return Decoration.none;
      return Decoration.set([Decoration.line({ class: "cm-bc-lit" }).range(tr.state.doc.line(n).from)]);
    }
    return tr.docChanged ? v.map(tr.changes) : v;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export default function TextView(props: TextViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    const extensions: Extension[] = [
      lineNumbers(),
      history(),
      drawSelection(),
      indentUnit.of("  "),
      indentOnInput(),
      bracketMatching(),
      benchC,
      syntaxHighlighting(benchHighlight),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": m.lab.code.textLabel, autocapitalize: "off", autocorrect: "off", spellcheck: "false" }),
      EditorState.readOnly.of(!!cb.current.readOnly),
      errorField,
      litField,
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !u.transactions.some((tr) => tr.annotation(fromDrawer))) cb.current.onChange(u.state.doc.toString());
        if (u.selectionSet && u.view.hasFocus) {
          const head = u.state.selection.main.head;
          const line = u.state.doc.lineAt(head);
          cb.current.onCursor?.(line.number, head - line.from + 1);
        }
      }),
    ];
    const v = new EditorView({ parent: host.current!, state: EditorState.create({ doc: cb.current.source, extensions }) });
    view.current = v;
    v.dispatch({ effects: [setError.of(cb.current.error), setLit.of(cb.current.lit)] });
    return () => {
      v.destroy();
      view.current = null;
    };
  }, []);

  // The blocks changed the program: redraw the text, keeping the cursor where it was (as far as the text allows).
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (cur === props.source) return;
    const head = Math.min(v.state.selection.main.head, props.source.length);
    v.dispatch({ changes: { from: 0, to: cur.length, insert: props.source }, selection: { anchor: head }, annotations: fromDrawer.of(true) });
  }, [props.source]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const d = props.error;
    const effects: StateEffect<unknown>[] = [setError.of(d)];
    // The mistake's line comes into view.
    if (d && d.line >= 1 && d.line <= v.state.doc.lines) effects.push(EditorView.scrollIntoView(v.state.doc.line(d.line).from, { y: "nearest" }));
    v.dispatch({ effects });
  }, [props.error]);

  useEffect(() => {
    view.current?.dispatch({ effects: setLit.of(props.lit) });
  }, [props.lit]);

  return <div ref={host} className="code-text" data-code-text />;
}
