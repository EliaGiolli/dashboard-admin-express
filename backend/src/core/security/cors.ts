import cors from 'cors';
import { ALLOWED_ORIGINS } from '../config/env.js';

// Requests with no Origin header (curl, server-to-server, same-origin) are left
// alone; only a mismatched browser-supplied Origin is denied the CORS headers.
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
});
