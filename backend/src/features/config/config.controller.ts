import type { ConfigKeyParams, UpdateConfig } from '@pc-monitor/shared';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../core/errors/appError.js';
import { getSafeEnv, updateConfigValue } from './config.service.js';

export function getSafeEnvController(_req: Request, res: Response) {
  res.status(200).json(getSafeEnv());
}

export async function updateEnvController(req: Request, res: Response, next: NextFunction) {
  const { key } = req.params as unknown as ConfigKeyParams;
  const { value } = req.body as UpdateConfig;
  try {
    res.status(200).json(await updateConfigValue(key, value));
  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Unable to update the configuration', 500));
  }
}
