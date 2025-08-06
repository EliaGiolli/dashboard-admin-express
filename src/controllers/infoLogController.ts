import { LoggerService } from "../services/infoLogService.js";
import { type Response, type Request } from "express";
import type { InfoLog } from "../types/infoLog.js";
import path from 'node:path';

const absolutePath = path.resolve('data', 'info.log');
const logInfo = new LoggerService(absolutePath);

//GET
export async function getLogsController(req:Request, res:Response){
   try{
    const logs = await logInfo.readLogs();
    res.status(200).json(logs);
   }catch(err){
        res.status(500).json({error: 'unable to read logs'});
   }
}

//POST
export async function writeLogsController(req:Request, res:Response){
    const newLog:InfoLog = req.body;
    try{
        await logInfo.writeLogs(newLog);
        res.status(200).json({message: 'Log written', log:logInfo})
    }catch(err){
        res.status(500).json({error: 'unable to write logs'});
    }
}

//DELETE
export async function deleteLogsController(req:Request, res:Response){
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ error: 'Missing log id parameter' });
    }

    try{
        const updatedLog = await logInfo.deleteLogById(id);
        res.status(200).json({message: 'log updated', logs:logInfo});
    }catch(err){
        res.status(500).json({error: 'unable to update the log'});
    }
}