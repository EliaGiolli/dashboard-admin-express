import type { SystemSample } from '@pc-monitor/shared';
import { insertSample } from './samples.service.js';
import { collectSnapshot, toNewSample } from './snapshot.js';

export async function recordSnapshot(): Promise<SystemSample> {
  const snapshot = await collectSnapshot();
  return insertSample(toNewSample(snapshot), new Date(snapshot.timestamp));
}
