import { z } from 'zod';

export const processInfoSchema = z.object({
  pid: z.number().int().nonnegative(),
  name: z.string(),
  cpuPercent: z.number().nonnegative(), // share of total CPU
  memBytes: z.number().nonnegative(), // resident memory
  memPercent: z.number().min(0).max(100),
});
export type ProcessInfo = z.infer<typeof processInfoSchema>;

export const processSortSchema = z.enum(['cpu', 'mem']);
export type ProcessSort = z.infer<typeof processSortSchema>;

export const processListQuerySchema = z.object({
  sortBy: processSortSchema.default('cpu'),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});
export type ProcessListQuery = z.infer<typeof processListQuerySchema>;

export const processListSchema = z.object({
  total: z.number().int().nonnegative(), // processes running, before the limit
  processes: z.array(processInfoSchema),
});
export type ProcessList = z.infer<typeof processListSchema>;
