/** Turns a grade into what the learner sees: right or not, plus one or two lines of useful feedback. */
import type { QuizItem } from "../content/schema";
import { m } from "../i18n";
import { bandsForOhms, type BandColor } from "./colorCode";
import { gradeChoice, gradeColorBuild, gradeColorRead, gradeHotspot, gradeMatch, gradeNumericItem, gradeOrder } from "./grade";
import { formatSI, type NumericGrade } from "./si";
import type { Outcome } from "./types";

function numericOutcome(g: NumericGrade): Outcome {
  const q = m.quiz.numeric;
  switch (g.status) {
    case "correct":
      return { correct: true, lines: [] };
    case "invalid":
      return { correct: false, noTry: true, lines: [g.reason === "empty" ? q.empty : g.reason === "unit" ? q.unit : q.format] };
    case "wrong-unit":
      return { correct: false, lines: [q.wrongUnit(q.unitNames[g.got] ?? g.got, q.unitNames[g.want] ?? g.want)] };
    case "prefix":
      return {
        correct: false,
        lines: [g.explicit ? q.prefixExplicit(g.digits, g.typedUnit, g.rightUnit) : q.prefixBare(g.digits, g.rightUnit, g.inBoxUnit)],
      };
    case "wrong":
      return { correct: false, lines: [g.factor10 ? q.factor10 : g.direction === "high" ? q.high : q.low] };
  }
}

/** The right answer as an item value, to show when the learner asks for it. */
export function correctValue(item: QuizItem): unknown {
  switch (item.type) {
    case "choice":
      return item.options.flatMap((o, i) => (o.correct ? [i] : []));
    case "numeric":
      return `${item.answer} ${item.unit}`;
    case "order":
      return item.items.map((_, i) => i);
    case "match":
      return Object.fromEntries(item.pairs.map((_, i) => [i, i]));
    case "color-code":
      return item.mode === "read" ? formatSI(item.ohms, "Ω") : bandsForOhms(item.ohms, item.bands);
    case "hotspot":
      return Array.isArray(item.answer) ? item.answer[0] : item.answer;
  }
}

export function evaluate(item: QuizItem, value: unknown): Outcome {
  switch (item.type) {
    case "choice": {
      const g = gradeChoice(item, (value as number[]) ?? []);
      if (g.correct) return { correct: true, lines: [] };
      const lines = g.wrongPicks.length ? [] : [m.quiz.missedSome];
      return { correct: false, lines, wrong: g.wrongPicks };
    }
    case "numeric":
      return numericOutcome(gradeNumericItem(item, String(value ?? "")));
    case "order": {
      const g = gradeOrder((value as number[]) ?? []);
      return { correct: g.correct, lines: g.correct ? [] : [m.quiz.order.inPlace(g.inPlace, item.items.length)] };
    }
    case "match": {
      const g = gradeMatch(item, (value as Record<number, number>) ?? {});
      if (!g.complete) return { correct: false, noTry: true, lines: [m.quiz.match.incomplete] };
      return { correct: g.correct, lines: g.correct ? [] : [m.quiz.match.rightCount(g.right, item.pairs.length)] };
    }
    case "color-code": {
      if (item.mode === "read") return numericOutcome(gradeColorRead(item, String(value ?? "")));
      const g = gradeColorBuild(item, (value as (BandColor | null)[]) ?? []);
      if (g.correct) return { correct: true, lines: [] };
      return { correct: false, lines: g.value === null ? [m.quiz.colorCode.noValue] : [m.quiz.colorCode.yourValue(formatSI(g.value, "Ω"))] };
    }
    case "hotspot":
      return gradeHotspot(item, typeof value === "string" ? value : null) ? { correct: true, lines: [] } : { correct: false, lines: [] };
  }
}
