import { LoggerService } from './features/logs/index.js';
import { pruneSamplesOlderThan } from './features/metrics/index.js';

// Keeps the SQLite file bounded: drops samples and logs older than `days`.
export async function pruneOlderThan(days: number, now: Date = new Date()) {
  const samples = await pruneSamplesOlderThan(days, now);
  const logs = await new LoggerService().pruneOlderThan(days, now);
  return { samples, logs };
}
