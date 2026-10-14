/**
 * The first-use check (content/glossary.yaml, docs/LESSONS.md "Writing beats"): walks the course's bench lessons in
 * order, line by line as the learner meets them, and reports each glossary term at its first use when that use does
 * not introduce it. A term is introduced by a `meet` beat, by a note on the bench, or in the line itself with a short
 * naming phrase next to it ("the probes, the two pointed tips", "Ω, ohms", "OL means over the limit", "This is a
 * resistor"). Each term is reported once: once its first use introduces it, every later use is fine.
 *
 * Pure: the caller loads the glossary and the labs (apps/web/src/lesson/bench/lessons.test.ts).
 */
import type { BenchLessonData } from "../../content/load";

export type GlossaryTerm = { term: string; forms: string[] };
/** A term used before anything introduced it: where, and the line that used it. */
export type FirstUse = { term: string; lesson: string; unit: string; where: string; line: string };
/** A lab task's own lines, as the lesson shows them (hints, nudges, the success line). */
export type TaskLines = (lab: string, task: string) => string[];

type Line = { where: string; text: string; names?: boolean };

const norm = (s: string) => s.normalize("NFKC");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A form as a whole-word pattern. Lower case matches any case; a capital or a symbol matches exactly ("LED" is not
 * "led", and "Ω" never matches inside "kΩ").
 */
function formPattern(form: string): RegExp {
  const f = norm(form);
  const exact = f !== f.toLowerCase() || /[^\p{L}\s]/u.test(f);
  return new RegExp(`(?<!\\p{L})${escape(f).replace(/\s+/g, "\\s+")}(?!\\p{L})`, exact ? "gu" : "giu");
}

/** Right after the term: a comma, colon or bracket and then a naming phrase, or "means", "is a", "stands for". */
const NAMED_AFTER = /^\s*(?:[,:(]|\s(?:means|is (?:a|an|the)|stands for)\b)\s*(?!(?:then|and|or|but|so|now|not|because|if|when|while|until|too|again|please)\b)["'\p{L}\p{N}]/iu;
/** Right before the term: "This is a", "these are the", "called", "named", a bracket ("the long leg (anode)"), or ", the". */
const NAMED_BEFORE = /(?:\b(?:this|that) is (?:a |an |the )?|\bthese are (?:the )?|\bcalled (?:a |an |the )?|\bnamed |\(\s*|[,:]\s+the\s+)$/iu;

/** Whether `text` uses a form of `term`, and whether one of those uses names it. */
export function useOf(term: GlossaryTerm, text: string): { used: boolean; named: boolean } {
  const t = norm(text);
  let used = false;
  for (const form of term.forms) {
    for (const m of t.matchAll(formPattern(form))) {
      used = true;
      const end = m.index + m[0].length;
      if (NAMED_AFTER.test(t.slice(end)) || NAMED_BEFORE.test(t.slice(0, m.index))) return { used, named: true };
    }
  }
  return { used, named: false };
}

/** A lesson's lines in the order the learner meets them. Notes and `meet` beats name what they mention. */
export function linesOf(lesson: BenchLessonData, taskLines: TaskLines): Line[] {
  const out: Line[] = [];
  const add = (where: string, text: string | undefined, names = false) => {
    if (text) out.push({ where, text, names });
  };
  const task = (where: string, id: string) => taskLines(lesson.lab, id).forEach((t) => add(where, t));
  add("start", lesson.start.title);
  add("start", lesson.start.say);
  add("start", lesson.start.go);
  lesson.beats.forEach((b, i) => {
    const where = `b${i}`;
    const acts = b.meet || b.do || b.tap || b.pick || b.number || b.popup;
    // A meet beat writes the part's name as it begins; a beat with nothing to do draws its note beside its line.
    if (b.meet) add(where, b.say, true);
    if (b.meet || !acts) add(where, b.note?.text, true);
    if (!b.meet) add(where, b.say);
    b.guess?.options.forEach((o) => add(where, o));
    b.pick?.options.forEach((o) => add(where, o));
    add(where, b.hint);
    Object.values(b.wrong ?? {}).forEach((w) => add(where, w));
    if (b.do) task(where, b.do);
    add(where, b.done);
    if (acts && !b.meet) add(where, b.note?.text, true);
    add(where, b.rule);
  });
  if (lesson.secret) {
    add("secret", lesson.secret.say);
    task("secret", lesson.secret.task);
    add("secret", lesson.secret.done);
    add("secret", lesson.secret.note?.text, true);
    add("secret", lesson.secret.rule);
  }
  if (lesson.fixit) {
    add("fixit", lesson.fixit.say);
    lesson.fixit.tasks.forEach((t, i) => {
      add(`fix${i}`, t.say);
      task(`fix${i}`, t.task);
    });
  }
  add("end", lesson.end.say);
  return out;
}

/** Every term whose first use in the course (lessons in course order) does not introduce it. */
export function firstUses(lessons: BenchLessonData[], terms: GlossaryTerm[], taskLines: TaskLines): FirstUse[] {
  const met = new Set<string>();
  const out: FirstUse[] = [];
  for (const lesson of lessons) {
    for (const line of linesOf(lesson, taskLines)) {
      for (const term of terms) {
        if (met.has(term.term)) continue;
        const use = useOf(term, line.text);
        if (!use.used) continue;
        met.add(term.term);
        if (!line.names && !use.named) out.push({ term: term.term, lesson: lesson.id, unit: lesson.unit, where: line.where, line: line.text });
      }
    }
  }
  return out;
}
