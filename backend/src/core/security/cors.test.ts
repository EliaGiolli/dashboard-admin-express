import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';

describe('CORS allow-list', () => {
  it('allows the configured frontend origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not grant CORS headers to a foreign origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows requests with no Origin header (curl, server-to-server)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
