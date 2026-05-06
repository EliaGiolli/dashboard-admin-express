import { CryptoService } from "../services/cryptoService.js";
import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../helpers/appError.js";

const cryptoService = new CryptoService(10);

export async function hashPasswordController(req:Request, res:Response, next: NextFunction){
    const { password } = req.body;

    if(!password) return next(new AppError('Password is required', 400));

    try{
        const hashed = await cryptoService.hashPassword(password);

        res.status(200).json({hashed});
    }catch(err){
       next(new AppError('Hashing failed', 500));
    }
}

export async function comparePasswordController(req:Request, res:Response, next:NextFunction){
    const { password, hashed } = req.body;

    if(!password || !hashed) return next(new AppError('No password found. Insert a valid one', 400));

    const isMatch = await cryptoService.comparePassword(password, hashed);

    res.status(200).json({ match: isMatch });
}