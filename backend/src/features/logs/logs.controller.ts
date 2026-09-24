import type { CreateLog, LogIdParams, UpdateLog } from '@pc-monitor/shared';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../core/errors/appError.js';
import { isRecordNotFound } from '../../core/errors/prismaErrors.js';
import { LoggerService } from './logs.service.js';

const logService = new LoggerService();

function toAppError(err: unknown, id: number, fallback: string): AppError {
  return isRecordNotFound(err)
    ? new AppError(`Log ${id} not found`, 404)
    : new AppError(fallback, 500);
}

export async function getLogsController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await logService.readLogs());
  } catch {
    next(new AppError('Unable to fetch logs from database', 500));
  }
}

export async function writeLogsController(req: Request, res: Response, next: NextFunction) {
  try {
    const newLog = await logService.writeLogs(req.body as CreateLog);
    res.status(201).json({ message: 'Log created', newLog });
  } catch {
    next(new AppError('Unable to save the log', 500));
  }
}

export async function deleteLogsController(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params as unknown as LogIdParams;
  try {
    await logService.deleteLogById(id);
    res.status(200).json({ message: 'Log deleted successfully' });
  } catch (err) {
    next(toAppError(err, id, 'Unable to delete the log'));
  }
}

export async function patchLogController(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params as unknown as LogIdParams;
  const { archived } = req.body as UpdateLog;
  try {
    res.status(200).json(await logService.setArchived(id, archived));
  } catch (err) {
    next(toAppError(err, id, 'Unable to update the log'));
  }
}
