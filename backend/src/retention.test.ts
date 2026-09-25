import type { NewSample } from '@pc-monitor/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from './core/prisma.js';
import { pruneOlderThan } from './retention.js';

const sample: NewSample = {
  cpuTotal: 10,
  cpuTemp: null,
  ramUsed: 1,
  ramTotal: 2,
  diskReadBps: 0,
  diskWriteBps: 0,
  netRxBps: 0,
  netTxBps: 0,
};
const now = new Date('2026-09-25T12:00:00.000Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

beforeEach(async () => {
  await prisma.sample.deleteMany();
  await prisma.log.deleteMany();
});

describe('pruneOlderThan', () => {
  it('deletes samples and logs older than the window and keeps the rest', async () => {
    await prisma.sample.createMany({
      data: [8, 7.5, 6, 0].map((d) => ({ ...sample, createdAt: daysAgo(d) })),
    });
    await prisma.log.createMany({
      data: [30, 6.9, 1].map((d) => ({
        logMessage: `${d} days old`,
        logLevel: 'info',
        archived: false,
        timestamp: daysAgo(d),
      })),
    });

    expect(await pruneOlderThan(7, now)).toEqual({ samples: 2, logs: 1 });
    expect(await prisma.sample.count()).toBe(2);
    const logs = await prisma.log.findMany({ orderBy: { timestamp: 'asc' } });
    expect(logs.map((l) => l.logMessage)).toEqual(['6.9 days old', '1 days old']);
  });

  it('is a no-op on an empty database', async () => {
    expect(await pruneOlderThan(7, now)).toEqual({ samples: 0, logs: 0 });
  });
});
