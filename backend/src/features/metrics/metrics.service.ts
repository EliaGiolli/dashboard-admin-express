import os from 'node:os';
import type { SystemSample } from '@pc-monitor/shared';
import { prisma } from '../../core/prisma.js';
import type { System as SystemModel } from '../../generated/prisma/client.js';

// BigInt columns are not JSON-serializable, so memory values are exposed as numbers.
function toSample(row: SystemModel): SystemSample {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    uptime: row.uptime,
    totalMemory: Number(row.totalMemory),
    freeMemory: Number(row.freeMemory),
    cpuUsagePercent: row.cpuUsagePercent,
  };
}

export async function saveCurrentSystemStats(): Promise<SystemSample> {
  const row = await prisma.system.create({
    data: {
      uptime: Math.floor(os.uptime()),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuUsagePercent: Math.round(Math.random() * 100),
      createdAt: new Date(),
    },
  });
  return toSample(row);
}

export async function getSystemHistory(): Promise<SystemSample[]> {
  const rows = await prisma.system.findMany({ take: 20, orderBy: { createdAt: 'desc' } });
  return rows.map(toSample);
}
