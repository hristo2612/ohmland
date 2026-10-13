import { useId } from "react";
import { m } from "../i18n";

/** A text box for a quantity, with its unit shown inside the field. Prefixes and units can be typed too. */
export function NumericField({
  value,
  onChange,
  unit,
  locked,
  label = m.quiz.numeric.label,
  state,
  onSubmit,
}: {
  value: string | undefined;
  onChange(v: string): void;
  unit: string;
  locked: boolean;
  label?: string;
  state?: "right" | "wrong" | undefined;
  onSubmit?(): void;
}) {
  const id = useId();
  const noteId = useId();
  return (
    <div className="numeric" data-state={state}>
      <label htmlFor={id} className="numeric__label">
        {label}
      </label>
      <div className="numeric__field">
        <input
          id={id}
          className="numeric__input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={m.quiz.numeric.placeholder}
          value={value ?? ""}
          readOnly={locked}
          aria-describedby={noteId}
          data-numeric-input
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <span className="numeric__unit" aria-hidden="true">
          {unit}
        </span>
      </div>
      <p id={noteId} className="numeric__note">
        {m.quiz.numeric.unitNote(unit)}
      </p>
    </div>
  );
}
