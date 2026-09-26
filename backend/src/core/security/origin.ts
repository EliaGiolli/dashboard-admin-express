import { ALLOWED_ORIGINS } from '../config/env.js';

// The single origin rule shared by CORS, the HTTP Origin guard and the WebSocket
// handshake, so the three can never disagree.
//
// A missing Origin is allowed: browsers always send Origin on cross-origin requests and
// on every WebSocket handshake, so "no Origin" means a non-browser client (curl, a test,
// a script on this machine), which a malicious website cannot impersonate.
export function isOriginAllowed(origin: string | undefined): boolean {
  return origin === undefined || ALLOWED_ORIGINS.includes(origin);
}
