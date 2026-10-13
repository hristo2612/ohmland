/**
 * The one door to the island code. The planner, the renderer and three.js all sit behind this dynamic import, so no
 * page carries them in its first load: a page calls loadIsle() when an island is about to be on screen.
 */
type Runtime = typeof import("./runtime");

let pending: Promise<Runtime> | null = null;

export function loadIsle(): Promise<Runtime> {
  pending ??= import("./runtime").catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}

/** Fetches the island code and three.js without drawing anything, so a reveal that follows starts quickly. */
export function prefetchIsle(): void {
  void loadIsle()
    .then((rt) => rt.warmRenderer())
    .catch(() => undefined);
}
