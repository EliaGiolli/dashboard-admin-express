import { type InfoLog } from "../types/infoLog.js";
import * as fs from 'fs/promises';

//Logger service with OOP
export class LoggerService {

    constructor(private readonly filePath:string){}

    async readLogs(){

        const data = await fs.readFile(this.filePath, 'utf-8');
        const log = JSON.parse(data);

        return log;
    }
    async writeLogs(newLog:InfoLog){

        const logs = await this.readLogs() ?? [];

        logs.push(newLog);

        await fs.writeFile(this.filePath, JSON.stringify(logs, null, 2), 'utf-8');
    }

    async deleteLogById(id:string){
        const logs = await this.readLogs();
        const updatedLogs = logs.filter((log: InfoLog) => log.id !== id);

        if (logs.length === updatedLogs.length) {
            console.warn('No log found with the provided ID');
        }

        await fs.writeFile(this.filePath, JSON.stringify(updatedLogs, null, 2), 'utf-8');
        return updatedLogs;
    }
}