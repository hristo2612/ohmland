import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { resumeTarget } from "../progress/derive";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { Button } from "./Button";

/**
 * The landing's call to action. A new visitor goes straight into the first lesson; a returning learner continues
 * where they left off. The server renders the new-visitor version, so the button is there before any script runs.
 */
export default function HeroActions({ outline, size = "large", secondary = true }: { outline: CourseOutline; size?: "regular" | "large"; secondary?: boolean }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const first = outline.order[0];
  const started = ready && (Object.keys(learner.lessons).length > 0 || Object.keys(learner.inProgress).length > 0);
  const target = started ? resumeTarget(learner, outline) : first;
  const lesson = target ? outline.lessons[target] : undefined;
  return (
    <div className="hero-actions">
      <Button variant="primary" size={size} href={lesson?.href ?? "/learn"} iconEnd="arrow-right">
        {started ? m.landing.continue : m.landing.start}
      </Button>
      {secondary && (
        <Button variant="secondary" size={size} href="/learn">
          {m.landing.seeCourse}
        </Button>
      )}
    </div>
  );
}
