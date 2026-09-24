import { systemSampleSchema } from '@pc-monitor/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { prisma } from '../../core/prisma.js';

beforeEach(async () => {
  await prisma.system.deleteMany();
});

describe('system API', () => {
  it('records a sample matching the shared schema', async () => {
    const res = await request(app).post('/api/system/record');
    expect(res.status).toBe(201);
    expect(systemSampleSchema.parse(res.body)).toBeTruthy();
  });

  it('lists recorded samples as JSON (BigInt columns are serialized as numbers)', async () => {
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
