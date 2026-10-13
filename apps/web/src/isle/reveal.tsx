/**
 * The finale's island reveal: a full-screen dialog over the lesson. It shows the island as it stood before the lesson,
 * springs in what the lesson brought (a piece, and a landmark when a module is done), and captions it in the isle's
 * words. One Continue button appears after a moment (at once under reduced motion); Escape closes too. The native
 * modal dialog keeps focus inside and makes the lesson behind it inert.
 *
 * Loaded on demand by the lesson's IsleHooks (../lesson/isle-hooks.ts), never with a lesson page.
 */
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { IslePlan, IsleView, RevealInfo } from "@ohmland/isle";
import { Button } from "../components/Button";
import { m } from "../i18n";
import type { IsleRevealInfo, IsleRevealResult } from "../lesson/isle-hooks";
import { prefersReducedMotion } from "../progress/prefs";
import { timeOption } from "./env";
import { loadIsle } from "./load";
import "./reveal.css";

type Runtime = Awaited<ReturnType<typeof loadIsle>>;

/** When Continue appears, unless motion is reduced. */
const CONTINUE_DELAY_MS = 1400;
/** A beat on the island as it was, before the new piece springs in. */
const BEAT_MS = 350;

/** Shows the reveal for the change from `before` to `after`; resolves when the learner closes it (null: nothing new). */
export async function playReveal(info: IsleRevealInfo): Promise<IsleRevealResult> {
  const rt = await loadIsle();
  const was = rt.isleEvents(info.before, info.outline);
  const now = rt.isleEvents(info.after, info.outline);
  const range = rt.revealRange(was.events, now.events);
  if (!range || info.signal.aborted) return null;
  const plan = rt.makeIsle(now.seed, now.events);
  const big = now.events.slice(range.from + 1).some((e) => e.type === "module");

  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let settled = false;
    const done = (result: IsleRevealResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
      setTimeout(() => {
        root.unmount();
        host.remove();
      });
    };
    root.render(
      <Guard onError={() => done(null)}>
        <RevealDialog rt={rt} plan={plan} from={range.from} to={range.to} big={big} muted={info.muted} outline={info.outline} onShow={info.onShow} onDone={done} />
      </Guard>,
    );
  });
}

/** A crash inside the dialog closes it, so the finale always follows. */
class Guard extends Component<{ onError(): void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

type DialogProps = {
  rt: Runtime;
  plan: IslePlan;
  from: number;
  to: number;
  big: boolean;
  muted: boolean;
  outline: IsleRevealInfo["outline"];
  onShow(): void;
  onDone(result: IsleRevealResult): void;
};

function RevealDialog({ rt, plan, from, to, big, muted, outline, onShow, onDone }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const view = useRef<IsleView | null>(null);
  const result = useRef<IsleRevealResult>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [caption, setCaption] = useState<RevealInfo | null>(null);
  const [canGo, setCanGo] = useState(reduced);

  const close = useCallback(() => {
    view.current?.dispose();
    view.current = null;
    if (dialog.current?.open) dialog.current.close();
    onDone(result.current);
  }, [onDone]);

  useEffect(() => {
    const d = dialog.current;
    const el = stage.current;
    if (!d || !el) return;
    d.showModal();
    onShow();
    heading.current?.focus();
    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    d.addEventListener("cancel", onCancel);
    let cancelled = false;
    const timer = reduced ? 0 : window.setTimeout(() => setCanGo(true), CONTINUE_DELAY_MS);
    (async () => {
      try {
        const v = await rt.mountIsle(el, plan, { interactive: false, quality: "high", muted, reducedMotion: reduced, at: from, messages: rt.isleMessages(outline), ...timeOption() });
        if (cancelled) {
          v.dispose();
          return;
        }
        view.current = v;
        setStatus("ready");
        if (!reduced) await new Promise((r) => setTimeout(r, BEAT_MS));
        if (cancelled) return;
        const got = await v.reveal(from, to);
        if (cancelled) return;
        result.current = { title: got.title, big: got.big };
        setCaption(got);
      } catch {
        // no 3D here (or the island failed to draw): skip straight to the finale
        if (!cancelled) close();
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      d.removeEventListener("cancel", onCancel);
    };
    // the dialog plays once: its inputs never change while it is open
  }, []);

  // Continue takes focus as it appears, so Enter or Space moves on.
  useEffect(() => {
    if (canGo) next.current?.focus();
  }, [canGo]);

  return (
    <dialog
      ref={dialog}
      className="reveal"
      aria-labelledby="reveal-title"
      aria-describedby="reveal-lines"
      data-status={status}
      data-reveal
      // keys stay in the dialog: the lesson's own Enter shortcut must not fire behind it
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="reveal__stage" ref={stage} />
      {status === "loading" && <span className="reveal__spinner" aria-hidden="true" />}
      <div className="reveal__panel">
        <p className="eyebrow">{big ? m.reveal.module : m.reveal.lesson}</p>
        <h2 id="reveal-title" className="reveal__title" ref={heading} tabIndex={-1}>
          {caption?.title ?? m.reveal.growing}
        </h2>
        <div id="reveal-lines" className="reveal__lines" aria-live="polite">
          {caption?.lines.map((line, i) => <p key={i}>{line}</p>)}
        </div>
        {/* hidden (so neither focusable nor read) until it is time to move on */}
        <div className="reveal__actions" data-ready={canGo || undefined}>
          <Button ref={next} variant="primary" size="large" iconEnd="arrow-right" onClick={close} data-reveal-continue>
            {m.reveal.continue}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
