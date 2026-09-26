import { z } from 'zod';
import { snapshotSchema } from '../metrics/schema.js';

/**
 * Messages the server pushes over the `/ws` WebSocket.
 *
 * The union is discriminated on `type`, so a client can switch on it and TypeScript
 * narrows `data` automatically. The channel is one-way (server -> client): the server
 * ignores anything a client sends.
 *
 * Versioning rule: add new message types instead of changing existing ones, and make
 * clients ignore unknown types (`parseServerMessage` returns null for them), so an
 * older frontend keeps working against a newer backend.
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
