import express from 'express';
import {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import envRouter from './routes/safeEnvRoute.js';
import loggerRouter from './routes/loggerRoute.js';
import systemRouter from './routes/systemRoute.js';
import { healthRouter } from './features/health/index.js';
import { AppError } from './helpers/appError.js';
import { globalErrorHandler } from './middlewares/errorHandler.js';

const app = express();
app.use(express.json());

const api = express.Router();
api.use('/health', healthRouter);
api.use('/env', envRouter);
api.use('/system', systemRouter);
api.use('/logs', loggerRouter);
app.use('/api', api);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
});

app.use(globalErrorHandler);

export default app;
