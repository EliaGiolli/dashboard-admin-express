import type { CreateLog, LogAudit, LogQuery } from '@pc-monitor/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../core/prisma.js';
import type { Log as LogModel } from '../../generated/prisma/client.js';

// Translates the validated filters into a Prisma where clause (no raw SQL).
export function toWhere({ level, source, actionId, archived, from, to }: Partial<LogQuery>): Prisma.LogWhereInput {
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

export function encodeCursor(log: Pick<LogModel, 'timestamp' | 'id'>): string {
  return `${log.timestamp.getTime()}_${log.id}`;
}

// Rows strictly after the cursor in (timestamp desc, id desc) order.
function afterCursor(cursor: string | undefined): Prisma.LogWhereInput {
  if (!cursor) return {};
  const [ms, id] = cursor.split('_').map(Number) as [number, number];
  const timestamp = new Date(ms);
  return { OR: [{ timestamp: { lt: timestamp } }, { timestamp, id: { lt: id } }] };
}

export class LoggerService {
  // One page, newest first. Order is (timestamp desc, id desc): the id breaks ties so the
  // order is total and the cursor is unambiguous. One extra row is fetched to know
  // whether another page exists.
  async readLogs(query: LogQuery): Promise<{ items: LogModel[]; nextCursor: string | null }> {
    const where: Prisma.LogWhereInput = { AND: [toWhere(query), afterCursor(query.cursor)] };
    const rows = await prisma.log.findMany({
      where,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null };
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
