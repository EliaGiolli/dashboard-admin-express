import {
  appConfigSchema,
  configKeyParamsSchema,
  safeEnvSchema,
  updateConfigSchema,
} from '@pc-monitor/shared';
import { errorResponses, json, type ApiRegistry } from '../../core/openapi/index.js';

export function registerConfigDocs(registry: ApiRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/env',
    tags: ['Config'],
    summary: 'Whitelisted environment variables and dynamic settings',
    responses: { 200: { description: 'Safe environment', content: json(safeEnvSchema) } },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/env/{key}',
    tags: ['Config'],
    summary: 'Update a stored setting (e.g. a monitoring threshold)',
    request: { params: configKeyParamsSchema, body: { required: true, content: json(updateConfigSchema) } },
    responses: {
      200: { description: 'Updated setting', content: json(appConfigSchema) },
      400: errorResponses[400],
      404: errorResponses[404],
      500: errorResponses[500],
    },
  });
}
