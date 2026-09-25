import type { NewSample, SystemSample } from '@pc-monitor/shared';
import { prisma } from '../../core/prisma.js';
import type { Sample as SampleModel } from '../../generated/prisma/client.js';

function toSample(row: SampleModel): SystemSample {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function insertSample(data: NewSample, createdAt: Date = new Date()): Promise<SystemSample> {
  return toSample(await prisma.sample.create({ data: { ...data, createdAt } }));
}

// Samples from the last `minutes`, oldest first (the order charts are drawn in).
export async function getSamplesSince(minutes: number, now: Date = new Date()): Promise<SystemSample[]> {
  const since = new Date(now.getTime() - minutes * 60_000);
  const rows = await prisma.sample.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toSample);
}

export async function getLatestSamples(take: number): Promise<SystemSample[]> {
  const rows = await prisma.sample.findMany({ take, orderBy: { createdAt: 'desc' } });
  return rows.map(toSample);
}
