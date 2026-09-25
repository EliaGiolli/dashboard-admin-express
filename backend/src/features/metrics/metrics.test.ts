import { systemSampleSchema } from '@pc-monitor/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import { prisma } from '../../core/prisma.js';

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
    const res = await request(app).post('/api/system/record');
    expect(res.status).toBe(201);
    expect(systemSampleSchema.parse(res.body)).toBeTruthy();
  });

  it('stores the collected snapshot, keeping unmeasurable values as null', async () => {
    const res = await request(app).post('/api/system/record');
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
    await request(app).post('/api/system/record');
    await request(app).post('/api/system/record');
    const res = await request(app).get('/api/system');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const sample of res.body) expect(systemSampleSchema.parse(sample)).toBeTruthy();
  });

  it('validates the settings body', async () => {
    const res = await request(app).patch('/api/system/settings').send({ key: 'lower', value: '1' });
    expect(res.status).toBe(400);
  });
});
