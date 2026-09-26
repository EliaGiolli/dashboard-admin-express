import { actionDefinitionSchema } from '@pc-monitor/shared';
import { z } from 'zod';
import { json, type ApiRegistry } from '../../core/openapi/index.js';

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
}
