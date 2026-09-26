import { z } from 'zod';
import { snapshotSchema, type Snapshot } from '../metrics/schema.js';

/**
 * Messages the server pushes over the live channel (Socket.IO on path `/ws`).
 *
 * Each message type is a Socket.IO event: the event name is the `type` below and the
 * event payload is `data`. `serverEventSchemas` maps every event to the zod schema of
 * its payload, so the client validates what it receives instead of trusting it.
 * `ServerToClientEvents` gives Socket.IO's generics the same contract at compile time.
 *
 * The channel is one-way (server -> client): the server registers no client events.
 *
 * Versioning rule: add new event types instead of changing existing ones, and make
 * clients ignore unknown events, so an older frontend keeps working against a newer
 * backend.
 */

// Metrics that can cross an AppConfig threshold. Disk uses the fullest drive.
export const alertMetricSchema = z.enum(['cpu', 'ram', 'disk']);
export type AlertMetric = z.infer<typeof alertMetricSchema>;

export const alertSchema = z.object({
  metric: alertMetricSchema,
  value: z.number(), // percent that crossed the threshold
  threshold: z.number(), // percent configured in AppConfig at that moment
  message: z.string(), // human readable, also stored as the log message
  logId: z.number().int(), // the Log row written for this alert (source "monitor")
  timestamp: z.iso.datetime(),
});
export type Alert = z.infer<typeof alertSchema>;

// A fresh metrics snapshot, sent every ticker cycle (about every 2 seconds).
export const snapshotMessageSchema = z.object({
  type: z.literal('snapshot'),
  data: snapshotSchema,
});

// A threshold was exceeded (sustained, and debounced server-side).
export const alertMessageSchema = z.object({
  type: z.literal('alert'),
  data: alertSchema,
});

export const serverMessageSchema = z.discriminatedUnion('type', [snapshotMessageSchema, alertMessageSchema]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type ServerMessageType = ServerMessage['type'];

// Event name -> payload schema, for runtime validation on the client:
//   socket.on('snapshot', (raw) => { const r = serverEventSchemas.snapshot.safeParse(raw); ... })
export const serverEventSchemas = {
  snapshot: snapshotSchema,
  alert: alertSchema,
} as const satisfies Record<ServerMessageType, z.ZodType>;

// Socket.IO typing: `new Server<ClientToServerEvents, ServerToClientEvents>()` on the
// backend and `io() as Socket<ServerToClientEvents, ClientToServerEvents>` on the frontend.
export interface ServerToClientEvents {
  snapshot: (data: Snapshot) => void;
  alert: (data: Alert) => void;
}

// No events: clients never send anything (read-only channel).
export type ClientToServerEvents = Record<string, never>;

/**
 * Parses a raw WebSocket frame into a typed message.
 * Returns null (never throws) for invalid JSON, unknown types or malformed payloads,
 * so a bad frame can't crash the client's message loop.
 */
export function parseServerMessage(raw: string): ServerMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = serverMessageSchema.safeParse(json);
  return result.success ? result.data : null;
}
