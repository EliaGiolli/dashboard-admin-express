import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { globalErrorHandler } from '../errors/errorHandler.js';
import { validate } from './validate.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post(
    '/items/:id',
    validate({
      params: z.object({ id: z.coerce.number().int().positive() }),
      query: z.object({ dry: z.enum(['true', 'false']).default('false') }),
      body: z.object({ name: z.string().min(1) }),
    }),
    (req, res) => {
      res.json({ params: req.params, query: req.query, body: req.body });
    },
  );
  app.use(globalErrorHandler);
  return app;
}

describe('validate middleware', () => {
  it('passes parsed and coerced values to the handler', async () => {
    const res = await request(buildApp()).post('/items/7').send({ name: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ params: { id: 7 }, query: { dry: 'false' }, body: { name: 'x' } });
  });

  it('returns 400 with the failing field when the body is invalid', async () => {
    const res = await request(buildApp()).post('/items/7').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('body.name');
  });

  it('returns 400 when a param is invalid', async () => {
    const res = await request(buildApp()).post('/items/abc').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('params.id');
  });

  it('returns 400 when a query value is invalid', async () => {
    const res = await request(buildApp()).post('/items/7?dry=maybe').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('query.dry');
  });
});
