import type { CpuStats, DiskStats, RamStats } from '@pc-monitor/shared';
import si from 'systeminformation';
import { createWindowsDiskIoSampler, type DiskIo } from './diskIo.js';

// Clamps to 0-100 and keeps one decimal: enough for charts, smaller WS payloads.
export function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

// CPU temperature is unreliable on Windows (usually no readable sensor), and every
// call spawns PowerShell. After the first reading without a value we stop asking and
// report null for good, instead of paying for a process every tick. Never throws.
export function createTempReader() {
  let supported = true;
  return async function readTemp(): Promise<number | null> {
    if (!supported) return null;
    try {
      const { main } = await si.cpuTemperature();
      if (typeof main === 'number' && Number.isFinite(main) && main > 0) return Math.round(main * 10) / 10;
    } catch {
      // fall through: treat errors like a missing sensor
    }
    supported = false;
    return null;
  };
}

const readTemp = createTempReader();

export async function readCpu(): Promise<CpuStats> {
  const [load, tempC] = await Promise.all([si.currentLoad(), readTemp()]);
  return {
    total: toPercent(load.currentLoad),
    perCore: load.cpus.map((core) => toPercent(core.load)),
    tempC,
  };
}

// "Used" is what's not available to new programs, so reclaimable cache doesn't count (matters on Linux).
export async function readRam(): Promise<RamStats> {
  const mem = await si.mem();
  const used = Math.max(0, mem.total - mem.available);
  return {
    used,
    total: mem.total,
    usedPercent: mem.total > 0 ? toPercent((used / mem.total) * 100) : 0,
  };
}

const windowsDiskIo = createWindowsDiskIoSampler();

// Stops the background disk sampler (Windows); called when the ticker shuts down.
export function stopSnapshotSources(): void {
  windowsDiskIo.stop();
}

async function readDiskIo(platform: NodeJS.Platform): Promise<DiskIo | null> {
  if (platform === 'win32') return windowsDiskIo.read();
  // Linux/macOS: bytes per second; null on the first call, until there is a previous reading.
  const stats = await si.fsStats();
  if (!stats || stats.rx_sec == null || stats.wx_sec == null) return null;
  return { readBps: Math.max(0, Math.round(stats.rx_sec)), writeBps: Math.max(0, Math.round(stats.wx_sec)) };
}

export async function readDisk(platform: NodeJS.Platform = process.platform): Promise<DiskStats> {
  const [sizes, io] = await Promise.all([si.fsSize(), readDiskIo(platform)]);
  return {
    drives: sizes
      .filter((d) => d.size > 0)
      .map((d) => ({
        mount: d.mount,
        fsType: d.type,
        size: d.size,
        used: d.used,
        usedPercent: toPercent(d.use),
      })),
    readBps: io?.readBps ?? null,
    writeBps: io?.writeBps ?? null,
  };
}
