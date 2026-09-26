import { logPageSchema, logSchema } from '@pc-monitor/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { prisma } from '../../core/prisma.js';
import { LoggerService } from './logs.service.js';

const ADMIN_KEY = 'test-admin-key';
const originalSecret = process.env.API_SEGRETO;
beforeAll(() => {
  process.env.API_SEGRETO = ADMIN_KEY;
});
afterAll(() => {
  process.env.API_SEGRETO = originalSecret;
});

beforeEach(async () => {
  await prisma.log.deleteMany();
});

const patchLog = (id: number | string, body: object) =>
  request(app).patch(`/api/logs/${id}`).set('x-api-key', ADMIN_KEY).send(body);
const deleteLog = (id: number | string) => request(app).delete(`/api/logs/${id}`).set('x-api-key', ADMIN_KEY);

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
    expect(logSchema.parse(res.body.items[0])).toMatchObject({
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
    expect(res.body.items.map((l: { logMessage: string }) => l.logMessage)).toEqual(['second', 'first']);
  });

  it('archives a log with PATCH', async () => {
    const { body } = await createLog();
    const res = await patchLog(body.newLog.id, { archived: true });
    expect(res.status).toBe(200);
    expect(res.body.archived).toBe(true);
  });

  it('rejects a non-boolean archived value and a bad id', async () => {
    const { body } = await createLog();
    const badBody = await patchLog(body.newLog.id, { archived: 'yes' });
    expect(badBody.status).toBe(400);
    const badId = await patchLog('abc', { archived: true });
    expect(badId.status).toBe(400);
  });

  it('deletes a log, and returns 404 for an unknown id', async () => {
    const { body } = await createLog();
    const ok = await deleteLog(body.newLog.id);
    expect(ok.status).toBe(200);
    const again = await deleteLog(body.newLog.id);
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
    return res.body.items.map((l: { logMessage: string }) => l.logMessage);
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

describe('GET /api/logs pagination', () => {
  const T0 = Date.parse('2026-09-25T00:00:00Z');
  // 7 logs; two pairs share a timestamp to exercise the id tie-break.
  beforeEach(async () => {
    const minutes = [0, 1, 2, 2, 3, 4, 4];
    for (const [i, m] of minutes.entries()) {
      await prisma.log.create({
        data: { logMessage: `log ${i}`, logLevel: 'info', archived: false, timestamp: new Date(T0 + m * 60_000) },
      });
    }
  });

  async function page(qs: string) {
    const res = await request(app).get(`/api/logs${qs}`);
    expect(res.status).toBe(200);
    return logPageSchema.parse(res.body);
  }

  async function walk(qs: string) {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const p = await page(`${qs}${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...p.items.map((l) => l.logMessage));
      cursor = p.nextCursor;
      pages++;
    } while (cursor && pages < 20);
    return { seen, pages };
  }

  it('walks every log exactly once, newest first, with the id breaking timestamp ties', async () => {
    const { seen, pages } = await walk('?limit=3');
    expect(seen).toEqual(['log 6', 'log 5', 'log 4', 'log 3', 'log 2', 'log 1', 'log 0']);
    expect(pages).toBe(3);
  });

  it('returns nextCursor null on the last page, also when it is exactly full', async () => {
    expect((await page('?limit=7')).nextCursor).toBeNull();
    expect((await page('?limit=100')).items).toHaveLength(7);
    expect((await page('?limit=6')).nextCursor).not.toBeNull();
  });

  it('defaults to 50 per page', async () => {
    for (let i = 0; i < 55; i++) {
      await prisma.log.create({ data: { logMessage: `bulk ${i}`, logLevel: 'info', archived: false } });
    }
    const p = await page('');
    expect(p.items).toHaveLength(50);
    expect(p.nextCursor).not.toBeNull();
  });

  it('does not repeat or skip rows when new logs arrive between pages', async () => {
    const first = await page('?limit=3');
    await prisma.log.create({ data: { logMessage: 'arrived later', logLevel: 'warning', archived: false } });
    const second = await page(`?limit=3&cursor=${first.nextCursor}`);
    expect(second.items.map((l) => l.logMessage)).toEqual(['log 3', 'log 2', 'log 1']);
  });

  it('keeps working when the row under the cursor was deleted', async () => {
    const first = await page('?limit=3');
    await prisma.log.delete({ where: { id: first.items.at(-1)!.id } });
    const second = await page(`?limit=3&cursor=${first.nextCursor}`);
    expect(second.items.map((l) => l.logMessage)).toEqual(['log 3', 'log 2', 'log 1']);
  });

  it('paginates within a filter', async () => {
    await prisma.log.updateMany({ where: { logMessage: { in: ['log 1', 'log 4', 'log 6'] } }, data: { logLevel: 'error' } });
    const { seen } = await walk('?level=error&limit=2');
    expect(seen).toEqual(['log 6', 'log 4', 'log 1']);
  });

  it.each(['limit=0', 'limit=101', 'limit=abc', 'cursor=abc', 'cursor=1_2_3', 'cursor=-1_2'])('rejects %s with 400', async (qs) => {
    expect((await request(app).get(`/api/logs?${qs}`)).status).toBe(400);
  });
});

describe('admin guard on PATCH and DELETE /api/logs/:id', () => {
  async function seed() {
    return prisma.log.create({ data: { logMessage: 'audit entry', logLevel: 'info', archived: false, source: 'action', actionId: 'flush-dns' } });
  }

  it.each([
    ['no key', undefined],
    ['a wrong key', 'nope'],
    ['a key of the right length but wrong', 'x'.repeat(ADMIN_KEY.length)],
  ])('refuses to archive or delete with %s (403) and changes nothing', async (_label, key) => {
    const log = await seed();
    const patch = request(app).patch(`/api/logs/${log.id}`);
    const del = request(app).delete(`/api/logs/${log.id}`);
    const [p, d] = await Promise.all([
      (key ? patch.set('x-api-key', key) : patch).send({ archived: true }),
      key ? del.set('x-api-key', key) : del,
    ]);
    expect(p.status).toBe(403);
    expect(d.status).toBe(403);
    expect(await prisma.log.findUniqueOrThrow({ where: { id: log.id } })).toMatchObject({ archived: false });
  });

  it('checks the key before anything else (no 404 or 400 leaks to unauthenticated callers)', async () => {
    expect((await request(app).delete('/api/logs/999999')).status).toBe(403);
    expect((await request(app).patch('/api/logs/abc').send({ archived: 'x' })).status).toBe(403);
  });

  it('archives, unarchives and deletes with the right key', async () => {
    const log = await seed();
    expect((await patchLog(log.id, { archived: true })).body.archived).toBe(true);
    expect((await patchLog(log.id, { archived: false })).body.archived).toBe(false);
    expect((await deleteLog(log.id)).status).toBe(200);
    expect(await prisma.log.count()).toBe(0);
  });

  it('keeps reading and writing logs open (no key needed)', async () => {
    expect((await request(app).get('/api/logs')).status).toBe(200);
    expect((await request(app).post('/api/logs').send({ logMessage: 'x', logLevel: 'info' })).status).toBe(201);
  });

  it('still requires the dashboard origin even with the key', async () => {
    const log = await seed();
    const res = await request(app)
      .delete(`/api/logs/${log.id}`)
      .set('x-api-key', ADMIN_KEY)
      .set('Origin', 'http://evil.example');
    expect(res.status).toBe(403);
    expect(await prisma.log.count()).toBe(1);
  });
});
