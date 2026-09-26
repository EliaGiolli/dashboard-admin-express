import { z } from 'zod';

/**
 * Fix actions: one-click PowerShell scripts run by the backend.
 *
 * The client only ever sees and sends an action *id*; the backend maps it to a script
 * through a fixed registry, so a request can never choose a file path or a command.
 */

export const actionIdSchema = z.enum(['flush-dns', 'clear-temp', 'empty-recyclebin', 'kill-process']);
export type ActionId = z.infer<typeof actionIdSchema>;

export const actionRiskSchema = z.enum(['low', 'medium', 'high']);
export type ActionRisk = z.infer<typeof actionRiskSchema>;

// Public metadata returned by GET /api/actions. Never includes script paths.
export const actionDefinitionSchema = z.object({
  id: actionIdSchema,
  label: z.string(),
  description: z.string(),
  risk: actionRiskSchema,
  // When true the server refuses to run it without {"confirm": true} (409).
  requiresConfirm: z.boolean(),
  // "system" actions go in the fix panel; "process" actions need a PID and are
  // triggered from the process table (POST /api/processes/:pid/kill).
  target: z.enum(['system', 'process']),
});
export type ActionDefinition = z.infer<typeof actionDefinitionSchema>;

// Path parameter: any short slug is accepted here so an unknown id gets a clean 404
// from the registry lookup instead of a validation error.
export const actionIdParamsSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/, 'must be a lowercase slug'),
});

// A PID that could be killed. Protected PIDs (0, 4, the server itself) are refused
// server-side with a clearer error, not here.
export const pidSchema = z.coerce.number().int().positive().max(2 ** 32 - 1);

// Body of POST /api/actions/:id/run. Strict: unknown fields are rejected, so a
// typo like {"confrim": true} fails loudly instead of being ignored.
export const runActionRequestSchema = z
  .object({
    confirm: z.boolean().optional(),
    pid: pidSchema.optional(), // required by kill-process, refused by the others
  })
  .strict();
export type RunActionRequest = z.infer<typeof runActionRequestSchema>;

// Body of POST /api/processes/:pid/kill (the PID comes from the path).
export const killProcessRequestSchema = z.object({ confirm: z.boolean().optional() }).strict();
export const pidParamsSchema = z.object({ pid: pidSchema });

export const runActionResultSchema = z.object({
  actionId: actionIdSchema,
  success: z.boolean(),
  message: z.string(), // one-line summary from the script, or the error
  durationMs: z.number().int().nonnegative(),
  logId: z.number().int(), // the audit Log row written for this run
});
export type RunActionResult = z.infer<typeof runActionResultSchema>;
