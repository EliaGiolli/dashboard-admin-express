import si from 'systeminformation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempReader, readCpu, readDisk, readRam, toPercent } from './snapshot.js';

vi.mock('systeminformation', () => ({
  default: { currentLoad: vi.fn(), cpuTemperature: vi.fn(), mem: vi.fn(), fsSize: vi.fn(), fsStats: vi.fn() },
}));

// The Windows disk sampler spawns PowerShell; replace it with a controllable fake.
const diskIo = vi.hoisted(() => ({ read: vi.fn(), stop: vi.fn() }));
vi.mock('./diskIo.js', () => ({ createWindowsDiskIoSampler: () => diskIo }));

const mocked = vi.mocked(si);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('toPercent', () => {
  it('clamps to 0-100, keeps one decimal and maps NaN to 0', () => {
    expect(toPercent(12.345)).toBe(12.3);
    expect(toPercent(100.4)).toBe(100);
    expect(toPercent(-0.1)).toBe(0);
    expect(toPercent(Number.NaN)).toBe(0);
  });
});

describe('readCpu', () => {
  it('returns total and per-core load', async () => {
    mocked.currentLoad.mockResolvedValue({
      currentLoad: 26.94,
      cpus: [{ load: 10.04 }, { load: 43.86 }],
    } as Awaited<ReturnType<typeof si.currentLoad>>);

    mocked.cpuTemperature.mockResolvedValue(temp(null));

    expect(await readCpu()).toEqual({ total: 26.9, perCore: [10, 43.9], tempC: null });
  });
});

function temp(main: number | null) {
  return { main } as Awaited<ReturnType<typeof si.cpuTemperature>>;
}

describe('createTempReader', () => {
  it('returns the temperature while the sensor reports one', async () => {
    mocked.cpuTemperature.mockResolvedValue(temp(54.26));
    const readTemp = createTempReader();
    expect(await readTemp()).toBe(54.3);
    expect(await readTemp()).toBe(54.3);
    expect(mocked.cpuTemperature).toHaveBeenCalledTimes(2);
  });

  it('returns null and stops polling when the sensor is not readable', async () => {
    mocked.cpuTemperature.mockResolvedValue(temp(null));
    const readTemp = createTempReader();
    expect(await readTemp()).toBeNull();
    expect(await readTemp()).toBeNull();
    expect(mocked.cpuTemperature).toHaveBeenCalledTimes(1);
  });

  it('never throws when systeminformation fails', async () => {
    mocked.cpuTemperature.mockRejectedValue(new Error('WMI unavailable'));
    const readTemp = createTempReader();
    await expect(readTemp()).resolves.toBeNull();
  });
});

describe('readRam', () => {
  it('counts used memory as total minus available', async () => {
    mocked.mem.mockResolvedValue({
      total: 16_000_000_000,
      available: 4_000_000_000,
      free: 1_000_000_000,
    } as Awaited<ReturnType<typeof si.mem>>);

    expect(await readRam()).toEqual({ used: 12_000_000_000, total: 16_000_000_000, usedPercent: 75 });
  });
});

describe('readDisk', () => {
  const drives = [
    { fs: 'C:', type: 'NTFS', size: 1_000, used: 700, available: 300, use: 70.04, mount: 'C:', rw: true },
    { fs: 'E:', type: '', size: 0, used: 0, available: 0, use: 0, mount: 'E:', rw: false }, // empty card reader
  ] as Awaited<ReturnType<typeof si.fsSize>>;

  it('lists drives with a size and takes throughput from the Windows sampler', async () => {
    mocked.fsSize.mockResolvedValue(drives);
    diskIo.read.mockReturnValue({ readBps: 2_048, writeBps: 512 });

    expect(await readDisk('win32')).toEqual({
      drives: [{ mount: 'C:', fsType: 'NTFS', size: 1_000, used: 700, usedPercent: 70 }],
      readBps: 2_048,
      writeBps: 512,
    });
    expect(mocked.fsStats).not.toHaveBeenCalled();
  });

  it('reports null throughput until the sampler has a rate', async () => {
    mocked.fsSize.mockResolvedValue(drives);
    diskIo.read.mockReturnValue(null);
    expect(await readDisk('win32')).toMatchObject({ readBps: null, writeBps: null });
  });

  it('uses fsStats on other platforms', async () => {
    mocked.fsSize.mockResolvedValue([]);
    mocked.fsStats.mockResolvedValue({ rx_sec: 100.4, wx_sec: 50 } as Awaited<ReturnType<typeof si.fsStats>>);
    expect(await readDisk('linux')).toEqual({ drives: [], readBps: 100, writeBps: 50 });
    expect(diskIo.read).not.toHaveBeenCalled();
  });
});
