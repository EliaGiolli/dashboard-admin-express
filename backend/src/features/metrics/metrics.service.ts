import type { SystemSample } from '@pc-monitor/shared';
import { getLatestSamples, insertSample } from './samples.service.js';
import { collectSnapshot, toNewSample } from './snapshot.js';

export async function saveCurrentSystemStats(): Promise<SystemSample> {
  const snapshot = await collectSnapshot();
  return insertSample(toNewSample(snapshot), new Date(snapshot.timestamp));
}

export async function getSystemHistory(): Promise<SystemSample[]> {
  return getLatestSamples(20);
}
