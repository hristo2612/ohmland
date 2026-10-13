/**
 * The account's flows: sign in (and join this device's progress to the account), resume syncing on a page, sign out,
 * delete the account. Loaded lazily (boot.ts for a signed-in learner's pages, the account page on open); it brings
 * Firebase with it.
 *
 * Joining. After Firebase signs someone in, the cloud copy is read once. If this device holds progress that is not
 * known to be this account's, the learner is asked before anything merges:
 *   - the device was last joined to a different account (and holds progress), or
 *   - the device never joined an account (guest progress) and the account already has progress of its own.
 * A guest who signs in to a brand-new account is not asked: keeping their progress is why they signed in. The answer
 * "add" merges the device into the account; "account" makes the device start from the account's own progress; closing
 * the question signs out and changes nothing. Until the learner answers, nothing syncs.
 */
import { useLearner } from "../progress/store";
import { emptyLearner } from "../progress/state";
import { DELETE_PENDING_KEY, forgetAccount, forgetSignIn, lastUid, rememberAccount, signedIn } from "./device";
import * as fb from "./firebase";
import { fromRemote, hasProgress } from "./remote";
import { createFirestoreSync, type LearnerDocs } from "./sync";

export type ProviderId = fb.ProviderId;

/** The signed-in learner as the account page shows them. */
export type AccountView = { uid: string; name: string; email: string | null; photo: string | null; provider: ProviderId };

export type SignInResult =
  | { kind: "signed-out" }
  /** Joined: this device syncs with the account. `linked`: a second provider was linked to it on the way. */
  | { kind: "done"; account: AccountView; linked?: ProviderId }
  /** This device holds progress that may be someone else's: add it to the account, or start from the account's? */
  | { kind: "ask"; account: AccountView; lessons: number }
  /** The page is leaving for the provider (sign-in by redirect). */
  | { kind: "leaving" }
  /** Nothing to say (the learner closed the popup). */
  | { kind: "quiet" }
  /** The email already has an account made with the other provider. */
  | { kind: "other-provider"; email: string | null; existing: ProviderId; attempted: ProviderId }
  /** A re-sign-in by redirect (to delete the account) came back: ask once more, then delete. */
  | { kind: "delete-ready"; account: AccountView }
  | { kind: "error"; reason: "provider-off" | "offline" | "too-many" | "unreachable" | "failed"; provider?: ProviderId; account?: AccountView };

const QUIET = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);
/** The provider, or this site, is not switched on in the Firebase project yet (docs/ACCOUNTS.md). */
const PROVIDER_OFF = new Set([
  "auth/operation-not-allowed",
  "auth/configuration-not-found",
  "auth/admin-restricted-operation",
  "auth/unauthorized-domain",
  "auth/invalid-oauth-client-id",
]);
const NETWORK = new Set(["unavailable", "deadline-exceeded", "auth/network-request-failed"]);
const isNetworkError = (e: unknown) => NETWORK.has(fb.codeOf(e)) || e instanceof TypeError;

const docs: LearnerDocs = { read: fb.readLearner, write: fb.writeLearner, update: fb.updateLearner, beacon: fb.beaconLearner };

/** The provider a sign-in by redirect left with, to name it if it comes back refused. */
const REDIRECT_PROVIDER_KEY = "ohmland:redirect-provider";
function session(key: string, value?: string | null): string | null {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Without session storage a redirect simply comes back without the hint.
  }
  return null;
}

async function viewOf(user: fb.User): Promise<AccountView> {
  return {
    uid: user.uid,
    name: user.displayName?.trim() || user.email || "",
    email: user.email,
    photo: user.photoURL,
    provider: await fb.signInProvider(user).catch((): ProviderId => "google.com"),
  };
}

/* Syncing */

let stopWatching: (() => void) | null = null;

/** Attaches the store to this account's document, and stops if the account signs out (in this tab or another). */
async function connect(user: fb.User, label: string, prefetched?: { raw: unknown }) {
  const sync = createFirestoreSync({ uid: user.uid, label, docs, isNetworkError, ...(prefetched ? { prefetched } : {}) });
  stopWatching?.();
  stopWatching = fb.watchUser((u) => {
    if (u && u.uid === user.uid) return;
    useLearner.getState().detachSync();
    if (!u) forgetSignIn();
    stopWatching?.();
    stopWatching = null;
  });
  await useLearner.getState().attachSync(sync);
}

let resuming: Promise<void> | null = null;

/** A page of a signed-in learner (boot.ts): connects the store to the account. Safe to call more than once. */
export function resume(): Promise<void> {
  resuming ??= (async () => {
    if (!signedIn()) return;
    const user = await fb.currentUser();
    if (!user || user.uid !== lastUid()) {
      // The session ended (signed out in another tab, or expired), or it is not the account this device joined.
      forgetSignIn();
      return;
    }
    await connect(user, (await viewOf(user)).name);
  })();
  return resuming;
}

/* Signing in */

/** The sign-in that was refused for an existing account, to link it once the learner signs in the other way. */
let pendingLink: { credential: NonNullable<ReturnType<typeof fb.credentialFromError>>; provider: ProviderId } | null = null;
/** A signed-in learner who has not been joined yet: waiting for an answer, or for the cloud to be reachable. */
let pending: { user: fb.User; account: AccountView; raw: unknown } | null = null;

function failure(id: ProviderId, e: unknown): SignInResult {
  const code = fb.codeOf(e);
  if (QUIET.has(code)) return { kind: "quiet" };
  if (code === "auth/account-exists-with-different-credential") {
    const credential = fb.credentialFromError(id, e);
    if (credential) pendingLink = { credential, provider: id };
    const email = (e as { customData?: { email?: unknown } }).customData?.email;
    return { kind: "other-provider", email: typeof email === "string" ? email : null, existing: id === "github.com" ? "google.com" : "github.com", attempted: id };
  }
  if (PROVIDER_OFF.has(code)) return { kind: "error", reason: "provider-off", provider: id };
  if (code === "auth/network-request-failed") return { kind: "error", reason: "offline" };
  if (code === "auth/too-many-requests") return { kind: "error", reason: "too-many" };
  return { kind: "error", reason: "failed" };
}

/** Joins this device to the account, or asks first (see the top of this file). */
async function join(user: fb.User): Promise<SignInResult> {
  const account = await viewOf(user);
  let raw: unknown;
  try {
    raw = await fb.readLearner(user.uid);
  } catch (e) {
    pending = { user, account, raw: undefined };
    return { kind: "error", reason: isNetworkError(e) ? "offline" : "unreachable", account };
  }
  pending = { user, account, raw };
  await useLearner.getState().init();
  const device = useLearner.getState().learner;
  const cloud = fromRemote(raw);
  const last = lastUid();
  const ask = hasProgress(device) && last !== user.uid && (last !== null || (cloud !== null && hasProgress(cloud)));
  if (ask) return { kind: "ask", account, lessons: Object.keys(device.lessons).length };
  return finishJoin("add");
}

async function finishJoin(choice: "add" | "account"): Promise<SignInResult> {
  const p = pending;
  if (!p) return { kind: "signed-out" };
  pending = null;
  if (choice === "account") {
    // The device starts from the account's progress. Its own settings stay; half-done lessons were someone else's.
    const store = useLearner.getState();
    const cloud = fromRemote(p.raw) ?? emptyLearner();
    store.replaceLearner({ ...cloud, inProgress: {}, settings: store.learner.settings });
  }
  rememberAccount(p.user.uid);
  resuming = Promise.resolve();
  await connect(p.user, p.account.name, { raw: p.raw });
  return { kind: "done", account: p.account };
}

async function afterSignIn(user: fb.User): Promise<SignInResult> {
  let linked: ProviderId | undefined;
  if (pendingLink) {
    const l = pendingLink;
    pendingLink = null;
    try {
      await fb.linkCredential(user, l.credential);
      linked = l.provider;
    } catch {
      // Linking is a bonus; the learner is signed in either way.
    }
  }
  const result = await join(user);
  return result.kind === "done" && linked ? { ...result, linked } : result;
}

/**
 * "Continue with Google / GitHub". Call it straight from the click (load this module first): the popup must open
 * within the click, or the browser blocks it (then the page leaves by redirect instead).
 */
export async function signIn(id: ProviderId): Promise<SignInResult> {
  session(REDIRECT_PROVIDER_KEY, id);
  let user: fb.User | null;
  try {
    user = await fb.signInWith(id);
  } catch (e) {
    session(REDIRECT_PROVIDER_KEY, null);
    return failure(id, e);
  }
  if (!user) return { kind: "leaving" };
  session(REDIRECT_PROVIDER_KEY, null);
  return afterSignIn(user);
}

/** The learner's answer to "ask". "cancel" signs out again and leaves the device as it was. */
export async function choose(choice: "add" | "account" | "cancel"): Promise<SignInResult> {
  if (choice !== "cancel") return finishJoin(choice);
  pending = null;
  await fb.signOutUser().catch(() => undefined);
  return { kind: "signed-out" };
}

/** Tries the join again (the cloud could not be reached the first time). */
export async function retryJoin(): Promise<SignInResult> {
  return pending ? join(pending.user) : { kind: "signed-out" };
}

/**
 * The account page opens: finishes a sign-in (or re-sign-in) that came back by redirect, asks again about a join left
 * unanswered, or reports who is signed in.
 */
export async function start(): Promise<SignInResult> {
  try {
    const back = await fb.redirectResult();
    if (back?.operationType === "reauthenticate" && session(DELETE_PENDING_KEY) === "1") {
      session(DELETE_PENDING_KEY, null);
      return { kind: "delete-ready", account: await viewOf(back.user) };
    }
    if (back?.operationType === "signIn") {
      session(REDIRECT_PROVIDER_KEY, null);
      return afterSignIn(back.user);
    }
  } catch (e) {
    const id = session(REDIRECT_PROVIDER_KEY) === "github.com" ? "github.com" : "google.com";
    session(REDIRECT_PROVIDER_KEY, null);
    const said = failure(id, e);
    if (said.kind !== "quiet" && fb.codeOf(e).startsWith("auth/")) return said;
  }
  const user = await fb.currentUser();
  if (!user) {
    forgetSignIn();
    return { kind: "signed-out" };
  }
  if (signedIn() && lastUid() === user.uid) {
    await resume();
    return { kind: "done", account: await viewOf(user) };
  }
  // Firebase has a learner this device never joined (the question was left unanswered): ask again.
  return join(user);
}

/* Signing out and deleting */

/** Signs out. What waits for the cloud goes first (for up to three seconds); the device keeps its progress. */
export async function signOut(): Promise<void> {
  const store = useLearner.getState();
  await Promise.race([store.flushSync(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  stopWatching?.();
  stopWatching = null;
  store.detachSync();
  forgetSignIn();
  resuming = null;
  await fb.signOutUser().catch(() => undefined);
}

/**
 * Deletes the learner's cloud document, then the account itself. Firebase deletes an account only shortly after a
 * sign-in, so an older session confirms with the provider first (a popup, straight from the click: nothing is awaited
 * before it). "leaving": that confirmation goes by redirect; the account page asks once more when it comes back.
 */
export async function deleteAccount(provider: ProviderId): Promise<"deleted" | "leaving"> {
  const user = fb.currentUserNow();
  if (!user) throw new Error("not signed in");
  /** Confirms with the provider; "redirect" means the page is leaving and the account page takes over on return. */
  const confirm = async () => {
    session(DELETE_PENDING_KEY, "1");
    try {
      const r = await fb.reauthenticate(user, provider);
      if (r === "done") session(DELETE_PENDING_KEY, null);
      return r;
    } catch (e) {
      session(DELETE_PENDING_KEY, null);
      throw e;
    }
  };
  if (!fb.signedInRecently(user) && (await confirm()) === "redirect") return "leaving";
  // Nothing may write the document back while it is being deleted.
  stopWatching?.();
  stopWatching = null;
  useLearner.getState().detachSync();
  try {
    await fb.deleteLearner(user.uid);
    try {
      await fb.deleteAuthUser(user);
    } catch (e) {
      if (fb.codeOf(e) !== "auth/requires-recent-login") throw e;
      if ((await confirm()) === "redirect") return "leaving";
      await fb.deleteAuthUser(user);
    }
  } catch (e) {
    // The account is still there (offline, or the confirmation was closed): keep syncing with it.
    resuming = null;
    void resume();
    throw e;
  }
  forgetAccount();
  resuming = null;
  return "deleted";
}

/** True when Firebase will let the account be deleted without confirming with the provider first. */
export function recentlySignedIn(): boolean {
  const user = fb.currentUserNow();
  return user !== null && fb.signedInRecently(user);
}

export const errorCode = fb.codeOf;
