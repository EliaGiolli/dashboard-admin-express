import { type Request, type Response, type NextFunction } from 'express';
import { getSystemHistory, saveCurrentSystemStats } from '../services/systemAdminService.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../helpers/appError.js';

export const getSystemStats = async (req: Request, res: Response, next:NextFunction) => {
    try {
        const stats = await getSystemHistory();
        res.status(200).json(stats);
    } catch (error) {
        next(new AppError('Unable to retrieve the statystics from the system', 500));
    }
};

export async function patchSystemSettings(req: Request, res: Response, next:NextFunction) {
    const { key, value } = req.body; // es. key: "CPU_THRESHOLD", value: "90"

    try {
        const updatedSetting = await prisma.appConfig.update({
            where: { key: key },
            data: { value: String(value) }
        });
        res.status(200).json(updatedSetting);
    } catch (err) {
        console.error('Impossibile aggiornare la soglia di sistema');
        next(new AppError('Unable to update the system', 500));
    }
}

// Optional: endpoint to force a manual save of data
export const recordCurrentStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newRecord = await saveCurrentSystemStats();
        res.status(201).json(newRecord);
    } catch (error) {
         next(new AppError('Unable to save the data', 500));
    }
};