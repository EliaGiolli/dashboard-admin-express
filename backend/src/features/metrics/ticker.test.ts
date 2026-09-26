import type { Snapshot } from '@pc-monitor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTicker, type TickerDeps } from './ticker.js';

// All timing is driven by fake timers: vi.advanceTimersByTimeAsync moves the clock and
// flushes the promises in between, so a "2 second" test runs in microseconds.

const INTERVAL = 2_000;

function snapshotAt(ms: number): Snapshot {
  return {
    timestamp: new Date(ms).toISOString(),
    cpu: { total: 10, perCore: [10], tempC: null },
    ram: { used: 1, total: 2, usedPercent: 50 },
    disk: { drives: [], readBps: null, writeBps: null },
    network: { rxBps: null, txBps: null },
  };
}

// Resolves after `ms` of fake time, to simulate a slow systeminformation call.
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// stop() waits for an in-flight cycle; when that cycle sleeps on fake time, the clock
// has to be advanced or the await never resolves.
async function stopAndFlush(ticker: { stop(): Promise<void> }) {
  const stopping = ticker.stop();
  await vi.advanceTimersByTimeAsync(60_000);
  await stopping;
}

function setup(overrides: Partial<TickerDeps> = {}) {
  const calls: string[] = [];
  const deps = {
    collect: vi.fn(async () => {
      calls.push('collect');
      return snapshotAt(Date.now());
    }),
    broadcast: vi.fn(() => {
      calls.push('broadcast');
    }),
    persist: vi.fn(async () => {
      calls.push('persist');
    }),
    onError: vi.fn(),
    intervalMs: INTERVAL,
    ...overrides,
  };
  const ticker = createTicker(deps);
  return { ticker, deps, calls };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ticker: schedule', () => {
  it('runs the first cycle right away, in order collect -> broadcast -> persist', async () => {
    const { ticker, deps, calls } = setup();
    ticker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toEqual(['collect', 'broadcast', 'persist']);
    // broadcast and persist get the very snapshot that was collected
    const snapshot = await vi.mocked(deps.collect).mock.results[0]!.value;
    expect(snapshot.timestamp).toBe('2026-09-26T10:00:00.000Z');
    expect(deps.broadcast).toHaveBeenCalledWith(snapshot);
    expect(deps.persist).toHaveBeenCalledWith(snapshot);
    await ticker.stop();
  });

  it('repeats every interval', async () => {
    const { ticker, deps } = setup();
    ticker.start();
    await vi.advanceTimersByTimeAsync(3 * INTERVAL);
    expect(deps.collect).toHaveBeenCalledTimes(4); // t=0, 2s, 4s, 6s
    await ticker.stop();
  });

  it('keeps a steady cadence: the cycle duration is subtracted from the wait', async () => {
    const starts: number[] = [];
    const { ticker } = setup({
      collect: async () => {
        starts.push(Date.now());
        await sleep(1_500); // like a real Windows snapshot
        return snapshotAt(Date.now());
      },
    });
    ticker.start();
    await vi.advanceTimersByTimeAsync(3 * INTERVAL);

    const t0 = starts[0]!;
    expect(starts.map((t) => t - t0)).toEqual([0, 2_000, 4_000, 6_000]);
    await stopAndFlush(ticker);
  });

  it('never overlaps: a slow cycle delays the next one instead of running in parallel', async () => {
    let active = 0;
    let maxActive = 0;
    const starts: number[] = [];
    const { ticker } = setup({
      collect: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        starts.push(Date.now());
        await sleep(5_000); // longer than the interval
        active--;
        return snapshotAt(Date.now());
      },
    });
    ticker.start();
    await vi.advanceTimersByTimeAsync(12_000);

    expect(maxActive).toBe(1);
    // each cycle starts as soon as the previous one ends (setTimeout 0, which Node
    // clamps to 1ms), instead of waiting another full interval; none is skipped
    expect(starts).toHaveLength(3);
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i]! - starts[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(5_000);
      expect(gap).toBeLessThan(5_000 + 10);
    }
    await stopAndFlush(ticker);
  });

  it('start() while running does not create a second loop', async () => {
    const { ticker, deps } = setup();
    ticker.start();
    ticker.start();
    ticker.start();
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(deps.collect).toHaveBeenCalledTimes(2); // t=0 and t=2s, not 6
    await ticker.stop();
  });
});

describe('ticker: failures never stop the loop', () => {
  it('a failed collect is reported, skips broadcast/persist, and the next cycle still runs', async () => {
    const collect = vi
      .fn<() => Promise<Snapshot>>()
      .mockRejectedValueOnce(new Error('WMI timeout'))
      .mockImplementation(async () => snapshotAt(Date.now()));
    const { ticker, deps } = setup({ collect });

    ticker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(deps.onError).toHaveBeenCalledWith('collect', expect.any(Error));
    expect(deps.broadcast).not.toHaveBeenCalled();
    expect(deps.persist).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(deps.broadcast).toHaveBeenCalledTimes(1);
    expect(deps.persist).toHaveBeenCalledTimes(1);
    await ticker.stop();
  });

  it('a throwing broadcast does not prevent persisting', async () => {
    const { ticker, deps } = setup({
      broadcast: vi.fn(() => {
        throw new Error('socket gone');
      }),
    });
    ticker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(deps.onError).toHaveBeenCalledWith('broadcast', expect.any(Error));
    expect(deps.persist).toHaveBeenCalledTimes(1);
    await ticker.stop();
  });

  it('a failed persist is reported after the data was already broadcast', async () => {
    const { ticker, deps } = setup({ persist: vi.fn().mockRejectedValue(new Error('SQLITE_BUSY')) });
    ticker.start();
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(deps.broadcast).toHaveBeenCalledTimes(2);
    expect(deps.onError).toHaveBeenCalledTimes(2);
    expect(deps.onError).toHaveBeenCalledWith('persist', expect.any(Error));
    await ticker.stop();
  });

  it('runs afterBroadcast between broadcast and persist, and isolates its errors', async () => {
    const calls: string[] = [];
    const { ticker, deps } = setup({
      broadcast: () => void calls.push('broadcast'),
      afterBroadcast: async () => {
        calls.push('afterBroadcast');
        throw new Error('alert failed');
      },
      persist: async () => void calls.push('persist'),
    });
    ticker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(['broadcast', 'afterBroadcast', 'persist']);
    expect(deps.onError).toHaveBeenCalledWith('afterBroadcast', expect.any(Error));
    await ticker.stop();
  });
});

describe('ticker: stop', () => {
  it('stops scheduling cycles', async () => {
    const { ticker, deps } = setup();
    ticker.start();
    await vi.advanceTimersByTimeAsync(0);
    await ticker.stop();
    expect(ticker.isRunning()).toBe(false);
    await vi.advanceTimersByTimeAsync(10 * INTERVAL);
    expect(deps.collect).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight cycle to finish (no half-written sample) and then schedules nothing', async () => {
    let persisted = false;
    const { ticker, deps } = setup({
      persist: async () => {
        await sleep(1_000);
        persisted = true;
      },
    });
    ticker.start();
    await vi.advanceTimersByTimeAsync(0); // cycle is now inside persist

    let stopped = false;
    const stopping = ticker.stop().then(() => (stopped = true));
    await vi.advanceTimersByTimeAsync(500);
    expect(stopped).toBe(false); // still waiting for persist

    await vi.advanceTimersByTimeAsync(500);
    await stopping;
    expect(persisted).toBe(true);

    await vi.advanceTimersByTimeAsync(10 * INTERVAL);
    expect(deps.collect).toHaveBeenCalledTimes(1);
  });

  it('is idempotent and safe before start', async () => {
    const { ticker } = setup();
    await ticker.stop();
    ticker.start();
    await ticker.stop();
    await ticker.stop();
    expect(ticker.isRunning()).toBe(false);
  });

  it('can be restarted after stop, with a single loop', async () => {
    const { ticker, deps } = setup();
    ticker.start();
    await vi.advanceTimersByTimeAsync(0);
    await ticker.stop();

    ticker.start();
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(deps.collect).toHaveBeenCalledTimes(3); // 1 before stop, then t=0 and t=2s
    await ticker.stop();
  });

  it('restarting while the old cycle is still finishing keeps a single loop', async () => {
    const { ticker, deps } = setup({ persist: () => sleep(1_000) });
    ticker.start();
    await vi.advanceTimersByTimeAsync(0); // in persist
    void ticker.stop(); // not awaited
    ticker.start(); // restart before the old cycle ended
    await vi.advanceTimersByTimeAsync(3 * INTERVAL);
    // one chain only: cycles at 0, 2s, 4s, 6s
    expect(deps.collect).toHaveBeenCalledTimes(4);
    await stopAndFlush(ticker);
  });
});
