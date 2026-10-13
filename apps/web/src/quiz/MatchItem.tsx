import { useMemo, useState } from "react";
import type { MatchItem as MatchItemT } from "../content/schema";
import { m } from "../i18n";
import { shuffledIndices } from "../lib/shuffle";
import { plainText } from "../lib/text";
import type { ItemViewProps } from "./types";

type Pairs = Record<number, number>;

/**
 * Match pairs by tapping: pick an item on the left, then its partner on the right. A pair shares a number badge.
 * Picking a paired left item again unpairs it. Everything is a button, so it works with a keyboard too.
 */
export function MatchItem({ item, value, onChange, locked, reveal, outcome, announce }: ItemViewProps<Pairs, MatchItemT>) {
  const rights = useMemo(() => shuffledIndices(item.pairs.length, `${item.id}:right`, true), [item]);
  const pairs: Pairs = value ?? {};
  const [active, setActive] = useState<number | null>(value && Object.keys(value).length ? null : 0);
  const pairNumber = (left: number) => left + 1;
  const leftOf = (right: number) => {
    const hit = Object.entries(pairs).find(([, r]) => r === right);
    return hit ? Number(hit[0]) : null;
  };

  const pickLeft = (l: number) => {
    if (locked) return;
    if (pairs[l] !== undefined) {
      const next = { ...pairs };
      delete next[l];
      onChange(next);
      announce(m.quiz.match.unpaired(plainText(item.pairs[l]?.left ?? "")));
      setActive(l);
      return;
    }
    setActive(l);
    announce(m.quiz.match.selected(plainText(item.pairs[l]?.left ?? "")));
  };

  const pickRight = (r: number) => {
    if (locked || active === null) return;
    const next: Pairs = {};
    for (const [l, rr] of Object.entries(pairs)) if (rr !== r) next[Number(l)] = rr;
    next[active] = r;
    onChange(next);
    announce(m.quiz.match.paired(plainText(item.pairs[active]?.left ?? ""), plainText(item.pairs[r]?.right ?? "")));
    // Move on to the next unpaired item on the left, so pairing flows.
    const nextLeft = item.pairs.findIndex((_, i) => next[i] === undefined);
    setActive(nextLeft === -1 ? null : nextLeft);
  };

  const showResult = reveal || (outcome && !outcome.correct);
  return (
    <div className="match">
      <p className="quiz-instructions">{m.quiz.match.instructions}</p>
      <div className="match__cols">
        <ul className="match__col" aria-label={m.quiz.match.leftLabel}>
          {item.pairs.map((p, l) => {
            const paired = pairs[l] !== undefined;
            const state = showResult && paired ? (pairs[l] === l ? "right" : "wrong") : active === l ? "active" : paired ? "paired" : undefined;
            return (
              <li key={l}>
                <button
                  type="button"
                  className="match__chip"
                  data-match-left
                  data-state={state}
                  aria-pressed={active === l}
                  disabled={locked}
                  onClick={() => pickLeft(l)}
                >
                  <span dangerouslySetInnerHTML={{ __html: p.left }} />
                  <span className="match__badge mono" aria-hidden="true">
                    {paired ? pairNumber(l) : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="match__col" aria-label={m.quiz.match.rightLabel}>
          {rights.map((r) => {
            const l = leftOf(r);
            const state = showResult && l !== null ? (l === r ? "right" : "wrong") : l !== null ? "paired" : undefined;
            const label = plainText(item.pairs[r]?.right ?? "");
            return (
              <li key={r}>
                <button
                  type="button"
                  className="match__chip match__chip--right"
                  data-match-right
                  data-state={state}
                  disabled={locked || active === null}
                  aria-label={l !== null ? `${label}, ${m.quiz.match.pairWith(pairNumber(l))}` : label}
                  onClick={() => pickRight(r)}
                >
                  <span className="match__badge mono" aria-hidden="true">
                    {l !== null ? pairNumber(l) : ""}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: item.pairs[r]?.right ?? "" }} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
