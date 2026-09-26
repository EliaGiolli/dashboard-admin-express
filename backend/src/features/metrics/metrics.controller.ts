import type { HistoryQuery } from '@pc-monitor/shared';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../core/errors/appError.js';
import { recordSnapshot } from './metrics.service.js';
import { getSamplesSince } from './samples.service.js';

// Samples from the last `minutes`, oldest first: the frontend prefills its charts with
// this, then appends live `snapshot` events from the WebSocket.
export async function getHistoryController(req: Request, res: Response, next: NextFunction) {
  const { minutes } = req.query as unknown as HistoryQuery;
  try {
    res.status(200).json(await getSamplesSince(minutes));
  } catch {
    next(new AppError('Unable to read the metrics history', 500));
  }
}

// Takes and stores one sample now, outside the ticker's rhythm.
export async function recordSnapshotController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await recordSnapshot());
  } catch {
    next(new AppError('Unable to record a sample', 500));
  }
}
