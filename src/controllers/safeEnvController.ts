import { AppError } from "../helpers/appError.js";
import { prisma } from "../lib/prisma.js";
import { getSafeEnv } from "../services/getSafeEnv.js";
import { type Response, type Request, type NextFunction } from "express";

export async function getSafeEnvController(req:Request, res:Response, next:NextFunction){
    try{
        const safeEnv = await getSafeEnv();
        res.status(200).json(safeEnv);
    }catch(err){
        next(new AppError('Unable to retrieve the safe env variables', 500))
    }
}

export async function updateEnvController(req: Request, res: Response, next:NextFunction) {
    const { key } = req.params; // es. "THEME_COLOR"
    const { value } = req.body;   //The new color

    if (!key) {
        return next(new AppError('Missing configuration key', 400));
    }

    try {
        const updatedConfig = await prisma.appConfig.update({
            where: { key: key },
            data: { value: String(value) }
        });
        res.status(200).json(updatedConfig);
    } catch (err) {
        next(new AppError('Unable to update the configuration', 500));
    }
}