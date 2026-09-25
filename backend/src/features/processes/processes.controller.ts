import type { ProcessListQuery } from '@pc-monitor/shared';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../core/errors/appError.js';
import { listTopProcesses } from './processes.service.js';

export async function listProcessesController(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await listTopProcesses(req.query as unknown as ProcessListQuery));
  } catch {
    next(new AppError('Unable to list processes', 500));
  }
}
