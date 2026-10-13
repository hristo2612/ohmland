/**
 * Firebase: the app, Auth and Firestore Lite, and every call the account makes. Only session.ts imports this file, and
 * only pages that need it load session.ts (dynamically: /account, and pages of a signed-in learner, see boot.ts), so the
 * SDK never reaches a guest's first load.
 */
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  deleteUser,
  getRedirectResult,
  GithubAuthProvider,
  GoogleAuthProvider,
  initializeAuth,
  linkWithCredential,
  onAuthStateChanged,
  onIdTokenChanged,
  reauthenticateWithPopup,
  reauthenticateWithRedirect,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthCredential,
  type AuthError,
  type AuthProvider,
  type User,
  type UserCredential,
} from "firebase/auth";
// Firestore Lite: plain reads and writes over HTTPS, no listeners and no offline cache. A write offline fails at once
// (the queue in queue.ts keeps it), and the chunk is a fraction of the full SDK.
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getFirestore, runTransaction, setDoc } from "firebase/firestore/lite";
import { emulatorHosts, firebaseConfig } from "./config";
import type { RemoteDoc } from "./remote";

const app = initializeApp(firebaseConfig);
/** The session is kept in localStorage, so it outlives the tab. */
const auth = initializeAuth(app, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });
const db = getFirestore(app);

/** An emulator build (PUBLIC_OHMLAND_EMULATORS) talks to the local emulators. Production builds leave it unset. */
const emulators = emulatorHosts(import.meta.env.PUBLIC_OHMLAND_EMULATORS);
if (emulators?.auth) connectAuthEmulator(auth, `http://${emulators.auth.host}:${emulators.auth.port}`, { disableWarnings: true });
if (emulators?.firestore) connectFirestoreEmulator(db, emulators.firestore.host, emulators.firestore.port);

export type { User };
export type ProviderId = "google.com" | "github.com";

export const codeOf = (e: unknown): string =>
  typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";

/** The signed-in user once Auth has read its saved session, or null. */
export async function currentUser(): Promise<User | null> {
  await auth.authStateReady();
  return auth.currentUser;
}

/** The signed-in user right now, without waiting (for calls that must open a popup straight from a click). */
export const currentUserNow = (): User | null => auth.currentUser;

/** Calls `cb` whenever the signed-in user changes (also when another tab signs out). Returns an unsubscribe function. */
export const watchUser = (cb: (user: User | null) => void): (() => void) => onAuthStateChanged(auth, cb);

function provider(id: ProviderId): AuthProvider {
  if (id === "github.com") return new GithubAuthProvider();
  const google = new GoogleAuthProvider();
  // Lets someone with several Google accounts pick the right one instead of being signed in silently.
  google.setCustomParameters({ prompt: "select_account" });
  return google;
}

/** A web app added to the iOS home screen: popups cannot come back to it, so sign-in goes by redirect there. */
const iosStandalone = () => typeof navigator !== "undefined" && (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Signs in with a popup. When popups are blocked, or cannot work (iOS home-screen app), the page leaves for the
 * provider instead and this resolves null; the result arrives through redirectResult() when the page loads again.
 */
export async function signInWith(id: ProviderId): Promise<User | null> {
  if (iosStandalone()) {
    await signInWithRedirect(auth, provider(id));
    return null;
  }
  try {
    return (await signInWithPopup(auth, provider(id))).user;
  } catch (e) {
    if (codeOf(e) !== "auth/popup-blocked") throw e;
    await signInWithRedirect(auth, provider(id));
    return null;
  }
}

/** What a sign-in by redirect brought back to this page, or null when the page was opened any other way. */
export const redirectResult = (): Promise<UserCredential | null> => getRedirectResult(auth);

/** The credential a refused sign-in carried (account-exists-with-different-credential), to link it after the right one. */
export function credentialFromError(id: ProviderId, e: unknown): AuthCredential | null {
  return id === "github.com" ? GithubAuthProvider.credentialFromError(e as AuthError) : GoogleAuthProvider.credentialFromError(e as AuthError);
}

export const linkCredential = (user: User, credential: AuthCredential) => linkWithCredential(user, credential);

/** The provider this session signed in with. */
export async function signInProvider(user: User): Promise<ProviderId> {
  const used = (await user.getIdTokenResult()).signInProvider;
  if (used === "github.com" || used === "google.com") return used;
  return user.providerData.some((p) => p.providerId === "github.com") ? "github.com" : "google.com";
}

/** True when the last sign-in is recent enough for Firebase to allow deleting the user (about five minutes). */
export function signedInRecently(user: User, withinMs = 4 * 60_000): boolean {
  const at = Date.parse(user.metadata.lastSignInTime ?? "");
  return Number.isFinite(at) && Date.now() - at < withinMs;
}

/**
 * Confirms it is really the learner (before deleting the account), with the provider they signed in with. Nothing is
 * awaited before the popup opens, so it still counts as part of the click. "redirect": the page is leaving to do it.
 */
export async function reauthenticate(user: User, id: ProviderId): Promise<"done" | "redirect"> {
  const p = provider(id);
  if (iosStandalone()) {
    await reauthenticateWithRedirect(user, p);
    return "redirect";
  }
  try {
    await reauthenticateWithPopup(user, p);
    return "done";
  } catch (e) {
    if (codeOf(e) !== "auth/popup-blocked") throw e;
    await reauthenticateWithRedirect(user, p);
    return "redirect";
  }
}

export const signOutUser = () => signOut(auth);
export const deleteAuthUser = (user: User) => deleteUser(user);

/* The learner's document, learners/{uid}. */

const learnerRef = (uid: string) => doc(db, "learners", uid);

/** The document as stored, or undefined when there is none yet. */
export async function readLearner(uid: string): Promise<unknown> {
  const snap = await getDoc(learnerRef(uid));
  return snap.exists() ? snap.data() : undefined;
}

/** Replaces the document. */
export const writeLearner = (uid: string, d: RemoteDoc) => setDoc(learnerRef(uid), d);

/**
 * Reads the document and writes what `next` makes of it, in one transaction, so a change from another device that lands
 * in between is never overwritten. `next` returns null when nothing needs writing. It may run more than once.
 */
export async function updateLearner(uid: string, next: (stored: unknown) => RemoteDoc | null): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(learnerRef(uid));
    const d = next(snap.exists() ? snap.data() : undefined);
    if (d) tx.set(learnerRef(uid), d);
  });
}

export const deleteLearner = (uid: string) => deleteDoc(learnerRef(uid));

/* The best-effort write for a page that is going away. */

/** The current ID token, kept fresh by Auth, so a page that is closing can send without waiting for anything. */
let idToken: { uid: string; token: string } | null = null;
onIdTokenChanged(auth, (user) => {
  if (!user) {
    idToken = null;
    return;
  }
  user.getIdToken().then(
    (token) => {
      idToken = { uid: user.uid, token };
    },
    () => undefined,
  );
});

const restBase = emulators?.firestore ? `http://${emulators.firestore.host}:${emulators.firestore.port}` : "https://firestore.googleapis.com";

/** A value in the Firestore REST format. Whole numbers go as integers, as the SDK writes them (the rules check `is int`). */
function restValue(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(restValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, restValue(x)])) } };
}

/** Keepalive requests may carry about 64 KB in all; a bigger document waits for the next page instead. */
const KEEPALIVE_BYTES = 60_000;

/**
 * Sends the document with a keepalive request, which the browser finishes after the page is gone (the SDK's own
 * requests would be cancelled). Best effort: false when it could not even be sent. The same rules apply as for the SDK.
 */
export function beaconLearner(uid: string, d: RemoteDoc): boolean {
  if (!idToken || idToken.uid !== uid || typeof fetch !== "function") return false;
  const body = JSON.stringify({ fields: (restValue(d) as { mapValue: { fields: unknown } }).mapValue.fields });
  if (new TextEncoder().encode(body).length > KEEPALIVE_BYTES) return false;
  const url = `${restBase}/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/learners/${encodeURIComponent(uid)}`;
  try {
    fetch(url, { method: "PATCH", keepalive: true, headers: { Authorization: `Bearer ${idToken.token}`, "Content-Type": "application/json" }, body }).catch(
      () => undefined,
    );
    return true;
  } catch {
    return false;
  }
}
