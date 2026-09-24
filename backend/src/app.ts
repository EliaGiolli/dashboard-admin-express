import express from 'express';
import {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import { configRouter } from './features/config/index.js';
import { logsRouter } from './features/logs/index.js';
import { metricsRouter } from './features/metrics/index.js';
import { healthRouter } from './features/health/index.js';
import { AppError } from './core/errors/appError.js';
import { globalErrorHandler } from './core/errors/errorHandler.js';

const app = express();
app.use(express.json());

const api = express.Router();
api.use('/health', healthRouter);
api.use('/env', configRouter);
api.use('/system', metricsRouter);
api.use('/logs', logsRouter);
app.use('/api', api);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
});

app.use(globalErrorHandler);

export default app;
