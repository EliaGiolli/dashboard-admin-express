import type { ProcessListQuery } from '@pc-monitor/shared';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../core/errors/appError.js';
import { actionService } from '../actions/index.js';
import { listTopProcesses } from './processes.service.js';

export async function listProcessesController(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await listTopProcesses(req.query as unknown as ProcessListQuery));
  } catch {
    next(new AppError('Unable to list processes', 500));
  }
}

// Delegates to the kill-process action, so the PID guard, the confirmation rule, the
// runner and the audit log are exactly the same as POST /api/actions/kill-process/run.
export async function killProcessController(req: Request, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params as unknown as { pid: number };
    const { confirm } = req.body as { confirm?: boolean };
    const request = confirm === undefined ? { pid } : { pid, confirm };
    res.status(200).json(await actionService.runAction('kill-process', request));
  } catch (error) {
    next(error);
  }
}
