import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { resumeTarget } from "../progress/derive";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { Icon } from "./Icon";

/**
 * The landing's one action, drawn as the switch in the hero's circuit. A new visitor goes straight into the first
 * lesson; a returning learner continues where they left off. The server renders the new-visitor version, so the
 * switch is there before any script runs.
 */
export default function HeroActions({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const first = outline.order[0];
  const started = ready && (Object.keys(learner.lessons).length > 0 || Object.keys(learner.inProgress).length > 0);
  const target = started ? resumeTarget(learner, outline) : first;
  const lesson = target ? outline.lessons[target] : undefined;
  return (
    <a className="btn btn--primary hero__switch" href={lesson?.href ?? "/learn"} data-switch>
      <span>{started ? m.landing.continue : m.landing.start}</span>
      <Icon name="arrow-right" size={20} />
    </a>
  );
}
