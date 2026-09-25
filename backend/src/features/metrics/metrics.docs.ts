import {
  appConfigSchema,
  configKeyParamsSchema,
  systemSampleSchema,
  updateConfigSchema,
} from '@pc-monitor/shared';
import { z } from 'zod';
import { errorResponses, json, type ApiRegistry } from '../../core/openapi/index.js';

export function registerMetricsDocs(registry: ApiRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/system',
    tags: ['System'],
    summary: 'Latest stored system samples',
    responses: {
      200: { description: 'Samples, newest first', content: json(z.array(systemSampleSchema)) },
      500: errorResponses[500],
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/system/record',
    tags: ['System'],
    summary: 'Take and store a system sample now',
    responses: {
      201: { description: 'Stored sample', content: json(systemSampleSchema) },
      500: errorResponses[500],
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/system/settings',
    tags: ['System'],
    summary: 'Update a monitoring threshold',
    request: {
      body: {
        required: true,
        content: json(
          z.object({ key: configKeyParamsSchema.shape.key, value: updateConfigSchema.shape.value }),
        ),
      },
    },
    responses: {
      200: { description: 'Updated setting', content: json(appConfigSchema) },
      400: errorResponses[400],
      500: errorResponses[500],
    },
  });
}
