import { logSchema } from '@pc-monitor/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { prisma } from '../../core/prisma.js';
import { LoggerService } from './logs.service.js';

beforeEach(async () => {
  await prisma.log.deleteMany();
});

async function createLog(logMessage = 'disk almost full', logLevel = 'warning') {
  const res = await request(app).post('/api/logs').send({ logMessage, logLevel });
  return res;
}

describe('logs API', () => {
  it('creates a log and returns it matching the shared schema', async () => {
    const res = await createLog();
    expect(res.status).toBe(201);
    expect(logSchema.parse(res.body.newLog)).toMatchObject({
      logMessage: 'disk almost full',
      logLevel: 'warning',
      archived: false,
      source: 'manual',
      actionId: null,
      success: null,
      durationMs: null,
    });
  });

  it('ignores source and audit fields sent by clients', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({ logMessage: 'fake run', logLevel: 'info', source: 'action', actionId: 'flush-dns', success: true });
    expect(res.status).toBe(201);
    expect(res.body.newLog).toMatchObject({ source: 'manual', actionId: null, success: null });
  });

  it('stores audit fields for action runs written by the server', async () => {
    const log = await new LoggerService().writeLogs(
      { logMessage: 'Flushed DNS', logLevel: 'info' },
      { source: 'action', actionId: 'flush-dns', success: true, durationMs: 120 },
    );
    const res = await request(app).get('/api/logs');
    expect(logSchema.parse(res.body[0])).toMatchObject({
      id: log.id,
      source: 'action',
      actionId: 'flush-dns',
      success: true,
      durationMs: 120,
    });
  });

  it('rejects an invalid body with 400', async () => {
    const missing = await request(app).post('/api/logs').send({ logMessage: 'x' });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toContain('body.logLevel');

    const badLevel = await request(app).post('/api/logs').send({ logMessage: 'x', logLevel: 'debug' });
    expect(badLevel.status).toBe(400);
  });

  it('lists logs newest first', async () => {
    await createLog('first', 'info');
    await createLog('second', 'error');
    const res = await request(app).get('/api/logs');
    expect(res.status).toBe(200);
    expect(res.body.map((l: { logMessage: string }) => l.logMessage)).toEqual(['second', 'first']);
  });

  it('archives a log with PATCH', async () => {
    const { body } = await createLog();
    const res = await request(app).patch(`/api/logs/${body.newLog.id}`).send({ archived: true });
    expect(res.status).toBe(200);
    expect(res.body.archived).toBe(true);
  });

  it('rejects a non-boolean archived value and a bad id', async () => {
    const { body } = await createLog();
    const badBody = await request(app).patch(`/api/logs/${body.newLog.id}`).send({ archived: 'yes' });
    expect(badBody.status).toBe(400);
    const badId = await request(app).patch('/api/logs/abc').send({ archived: true });
    expect(badId.status).toBe(400);
  });

  it('deletes a log, and returns 404 for an unknown id', async () => {
    const { body } = await createLog();
    const ok = await request(app).delete(`/api/logs/${body.newLog.id}`);
    expect(ok.status).toBe(200);
    const again = await request(app).delete(`/api/logs/${body.newLog.id}`);
    expect(again.status).toBe(404);
  });
});

describe('GET /api/logs filters', () => {
  const at = (iso: string) => new Date(iso);
  beforeEach(async () => {
    await prisma.log.createMany({
      data: [
        { logMessage: 'manual info', logLevel: 'info', archived: false, source: 'manual', timestamp: at('2026-09-20T10:00:00Z') },
        { logMessage: 'cpu alert', logLevel: 'warning', archived: false, source: 'monitor', timestamp: at('2026-09-21T10:00:00Z') },
        { logMessage: 'dns ok', logLevel: 'info', archived: true, source: 'action', actionId: 'flush-dns', success: true, durationMs: 900, timestamp: at('2026-09-22T10:00:00Z') },
        { logMessage: 'temp failed', logLevel: 'error', archived: false, source: 'action', actionId: 'clear-temp', success: false, durationMs: 60000, timestamp: at('2026-09-23T10:00:00Z') },
      ],
    });
  });
  const messages = async (qs: string) => {
    const res = await request(app).get(`/api/logs${qs}`);
    expect(res.status).toBe(200);
    return res.body.map((l: { logMessage: string }) => l.logMessage);
  };

  it('returns everything newest first without filters', async () => {
    expect(await messages('')).toEqual(['temp failed', 'dns ok', 'cpu alert', 'manual info']);
  });

  it('filters by level, source and actionId', async () => {
    expect(await messages('?level=error')).toEqual(['temp failed']);
    expect(await messages('?source=action')).toEqual(['temp failed', 'dns ok']);
    expect(await messages('?source=monitor')).toEqual(['cpu alert']);
    expect(await messages('?actionId=flush-dns')).toEqual(['dns ok']);
  });

  it('filters by archived, reading "false" as false', async () => {
    expect(await messages('?archived=true')).toEqual(['dns ok']);
    expect(await messages('?archived=false')).toEqual(['temp failed', 'cpu alert', 'manual info']);
  });

  it('filters by an inclusive date range', async () => {
    expect(await messages('?from=2026-09-21T10:00:00Z&to=2026-09-22T10:00:00Z')).toEqual(['dns ok', 'cpu alert']);
    expect(await messages('?from=2026-09-23T00:00:00Z')).toEqual(['temp failed']);
    expect(await messages('?to=2026-09-20T23:59:59%2B02:00')).toEqual(['manual info']); // offset allowed
  });

  it('combines filters with AND', async () => {
    expect(await messages('?source=action&archived=false&level=error')).toEqual(['temp failed']);
    expect(await messages('?source=monitor&level=error')).toEqual([]);
  });

  it.each([
    ['level=debug', 'query.level'],
    ['source=user', 'query.source'],
    ['archived=yes', 'query.archived'],
    ['archived=1', 'query.archived'],
    ['from=yesterday', 'query.from'],
    ['from=2026-09-23T00:00:00Z&to=2026-09-20T00:00:00Z', 'must not be after'],
    ['actionId=../x', 'query.actionId'],
  ])('rejects %s with 400', async (qs, hint) => {
    const res = await request(app).get(`/api/logs?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(hint);
  });
});
