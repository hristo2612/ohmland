/**
 * What this device remembers about the account, in localStorage. Tiny and free of Firebase on purpose: every page reads
 * it (boot.ts, the header) to decide whether to load Firebase at all, so a guest never downloads the SDK.
 */

/** Set while this device is joined to an account. Pages load Firebase and sync only when it is "1". */
export const SIGNED_IN_KEY = "ohmland:signed-in";
/**
 * The account this device's progress was last joined to. Kept after signing out, so a different account signing in on
 * the same device is asked before anything merges.
 */
export const LAST_UID_KEY = "ohmland:account-uid";
/** Set (in sessionStorage) while a sign-in by redirect, made to confirm deleting the account, is under way. */
export const DELETE_PENDING_KEY = "ohmland:delete-after-reauth";
/**
 * The account whose cloud copy must be replaced, not merged, at the next write: all progress was deleted while signed
 * in and the write has not landed yet (offline). Kept across pages so a reload cannot bring the progress back.
 */
export const REPLACE_PENDING_KEY = "ohmland:replace-pending";
/** Tells this tab's islands (the header) that the sign-in changed. Other tabs hear the storage event instead. */
const CHANGED = "ohmland:account-changed";

function local(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return local()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    const s = local();
    if (value === null) s?.removeItem(key);
    else s?.setItem(key, value);
  } catch {
    // Without storage this device simply stays signed out between pages.
  }
}

const announce = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
};

/** True while this device is joined to an account. Blocked storage reads as signed out. */
export const signedIn = (): boolean => read(SIGNED_IN_KEY) === "1";
export const lastUid = (): string | null => read(LAST_UID_KEY);

/** Joins this device to `uid`: its pages sync from now on. */
export function rememberAccount(uid: string): void {
  write(LAST_UID_KEY, uid);
  write(SIGNED_IN_KEY, "1");
  announce();
}

/** Signed out: pages stop loading Firebase. The last account is kept for the "different account" question. */
export function forgetSignIn(): void {
  write(SIGNED_IN_KEY, null);
  announce();
}

/** The account is gone (deleted): the device's progress is a guest's again. */
export function forgetAccount(): void {
  write(SIGNED_IN_KEY, null);
  write(LAST_UID_KEY, null);
  write(REPLACE_PENDING_KEY, null);
  announce();
}

export const replacePending = (uid: string): boolean => read(REPLACE_PENDING_KEY) === uid;
export const setReplacePending = (uid: string | null): void => write(REPLACE_PENDING_KEY, uid);

/** Calls `cb` when this tab or another one signs the device in or out. Returns an unsubscribe function. */
export function onSignInChange(cb: (signedIn: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fromOtherTab = (e: StorageEvent) => {
    if (e.key === SIGNED_IN_KEY || e.key === null) cb(signedIn());
  };
  const fromThisTab = () => cb(signedIn());
  window.addEventListener("storage", fromOtherTab);
  window.addEventListener(CHANGED, fromThisTab);
  return () => {
    window.removeEventListener("storage", fromOtherTab);
    window.removeEventListener(CHANGED, fromThisTab);
  };
}
