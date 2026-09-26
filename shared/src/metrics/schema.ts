import { z } from 'zod';

// A stored metrics sample. Byte values are plain numbers (exact up to 2^53).
export const systemSampleSchema = z.object({
  id: z.number().int(),
  createdAt: z.iso.datetime(),
  cpuTotal: z.number().min(0).max(100),
  cpuTemp: z.number().nullable(),
  ramUsed: z.number().nonnegative(),
  ramTotal: z.number().nonnegative(),
  diskReadBps: z.number().nonnegative().nullable(),
  diskWriteBps: z.number().nonnegative().nullable(),
  netRxBps: z.number().nonnegative().nullable(),
  netTxBps: z.number().nonnegative().nullable(),
});
export type SystemSample = z.infer<typeof systemSampleSchema>;

// A sample before it is stored: the database assigns id and createdAt.
export const newSampleSchema = systemSampleSchema.omit({ id: true, createdAt: true });
export type NewSample = z.infer<typeof newSampleSchema>;

// Live snapshot collected by the ticker and pushed over the WebSocket.
// Rates are null when they can't be measured yet (first reading) or at all on this machine.
const percentSchema = z.number().min(0).max(100);
const bytesSchema = z.number().nonnegative();
const rateSchema = z.number().nonnegative().nullable();

export const cpuStatsSchema = z.object({
  total: percentSchema,
  perCore: z.array(percentSchema),
  tempC: z.number().nullable(), // usually null on Windows
});
export type CpuStats = z.infer<typeof cpuStatsSchema>;

export const ramStatsSchema = z.object({
  used: bytesSchema,
  total: bytesSchema,
  usedPercent: percentSchema,
});
export type RamStats = z.infer<typeof ramStatsSchema>;

export const driveStatsSchema = z.object({
  mount: z.string(), // "C:"
  fsType: z.string(), // "NTFS"
  size: bytesSchema,
  used: bytesSchema,
  usedPercent: percentSchema,
});
export type DriveStats = z.infer<typeof driveStatsSchema>;

export const diskStatsSchema = z.object({
  drives: z.array(driveStatsSchema),
  readBps: rateSchema,
  writeBps: rateSchema,
});
export type DiskStats = z.infer<typeof diskStatsSchema>;

export const networkStatsSchema = z.object({
  rxBps: rateSchema,
  txBps: rateSchema,
});
export type NetworkStats = z.infer<typeof networkStatsSchema>;

export const snapshotSchema = z.object({
  timestamp: z.iso.datetime(),
  cpu: cpuStatsSchema,
  ram: ramStatsSchema,
  disk: diskStatsSchema,
  network: networkStatsSchema,
});
export type Snapshot = z.infer<typeof snapshotSchema>;

// GET /api/metrics/history?minutes= . Bounded: one sample every 2s means 60 min is
// ~1,800 rows; the cap (6h, ~10,800 rows) keeps a single response around 2 MB.
export const HISTORY_MAX_MINUTES = 360;
export const historyQuerySchema = z.object({
  minutes: z.coerce.number().int().min(1).max(HISTORY_MAX_MINUTES).default(60),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
