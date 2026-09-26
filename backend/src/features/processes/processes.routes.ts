import { killProcessRequestSchema, pidParamsSchema, processListQuerySchema } from '@pc-monitor/shared';
import { Router } from 'express';
import { validate } from '../../core/validation/validate.js';
import { killProcessController, listProcessesController } from './processes.controller.js';

const processesRouter = Router();

// A POST without a body leaves req.body undefined; treat it as {}.
const killBody = killProcessRequestSchema.optional().transform((body) => body ?? {});

processesRouter.get('/', validate({ query: processListQuerySchema }), listProcessesController);
processesRouter.post('/:pid/kill', validate({ params: pidParamsSchema, body: killBody }), killProcessController);

export default processesRouter;
