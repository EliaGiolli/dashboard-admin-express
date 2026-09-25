import { timingSafeEqual } from 'node:crypto';
import { type Request, type Response, type NextFunction } from 'express';

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

export const adminGuard = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const secret = process.env.API_SEGRETO;

  if (typeof apiKey !== 'string' || !secret || !timingSafeEqualStrings(apiKey, secret)) {
    return res.status(403).json({
      error: 'Access Denied: Invalid or missing API Key',
    });
  }

  next();
};
