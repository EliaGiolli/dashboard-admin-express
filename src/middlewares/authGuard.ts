import { type Request, type Response, type NextFunction } from "express";

export const adminGuard = (req: Request, res: Response, next: NextFunction) => {
    // Read the key from the header 'x-api-key'
    const apiKey = req.headers['x-api-key'];
    const secret = process.env.API_SEGRETO;

    if (!apiKey || apiKey !== secret) {
        return res.status(403).json({ 
            error: "Access Denied: Invalid or missing API Key" 
        });
    }

    next();
};