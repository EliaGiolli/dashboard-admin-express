import { describe, expect, it } from 'vitest';
import { snapshotSchema, type Snapshot } from './schema.js';

const snapshot: Snapshot = {
  timestamp: '2026-09-25T12:00:00.000Z',
  cpu: { total: 12.5, perCore: [10, 15], tempC: null },
  ram: { used: 8e9, total: 16e9, usedPercent: 50 },
  disk: {
    drives: [{ mount: 'C:', fsType: 'NTFS', size: 1e12, used: 7e11, usedPercent: 70 }],
    readBps: 1024,
    writeBps: null,
  },
  network: { rxBps: null, txBps: null },
};

describe('snapshotSchema', () => {
  it('accepts a snapshot with unmeasurable values set to null', () => {
    expect(snapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it('rejects percentages out of range and negative rates', () => {
    expect(snapshotSchema.safeParse({ ...snapshot, cpu: { ...snapshot.cpu, perCore: [101] } }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...snapshot, network: { rxBps: -1, txBps: 0 } }).success).toBe(false);
  });

  it('requires temperature to be present (null, not missing)', () => {
    const { tempC: _omit, ...cpu } = snapshot.cpu;
    expect(snapshotSchema.safeParse({ ...snapshot, cpu }).success).toBe(false);
  });
});
