import type { CreateLog } from '@pc-monitor/shared';
import { prisma } from '../../core/prisma.js';
import type { Log as LogModel } from '../../generated/prisma/client.js';

export class LoggerService {
  async readLogs(): Promise<LogModel[]> {
    return prisma.log.findMany({ orderBy: { timestamp: 'desc' } });
  }

  async writeLogs({ logMessage, logLevel }: CreateLog): Promise<LogModel> {
    return prisma.log.create({ data: { logMessage, logLevel, archived: false } });
  }

  async setArchived(id: number, archived: boolean): Promise<LogModel> {
    return prisma.log.update({ where: { id }, data: { archived } });
  }

  async deleteLogById(id: number): Promise<void> {
    await prisma.log.delete({ where: { id } });
  }
}
