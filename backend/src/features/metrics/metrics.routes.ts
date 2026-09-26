import { historyQuerySchema } from '@pc-monitor/shared';
import { Router } from 'express';
import { validate } from '../../core/validation/validate.js';
import { getHistoryController, recordSnapshotController } from './metrics.controller.js';

// Mounted at /api/metrics. Live data goes over the WebSocket (/ws); these routes cover
// the chart prefill and a manual, on-demand sample. Thresholds live in /api/config.
const metricsRouter = Router();

metricsRouter.get('/history', validate({ query: historyQuerySchema }), getHistoryController);
metricsRouter.post('/record', recordSnapshotController);

export default metricsRouter;
