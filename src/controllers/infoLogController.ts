import { prisma } from "../lib/prisma.js";
import { LoggerService } from "../services/infoLogService.js";
import { type Response, type Request } from "express";

const logService = new LoggerService();

// GET
export async function getLogsController(req: Request, res: Response) {
    try {
        const logs = await logService.readLogs();
        res.status(200).json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Unable to fetch logs from database' });
    }
}

// POST
export async function writeLogsController(req: Request, res: Response) {
  
    const { logMessage, logLevel } = req.body;
    
    if (!logMessage || !logLevel) {
        return res.status(400).json({ error: 'Missing logMessage or logLevel' });
    }

    try {
        const newLog = await logService.writeLogs(logMessage, logLevel);
        res.status(201).json({ message: 'Log created', newLog });
    } catch (err) {
        res.status(500).json({ error: 'Unable to save the log' });
    }
}

// DELETE
export async function deleteLogsController(req: Request, res: Response) {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ error: 'Missing log id parameter' });
    }

    try {
        // SQlite usually uses only numeric IDs (Int), we should cast the string from the params
        await logService.deleteLogById(Number(id));
        res.status(200).json({ message: 'Log deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Unable to delete the log' });
    }
}

// PATCH
export async function patchLogController(req: Request, res: Response) {
    const { id } = req.params;
    const { archived } = req.body; 

    try {
        const updatedLog = await prisma.log.update({
            where: { id: Number(id) },
            data: { archived: Boolean(archived) }
        });
        res.status(200).json(updatedLog);
    } catch (err) {
        res.status(500).json({ error: 'Errore durante l’aggiornamento del log' });
    }
}