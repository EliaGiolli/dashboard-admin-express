import type { RunActionRequest } from '@pc-monitor/shared';
import type { NextFunction, Request, Response } from 'express';
import { actionService } from './actions.service.js';
import { listActionDefinitions } from './registry.js';

export function listActionsController(_req: Request, res: Response, _next: NextFunction) {
  res.status(200).json(listActionDefinitions());
}

// 200 even when the script failed: the request was handled and the result (success
// flag + message) is what the UI shows. Rejections (404/400/409) come from the service.
export async function runActionController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.status(200).json(await actionService.runAction(id, req.body as RunActionRequest));
  } catch (error) {
    next(error);
  }
}
