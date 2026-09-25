import os from 'node:os';
import type { SystemSample } from '@pc-monitor/shared';
import { getLatestSamples, insertSample } from './samples.service.js';

// Placeholder values until the systeminformation snapshot lands (B6).
export async function saveCurrentSystemStats(): Promise<SystemSample> {
  return insertSample({
    cpuTotal: Math.round(Math.random() * 100),
    cpuTemp: null,
    ramUsed: os.totalmem() - os.freemem(),
    ramTotal: os.totalmem(),
    diskReadBps: 0,
    diskWriteBps: 0,
    netRxBps: 0,
    netTxBps: 0,
  });
}

export async function getSystemHistory(): Promise<SystemSample[]> {
  return getLatestSamples(20);
}
