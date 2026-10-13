/**
 * Runs on every page (layouts/Base.astro). A guest stops at the localStorage check: no Firebase, no request. For a
 * signed-in learner, Firebase loads once the page is idle and the store starts syncing (session.resume), so a lesson's
 * text and quiz never wait for it.
 */
import { signedIn } from "./device";

export function boot(): void {
  if (!signedIn()) return;
  const start = () => {
    import("./session")
      .then((s) => s.resume())
      .catch(() => {
        // Offline before the account code was ever cached: try again when the browser is back online.
        window.addEventListener("online", start, { once: true });
      });
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(start, { timeout: 3000 });
  else setTimeout(start, 1000);
}
