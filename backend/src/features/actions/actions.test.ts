import path from 'node:path';
import { runActionResultSchema } from '@pc-monitor/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import { FRONTEND_ORIGIN } from '../../core/config/env.js';
import { prisma } from '../../core/prisma.js';
import { runScript, type RunOutcome } from './runner.js';

// The runner is mocked: these tests cover the HTTP layer, the registry lookup and the
// audit log, never real PowerShell.
vi.mock('./runner.js', () => ({ runScript: vi.fn() }));
const run = vi.mocked(runScript);
const ok: RunOutcome = { success: true, message: 'DNS cache flushed (3 cached entries cleared)', durationMs: 120 };

beforeEach(async () => {
  run.mockReset();
  run.mockResolvedValue(ok);
  await prisma.log.deleteMany();
});

const post = (url: string) => request(app).post(url).set('Origin', FRONTEND_ORIGIN);

describe('POST /api/actions/:id/run', () => {
  it('runs the registered script with no extra args and returns the result', async () => {
    const res = await post('/api/actions/flush-dns/run').send({});

    expect(res.status).toBe(200);
    expect(runActionResultSchema.parse(res.body)).toMatchObject({ actionId: 'flush-dns', ...ok });
    expect(run).toHaveBeenCalledTimes(1);
    const [file, args] = run.mock.calls[0]!;
    expect(path.basename(file)).toBe('flush-dns.ps1');
    expect(path.basename(path.dirname(file))).toBe('scripts');
    expect(args).toEqual([]);
  });

  it('accepts a POST without any body', async () => {
    const res = await post('/api/actions/flush-dns/run');
    expect(res.status).toBe(200);
  });

  it('writes an audit log for every run', async () => {
    const res = await post('/api/actions/flush-dns/run').send({});
    const log = await prisma.log.findUniqueOrThrow({ where: { id: res.body.logId } });
    expect(log).toMatchObject({
      source: 'action',
      actionId: 'flush-dns',
      success: true,
      durationMs: 120,
      logLevel: 'info',
      logMessage: 'Flush DNS cache: DNS cache flushed (3 cached entries cleared)',
      archived: false,
    });
  });

  it('returns 200 with success false when the script failed, logged as an error', async () => {
    run.mockResolvedValue({ success: false, message: 'Timed out after 60s', durationMs: 60_000 });
    const res = await post('/api/actions/clear-temp/run').send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, message: 'Timed out after 60s' });
    const log = await prisma.log.findUniqueOrThrow({ where: { id: res.body.logId } });
    expect(log).toMatchObject({ logLevel: 'error', success: false, actionId: 'clear-temp' });
  });

  it('answers 404 for an unknown id, without running or logging anything', async () => {
    for (const id of ['nope', 'constructor', 'tostring']) {
      const res = await post(`/api/actions/${id}/run`).send({});
      expect(res.status).toBe(404);
    }
    expect(run).not.toHaveBeenCalled();
    expect(await prisma.log.count()).toBe(0);
  });

  it('rejects ids that are not slugs (no path tricks reach the registry)', async () => {
    for (const id of ['..%2Fscripts%2Fflush-dns', 'FLUSH-DNS', 'flush-dns.ps1']) {
      const res = await post(`/api/actions/${id}/run`).send({});
      expect([400, 404]).toContain(res.status);
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects a pid on a system action and unknown body fields (400)', async () => {
    expect((await post('/api/actions/flush-dns/run').send({ pid: 123 })).status).toBe(400);
    expect((await post('/api/actions/flush-dns/run').send({ script: 'C:/x.ps1' })).status).toBe(400);
    expect((await post('/api/actions/flush-dns/run').send({ confirm: 'yes' })).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses to start the same action twice at once (409), then allows it again', async () => {
    let finish!: (o: RunOutcome) => void;
    run.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));

    const first = post('/api/actions/flush-dns/run').send({}).then((r) => r);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    const second = await post('/api/actions/flush-dns/run').send({});
    expect(second.status).toBe(409);
    expect(second.body.message).toBe('Flush DNS cache is already running');

    // a different action is not blocked
    expect((await post('/api/actions/clear-temp/run').send({})).status).toBe(200);

    finish(ok);
    expect((await first).status).toBe(200);
    expect((await post('/api/actions/flush-dns/run').send({})).status).toBe(200);
  });

  it('is blocked for a foreign origin and for non-JSON bodies, before running', async () => {
    const foreign = await request(app).post('/api/actions/flush-dns/run').set('Origin', 'http://evil.example').send({});
    expect(foreign.status).toBe(403);
    const form = await post('/api/actions/flush-dns/run').set('Content-Type', 'text/plain').send('confirm=true');
    expect(form.status).toBe(415);
    expect(run).not.toHaveBeenCalled();
  });

  it('frees the lock even when logging fails', async () => {
    const spy = vi.spyOn(prisma.log, 'create').mockRejectedValueOnce(new Error('SQLITE_BUSY'));
    expect((await post('/api/actions/flush-dns/run').send({})).status).toBe(500);
    spy.mockRestore();
    expect((await post('/api/actions/flush-dns/run').send({})).status).toBe(200);
  });
});

describe('kill-process end to end (both routes, runner mocked)', () => {
  const killRoute = (pid: number | string) => post(`/api/processes/${pid}/kill`).send({ confirm: true });
  const runRoute = (pid: number) => post('/api/actions/kill-process/run').send({ pid, confirm: true });

  it('passes the PID as a separate -ProcessId argument and logs the run', async () => {
    run.mockResolvedValue({ success: true, message: 'Stopped notepad (PID 1234)', durationMs: 80 });
    for (const res of [await killRoute(1234), await runRoute(1234)]) {
      expect(res.status).toBe(200);
      const [file, args] = run.mock.calls.at(-1)!;
      expect(path.basename(file)).toBe('kill-process.ps1');
      expect(args).toEqual(['-ProcessId', '1234']);
      const log = await prisma.log.findUniqueOrThrow({ where: { id: res.body.logId } });
      expect(log).toMatchObject({ source: 'action', actionId: 'kill-process', success: true });
    }
  });

  it.each([
    ['System (4)', 4],
    ['this server', process.pid],
    ['the parent of this server', process.ppid],
  ])('refuses to kill %s with 403 on both routes, without running anything', async (_label, pid) => {
    for (const res of [await killRoute(pid), await runRoute(pid)]) {
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(`Refusing to kill protected process ${pid}`);
    }
    expect(run).not.toHaveBeenCalled();
    expect(await prisma.log.count()).toBe(0);
  });

  it('rejects PID 0 (System Idle) at validation', async () => {
    expect((await killRoute(0)).status).toBe(400);
    expect((await runRoute(0)).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it('requires a pid on the generic route', async () => {
    const res = await post('/api/actions/kill-process/run').send({ confirm: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('kill-process needs a pid');
  });
});

describe('confirmation guard (server-side)', () => {
  it.each([
    ['no body', undefined],
    ['empty body', {}],
    ['confirm false', { confirm: false }],
  ])('empty-recyclebin with %s is refused with 409 and runs nothing', async (_label, body) => {
    const req = post('/api/actions/empty-recyclebin/run');
    const res = body === undefined ? await req : await req.send(body);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Empty Recycle Bin needs confirmation: send {"confirm": true}');
    expect(run).not.toHaveBeenCalled();
    expect(await prisma.log.count()).toBe(0);
  });

  it('empty-recyclebin runs with confirm: true (runner mocked, nothing is deleted)', async () => {
    const res = await post('/api/actions/empty-recyclebin/run').send({ confirm: true });
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('killing a process needs confirmation on both routes', async () => {
    expect((await post('/api/processes/1234/kill')).status).toBe(409);
    expect((await post('/api/processes/1234/kill').send({ confirm: false })).status).toBe(409);
    expect((await post('/api/actions/kill-process/run').send({ pid: 1234 })).status).toBe(409);
    expect(run).not.toHaveBeenCalled();
    expect((await post('/api/processes/1234/kill').send({ confirm: true })).status).toBe(200);
  });

  it('a protected PID is refused (403) before asking for confirmation', async () => {
    expect((await post('/api/processes/4/kill')).status).toBe(403);
  });

  it('actions without requiresConfirm run immediately, with or without confirm', async () => {
    expect((await post('/api/actions/flush-dns/run')).status).toBe(200);
    expect((await post('/api/actions/clear-temp/run').send({ confirm: true })).status).toBe(200);
  });

  it('the guard matches the metadata the UI reads', async () => {
    const res = await request(app).get('/api/actions');
    const needsConfirm = res.body.filter((a: { requiresConfirm: boolean }) => a.requiresConfirm);
    for (const action of needsConfirm) {
      const url = action.id === 'kill-process' ? '/api/processes/1234/kill' : `/api/actions/${action.id}/run`;
      expect((await post(url).send({})).status).toBe(409);
    }
    expect(run).not.toHaveBeenCalled();
  });
});

describe('per-action timeouts', () => {
  it('gives clear-temp and empty-recyclebin longer than the 60s default', async () => {
    await post('/api/actions/clear-temp/run').send({});
    await post('/api/actions/empty-recyclebin/run').send({ confirm: true });
    await post('/api/actions/flush-dns/run').send({});
    const timeouts = Object.fromEntries(run.mock.calls.map(([file, , options]) => [path.basename(file), options?.timeoutMs]));
    expect(timeouts).toEqual({
      'clear-temp.ps1': 600_000,
      'empty-recyclebin.ps1': 120_000,
      'flush-dns.ps1': undefined, // runner default (60s)
    });
  });
});
