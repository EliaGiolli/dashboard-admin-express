import { prisma } from "../lib/prisma.js"; // Il tuo singleton
import { type Log as LogModel } from "../generated/prisma/client.js";

export class LoggerService {

    async readLogs(): Promise<LogModel[]> {
        // SELECT * FROM Log
        return await prisma.log.findMany({
            orderBy: { timestamp: 'desc' } 
        });
    }

    async writeLogs(logMessage: string, logLevel: string): Promise<LogModel> {
        // INSERT INTO Log ...
        return await prisma.log.create({
            data: {
                logMessage,
                logLevel,
            }
        });
    }

    async deleteLogById(id: number): Promise<void> {
        // DELETE FROM Log WHERE id = id
        await prisma.log.delete({
            where: { id }
        });
    }
}