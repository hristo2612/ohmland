import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { m } from "../i18n";
import { IconButton } from "./IconButton";

export type DialogProps = {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  /** Visible description under the title (also the dialog's accessible description). */
  description?: ReactNode;
  variant?: "center" | "sheet";
  /** Element to focus when the dialog opens; defaults to the first focusable element after the close button. */
  initialFocus?: RefObject<HTMLElement | null>;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog on the native <dialog> element: showModal() makes everything behind it inert (no clicks, no focus,
 * hidden from assistive tech). On top of that, Tab and Shift+Tab cycle inside the dialog, Escape and a click on the
 * backdrop close it, and focus returns to whatever opened it.
 */
export function Dialog({ open, onClose, title, description, variant = "center", initialFocus, actions, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      const target = initialFocus?.current ?? [...d.querySelectorAll<HTMLElement>(FOCUSABLE)][1] ?? d.querySelector<HTMLElement>(FOCUSABLE);
      // focus without scrolling, so a long sheet opens at its top
      target?.focus({ preventScroll: true });
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, initialFocus]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onDialogClose = () => {
      const back = returnTo.current;
      returnTo.current = null;
      if (back && back.isConnected) back.focus();
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = [...d.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === d) onClose();
    };
    d.addEventListener("close", onDialogClose);
    d.addEventListener("cancel", onCancel);
    d.addEventListener("keydown", onKey);
    d.addEventListener("click", onClick);
    return () => {
      d.removeEventListener("close", onDialogClose);
      d.removeEventListener("cancel", onCancel);
      d.removeEventListener("keydown", onKey);
      d.removeEventListener("click", onClick);
    };
  }, [onClose]);

  const cls = ["dialog", variant === "sheet" && "dialog--sheet", className].filter(Boolean).join(" ");
  return (
    <dialog ref={ref} className={cls} aria-labelledby={titleId} aria-describedby={description ? descId : undefined}>
      {open && (
        <div className="dialog__inner">
          <div className="dialog__head">
            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>
            <IconButton label={m.dialog.close} icon="close" onClick={onClose} />
          </div>
          {description && (
            <div id={descId} className="dialog__body">
              {description}
            </div>
          )}
          {children}
          {actions && <div className="dialog__actions">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}
