import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { errorResponseSchema } from '@pc-monitor/shared';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

export type ApiRegistry = OpenAPIRegistry;

export const errorResponses = {
  400: { description: 'Invalid request', content: { 'application/json': { schema: errorResponseSchema } } },
  403: { description: 'Origin not allowed', content: { 'application/json': { schema: errorResponseSchema } } },
  404: { description: 'Not found', content: { 'application/json': { schema: errorResponseSchema } } },
  409: { description: 'Conflict', content: { 'application/json': { schema: errorResponseSchema } } },
  500: { description: 'Server error', content: { 'application/json': { schema: errorResponseSchema } } },
} as const;

export function json<T extends z.ZodType>(schema: T) {
  return { 'application/json': { schema } };
}

export function buildOpenApiDocument(reg: ApiRegistry = registry) {
  return new OpenApiGeneratorV3(reg.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'PC Monitor API',
      version: '1.0.0',
      description:
        'Local PC monitoring API. Runs on 127.0.0.1 only. Live metrics and alerts are pushed over Socket.IO on /ws (see the "Live (Socket.IO)" section). Mutating requests from a browser must come from the dashboard origin (403 otherwise) and use Content-Type: application/json.',
    },
    servers: [{ url: 'http://127.0.0.1:4317' }],
  });
}
