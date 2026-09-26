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
