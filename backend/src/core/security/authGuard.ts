import { timingSafeEqual } from 'node:crypto';
import { type Request, type Response, type NextFunction } from 'express';
import { AppError } from '../errors/appError.js';

// Comparing the key with `!==` leaks timing information proportional to how many
// leading characters match. Not a strong defense here regardless (a key shipped
// to a browser isn't secret; the real protection is loopback binding + CORS/Origin
// checks), but there's no reason not to use the constant-time comparison Node
// already provides. timingSafeEqual throws on mismatched lengths, so that's
// checked first — that leaks only the correct key's length, which is acceptable.
function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

// Header name clients send the admin key in (documented as the `adminKey` scheme).
export const ADMIN_KEY_HEADER = 'x-api-key';

// Denies (403, standard error JSON) unless `x-api-key` equals API_SEGRETO. With no
// API_SEGRETO configured, everything is denied rather than allowed.
export const adminGuard = (req: Request, _res: Response, next: NextFunction) => {
  const apiKey = req.headers[ADMIN_KEY_HEADER];
  const secret = process.env.API_SEGRETO;

  if (typeof apiKey !== 'string' || !secret || !timingSafeEqualStrings(apiKey, secret)) {
    return next(new AppError('Access denied: invalid or missing API key', 403));
  }

  next();
};
