import { AppError } from "../helpers/appError.js";
import { prisma } from "../lib/prisma.js";
import { LoggerService } from "../services/infoLogService.js";
import { type Response, type Request, type NextFunction } from "express";

const logService = new LoggerService();

// GET
export async function getLogsController(req: Request, res: Response, next: NextFunction) {
    try {
        const logs = await logService.readLogs();
        res.status(200).json(logs);
    } catch (err) {
        next(new AppError('Unable to fetch logs from database', 500));
    }
}

// POST
export async function writeLogsController(req: Request, res: Response, next: NextFunction) {
  
    const { logMessage, logLevel } = req.body;
    
    if (!logMessage || !logLevel) {
        return next(new AppError('Missing logMessage or logLevel', 400));
    }

    try {
        const newLog = await logService.writeLogs(logMessage, logLevel);
        res.status(201).json({ message: 'Log created', newLog });
    } catch (err) {
        next(new AppError('Unable to save the log', 500))
    }
}

// DELETE
export async function deleteLogsController(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id;

    if (!id) {
        return next(new AppError('Missing log id parameter', 400));
    }

    try {
        // SQlite usually uses only numeric IDs (Int), we should cast the string from the params
        await logService.deleteLogById(Number(id));
        res.status(200).json({ message: 'Log deleted successfully' });
    } catch (err) {
        next(new AppError('Unable to delete the log', 500));
    }
}

// PATCH
export async function patchLogController(req: Request, res: Response, next:NextFunction) {
    const { id } = req.params;
    const { archived } = req.body; 

    try {
        const updatedLog = await prisma.log.update({
            where: { id: Number(id) },
            data: { archived: Boolean(archived) }
        });
        res.status(200).json(updatedLog);
    } catch (err) {
        next(new AppError('Unable to update the log', 500))
    }
}