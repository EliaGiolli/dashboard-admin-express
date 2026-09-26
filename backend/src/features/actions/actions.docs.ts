import { actionDefinitionSchema, actionIdParamsSchema, runActionRequestSchema, runActionResultSchema } from '@pc-monitor/shared';
import { z } from 'zod';
import { errorResponses, json, type ApiRegistry } from '../../core/openapi/index.js';

export function registerActionsDocs(registry: ApiRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/actions',
    tags: ['Actions'],
    summary: 'Available fix actions (metadata only)',
    description:
      'What the dashboard can run. `target: "system"` actions belong in the fix panel; `kill-process` is used from the process table. Script paths are never exposed.',
    responses: { 200: { description: 'Action definitions', content: json(z.array(actionDefinitionSchema)) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/actions/{id}/run',
    tags: ['Actions'],
    summary: 'Run a fix action',
    description:
      'Runs the PowerShell script registered for this id and writes the outcome to the logs (source `action`; list past runs with `GET /api/logs?source=action`). Responds 200 with `success: false` when the script itself failed. `pid` is only accepted (and required) by `kill-process`. Actions with `requiresConfirm` need `{"confirm": true}` (409 otherwise).',
    request: {
      params: actionIdParamsSchema,
      body: { required: false, content: json(runActionRequestSchema) },
    },
    responses: {
      200: { description: 'The action ran (check `success`)', content: json(runActionResultSchema) },
      400: errorResponses[400],
      403: errorResponses[403],
      404: errorResponses[404],
      409: {
        ...errorResponses[409],
        description: 'Confirmation missing (send `{"confirm": true}` for actions with `requiresConfirm`), or the same action is already running',
      },
      500: errorResponses[500],
    },
  });
}
