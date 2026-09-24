import { z } from 'zod';

export const logLevelSchema = z.enum(['info', 'warning', 'error']);
export type LogLevel = z.infer<typeof logLevelSchema>;

export const logSchema = z.object({
  id: z.number().int(),
  timestamp: z.iso.datetime(),
  logLevel: logLevelSchema,
  logMessage: z.string(),
  archived: z.boolean(),
});
export type Log = z.infer<typeof logSchema>;

export const createLogSchema = z.object({
  logMessage: z.string().trim().min(1).max(1000),
  logLevel: logLevelSchema,
});
export type CreateLog = z.infer<typeof createLogSchema>;

export const updateLogSchema = z.object({
  archived: z.boolean(),
});
export type UpdateLog = z.infer<typeof updateLogSchema>;

export const logIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
export type LogIdParams = z.infer<typeof logIdParamsSchema>;
