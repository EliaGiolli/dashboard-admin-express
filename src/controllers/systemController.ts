import { type Request, type Response } from 'express';
import { getSystemHistory, saveCurrentSystemStats } from '../services/systemAdminService.js';
import { prisma } from '../lib/prisma.js';

export const getSystemStats = async (req: Request, res: Response) => {
    try {
        const stats = await getSystemHistory();
        res.status(200).json(stats);
    } catch (error) {
        console.error("Errore recupero stats:", error);
        res.status(500).json({ error: "Errore interno del server" });
    }
};

export async function patchSystemSettings(req: Request, res: Response) {
    const { key, value } = req.body; // es. key: "CPU_THRESHOLD", value: "90"

    try {
        const updatedSetting = await prisma.appConfig.update({
            where: { key: key },
            data: { value: String(value) }
        });
        res.status(200).json(updatedSetting);
    } catch (err) {
        res.status(500).json({ error: 'Impossibile aggiornare la soglia di sistema' });
    }
}

// Optional: endpoint to force a manual save of data
export const recordCurrentStats = async (req: Request, res: Response) => {
    try {
        const newRecord = await saveCurrentSystemStats();
        res.status(201).json(newRecord);
    } catch (error) {
        res.status(500).json({ error: "Impossibile salvare i dati" });
    }
};