// The server only ever binds to loopback: this is a single-user, local-only app,
// and localhost CSRF (any browser tab can reach 127.0.0.1) is the real threat model.
// Never make this configurable to 0.0.0.0.
export const HOST = '127.0.0.1';

export const PORT = Number(process.env.PORT) || 4317;
