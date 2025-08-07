import { type InfoLog } from "../types/infoLog.js";
import * as fs from 'fs/promises';

//Logger service with OOP
export class LoggerService {

    constructor(private readonly filePath:string){}

    async readLogs(): Promise<InfoLog[]> {
        try {
            const data = await fs.readFile(this.filePath, 'utf-8');
            return JSON.parse(data);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                // File does not exist, return empty array
                return [];
            }
            throw err;
        }
    }

    async writeLogs(newLog:InfoLog): Promise<void> {

        const logs = await this.readLogs() ?? [];

        logs.push(newLog);

        await fs.writeFile(this.filePath, JSON.stringify(logs, null, 2), 'utf-8');
    }

    async deleteLogById(id:string): Promise<InfoLog[]> {
        const logs = await this.readLogs();
        const updatedLogs = logs.filter((log: InfoLog) => log.id !== id);

        if (logs.length === updatedLogs.length) {
            console.warn('No log found with the provided ID');
        }

        await fs.writeFile(this.filePath, JSON.stringify(updatedLogs, null, 2), 'utf-8');
        return updatedLogs;
    }
}