import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerShutdown } from './shutdown.js';

function setup(cleanup: () => Promise<void>) {
  const handlers = new Map<string, () => void>();
  const exit = vi.fn();
  const shutdown = registerShutdown(cleanup, {
    exit,
    timeoutMs: 5_000,
    on: (signal, handler) => handlers.set(signal, handler),
    log: () => {},
  });
  return { handlers, exit, shutdown };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('registerShutdown', () => {
  it('listens to SIGINT and SIGTERM', () => {
    const { handlers } = setup(async () => {});
    expect([...handlers.keys()]).toEqual(['SIGINT', 'SIGTERM']);
  });

  it('runs the cleanup and exits with 0', async () => {
    const cleanup = vi.fn(async () => {});
    const { handlers, exit } = setup(cleanup);
    handlers.get('SIGINT')!();
    await vi.advanceTimersByTimeAsync(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('runs the cleanup only once when signals repeat', async () => {
    const cleanup = vi.fn(() => new Promise<void>((r) => setTimeout(r, 1_000)));
    const { handlers, exit } = setup(cleanup);
    handlers.get('SIGINT')!();
    handlers.get('SIGINT')!();
    handlers.get('SIGTERM')!();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('exits with 1 when the cleanup fails', async () => {
    const { shutdown, exit } = setup(async () => {
      throw new Error('prisma busy');
    });
    await shutdown();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('forces exit 1 when the cleanup hangs past the timeout', async () => {
    const { shutdown, exit } = setup(() => new Promise<void>(() => {}));
    void shutdown();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
