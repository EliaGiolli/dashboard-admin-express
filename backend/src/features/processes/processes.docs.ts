import { processListQuerySchema, processListSchema } from '@pc-monitor/shared';
import { errorResponses, json, type ApiRegistry } from '../../core/openapi/index.js';

export function registerProcessesDocs(registry: ApiRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/processes',
    tags: ['Processes'],
    summary: 'Top running processes by CPU or memory',
    description: 'Takes about a second on Windows. The System Idle Process (PID 0) is excluded.',
    request: { query: processListQuerySchema },
    responses: {
      200: { description: 'Processes, heaviest first', content: json(processListSchema) },
      400: errorResponses[400],
      500: errorResponses[500],
    },
  });
}
