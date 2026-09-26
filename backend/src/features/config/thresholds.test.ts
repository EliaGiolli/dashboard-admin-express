import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../core/prisma.js';
import { getThresholds } from './config.service.js';

beforeEach(async () => {
  await prisma.appConfig.deleteMany();
});

describe('getThresholds', () => {
  it('returns the numeric thresholds', async () => {
    await prisma.appConfig.createMany({
      data: [
        { key: 'CPU_THRESHOLD', value: '85', type: 'number' },
        { key: 'RAM_THRESHOLD', value: '92.5', type: 'number' },
        { key: 'DISK_THRESHOLD', value: '0', type: 'number' },
        { key: 'DASHBOARD_NAME', value: 'x', type: 'string' }, // not a threshold
      ],
    });
    expect(await getThresholds()).toEqual({ CPU_THRESHOLD: 85, RAM_THRESHOLD: 92.5, DISK_THRESHOLD: 0 });
  });

  it('leaves out missing, non-numeric and out-of-range values', async () => {
    await prisma.appConfig.createMany({
      data: [
        { key: 'CPU_THRESHOLD', value: 'high', type: 'number' },
        { key: 'RAM_THRESHOLD', value: '150', type: 'number' },
      ],
    });
    expect(await getThresholds()).toEqual({});
  });

  it('treats an empty string as missing, not as 0', async () => {
    await prisma.appConfig.create({ data: { key: 'CPU_THRESHOLD', value: ' ', type: 'number' } });
    expect(await getThresholds()).toEqual({});
  });
});
