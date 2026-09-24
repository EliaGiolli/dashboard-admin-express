import express from 'express';
import {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import envRouter from './routes/safeEnvRoute.js';
import loggerRouter from './routes/loggerRoute.js';
import cryptoRouter from './routes/cryptoRoute.js';
import systemRouter from './routes/systemRoute.js';
import { AppError } from './helpers/appError.js';
import { globalErrorHandler } from './middlewares/errorHandler.js';

const app = express();
app.use(express.json());

// Define routes
app.use('/env', envRouter);
app.use('/system', systemRouter);
app.use('/crypto', cryptoRouter);
app.use('/logs', loggerRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
});

app.use(globalErrorHandler);

export default app;
