import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import { FRONTEND_ORIGIN, SELF_ORIGIN } from '../config/env.js';

describe('originGuard', () => {
  it('rejects a mutating request from a foreign Origin', async () => {
    const res = await request(app)
      .post('/api/logs')
      .set('Origin', 'https://evil.example')
      .set('Content-Type', 'application/json')
      .send({ logMessage: 'hi', logLevel: 'info' });
    expect(res.status).toBe(403);
  });

  it('allows a mutating request from the frontend origin', async () => {
    const res = await request(app)
      .post('/api/logs')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Content-Type', 'application/json')
      .send({ logMessage: 'hi', logLevel: 'info' });
    expect(res.status).toBe(201);
  });

  it('allows a mutating request from the server\'s own origin (Swagger UI)', async () => {
    const res = await request(app)
      .post('/api/logs')
      .set('Origin', SELF_ORIGIN)
      .set('Content-Type', 'application/json')
      .send({ logMessage: 'hi', logLevel: 'info' });
    expect(res.status).toBe(201);
  });

  it('allows a mutating request with no Origin header (curl, server-to-server)', async () => {
    const res = await request(app)
      .post('/api/logs')
      .set('Content-Type', 'application/json')
      .send({ logMessage: 'hi', logLevel: 'info' });
    expect(res.status).toBe(201);
  });

  it('does not check Origin on safe methods', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
  });
});
