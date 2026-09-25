import type { CpuStats } from '@pc-monitor/shared';
import si from 'systeminformation';

// Clamps to 0-100 and keeps one decimal: enough for charts, smaller WS payloads.
export function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

export async function readCpu(): Promise<CpuStats> {
  const load = await si.currentLoad();
  return {
    total: toPercent(load.currentLoad),
    perCore: load.cpus.map((core) => toPercent(core.load)),
    tempC: null,
  };
}
