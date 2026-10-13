/**
 * The cloud write queue: it holds only the newest value, sends it once changes pause for `delayMs`, one send at a time,
 * and keeps it when a send fails: offline it waits for the browser to come back (`network(true)`), otherwise it tries
 * again after a growing pause. Pure (timers and the network are passed in), so it is tested without a browser.
 */
export type QueueStatus = "syncing" | "synced" | "offline" | "error";

export type PushQueue<T> = {
  /** Remembers `value` as the newest and (re)starts the pause before sending it. */
  schedule(value: T): void;
  /** Sends the waiting value now. Resolves when it is sent or has failed; never rejects. */
  flush(): Promise<void>;
  /** The browser went offline (false) or came back (true): back online, what is waiting goes at once. */
  network(up: boolean): Promise<void>;
  /** What has not reached the cloud yet: the waiting value, else the one being sent. */
  unsent(): T | null;
  /** The newest value needs no send (the cloud already has it): drops what is waiting. */
  skip(): void;
  /** Drops what is waiting and stops every timer. */
  cancel(): void;
};

export type QueueOptions<T> = {
  send(value: T): Promise<void>;
  onStatus(status: QueueStatus): void;
  delayMs?: number;
  isOnline?: () => boolean;
  /** True when a failure means the network is down (as opposed to a refused or broken write). */
  isNetworkError?: (e: unknown) => boolean;
  /** Pauses before each retry after a failure; the last one repeats. */
  retryMs?: readonly number[];
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
};

export const SYNC_DELAY_MS = 2000;
const RETRY_MS = [5_000, 20_000, 60_000, 300_000] as const;

export function createPushQueue<T>({
  send,
  onStatus,
  delayMs = SYNC_DELAY_MS,
  isOnline = () => true,
  isNetworkError = () => false,
  retryMs = RETRY_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
}: QueueOptions<T>): PushQueue<T> {
  let waiting: T | null = null;
  let sending: T | null = null;
  let timer: unknown = null;
  let retryTimer: unknown = null;
  let failures = 0;
  let chain: Promise<void> = Promise.resolve();
  let status: QueueStatus | null = null;

  const setStatus = (s: QueueStatus) => {
    if (s === status) return;
    status = s;
    onStatus(s);
  };
  const stop = (id: unknown) => {
    if (id !== null) clearTimer(id);
    return null;
  };

  async function sendWaiting() {
    if (waiting === null) return;
    if (!isOnline()) {
      setStatus("offline");
      return;
    }
    const value = waiting;
    waiting = null;
    sending = value;
    setStatus("syncing");
    try {
      await send(value);
      failures = 0;
      if (waiting === null) setStatus("synced");
    } catch (e) {
      // A newer value may have arrived meanwhile; it wins. Otherwise this one waits for the next try.
      if (waiting === null) waiting = value;
      setStatus(!isOnline() || isNetworkError(e) ? "offline" : "error");
      const pause = retryMs[Math.min(failures, retryMs.length - 1)] ?? 60_000;
      failures++;
      retryTimer = stop(retryTimer);
      retryTimer = setTimer(() => {
        retryTimer = null;
        void flush();
      }, pause);
    } finally {
      sending = null;
    }
  }

  function flush(): Promise<void> {
    timer = stop(timer);
    // One send at a time, in order, so an older value never lands after a newer one.
    chain = chain.then(sendWaiting, sendWaiting);
    return chain;
  }

  return {
    schedule(value) {
      waiting = value;
      setStatus(isOnline() ? "syncing" : "offline");
      timer = stop(timer);
      timer = setTimer(() => {
        timer = null;
        void flush();
      }, delayMs);
    },
    flush,
    network(up) {
      if (!up) {
        setStatus("offline");
        return chain;
      }
      failures = 0;
      retryTimer = stop(retryTimer);
      if (waiting === null && sending === null) {
        setStatus("synced");
        return chain;
      }
      return flush();
    },
    unsent: () => waiting ?? sending,
    skip() {
      waiting = null;
      timer = stop(timer);
      if (sending === null) setStatus(isOnline() ? "synced" : "offline");
    },
    cancel() {
      waiting = null;
      timer = stop(timer);
      retryTimer = stop(retryTimer);
    },
  };
}
