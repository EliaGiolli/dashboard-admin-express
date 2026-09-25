import { systemSampleSchema, type NewSample } from '@pc-monitor/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../core/prisma.js';
import { getSamplesSince, insertSample } from './samples.service.js';

const sample: NewSample = {
  cpuTotal: 42.5,
  cpuTemp: null,
  ramUsed: 8 * 1024 ** 3,
  ramTotal: 32 * 1024 ** 3,
  diskReadBps: 1_500_000,
  diskWriteBps: 250_000,
  netRxBps: 12_000,
  netTxBps: 3_000,
};
const now = new Date('2026-09-25T12:00:00.000Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

beforeEach(async () => {
  await prisma.sample.deleteMany();
});

describe('samples service', () => {
  it('inserts a sample and returns it in the shared shape', async () => {
    const stored = await insertSample({ ...sample, cpuTemp: 55 }, now);
    expect(systemSampleSchema.parse(stored)).toMatchObject({ ...sample, cpuTemp: 55, createdAt: now.toISOString() });
  });

  it('keeps large byte counts exact', async () => {
    const big = 2 ** 40 + 1;
    const stored = await insertSample({ ...sample, ramTotal: big }, now);
    const [row] = await getSamplesSince(1, now);
    expect(stored.ramTotal).toBe(big);
    expect(row?.ramTotal).toBe(big);
  });

  it('returns only samples inside the window, oldest first', async () => {
    await insertSample({ ...sample, cpuTotal: 3 }, minutesAgo(1));
    await insertSample({ ...sample, cpuTotal: 1 }, minutesAgo(9));
    await insertSample({ ...sample, cpuTotal: 99 }, minutesAgo(11));
    await insertSample({ ...sample, cpuTotal: 2 }, minutesAgo(5));

    const rows = await getSamplesSince(10, now);
    expect(rows.map((r) => r.cpuTotal)).toEqual([1, 2, 3]);
  });

  it('returns an empty list when nothing is recent', async () => {
    await insertSample(sample, minutesAgo(120));
    expect(await getSamplesSince(60, now)).toEqual([]);
  });
});
