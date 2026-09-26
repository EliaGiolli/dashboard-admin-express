/**
 * Graceful shutdown on Ctrl+C / SIGTERM (tsx watch restarts send SIGTERM too).
 *
 * Why it matters here: the ticker may be halfway through writing a sample, and on
 * Windows a PowerShell disk sampler runs next to us. The cleanup (stop ticker -> close
 * WebSocket hub + HTTP server -> disconnect Prisma) lets the in-flight write finish and
 * kills the child process instead of leaving it behind.
 *
 * - Runs the cleanup once, even if the signal arrives twice (impatient double Ctrl+C).
 * - Exits with 0 when the cleanup succeeds, 1 when it throws.
 * - A hard timeout forces exit 1, so a stuck cleanup never leaves a zombie server.
 */

type ShutdownOptions = {
  signals?: NodeJS.Signals[];
  timeoutMs?: number;
  exit?: (code: number) => void;
  on?: (signal: NodeJS.Signals, handler: () => void) => void;
  log?: (message: string) => void;
};

export function registerShutdown(
  cleanup: () => Promise<void>,
  {
    signals = ['SIGINT', 'SIGTERM'],
    timeoutMs = 5_000,
    exit = (code) => process.exit(code),
    on = (signal, handler) => process.on(signal, handler),
    log = (message) => console.log(message),
  }: ShutdownOptions = {},
): () => Promise<void> {
  let shuttingDown: Promise<void> | null = null;

  function shutdown(): Promise<void> {
    if (shuttingDown) return shuttingDown;
    log('Shutting down...');
    const timer = setTimeout(() => {
      log(`Shutdown took longer than ${timeoutMs}ms, forcing exit`);
      exit(1);
    }, timeoutMs);
    timer.unref?.();
    shuttingDown = cleanup().then(
      () => {
        clearTimeout(timer);
        exit(0);
      },
      (error: unknown) => {
        clearTimeout(timer);
        log(`Shutdown failed: ${String(error)}`);
        exit(1);
      },
    );
    return shuttingDown;
  }

  for (const signal of signals) on(signal, () => void shutdown());
  return shutdown;
}
