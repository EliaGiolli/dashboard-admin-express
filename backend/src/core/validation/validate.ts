import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/appError.js';

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

function describeIssues(source: string, error: z.ZodError): string {
  return error.issues
    .map((issue) => `${source}${issue.path.length ? `.${issue.path.join('.')}` : ''}: ${issue.message}`)
    .join('; ');
}

// Express 5 exposes req.query and req.params as getters, so parsed values are redefined on the request.
function setParsed(req: Request, key: 'body' | 'query' | 'params', value: unknown) {
  Object.defineProperty(req, key, { value, writable: true, configurable: true, enumerable: true });
}

export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return next(new AppError(`Invalid request: ${describeIssues(key, result.error)}`, 400));
      }
      setParsed(req, key, result.data);
    }
    next();
  };
}
