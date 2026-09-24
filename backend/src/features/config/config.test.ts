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
  it('returns only whitelisted env variables matching the shared schema', async () => {
    const res = await request(app).get('/api/env');
    expect(res.status).toBe(200);
    expect(safeEnvSchema.parse(res.body)).toMatchObject({ NODE_ENV: 'test' });
    expect(res.body).not.toHaveProperty('DATABASE_URL');
    expect(res.body).not.toHaveProperty('API_SEGRETO');
  });

  it('updates a config value', async () => {
    const res = await request(app).patch('/api/env/CPU_THRESHOLD').send({ value: '75' });
    expect(res.status).toBe(200);
    expect(appConfigSchema.parse(res.body)).toMatchObject({ key: 'CPU_THRESHOLD', value: '75', type: 'number' });
  });

  it('rejects a value that does not match the stored type', async () => {
    const number = await request(app).patch('/api/env/CPU_THRESHOLD').send({ value: 'high' });
    expect(number.status).toBe(400);
    const boolean = await request(app).patch('/api/env/ALERTS_ENABLED').send({ value: 'maybe' });
    expect(boolean.status).toBe(400);
  });

  it('returns 404 for an unknown key and 400 for a malformed key or body', async () => {
    const unknown = await request(app).patch('/api/env/NOPE').send({ value: '1' });
    expect(unknown.status).toBe(404);
    const badKey = await request(app).patch('/api/env/lower-case').send({ value: '1' });
    expect(badKey.status).toBe(400);
    const badBody = await request(app).patch('/api/env/CPU_THRESHOLD').send({});
    expect(badBody.status).toBe(400);
  });
});
