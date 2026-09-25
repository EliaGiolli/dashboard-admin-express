import { systemSampleSchema } from '@pc-monitor/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { prisma } from '../../core/prisma.js';

beforeEach(async () => {
  await prisma.sample.deleteMany();
});

describe('system API', () => {
  it('records a sample matching the shared schema', async () => {
    const res = await request(app).post('/api/system/record');
    expect(res.status).toBe(201);
    expect(systemSampleSchema.parse(res.body)).toBeTruthy();
  });

  it('stores the real sample columns, with a nullable CPU temperature', async () => {
    const res = await request(app).post('/api/system/record');
    const row = await prisma.sample.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.cpuTemp).toBeNull();
    expect(row.ramTotal).toBeGreaterThan(0);
    expect(row.ramUsed).toBeLessThanOrEqual(row.ramTotal);
    expect(res.body).toMatchObject({ diskReadBps: 0, diskWriteBps: 0, netRxBps: 0, netTxBps: 0 });
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
