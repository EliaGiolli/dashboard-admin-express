import type { CreateLog, LogAudit } from '@pc-monitor/shared';
import { prisma } from '../../core/prisma.js';
import type { Log as LogModel } from '../../generated/prisma/client.js';

export class LoggerService {
  async readLogs(): Promise<LogModel[]> {
    return prisma.log.findMany({ orderBy: { timestamp: 'desc' } });
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
