/**
 * A pencil checkbox: an ink box, slightly hand drawn, with a blue tick when it is done. A dashed box means "not yet,
 * but you can still open it".
 */
export function Tick({ done = false, locked = false, write = false, className }: { done?: boolean; locked?: boolean; write?: boolean; className?: string }) {
  const cls = ["cbox", locked && "cbox--locked", write && "write", className].filter(Boolean).join(" ");
  return (
    <span className={cls} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path className="cbox__box" d="M3.5 3.8 20.6 3.3 20.3 20.5 3.2 20.7Z" />
        {done && <path className="cbox__tick" pathLength={1} d="M5 12.5c1.8 1.2 3.4 3 4.8 5.8C12.6 11 17.5 5 25 1.5" />}
      </svg>
    </span>
  );
}
