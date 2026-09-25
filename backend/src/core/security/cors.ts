import cors from 'cors';
import { FRONTEND_ORIGIN } from '../config/env.js';

// Requests with no Origin header (curl, server-to-server, same-origin) are left
// alone; only a mismatched browser-supplied Origin is denied the CORS headers.
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || origin === FRONTEND_ORIGIN) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
});
