import { useEffect } from "react";
import { m } from "../i18n";
import { Mascot } from "../mascot/Mascot";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { useToasts, type Toast } from "./toast-store";

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    if (!t.duration) return;
    const timer = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, dismiss]);
  return (
    <div className={`toast toast--${t.tone}`}>
      <div className="toast__icon">{t.mascot ? <Mascot pose={t.mascot} size={32} animate={false} /> : <Icon name={t.icon ?? "info"} size={20} />}</div>
      <div className="toast__text">
        <p className="toast__title">{t.title}</p>
        {t.body && <p className="toast__body">{t.body}</p>}
      </div>
      <IconButton label={m.toast.dismiss} icon="close" size="small" onClick={() => dismiss(t.id)} />
    </div>
  );
}

/**
 * Live region for toasts. One per page, in the layout. One toast at a time: the next waits until this one leaves (its
 * timer starts when it shows), so they never stack over the page.
 */
export default function ToastRegion() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <section className="toasts" aria-label={m.toast.region} aria-live="polite" aria-relevant="additions">
      {toasts.slice(0, 1).map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </section>
  );
}
