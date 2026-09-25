import express from 'express';
import {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import { configRouter, registerConfigDocs } from './features/config/index.js';
import { logsRouter, registerLogsDocs } from './features/logs/index.js';
import { metricsRouter, registerMetricsDocs } from './features/metrics/index.js';
import { healthRouter, registerHealthDocs } from './features/health/index.js';
import { AppError } from './core/errors/appError.js';
import { globalErrorHandler } from './core/errors/errorHandler.js';
import { createDocsRouter, registry } from './core/openapi/index.js';

registerHealthDocs(registry);
registerConfigDocs(registry);
registerMetricsDocs(registry);
registerLogsDocs(registry);

const app = express();
app.use(express.json());

const api = express.Router();
api.use('/health', healthRouter);
api.use('/env', configRouter);
api.use('/system', metricsRouter);
api.use('/logs', logsRouter);
api.use(createDocsRouter());
app.use('/api', api);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
});

app.use(globalErrorHandler);

export default app;
