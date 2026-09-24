import { z } from 'zod';

export const systemSampleSchema = z.object({
  id: z.number().int(),
  createdAt: z.iso.datetime(),
  uptime: z.number().int().nonnegative(),
  totalMemory: z.number().nonnegative(),
  freeMemory: z.number().nonnegative(),
  cpuUsagePercent: z.number().min(0).max(100),
});
export type SystemSample = z.infer<typeof systemSampleSchema>;
