import { defaultThresholds, thresholdKeys } from '@pc-monitor/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../core/prisma.js';
import { seedDefaultConfig } from './config.seed.js';

beforeEach(async () => {
  await prisma.appConfig.deleteMany();
});

describe('seedDefaultConfig', () => {
  it('creates every threshold with its default value', async () => {
    await seedDefaultConfig();
    const rows = await prisma.appConfig.findMany({ orderBy: { key: 'asc' } });
    expect(rows.map((r) => r.key)).toEqual([...thresholdKeys].sort());
    for (const row of rows) {
      expect(row).toMatchObject({ type: 'number', value: String(defaultThresholds[row.key as keyof typeof defaultThresholds]) });
    }
  });

  it('is idempotent and keeps values the user changed', async () => {
    await seedDefaultConfig();
    await prisma.appConfig.update({ where: { key: 'CPU_THRESHOLD' }, data: { value: '50' } });
    await seedDefaultConfig();
    expect(await prisma.appConfig.count()).toBe(thresholdKeys.length);
    const cpu = await prisma.appConfig.findUniqueOrThrow({ where: { key: 'CPU_THRESHOLD' } });
    expect(cpu.value).toBe('50');
  });
});
