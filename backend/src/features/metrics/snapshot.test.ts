import si from 'systeminformation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCpu, toPercent } from './snapshot.js';

vi.mock('systeminformation', () => ({
  default: { currentLoad: vi.fn() },
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

    expect(await readCpu()).toMatchObject({ total: 26.9, perCore: [10, 43.9] });
  });
});
