import { processListQuerySchema } from '@pc-monitor/shared';
import { Router } from 'express';
import { validate } from '../../core/validation/validate.js';
import { listProcessesController } from './processes.controller.js';

const processesRouter = Router();

processesRouter.get('/', validate({ query: processListQuerySchema }), listProcessesController);

export default processesRouter;
