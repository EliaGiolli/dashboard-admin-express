import express from 'express';
import helmet from 'helmet';
import {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import { registerConfigDocs } from './features/config/index.js';
import { registerLogsDocs } from './features/logs/index.js';
import { registerMetricsDocs } from './features/metrics/index.js';
import { registerHealthDocs } from './features/health/index.js';
import { AppError } from './core/errors/appError.js';
import { globalErrorHandler } from './core/errors/errorHandler.js';
import { createDocsRouter, registry } from './core/openapi/index.js';
import { corsMiddleware } from './core/security/cors.js';
import { requireJsonContentType } from './core/security/requireJson.js';
import { routeMounts } from './routeMounts.js';

registerHealthDocs(registry);
registerConfigDocs(registry);
registerMetricsDocs(registry);
registerLogsDocs(registry);

const app = express();
app.use(helmet());
app.use(corsMiddleware);
app.use(requireJsonContentType);
app.use(express.json());

const api = express.Router();
for (const { prefix, router } of routeMounts) {
  api.use(prefix, router);
}
api.use(createDocsRouter());
app.use('/api', api);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
});

app.use(globalErrorHandler);

export default app;
