import type { CreateLog, LogAudit, LogQuery } from '@pc-monitor/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../core/prisma.js';
import type { Log as LogModel } from '../../generated/prisma/client.js';

// Translates the validated filters into a Prisma where clause (no raw SQL).
export function toWhere({ level, source, actionId, archived, from, to }: LogQuery): Prisma.LogWhereInput {
  const where: Prisma.LogWhereInput = {};
  if (level) where.logLevel = level;
  if (source) where.source = source;
  if (actionId) where.actionId = actionId;
  if (archived !== undefined) where.archived = archived;
  if (from || to) {
    where.timestamp = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  return where;
}

export class LoggerService {
  // Newest first; ties on the same timestamp are broken by id so the order is stable.
  async readLogs(query: LogQuery = {}): Promise<LogModel[]> {
    return prisma.log.findMany({ where: toWhere(query), orderBy: [{ timestamp: 'desc' }, { id: 'desc' }] });
  }

  async writeLogs({ logMessage, logLevel }: CreateLog, audit?: LogAudit): Promise<LogModel> {
    return prisma.log.create({ data: { logMessage, logLevel, archived: false, ...audit } });
  }

  async setArchived(id: number, archived: boolean): Promise<LogModel> {
    return prisma.log.update({ where: { id }, data: { archived } });
  }

  // Deletes logs older than `days`; returns how many were removed.
  async pruneOlderThan(days: number, now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - days * 86_400_000);
    const { count } = await prisma.log.deleteMany({ where: { timestamp: { lt: cutoff } } });
    return count;
  }

  async deleteLogById(id: number): Promise<void> {
    await prisma.log.delete({ where: { id } });
  }
}
