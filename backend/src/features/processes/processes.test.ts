import { processListSchema } from '@pc-monitor/shared';
import request from 'supertest';
import si from 'systeminformation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';

vi.mock('systeminformation', () => ({ default: { processes: vi.fn() } }));

type SiProcess = Awaited<ReturnType<typeof si.processes>>['list'][number];
const proc = (pid: number, name: string, cpu: number, memRss: number, mem = 1) =>
  ({ pid, name, cpu, memRss, mem }) as SiProcess;

beforeEach(() => {
  vi.mocked(si.processes).mockResolvedValue({
    all: 4,
    list: [
      proc(0, 'System Idle Process', 80, 8),
      proc(100, 'chrome.exe', 12.34, 500_000, 3.21),
      proc(200, 'code.exe', 30, 200_000),
      proc(300, 'notepad.exe', 0, 900_000),
    ],
  } as Awaited<ReturnType<typeof si.processes>>);
});

describe('GET /api/processes', () => {
  it('sorts by CPU by default and leaves out the idle process', async () => {
    const res = await request(app).get('/api/processes');
    expect(res.status).toBe(200);
    const body = processListSchema.parse(res.body);
    expect(body.total).toBe(3);
    expect(body.processes.map((p) => p.name)).toEqual(['code.exe', 'chrome.exe', 'notepad.exe']);
    expect(body.processes[1]).toEqual({
      pid: 100,
      name: 'chrome.exe',
      cpuPercent: 12.3,
      memBytes: 500_000 * 1024,
      memPercent: 3.2,
    });
  });

  it('sorts by memory and applies the limit', async () => {
    const res = await request(app).get('/api/processes?sortBy=mem&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.processes.map((p: { pid: number }) => p.pid)).toEqual([300, 100]);
  });

  it('rejects an unknown sort key and an out-of-range limit', async () => {
    expect((await request(app).get('/api/processes?sortBy=name')).status).toBe(400);
    expect((await request(app).get('/api/processes?limit=0')).status).toBe(400);
    expect((await request(app).get('/api/processes?limit=1000')).status).toBe(400);
  });

  it('returns 500 when the process list cannot be read', async () => {
    vi.mocked(si.processes).mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/api/processes');
    expect(res.status).toBe(500);
  });
});
