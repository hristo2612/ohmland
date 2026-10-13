import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPushQueue, type QueueStatus } from "./queue";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(opts: { fail?: () => boolean; online?: () => boolean } = {}) {
  const sent: number[] = [];
  const statuses: QueueStatus[] = [];
  const queue = createPushQueue<number>({
    delayMs: 2000,
    retryMs: [5000],
    isOnline: opts.online ?? (() => true),
    onStatus: (s) => statuses.push(s),
    send: async (v) => {
      if (opts.fail?.()) throw new Error("refused");
      sent.push(v);
    },
  });
  return { queue, sent, statuses };
}

describe("the cloud write queue", () => {
  it("sends only the newest value, once changes pause", async () => {
    const { queue, sent, statuses } = setup();
    queue.schedule(1);
    await vi.advanceTimersByTimeAsync(1500);
    queue.schedule(2);
    queue.schedule(3);
    await vi.advanceTimersByTimeAsync(1999);
    expect(sent).toEqual([]);
    expect(queue.unsent()).toBe(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toEqual([3]);
    expect(statuses).toEqual(["syncing", "synced"]);
    expect(queue.unsent()).toBeNull();
  });

  it("sends at once on flush, and nothing when nothing waits", async () => {
    const { queue, sent } = setup();
    await queue.flush();
    queue.schedule(7);
    await queue.flush();
    expect(sent).toEqual([7]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toEqual([7]);
  });

  it("keeps the value while offline and sends it when the browser is back", async () => {
    let up = false;
    const { queue, sent, statuses } = setup({ online: () => up });
    queue.schedule(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent).toEqual([]);
    expect(statuses).toEqual(["offline"]);
    up = true;
    await queue.network(true);
    expect(sent).toEqual([1]);
    expect(statuses.at(-1)).toBe("synced");
  });

  it("retries a failed send after a pause, and a newer value replaces the one that failed", async () => {
    let failing = true;
    const { queue, sent, statuses } = setup({ fail: () => failing });
    queue.schedule(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses.at(-1)).toBe("error");
    expect(queue.unsent()).toBe(1);
    queue.schedule(2);
    failing = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent).toEqual([2]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent).toEqual([2]);
    expect(statuses.at(-1)).toBe("synced");
  });

  it("drops what waits when the cloud already has the newest value", async () => {
    const { queue, sent, statuses } = setup();
    queue.schedule(1);
    queue.skip();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toEqual([]);
    expect(statuses).toEqual(["syncing", "synced"]);
  });
});
