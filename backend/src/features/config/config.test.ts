import { appConfigSchema, safeEnvSchema } from '@pc-monitor/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { prisma } from '../../core/prisma.js';

beforeEach(async () => {
  await prisma.appConfig.deleteMany();
  await prisma.appConfig.createMany({
    data: [
      { key: 'CPU_THRESHOLD', value: '90', type: 'number' },
      { key: 'ALERTS_ENABLED', value: 'true', type: 'boolean' },
      { key: 'DASHBOARD_NAME', value: 'PC Monitor', type: 'string' },
    ],
  });
});

describe('config API', () => {
  it('threshold edits apply to the stored row that the alert monitor reads', async () => {
    const res = await request(app).patch('/api/config/CPU_THRESHOLD').send({ value: '42.5' });
    expect(res.status).toBe(200);
    const row = await prisma.appConfig.findUniqueOrThrow({ where: { key: 'CPU_THRESHOLD' } });
    expect(row.value).toBe('42.5');
  });

  it.each(['-1', '100.5', '1000'])('rejects threshold %s outside 0-100 with 400', async (value) => {
    const res = await request(app).patch('/api/config/CPU_THRESHOLD').send({ value });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('between 0 and 100');
  });

  it.each(['0', '100'])('accepts the boundary threshold %s', async (value) => {
    const res = await request(app).patch('/api/config/CPU_THRESHOLD').send({ value });
    expect(res.status).toBe(200);
  });

  it('refuses a threshold edit from a foreign origin', async () => {
    const res = await request(app)
      .patch('/api/config/CPU_THRESHOLD')
      .set('Origin', 'http://evil.example')
      .send({ value: '1' });
    expect(res.status).toBe(403);
    const row = await prisma.appConfig.findUniqueOrThrow({ where: { key: 'CPU_THRESHOLD' } });
    expect(row.value).toBe('90');
  });

  it('returns only whitelisted env variables matching the shared schema', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(safeEnvSchema.parse(res.body)).toMatchObject({ NODE_ENV: 'test' });
    expect(res.body).not.toHaveProperty('DATABASE_URL');
    expect(res.body).not.toHaveProperty('API_SEGRETO');
  });

  it('updates a config value', async () => {
    const res = await request(app).patch('/api/config/CPU_THRESHOLD').send({ value: '75' });
    expect(res.status).toBe(200);
    expect(appConfigSchema.parse(res.body)).toMatchObject({ key: 'CPU_THRESHOLD', value: '75', type: 'number' });
  });

  it('rejects a value that does not match the stored type', async () => {
    const number = await request(app).patch('/api/config/CPU_THRESHOLD').send({ value: 'high' });
    expect(number.status).toBe(400);
    const boolean = await request(app).patch('/api/config/ALERTS_ENABLED').send({ value: 'maybe' });
    expect(boolean.status).toBe(400);
  });

  it('returns 404 for an unknown key and 400 for a malformed key or body', async () => {
    const unknown = await request(app).patch('/api/config/NOPE').send({ value: '1' });
    expect(unknown.status).toBe(404);
    const badKey = await request(app).patch('/api/config/lower-case').send({ value: '1' });
    expect(badKey.status).toBe(400);
    const badBody = await request(app).patch('/api/config/CPU_THRESHOLD').send({});
    expect(badBody.status).toBe(400);
  });
});
