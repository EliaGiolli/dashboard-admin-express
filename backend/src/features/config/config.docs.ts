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
    path: '/api/config',
    tags: ['Config'],
    summary: 'Whitelisted environment variables and dynamic settings',
    responses: { 200: { description: 'Safe environment', content: json(safeEnvSchema) } },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/config/{key}',
    tags: ['Config'],
    summary: 'Update a stored setting (e.g. a monitoring threshold)',
    description:
      'The value must match the stored type (number, boolean, string). Thresholds (`CPU_THRESHOLD`, `RAM_THRESHOLD`, `DISK_THRESHOLD`) are percentages between 0 and 100 and apply to alerts on the next 2-second cycle.',
    request: { params: configKeyParamsSchema, body: { required: true, content: json(updateConfigSchema) } },
    responses: {
      200: { description: 'Updated setting', content: json(appConfigSchema) },
      400: errorResponses[400],
      403: errorResponses[403],
      404: errorResponses[404],
      500: errorResponses[500],
    },
  });
}
