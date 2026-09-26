import type { Snapshot } from '@pc-monitor/shared';
import { insertSample } from './samples.service.js';
import { collectSnapshot, stopSnapshotSources, toNewSample } from './snapshot.js';

/**
 * The metrics loop: every `intervalMs` it collects a snapshot, pushes it to the live
 * clients and stores it. It is the heart of the app, so the rules below are deliberate:
 *
 * 1. No overlapping cycles. A snapshot takes ~1.7s on Windows (several readers spawn
 *    PowerShell), close to the 2s interval. setInterval would start a new cycle while
 *    the previous one is still running and pile up work when the machine is busy, which
 *    is exactly when the monitor must stay light. So each cycle schedules the next one
 *    with setTimeout only after it has finished.
 *
 * 2. Steady cadence. The delay is measured from the *start* of the cycle, so a 1.7s
 *    cycle is followed by a 0.3s wait and ticks stay ~2s apart instead of ~3.7s. A cycle
 *    that takes longer than the interval is followed immediately (delay 0), never skipped.
 *
 * 3. Stages are isolated. Order is collect -> broadcast -> afterBroadcast (alerts) ->
 *    persist: live clients get the data first, and storage can't delay the chart. A
 *    failing stage is reported through `onError` and never stops the loop; if collect
 *    fails there is nothing to send or store, so that cycle ends early.
 *
 * 4. Clean stop. stop() cancels the pending timer and waits for an in-flight cycle to
 *    finish, so shutdown never closes the database in the middle of a write. A cycle
 *    that finishes after stop() does not schedule another one.
 */

export type TickerStage = 'collect' | 'broadcast' | 'afterBroadcast' | 'persist';

export type TickerDeps = {
  collect: () => Promise<Snapshot>;
  broadcast: (snapshot: Snapshot) => void;
  persist: (snapshot: Snapshot) => Promise<unknown>;
  /** Extra work per snapshot after it was broadcast, e.g. threshold alerts (B-41). */
  afterBroadcast?: (snapshot: Snapshot) => Promise<unknown>;
  intervalMs?: number;
  onError?: (stage: TickerStage, error: unknown) => void;
  now?: () => number;
};

export type Ticker = {
  /** Runs a first cycle right away, then keeps going. Calling it while running is a no-op. */
  start(): void;
  /** Stops the loop; resolves once an in-flight cycle (if any) has finished. Idempotent. */
  stop(): Promise<void>;
  isRunning(): boolean;
};

export const TICK_INTERVAL_MS = 2_000;

const defaultOnError = (stage: TickerStage, error: unknown) => {
  console.error(`[ticker] ${stage} failed:`, error);
};

export function createTicker({
  collect,
  broadcast,
  persist,
  afterBroadcast,
  intervalMs = TICK_INTERVAL_MS,
  onError = defaultOnError,
  now = Date.now,
}: TickerDeps): Ticker {
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  // Runs one stage and reports (instead of throwing) any error, sync or async.
  async function stage(name: TickerStage, fn: () => unknown): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (error) {
      onError(name, error);
      return false;
    }
  }

  async function cycle(): Promise<void> {
    let snapshot: Snapshot | undefined;
    const collected = await stage('collect', async () => {
      snapshot = await collect();
    });
    if (!collected || !snapshot) return;
    const s = snapshot;
    await stage('broadcast', () => broadcast(s));
    if (afterBroadcast) await stage('afterBroadcast', () => afterBroadcast(s));
    await stage('persist', () => persist(s));
  }

  function runCycle() {
    timer = null;
    const startedAt = now();
    inFlight = cycle().finally(() => {
      inFlight = null;
      // stop() may have been called while this cycle was running.
      if (!running) return;
      const elapsed = now() - startedAt;
      timer = setTimeout(runCycle, Math.max(0, intervalMs - elapsed));
    });
  }

  return {
    start() {
      if (running) return;
      running = true;
      // If a cycle from before a stop() is still finishing, its `finally` sees
      // running === true again and schedules the next one; starting another chain here
      // would run two loops in parallel.
      if (!inFlight) runCycle();
    },
    async stop() {
      running = false;
      if (timer) clearTimeout(timer);
      timer = null;
      await inFlight;
    },
    isRunning() {
      return running;
    },
  };
}

/**
 * The real loop used by the server: collects with systeminformation, stores each
 * snapshot as a Sample row, and broadcasts through whatever the caller passes in (the
 * WebSocket hub lives in core/, the server wires the two together).
 */
export function createMetricsTicker({
  broadcast,
  afterBroadcast,
}: Pick<TickerDeps, 'broadcast' | 'afterBroadcast'>): Ticker {
  const ticker = createTicker({
    collect: () => collectSnapshot(),
    broadcast,
    ...(afterBroadcast ? { afterBroadcast } : {}),
    persist: (snapshot) => insertSample(toNewSample(snapshot), new Date(snapshot.timestamp)),
  });
  return {
    ...ticker,
    async stop() {
      await ticker.stop();
      stopSnapshotSources(); // kill the Windows disk sampler process
    },
  };
}
