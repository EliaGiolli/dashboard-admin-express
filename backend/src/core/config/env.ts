// The server only ever binds to loopback: this is a single-user, local-only app,
// and localhost CSRF (any browser tab can reach 127.0.0.1) is the real threat model.
// Never make this configurable to 0.0.0.0.
export const HOST = '127.0.0.1';

export const PORT = Number(process.env.PORT) || 4317;

// The frontend dev server's origin. Configurable because the Vite dev port can
// change, but it must always be a single localhost origin.
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

// This server's own origin. Included in the allow-list alongside FRONTEND_ORIGIN
// because Swagger UI is served by this same app: a browser sends Origin even for
// same-origin fetch calls, so "Try it out" in /api/docs must be allowed too.
export const SELF_ORIGIN = `http://${HOST}:${PORT}`;

export const ALLOWED_ORIGINS = [FRONTEND_ORIGIN, SELF_ORIGIN];
