import type { CreateLog, LogAudit, RunActionRequest, RunActionResult } from '@pc-monitor/shared';
import { AppError } from '../../core/errors/appError.js';
import { LoggerService } from '../logs/index.js';
import { findAction, scriptPath } from './registry.js';
import { runScript, type RunOutcome } from './runner.js';

/**
 * Runs a fix action end to end. This is the single entry point for executing anything,
 * used by POST /api/actions/:id/run and POST /api/processes/:pid/kill.
 *
 * Order matters:
 * 1. Registry lookup: an unknown id is a 404 and nothing else happens.
 * 2. Confirmation (B-53) and argument checks: rejected requests never reach PowerShell.
 * 3. One run at a time per action (and per PID for kill-process): a double click gets a
 *    409 instead of starting the same script twice.
 * 4. The script runs through runner.ts (argv spawn, timeout, never throws).
 * 5. Every run that started is written to the Log table (source "action", actionId,
 *    success, durationMs): that is the audit trail. Rejected requests are not runs and
 *    are not logged.
 */

type RunFn = (scriptPath: string, args: string[]) => Promise<RunOutcome>;
type WriteLogFn = (log: CreateLog, audit: LogAudit) => Promise<{ id: number }>;

export function createActionService({
  run = (file, args) => runScript(file, args),
  writeLog = (log, audit) => new LoggerService().writeLogs(log, audit),
}: { run?: RunFn; writeLog?: WriteLogFn } = {}) {
  const inProgress = new Set<string>();

  async function runAction(id: string, request: RunActionRequest): Promise<RunActionResult> {
    const entry = findAction(id);
    if (!entry) throw new AppError(`Unknown action: ${id}`, 404);

    const args = entry.buildArgs(request); // 400 on a missing or unexpected pid

    const lockKey = request.pid === undefined ? entry.id : `${entry.id}:${request.pid}`;
    if (inProgress.has(lockKey)) throw new AppError(`${entry.label} is already running`, 409);
    inProgress.add(lockKey);

    let outcome: RunOutcome;
    try {
      outcome = await run(scriptPath(entry), args);
    } finally {
      inProgress.delete(lockKey);
    }

    const log = await writeLog(
      { logMessage: `${entry.label}: ${outcome.message}`, logLevel: outcome.success ? 'info' : 'error' },
      { source: 'action', actionId: entry.id, success: outcome.success, durationMs: outcome.durationMs },
    );

    return { actionId: entry.id, ...outcome, logId: log.id };
  }

  return { runAction };
}

export const actionService = createActionService();
