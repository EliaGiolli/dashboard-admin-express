import { getSystemStats } from "../services/systemAdminService.js";
import { type Request, type Response } from "express";


export function handleSystemStats(req:Request, res:Response){
    const stats = getSystemStats();
    res.status(200).json(stats);
}