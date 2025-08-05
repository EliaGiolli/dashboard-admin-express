import { type InfoLog } from "../types/infoLog.js";
import * as fs from 'fs/promises';

export async function readLogs(){

    try{
        const data = await fs.readFile('../data/info.log', 'utf-8');
        const log = JSON.parse(data);

        return log;
    }catch(err){
        //If the file doesn't exist, return an empty array
        if((err as NodeJS.ErrnoException).code === 'ENOENT'){
            return [];
        }
        console.error('unable to read the file', err);
        throw err;
    }
}

export async function writeLogs(newLog:InfoLog){
    
    try{
        const logs = await readLogs() ?? [];

        logs.push(newLog);

        await fs.writeFile('../data/info.log', JSON.stringify(logs, null, 2), 'utf-8');

        return newLog;
    }catch(err){

        console.error('impossible to write a new log', err);
        throw err;
    }

}

export async function deleteLogById(id:string){

    try{
        const logs = await readLogs();
        const updatedLogs = logs.filter((log: InfoLog) => log.id !== id);

        if (logs.length === updatedLogs.length) {
            console.warn('No log found with the provided ID');
        }

        await fs.writeFile('../data/info.log', JSON.stringify(updatedLogs, null, 2), 'utf-8');
        return updatedLogs;
    }catch(err){
        console.error('Unable to delete the log', err);
        throw err;
    }
}