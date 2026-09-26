import type { NextFunction, Request, Response } from 'express';
import { listActionDefinitions } from './registry.js';

export function listActionsController(_req: Request, res: Response, _next: NextFunction) {
  res.status(200).json(listActionDefinitions());
}
