import { HISTORY_MAX_MINUTES, systemSampleSchema, type NewSample, type SystemSample } from '@pc-monitor/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import { prisma } from '../../core/prisma.js';
import { insertSample } from './samples.service.js';

// No real systeminformation calls (they spawn PowerShell); a fixed snapshot is recorded instead.
vi.mock('./snapshot.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./snapshot.js')>()),
  collectSnapshot: vi.fn(async () => ({
    timestamp: new Date().toISOString(),
    cpu: { total: 37.5, perCore: [30, 45], tempC: null },
    ram: { used: 6e9, total: 16e9, usedPercent: 37.5 },
    disk: { drives: [], readBps: 2048, writeBps: null },
    network: { rxBps: 100, txBps: 50 },
  })),
}));

beforeEach(async () => {
  await prisma.sample.deleteMany();
});

describe('system API', () => {
  it('records a sample matching the shared schema', async () => {
    const res = await request(app).post('/api/metrics/record');
    expect(res.status).toBe(201);
    expect(systemSampleSchema.parse(res.body)).toBeTruthy();
  });

  it('stores the collected snapshot, keeping unmeasurable values as null', async () => {
    const res = await request(app).post('/api/metrics/record');
    const row = await prisma.sample.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row).toMatchObject({
      cpuTotal: 37.5,
      cpuTemp: null,
      ramUsed: 6e9,
      ramTotal: 16e9,
      diskReadBps: 2048,
      diskWriteBps: null,
      netRxBps: 100,
      netTxBps: 50,
    });
  });

  it('lists recorded samples as JSON', async () => {
    await request(app).post('/api/metrics/record');
    await request(app).post('/api/metrics/record');
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const sample of res.body) expect(systemSampleSchema.parse(sample)).toBeTruthy();
  });

  it('validates the settings body', async () => {
    const res = await request(app).patch('/api/metrics/settings').send({ key: 'lower', value: '1' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/metrics/history', () => {
  const base: NewSample = {
    cpuTotal: 10,
    cpuTemp: null,
    ramUsed: 1,
    ramTotal: 2,
    diskReadBps: null,
    diskWriteBps: null,
    netRxBps: null,
    netTxBps: null,
  };
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

  it('returns samples of the last 60 minutes by default, oldest first', async () => {
    await insertSample({ ...base, cpuTotal: 3 }, minutesAgo(1));
    await insertSample({ ...base, cpuTotal: 99 }, minutesAgo(61));
    await insertSample({ ...base, cpuTotal: 1 }, minutesAgo(59));

    const res = await request(app).get('/api/metrics/history');
    expect(res.status).toBe(200);
    expect(res.body.map((s: SystemSample) => s.cpuTotal)).toEqual([1, 3]);
    for (const sample of res.body) expect(systemSampleSchema.parse(sample)).toBeTruthy();
  });

  it('honours the minutes parameter', async () => {
    await insertSample({ ...base, cpuTotal: 1 }, minutesAgo(4));
    await insertSample({ ...base, cpuTotal: 2 }, minutesAgo(6));
    const res = await request(app).get('/api/metrics/history?minutes=5');
    expect(res.body.map((s: SystemSample) => s.cpuTotal)).toEqual([1]);
  });

  it('accepts the maximum window and returns an empty list when nothing is stored', async () => {
    const res = await request(app).get(`/api/metrics/history?minutes=${HISTORY_MAX_MINUTES}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it.each(['0', '-5', '1.5', 'abc', String(HISTORY_MAX_MINUTES + 1)])('rejects minutes=%s with 400', async (minutes) => {
    const res = await request(app).get(`/api/metrics/history?minutes=${minutes}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('query.minutes');
  });
});
