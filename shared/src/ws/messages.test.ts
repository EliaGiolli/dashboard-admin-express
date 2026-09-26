import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../metrics/schema.js';
import {
  parseServerMessage,
  serverEventSchemas,
  serverMessageSchema,
  type ServerMessage,
} from './messages.js';

const snapshot: Snapshot = {
  timestamp: '2026-09-26T10:00:00.000Z',
  cpu: { total: 50, perCore: [40, 60], tempC: null },
  ram: { used: 8, total: 16, usedPercent: 50 },
  disk: { drives: [], readBps: null, writeBps: null },
  network: { rxBps: 1, txBps: 2 },
};

const alert: ServerMessage = {
  type: 'alert',
  data: {
    metric: 'cpu',
    value: 97.5,
    threshold: 90,
    message: 'CPU at 97.5% (threshold 90%)',
    logId: 12,
    timestamp: '2026-09-26T10:00:00.000Z',
  },
};

describe('serverMessageSchema', () => {
  it('accepts snapshot and alert messages', () => {
    expect(serverMessageSchema.parse({ type: 'snapshot', data: snapshot })).toEqual({ type: 'snapshot', data: snapshot });
    expect(serverMessageSchema.parse(alert)).toEqual(alert);
  });

  it('rejects a payload that does not match its type', () => {
    expect(serverMessageSchema.safeParse({ type: 'alert', data: snapshot }).success).toBe(false);
    expect(serverMessageSchema.safeParse({ type: 'snapshot', data: alert.data }).success).toBe(false);
  });

  it('rejects an alert on an unknown metric', () => {
    const bad = { ...alert, data: { ...alert.data, metric: 'gpu' } };
    expect(serverMessageSchema.safeParse(bad).success).toBe(false);
  });
});

describe('parseServerMessage', () => {
  it('parses a valid frame into a typed message', () => {
    const msg = parseServerMessage(JSON.stringify({ type: 'snapshot', data: snapshot }));
    expect(msg?.type).toBe('snapshot');
    if (msg?.type === 'snapshot') expect(msg.data.cpu.total).toBe(50);
  });

  it('returns null instead of throwing for bad frames', () => {
    expect(parseServerMessage('not json')).toBeNull();
    expect(parseServerMessage('null')).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'hello', data: {} }))).toBeNull(); // unknown type
    expect(parseServerMessage(JSON.stringify({ type: 'snapshot' }))).toBeNull(); // missing data
  });
});

describe('serverEventSchemas', () => {
  it('has exactly one event schema per message type, so the two lists cannot drift', () => {
    const unionTypes = serverMessageSchema.options.map((o) => o.shape.type.value).sort();
    expect(Object.keys(serverEventSchemas).sort()).toEqual(unionTypes);
  });

  it('validates the same payloads as the message union', () => {
    expect(serverEventSchemas.snapshot.parse(snapshot)).toEqual(snapshot);
    if (alert.type === 'alert') expect(serverEventSchemas.alert.parse(alert.data)).toEqual(alert.data);
    expect(serverEventSchemas.alert.safeParse(snapshot).success).toBe(false);
  });
});
