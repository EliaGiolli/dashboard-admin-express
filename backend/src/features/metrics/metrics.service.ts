import os from 'node:os';
import type { SystemSample } from '@pc-monitor/shared';
import { prisma } from '../../core/prisma.js';
import type { Sample as SampleModel } from '../../generated/prisma/client.js';

function toSample(row: SampleModel): SystemSample {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

// Placeholder values until the systeminformation snapshot lands (B6).
export async function saveCurrentSystemStats(): Promise<SystemSample> {
  const row = await prisma.sample.create({
    data: {
      cpuTotal: Math.round(Math.random() * 100),
      cpuTemp: null,
      ramUsed: os.totalmem() - os.freemem(),
      ramTotal: os.totalmem(),
      diskReadBps: 0,
      diskWriteBps: 0,
      netRxBps: 0,
      netTxBps: 0,
    },
  });
  return toSample(row);
}

export async function getSystemHistory(): Promise<SystemSample[]> {
  const rows = await prisma.sample.findMany({ take: 20, orderBy: { createdAt: 'desc' } });
  return rows.map(toSample);
}
