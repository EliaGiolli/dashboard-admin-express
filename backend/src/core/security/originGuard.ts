import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/appError.js';
import { ALLOWED_ORIGINS } from '../config/env.js';

// A second layer independent of CORS: CORS only controls whether a browser lets
// the calling page *read* the response, it does not stop the server from running
// the handler. This rejects the request outright, so it protects non-preflighted
// and non-browser-enforced paths too.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) return next();
  return next(new AppError('Origin not allowed', 403));
}
