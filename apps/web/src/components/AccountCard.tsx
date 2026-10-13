import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountView, ProviderId, SignInResult } from "../account/session";
import { m } from "../i18n";
import { useLearner } from "../progress/store";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import type { IconName } from "./icons";
import { toast } from "./toast-store";

type Session = typeof import("../account/session");
/** Firebase comes with the session module. The account page is one of the two places allowed to load it. */
const loadSession = (): Promise<Session> => import("../account/session");

type Message = { tone: "info" | "warn"; text: string };
type Phase =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "ask"; account: AccountView; lessons: number }
  | { kind: "stuck"; account: AccountView; text: string }
  | { kind: "signed-in"; account: AccountView };
type Deleting = { again: boolean; reauth: boolean; busy: boolean; error: string | null };

const providerName = (id: ProviderId) => m.account.providers[id] ?? id;
const QUIET = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);

function errorText(r: Extract<SignInResult, { kind: "error" }>): string {
  if (r.reason === "provider-off") return m.account.errors.providerOff(providerName(r.provider ?? "google.com"));
  if (r.reason === "offline") return m.account.errors.offline;
  if (r.reason === "too-many") return m.account.errors.tooMany;
  if (r.reason === "unreachable") return m.account.errors.unreachable;
  return m.account.errors.failed;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0]?.toUpperCase() ?? "")
    .join("");

/** The provider's photo when there is one (sent without the page address), else the learner's initials. */
function Avatar({ account }: { account: AccountView }) {
  const [broken, setBroken] = useState(false);
  const letters = initials(account.name);
  return (
    <span className="avatar" aria-hidden="true">
      {account.photo && !broken ? (
        <img src={account.photo} alt="" width={56} height={56} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : letters ? (
        <span className="avatar__initials">{letters}</span>
      ) : (
        <Icon name="user" size={26} />
      )}
    </span>
  );
}

const STATUS_ICON: Record<string, IconName> = { local: "cloud", syncing: "cloud", synced: "cloud-check", offline: "cloud-off", error: "alert" };

function SyncStatus() {
  const status = useLearner((s) => s.sync.status);
  return (
    <div className="sync-status" data-status={status} role="status">
      <Icon name={STATUS_ICON[status] ?? "cloud"} size={22} />
      <div>
        <p className="sync-status__title" data-sync-status={status}>
          {m.account.status[status]}
        </p>
        <p className="small muted">{m.account.statusBody[status]}</p>
      </div>
    </div>
  );
}

/**
 * The account card on /account. Signed out: what signing in is for, Google and GitHub, and a privacy note. Signed in:
 * who, the sync status, signing out and deleting the account. It also asks the "progress from before" question. It is
 * the only component that loads Firebase (through the session module) for a learner who is not signed in yet.
 */
export function AccountCard({ onSignedIn }: { onSignedIn(on: boolean): void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [busy, setBusy] = useState<ProviderId | "work" | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const session = useRef<Session | null>(null);
  const live = useRef(true);

  const apply = useCallback((r: SignInResult) => {
    if (!live.current || r.kind === "leaving") return;
    setBusy(null);
    switch (r.kind) {
      case "done":
        setPhase({ kind: "signed-in", account: r.account });
        setMessage(null);
        if (r.linked) toast({ title: m.account.linked(providerName(r.linked)), tone: "good", icon: "check-circle" });
        break;
      case "ask":
        setPhase({ kind: "ask", account: r.account, lessons: r.lessons });
        break;
      case "delete-ready":
        setPhase({ kind: "signed-in", account: r.account });
        setDeleting({ again: true, reauth: false, busy: false, error: null });
        break;
      case "other-provider":
        setPhase({ kind: "signed-out" });
        setMessage({ tone: "info", text: m.account.errors.otherProvider(r.email, providerName(r.existing), providerName(r.attempted)) });
        break;
      case "error":
        if (r.account) setPhase({ kind: "stuck", account: r.account, text: errorText(r) });
        else {
          setPhase({ kind: "signed-out" });
          setMessage({ tone: "warn", text: errorText(r) });
        }
        break;
      default:
        setPhase({ kind: "signed-out" });
    }
  }, []);

  useEffect(() => {
    live.current = true;
    loadSession()
      .then((s) => {
        session.current = s;
        return s.start();
      })
      .then(apply, () => {
        // The account code could not load (offline on a first visit).
        if (!live.current) return;
        setPhase({ kind: "signed-out" });
        setMessage({ tone: "warn", text: m.account.errors.offline });
      });
    return () => {
      live.current = false;
    };
  }, [apply]);

  // "stuck" is signed in but not joined yet: nothing syncs, so the rest of the page still speaks of this device only.
  const signedInNow = phase.kind === "signed-in";
  useEffect(() => onSignedIn(signedInNow), [signedInNow, onSignedIn]);

  const run = async (work: (s: Session) => Promise<SignInResult>) => {
    const s = session.current;
    if (!s) return;
    setBusy("work");
    apply(await work(s).catch((): SignInResult => ({ kind: "error", reason: "failed" })));
  };

  const signIn = async (id: ProviderId) => {
    setBusy(id);
    setMessage(null);
    try {
      // Loaded on open, so the popup opens straight from this click.
      const s = session.current ?? (session.current = await loadSession());
      apply(await s.signIn(id));
    } catch {
      apply({ kind: "error", reason: "failed" });
    }
  };

  const signOut = async () => {
    const s = session.current;
    if (!s) return;
    setBusy("work");
    await s.signOut();
    if (!live.current) return;
    setBusy(null);
    setPhase({ kind: "signed-out" });
    toast({ title: m.account.signedOut, icon: "sign-out" });
  };

  const askDelete = () => setDeleting({ again: false, reauth: !(session.current?.recentlySignedIn() ?? false), busy: false, error: null });

  const confirmDelete = async () => {
    const s = session.current;
    if (!s || phase.kind !== "signed-in" || !deleting) return;
    setDeleting({ ...deleting, busy: true, error: null });
    try {
      // Straight from the click: a confirmation popup, when needed, opens before anything is awaited.
      const r = await s.deleteAccount(phase.account.provider);
      if (r === "leaving" || !live.current) return;
      setDeleting(null);
      setPhase({ kind: "signed-out" });
      toast({ title: m.account.deleted, icon: "trash" });
    } catch (e) {
      const code = s.errorCode(e);
      const error = QUIET.has(code) ? null : code === "auth/user-mismatch" ? m.account.deleteMismatch : m.account.deleteFailed;
      setDeleting({ ...deleting, busy: false, error });
    }
  };

  if (phase.kind === "loading")
    return (
      <section className="card card--raised account__card" aria-busy="true" aria-label={m.common.loading}>
        <div className="account__skeleton" />
      </section>
    );

  if (phase.kind === "signed-in" || phase.kind === "stuck") {
    const { account } = phase;
    const name = account.name || m.account.unnamed;
    return (
      <section className="card card--raised account__card" aria-labelledby="account-title" data-signed-in>
        <div className="account__who">
          <Avatar account={account} />
          <div className="account__who-text">
            <h2 id="account-title" className="account__name">
              {name}
            </h2>
            {account.email && account.email !== name && (
              <p className="small muted account__email" title={account.email}>
                {account.email}
              </p>
            )}
            <Badge tone="good" icon="check">
              {m.account.signedInWith(providerName(account.provider))}
            </Badge>
          </div>
        </div>
        {phase.kind === "stuck" ? (
          <div className="notice notice--warn account__stuck" role="status">
            <Icon name="alert" size={20} />
            <p>{phase.text}</p>
            <Button size="small" onClick={() => run((s) => s.retryJoin())} disabled={busy !== null}>
              {m.account.retry}
            </Button>
          </div>
        ) : (
          <SyncStatus />
        )}
        <div className="account__actions">
          <Button icon="sign-out" onClick={signOut} disabled={busy !== null}>
            {m.account.signOut}
          </Button>
        </div>
        <div className="account__row account__danger">
          <div>
            <p className="account__row-title">{m.account.deleteAccount}</p>
            <p className="small muted">{m.account.deleteAccountBody}</p>
          </div>
          <Button variant="danger" icon="trash" onClick={askDelete} disabled={busy !== null || phase.kind !== "signed-in"}>
            {m.account.deleteAccount}
          </Button>
        </div>
        <Dialog
          open={deleting !== null}
          onClose={() => !deleting?.busy && setDeleting(null)}
          title={m.account.deleteTitle}
          description={deleting?.again ? m.account.deleteAgain : m.account.deleteConfirmBody}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleting?.busy}>
                {m.common.cancel}
              </Button>
              <Button variant="danger" icon="trash" onClick={confirmDelete} disabled={deleting?.busy}>
                {deleting?.busy ? m.account.deleting : m.account.deleteConfirm}
              </Button>
            </>
          }
        >
          {deleting?.reauth && <p className="small muted account__note">{m.account.deleteReauth(providerName(account.provider))}</p>}
          {deleting?.error && (
            <p className="account__error small" role="alert">
              {deleting.error}
            </p>
          )}
        </Dialog>
      </section>
    );
  }

  return (
    <section className="card card--raised account__card" aria-labelledby="signin-title">
      <div className="account__signin-head">
        <span className="account__icon">
          <Icon name="cloud" size={24} />
        </span>
        <div>
          <h2 id="signin-title">{m.account.signInTitle}</h2>
          <p className="muted">{m.account.signInBody}</p>
        </div>
      </div>
      <div className="account__providers">
        <Button size="large" icon="google" block onClick={() => signIn("google.com")} disabled={busy !== null} aria-busy={busy === "google.com" || undefined}>
          {busy === "google.com" ? m.account.signingIn : m.account.google}
        </Button>
        <Button size="large" icon="github" block onClick={() => signIn("github.com")} disabled={busy !== null} aria-busy={busy === "github.com" || undefined}>
          {busy === "github.com" ? m.account.signingIn : m.account.github}
        </Button>
      </div>
      <div role="status" className="account__message">
        {message && (
          <div className={message.tone === "warn" ? "notice notice--warn" : "notice"}>
            <Icon name={message.tone === "warn" ? "alert" : "info"} size={20} />
            <p>{message.text}</p>
          </div>
        )}
      </div>
      <p className="account__privacy small muted">
        <Icon name="shield" size={18} />
        <span>{m.account.privacy}</span>
      </p>
      <Dialog
        open={phase.kind === "ask"}
        onClose={() => void run((s) => s.choose("cancel"))}
        title={m.account.askTitle}
        description={phase.kind === "ask" ? m.account.askBody(phase.lessons) : null}
        actions={
          <>
            <Button variant="secondary" onClick={() => run((s) => s.choose("account"))} disabled={busy !== null}>
              {m.account.askAccount}
            </Button>
            <Button variant="primary" onClick={() => run((s) => s.choose("add"))} disabled={busy !== null}>
              {m.account.askAdd}
            </Button>
          </>
        }
      >
        <p className="small muted account__note">{m.account.askNote}</p>
      </Dialog>
    </section>
  );
}
