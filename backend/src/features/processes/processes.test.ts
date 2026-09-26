import { processListSchema } from '@pc-monitor/shared';
import request from 'supertest';
import si from 'systeminformation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import { FRONTEND_ORIGIN } from '../../core/config/env.js';
import { AppError } from '../../core/errors/appError.js';
import { actionService } from '../actions/index.js';

vi.mock('systeminformation', () => ({ default: { processes: vi.fn() } }));
// Only the public API of the actions feature is replaced: the kill route must delegate
// to it. The PID guard, runner and audit log are tested end to end in actions.test.ts.
vi.mock('../actions/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../actions/index.js')>()),
  actionService: { runAction: vi.fn() },
}));
const runAction = vi.mocked(actionService.runAction);

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

describe('POST /api/processes/:pid/kill', () => {
  const post = (pid: string | number, body?: object) => {
    const req = request(app).post(`/api/processes/${pid}/kill`).set('Origin', FRONTEND_ORIGIN);
    return body === undefined ? req : req.send(body);
  };
  const result = { actionId: 'kill-process' as const, success: true, message: 'Stopped notepad (PID 1234)', durationMs: 80, logId: 7 };

  beforeEach(() => {
    runAction.mockReset();
    runAction.mockResolvedValue(result);
  });

  it('delegates to the kill-process action with the PID and the confirmation', async () => {
    const res = await post(1234, { confirm: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
    expect(runAction).toHaveBeenCalledWith('kill-process', { pid: 1234, confirm: true });
  });

  it('passes no confirmation when the body is missing (the action decides)', async () => {
    await post(1234);
    expect(runAction).toHaveBeenCalledWith('kill-process', { pid: 1234 });
  });

  it.each(['0', '-1', '1.5', 'abc', '1e3x', String(2 ** 32)])('rejects pid %s with 400 before delegating', async (pid) => {
    expect((await post(pid, { confirm: true })).status).toBe(400);
    expect(runAction).not.toHaveBeenCalled();
  });

  it('rejects unknown body fields and a foreign origin before delegating', async () => {
    expect((await post(1234, { confirm: true, force: true })).status).toBe(400);
    const foreign = await request(app)
      .post('/api/processes/1234/kill')
      .set('Origin', 'http://evil.example')
      .send({ confirm: true });
    expect(foreign.status).toBe(403);
    expect(runAction).not.toHaveBeenCalled();
  });

  it('forwards errors from the action (e.g. a protected PID) with their status', async () => {
    runAction.mockRejectedValue(new AppError('Refusing to kill protected process 4', 403));
    const res = await post(4, { confirm: true });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Refusing to kill protected process 4');
  });
});
