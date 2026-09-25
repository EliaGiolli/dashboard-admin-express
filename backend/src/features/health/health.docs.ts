import { healthResponseSchema } from '@pc-monitor/shared';
import { json, type ApiRegistry } from '../../core/openapi/index.js';

export function registerHealthDocs(registry: ApiRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/health',
    tags: ['Health'],
    summary: 'Liveness check',
    responses: { 200: { description: 'The API is up', content: json(healthResponseSchema) } },
  });
}
