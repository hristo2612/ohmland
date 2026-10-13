import type { WrapStep as WrapStepT } from "../../content/schema";
import { Icon } from "../../components/Icon";
import { m } from "../../i18n";
import { StepActions } from "../StepActions";
import type { StepProps } from "../types";

/** Rule cards to keep, and an optional "Try it for real" card for learners with parts at home. */
export function WrapStep({ step, onBack, finishing, onFinish }: StepProps<WrapStepT> & { finishing: boolean; onFinish(): void }) {
  return (
    <>
      <div className="step-body">
        <p className="step-eyebrow">
          <span>{m.lesson.stepNames.wrap}</span>
        </p>
        <h1 className="step-title" tabIndex={-1} data-step-heading>
          {m.lesson.rulesTitle}
        </h1>
        <p className="muted">{m.lesson.rulesNote}</p>
        <ol className="rules">
          {step.rules.map((r, i) => (
            <li key={i} className="rule-card">
              <span className="rule-card__num mono" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p dangerouslySetInnerHTML={{ __html: r }} />
              <Icon name="bolt" size={18} className="rule-card__icon" />
            </li>
          ))}
        </ol>

        {step.realWorld && (
          <section className="real-world" aria-labelledby="real-world-title">
            <div className="real-world__head">
              <span className="real-world__icon">
                <Icon name="wrench" size={22} />
              </span>
              <div>
                <h2 id="real-world-title" className="real-world__title">
                  {m.lesson.realWorldTitle}
                </h2>
                <p className="small muted">{m.lesson.realWorldLead}</p>
              </div>
            </div>
            {step.realWorld.body && <div className="prose" dangerouslySetInnerHTML={{ __html: step.realWorld.body }} />}
            <div className="real-world__cols">
              <div>
                <h3 className="real-world__sub">
                  <Icon name="box" size={18} />
                  {m.lesson.realWorldParts}
                </h3>
                <ul className="facts">
                  {step.realWorld.parts.map((p, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: p }} />
                  ))}
                </ul>
              </div>
              <div className="real-world__safety">
                <h3 className="real-world__sub">
                  <Icon name="shield" size={18} />
                  {m.lesson.realWorldSafety}
                </h3>
                <ul className="facts">
                  {step.realWorld.safety.map((p, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: p }} />
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </div>
      <StepActions onBack={onBack} primary={{ label: finishing ? m.lesson.finishing : m.lesson.finish, onClick: onFinish, icon: "check", disabled: finishing, busy: finishing }} />
    </>
  );
}
