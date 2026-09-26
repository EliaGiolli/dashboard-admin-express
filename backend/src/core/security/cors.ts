import cors from 'cors';
import { isOriginAllowed } from './origin.js';

// Requests with no Origin header (curl, server-to-server, same-origin) are left
// alone; only a mismatched browser-supplied Origin is denied the CORS headers.
export const corsMiddleware = cors({
  origin(origin, callback) {
    callback(null, isOriginAllowed(origin));
  },
});
