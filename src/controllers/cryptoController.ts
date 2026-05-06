import { CryptoService } from "../services/cryptoService.js";
import { type Request, type Response } from "express";

const cryptoService = new CryptoService(10);

export async function hashPasswordController(req:Request, res:Response){
    const { password } = req.body;

    if(!password) return res.status(400).json({error: 'unable to find the password'});

    try{
        const hashed = await cryptoService.hashPassword(password);

        res.status(200).json({hashed});
    }catch(err){
        res.status(400).json({error: 'unable to hash the password'});
    }
}

export async function comparePasswordController(req:Request, res:Response){
    const { password, hashed } = req.body;

    if(!password || !hashed) return res.status(400).json({error:'Password and hash are required'});

    const isMatch = await cryptoService.comparePassword(password, hashed);

    res.status(200).json({ match: isMatch });
}