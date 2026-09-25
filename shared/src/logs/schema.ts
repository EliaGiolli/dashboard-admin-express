import { z } from 'zod';

export const logLevelSchema = z.enum(['info', 'warning', 'error']);
export type LogLevel = z.infer<typeof logLevelSchema>;

// Where a log comes from: the API (manual), the threshold monitor, or a fix action run (audit trail).
export const logSourceSchema = z.enum(['manual', 'monitor', 'action']);
export type LogSource = z.infer<typeof logSourceSchema>;

export const logSchema = z.object({
  id: z.number().int(),
  timestamp: z.iso.datetime(),
  logLevel: logLevelSchema,
  logMessage: z.string(),
  archived: z.boolean(),
  source: logSourceSchema,
  actionId: z.string().nullable(),
  success: z.boolean().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
});
export type Log = z.infer<typeof logSchema>;

// Public body for POST /api/logs; it cannot set source or audit fields, so clients can't forge action runs.
export const createLogSchema = z.object({
  logMessage: z.string().trim().min(1).max(1000),
  logLevel: logLevelSchema,
});
export type CreateLog = z.infer<typeof createLogSchema>;

// Server-side extras for logs written by the monitor or the action runner.
export type LogAudit = {
  source: LogSource;
  actionId?: string;
  success?: boolean;
  durationMs?: number;
};

export const updateLogSchema = z.object({
  archived: z.boolean(),
});
export type UpdateLog = z.infer<typeof updateLogSchema>;

export const logIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
export type LogIdParams = z.infer<typeof logIdParamsSchema>;
