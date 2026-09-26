import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { ClientToServerEvents, ServerToClientEvents } from '@pc-monitor/shared';
import { Server } from 'socket.io';
import { ALLOWED_ORIGINS } from '../config/env.js';
import { isOriginAllowed } from '../security/origin.js';

/**
 * Live channel: a Socket.IO server that pushes metrics snapshots and alerts to the
 * dashboard. Read this before changing any option below; most of them are security
 * decisions, not tuning.
 *
 * Threat model (see CLAUDE.md): the app has no login and listens on 127.0.0.1, so the
 * attacker is any website open in another browser tab. CORS does NOT apply to
 * WebSockets: a page on evil.example can open `ws://127.0.0.1:4317/ws` and the browser
 * will happily connect and let it read every message. The only thing that tells us who
 * is connecting is the Origin header the browser attaches to the handshake, and pages
 * cannot forge it. So the Origin check in `allowRequest` is the real protection here.
 */

// Same path the Vite dev server proxies (`/api` and `/ws`); the client must use it too.
export const WS_PATH = '/ws';

export type WsHub = {
  /** Sends an event to every connected client. A no-op when nobody is connected. */
  broadcast<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>): void;
  /** Number of currently connected clients. */
  clientCount(): number;
  /** Disconnects every client and closes the HTTP server the hub is attached to. */
  close(): Promise<void>;
};

export function createWsHub(httpServer: HttpServer): WsHub {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: WS_PATH,

    // WebSocket only, no HTTP long-polling fallback. Polling exists for proxies that
    // block WebSockets, which don't sit between a browser and 127.0.0.1. Polling would
    // also add HTTP POST endpoints that bypass the Express security middleware
    // (JSON content type, Origin guard), so turning it off shrinks the attack surface.
    transports: ['websocket'],

    // Runs once per handshake, before the connection is accepted. A foreign Origin
    // gets an HTTP error on the upgrade request and never becomes a socket.
    allowRequest(req: IncomingMessage, callback) {
      callback(null, isOriginAllowed(req.headers.origin));
    },

    // Only relevant to polling (disabled above), kept as defense in depth in case the
    // transports list is ever widened.
    cors: { origin: ALLOWED_ORIGINS },

    // The channel is one-way (server -> client) and no client events are registered,
    // so a client never needs to send anything big. Keeps a misbehaving client from
    // pushing large frames into memory.
    maxHttpBufferSize: 10_000,

    // Don't serve /ws/socket.io.js: the frontend bundles socket.io-client itself.
    serveClient: false,

    // Heartbeat: Socket.IO pings every client every 25s and drops it if no pong arrives
    // within 20s, so a closed laptop lid or killed tab doesn't leave a dead socket that
    // we keep broadcasting to. These are the library defaults, written out on purpose.
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // No `io.on('connection', ...)` handlers: clients are listeners only. Anything they
  // emit is ignored because no event handler exists for it.

  return {
    broadcast(event, ...args) {
      io.emit(event, ...args);
    },
    clientCount() {
      return io.engine.clientsCount;
    },
    close() {
      // io.close() disconnects every client and then closes the HTTP server the hub is
      // attached to, so shutdown needs only this call. Resolves even if the HTTP server
      // was already closed (its callback then gets an error we don't care about).
      return new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
    },
  };
}
