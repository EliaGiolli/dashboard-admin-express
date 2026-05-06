import { prisma } from "../lib/prisma.js";
import { getSafeEnv } from "../services/getSafeEnv.js";
import { type Response, type Request } from "express";

export async function getSafeEnvController(req:Request, res:Response){
    try{
        const safeEnv = await getSafeEnv();
        res.status(200).json(safeEnv);
    }catch(err){
        console.error('Unable to retrieve the safe env variables',err);
        res.status(500).json({error:'no env variables'});
    }
}

export async function updateEnvController(req: Request, res: Response) {
    const { key } = req.params; // es. "THEME_COLOR"
    const { value } = req.body;   //The new color

    if (!key) {
        return res.status(400).json({ error: "Missing configuration key" });
    }

    try {
        const updatedConfig = await prisma.appConfig.update({
            where: { key: key },
            data: { value: String(value) }
        });
        res.status(200).json(updatedConfig);
    } catch (err) {
        res.status(500).json({ error: 'Incapace di aggiornare la configurazione' });
    }
}