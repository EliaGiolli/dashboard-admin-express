import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';

describe('requireJsonContentType', () => {
  it('rejects a POST with a non-JSON content type', async () => {
    const res = await request(app)
      .post('/api/logs')
      .set('Content-Type', 'text/plain')
      .send('logMessage=hi&logLevel=info');
    expect(res.status).toBe(415);
  });

  it('rejects a PATCH with a non-JSON content type', async () => {
    const res = await request(app)
      .patch('/api/logs/1')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('archived=true');
    expect(res.status).toBe(415);
  });

  it('accepts a POST with an application/json content type', async () => {
    const res = await request(app)
      .post('/api/logs')
      .set('Content-Type', 'application/json')
      .send({ logMessage: 'ok', logLevel: 'info' });
    expect(res.status).toBe(201);
  });

  it('does not affect DELETE, which carries no body', async () => {
    const res = await request(app).delete('/api/logs/999999');
    expect(res.status).not.toBe(415);
  });

  it('does not affect a bodyless POST', async () => {
    const res = await request(app).post('/api/metrics/record');
    expect(res.status).not.toBe(415);
  });
});
