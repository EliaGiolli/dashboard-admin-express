import { z } from 'zod';

// A stored metrics sample. Byte values are plain numbers (exact up to 2^53).
export const systemSampleSchema = z.object({
  id: z.number().int(),
  createdAt: z.iso.datetime(),
  cpuTotal: z.number().min(0).max(100),
  cpuTemp: z.number().nullable(),
  ramUsed: z.number().nonnegative(),
  ramTotal: z.number().nonnegative(),
  diskReadBps: z.number().nonnegative(),
  diskWriteBps: z.number().nonnegative(),
  netRxBps: z.number().nonnegative(),
  netTxBps: z.number().nonnegative(),
});
export type SystemSample = z.infer<typeof systemSampleSchema>;

// A sample before it is stored: the database assigns id and createdAt.
export const newSampleSchema = systemSampleSchema.omit({ id: true, createdAt: true });
export type NewSample = z.infer<typeof newSampleSchema>;
