import type { ReactNode } from "react";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import type { IconName } from "../components/icons";
import { m } from "../i18n";

export type Action = { label: string; onClick(): void; disabled?: boolean; icon?: IconName; busy?: boolean };

/**
 * The bar at the bottom of every step: an optional back button, an optional quiet action, and the one primary
 * action. The primary carries data-primary so Enter (and tests) can find it.
 */
export function StepActions({ primary, secondary, onBack, children }: { primary: Action; secondary?: Action | undefined; onBack?: (() => void) | undefined; children?: ReactNode }) {
  return (
    <div className="step-actions">
      <div className="step-actions__inner">
        <div className="step-actions__start">
          {onBack && <IconButton label={m.lesson.back} icon="arrow-left" variant="outline" onClick={onBack} />}
          {children}
        </div>
        <div className="step-actions__end">
          {secondary && (
            <Button variant="tertiary" onClick={secondary.onClick} disabled={secondary.disabled} icon={secondary.icon}>
              {secondary.label}
            </Button>
          )}
          <Button
            variant="primary"
            size="large"
            onClick={primary.onClick}
            disabled={primary.disabled}
            iconEnd={primary.icon ?? "arrow-right"}
            data-primary
            aria-busy={primary.busy || undefined}
          >
            {primary.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
