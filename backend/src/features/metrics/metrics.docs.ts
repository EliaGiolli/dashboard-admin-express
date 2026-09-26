import { historyQuerySchema, systemSampleSchema } from '@pc-monitor/shared';
import { z } from 'zod';
import { errorResponses, json, type ApiRegistry } from '../../core/openapi/index.js';

export function registerMetricsDocs(registry: ApiRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/metrics/history',
    tags: ['Metrics'],
    summary: 'Stored samples from the last N minutes, oldest first',
    description:
      'Used to prefill the charts before live WebSocket snapshots arrive. One sample is stored about every 2 seconds; `minutes` is capped to keep the response small.',
    request: { query: historyQuerySchema },
    responses: {
      200: { description: 'Samples, oldest first', content: json(z.array(systemSampleSchema)) },
      400: errorResponses[400],
      500: errorResponses[500],
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/metrics/record',
    tags: ['Metrics'],
    summary: 'Take and store a system sample now',
    description:
      'Collects a real snapshot (about 1-2s on Windows). CPU temperature is null when the sensor is not readable; disk and network rates are null until a previous reading exists.',
    responses: {
      201: { description: 'Stored sample', content: json(systemSampleSchema) },
      500: errorResponses[500],
    },
  });
}
