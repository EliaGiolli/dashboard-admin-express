import si from 'systeminformation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempReader, readCpu, toPercent } from './snapshot.js';

vi.mock('systeminformation', () => ({
  default: { currentLoad: vi.fn(), cpuTemperature: vi.fn() },
}));

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
