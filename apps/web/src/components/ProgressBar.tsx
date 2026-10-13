export type ProgressBarProps = {
  /** 0..1 */
  value: number;
  /** Optional earlier value (0..1): the part between it and `value` is drawn as a fresh gain. */
  from?: number;
  label: string;
  /** Spoken value, e.g. "150 of 300 XP". Defaults to a percentage. */
  valueText?: string;
  size?: "thin" | "regular" | "thick";
  className?: string;
};

const clamp = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** A determinate progress bar. Width changes animate with transform only. */
export function ProgressBar({ value, from, label, valueText, size = "regular", className }: ProgressBarProps) {
  const v = clamp(value);
  const cls = ["progress", size !== "regular" && `progress--${size}`, className].filter(Boolean).join(" ");
  return (
    <div
      className={cls}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={valueText ?? `${Math.round(v * 100)}%`}
    >
      {from !== undefined && from < v && <div className="progress__gain" style={{ transform: `scaleX(${v})` }} />}
      <div className="progress__fill" style={{ transform: `scaleX(${from !== undefined ? clamp(Math.min(from, v)) : v})` }} />
    </div>
  );
}
