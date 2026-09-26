import type { NextFunction, Request, Response } from 'express';

type HttpError = { statusCode?: unknown; message?: unknown; stack?: unknown };

// Last middleware: turns any error into the standard JSON body { status, message }.
// AppError carries its own status code; anything else is a 500. Express recognizes an
// error handler by its four parameters, so `_next` must stay even though it's unused.
export const globalErrorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = (typeof err === 'object' && err !== null ? err : {}) as HttpError;
  const statusCode = typeof e.statusCode === 'number' ? e.statusCode : 500;
  const message = typeof e.message === 'string' && e.message ? e.message : 'Internal Server Error';

  console.error(`[ERROR]: ${message}`);

  res.status(statusCode).json({
    status: 'error',
    message,
    // Stack traces only in development
    stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
  });
};
