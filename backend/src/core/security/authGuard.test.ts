import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminGuard } from './authGuard.js';

function buildApp() {
  const app = express();
  app.get('/protected', adminGuard, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('adminGuard', () => {
  const originalSecret = process.env.API_SEGRETO;

  beforeEach(() => {
    process.env.API_SEGRETO = 'correct-horse-battery-staple';
  });

  afterEach(() => {
    process.env.API_SEGRETO = originalSecret;
  });

  it('allows the request when the key matches', async () => {
    const res = await request(buildApp()).get('/protected').set('x-api-key', 'correct-horse-battery-staple');
    expect(res.status).toBe(200);
  });

  it('rejects a missing key', async () => {
    const res = await request(buildApp()).get('/protected');
    expect(res.status).toBe(403);
  });

  it('rejects a wrong key of the same length', async () => {
    const res = await request(buildApp()).get('/protected').set('x-api-key', 'wrong-horse-battery-staple');
    expect(res.status).toBe(403);
  });

  it('rejects a wrong key of a different length without throwing', async () => {
    const res = await request(buildApp()).get('/protected').set('x-api-key', 'short');
    expect(res.status).toBe(403);
  });
});
