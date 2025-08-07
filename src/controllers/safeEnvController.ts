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