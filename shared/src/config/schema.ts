import { z } from 'zod';

export const configValueTypeSchema = z.enum(['string', 'number', 'boolean']);
export type ConfigValueType = z.infer<typeof configValueTypeSchema>;

export const appConfigSchema = z.object({
  id: z.number().int(),
  key: z.string(),
  value: z.string(),
  type: configValueTypeSchema,
});
export type AppConfig = z.infer<typeof appConfigSchema>;

export const configKeyParamsSchema = z.object({
  key: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/, 'must be UPPER_SNAKE_CASE'),
});
export type ConfigKeyParams = z.infer<typeof configKeyParamsSchema>;

export const updateConfigSchema = z.object({
  value: z.string().trim().min(1).max(200),
});
export type UpdateConfig = z.infer<typeof updateConfigSchema>;

export const safeEnvSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
export type SafeEnv = z.infer<typeof safeEnvSchema>;
