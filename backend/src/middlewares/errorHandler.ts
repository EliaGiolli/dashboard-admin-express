import { type Request, type Response,type NextFunction } from 'express';

export const globalErrorHandler = ( err: any, req: Request, res: Response, next: NextFunction ) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    console.error(`[ERROR]: ${message}`);

    res.status(statusCode).json({
        status: 'error',
        message: message,
        // Shows the stack trace only in dev mode
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};