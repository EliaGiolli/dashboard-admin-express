import {
  killProcessRequestSchema,
  pidParamsSchema,
  processListQuerySchema,
  processListSchema,
  runActionResultSchema,
} from '@pc-monitor/shared';
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
  registry.registerPath({
    method: 'post',
    path: '/api/processes/{pid}/kill',
    tags: ['Processes'],
    summary: 'Force-stop a process (needs confirm: true)',
    description:
      'Runs the `kill-process` action for this PID and logs it. PIDs 0 and 4, this server and its parent are refused (403); critical Windows processes are refused by the script (200 with `success: false`).',
    request: {
      params: pidParamsSchema,
      body: { required: false, content: json(killProcessRequestSchema) },
    },
    responses: {
      200: { description: 'The kill ran (check `success`)', content: json(runActionResultSchema) },
      400: errorResponses[400],
      403: { ...errorResponses[403], description: 'Foreign origin, or a protected PID' },
      409: { ...errorResponses[409], description: 'Already stopping this PID' },
      500: errorResponses[500],
    },
  });
}
