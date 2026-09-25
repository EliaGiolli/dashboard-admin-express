import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/appError.js';

// Only requests that actually carry a body are checked (bodyless POST/DELETE
// endpoints have nothing to protect). For a request with a body, a plain HTML
// form can only send a CORS "simple" content type (application/x-www-form-urlencoded,
// multipart/form-data, text/plain) and skip the preflight our CORS policy would
// otherwise block it at; requiring application/json closes that gap.
function hasBody(req: Request): boolean {
  if (req.headers['transfer-encoding'] !== undefined) return true;
  const length = Number(req.headers['content-length']);
  return Number.isFinite(length) && length > 0;
}

export function requireJsonContentType(req: Request, _res: Response, next: NextFunction) {
  if (!hasBody(req)) return next();
  if (!req.is('application/json')) {
    return next(new AppError('Content-Type must be application/json', 415));
  }
  next();
}
